import { haversineM } from '../geo/geodesy.ts';
import type { FilteredPoint, RawPoint } from './types.ts';

export interface AntiCheatConfig {
  vehicleSpeedKmh: number;
  vehicleWindowS: number;
  maxAccelerationMps2: number;
  /** nombre d'accélérations impossibles au-delà duquel la course est signalée */
  maxAccelerationEvents: number;
  maxRejectedRatio: number;
  maxDurationH: number;
  maxUploadDelayDays: number;
  maxFutureSkewS: number;
  minPoints: number;
  maxPoints: number;
  /** distance minimale d'une course comptée (m) */
  minDistanceM: number;
  maxRunnerSpeedMps: number;
  /** au-delà : téléportation (saut plausible pour personne) */
  teleportMinM: number;
  allowSimulatedRuns: boolean;
  rawTraceRetentionDays: number;
}

export const DEFAULT_ANTI_CHEAT: AntiCheatConfig = {
  vehicleSpeedKmh: 20,
  vehicleWindowS: 180,
  maxAccelerationMps2: 6,
  maxAccelerationEvents: 20,
  maxRejectedRatio: 0.4,
  maxDurationH: 12,
  maxUploadDelayDays: 7,
  maxFutureSkewS: 300,
  minPoints: 30,
  maxPoints: 60_000,
  minDistanceM: 300,
  maxRunnerSpeedMps: 9,
  teleportMinM: 300,
  allowSimulatedRuns: false,
  rawTraceRetentionDays: 90,
};

export type RunSource = 'gps' | 'simulation' | 'healthkit' | 'health_connect';

export type RejectionCode =
  | 'too_few_points'
  | 'too_many_points'
  | 'non_monotonic'
  | 'too_long'
  | 'too_old'
  | 'future'
  | 'mocked'
  | 'simulated'
  | 'vehicle'
  | 'poor_signal'
  | 'teleport'
  | 'too_short'
  | 'duplicate';

export interface Rejection {
  code: RejectionCode;
  /** détails lisibles par le joueur (horaires, vitesses…) */
  details: Record<string, string | number>;
}

/** Contrôles sur la trace brute, avant tout filtrage. */
export function validateRawTrace(
  raw: readonly RawPoint[],
  ctx: { now: number; source: RunSource; cfg?: AntiCheatConfig },
): Rejection | null {
  const cfg = ctx.cfg ?? DEFAULT_ANTI_CHEAT;
  if (ctx.source === 'simulation' && !cfg.allowSimulatedRuns) return { code: 'simulated', details: {} };
  if (raw.length < cfg.minPoints) return { code: 'too_few_points', details: { points: raw.length } };
  if (raw.length > cfg.maxPoints) return { code: 'too_many_points', details: { points: raw.length } };
  const mocked = raw.filter((p) => p.mocked).length;
  if (mocked > 0 && ctx.source !== 'simulation') return { code: 'mocked', details: { points: mocked } };
  let backwards = 0;
  for (let i = 1; i < raw.length; i++) if (raw[i]!.t < raw[i - 1]!.t) backwards++;
  if (backwards > raw.length * 0.01) return { code: 'non_monotonic', details: { points: backwards } };
  const first = Math.min(...raw.map((p) => p.t));
  const last = Math.max(...raw.map((p) => p.t));
  if ((last - first) / 3_600_000 > cfg.maxDurationH) {
    return { code: 'too_long', details: { hours: Math.round((last - first) / 360_000) / 10 } };
  }
  if (last > ctx.now + cfg.maxFutureSkewS * 1000) return { code: 'future', details: {} };
  if (ctx.now - last > cfg.maxUploadDelayDays * 86_400_000) {
    return { code: 'too_old', details: { days: Math.floor((ctx.now - last) / 86_400_000) } };
  }
  return null;
}

export interface VehicleDetection {
  detected: boolean;
  maxWindowSpeedKmh: number;
  from: number | null;
  to: number | null;
}

/** Vitesse moyenne maximale sur une fenêtre glissante (distance le long de la trace). */
export function detectVehicle(points: readonly FilteredPoint[], cfg: AntiCheatConfig = DEFAULT_ANTI_CHEAT): VehicleDetection {
  const cum: number[] = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + haversineM(points[i - 1]!, points[i]!));
  let best = 0;
  let bestFrom: number | null = null;
  let bestTo: number | null = null;
  const windowMs = cfg.vehicleWindowS * 1000;
  let j = 0;
  for (let i = 0; i < points.length; i++) {
    if (j < i) j = i;
    while (j < points.length - 1 && points[j]!.t - points[i]!.t < windowMs) j++;
    const dt = (points[j]!.t - points[i]!.t) / 1000;
    if (dt < cfg.vehicleWindowS * 0.9) break;
    const kmh = ((cum[j]! - cum[i]!) / dt) * 3.6;
    if (kmh > best) {
      best = kmh;
      bestFrom = points[i]!.t;
      bestTo = points[j]!.t;
    }
  }
  return { detected: best > cfg.vehicleSpeedKmh, maxWindowSpeedKmh: best, from: bestFrom, to: bestTo };
}

/** Nombre d'accélérations physiquement impossibles pour un coureur (sur trace lissée). */
export function countImpossibleAccelerations(
  points: readonly FilteredPoint[],
  cfg: AntiCheatConfig = DEFAULT_ANTI_CHEAT,
): number {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (b.afterGap) continue;
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) continue;
    if (Math.abs(b.speed - a.speed) / dt > cfg.maxAccelerationMps2) n++;
  }
  return n;
}

/** Sauts impossibles à travers les coupures (ex. position qui « saute » de plusieurs km). */
export function detectTeleport(
  points: readonly FilteredPoint[],
  cfg: AntiCheatConfig = DEFAULT_ANTI_CHEAT,
): { detected: boolean; distanceM: number; at: number | null } {
  for (let i = 1; i < points.length; i++) {
    const b = points[i]!;
    if (!b.afterGap) continue;
    const a = points[i - 1]!;
    const d = haversineM(a, b);
    const dt = Math.max(1, (b.t - a.t) / 1000);
    if (d > cfg.teleportMinM && d / dt > cfg.maxRunnerSpeedMps) return { detected: true, distanceM: d, at: b.t };
  }
  return { detected: false, distanceM: 0, at: null };
}

/** Empreinte stable d'une trace (détection des doublons / rejeux). */
export function traceFingerprint(raw: readonly RawPoint[]): string {
  // FNV-1a 32 bits sur un échantillon des points arrondis (~1 m, 1 s)
  let h = 0x811c9dc5;
  const step = Math.max(1, Math.floor(raw.length / 200));
  for (let i = 0; i < raw.length; i += step) {
    const p = raw[i]!;
    const s = `${Math.round(p.t / 1000)}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)};`;
    for (let k = 0; k < s.length; k++) {
      h ^= s.charCodeAt(k);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return `${raw.length}-${h.toString(16).padStart(8, '0')}`;
}
