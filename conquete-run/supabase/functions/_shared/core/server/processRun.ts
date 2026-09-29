import type { GameConfig } from '../game/config.ts';
import { runXp } from '../game/progression.ts';
import { computeTroops, type TroopsResult } from '../game/troops.ts';
import { cellCenter, crossedCells, regionOf, zoneOf } from '../geo/h3.ts';
import type { LatLng } from '../geo/geodesy.ts';
import {
  COARSE_DEM_CLIMB,
  computeDemClimb,
  DEFAULT_DEM_CLIMB,
  type DemProvider,
  gpsFallbackClimb,
} from '../gps/dem.ts';
import { filterTrack } from '../gps/filter.ts';
import { DistanceAccumulator } from '../gps/metrics.ts';
import type { RawPoint } from '../gps/types.ts';
import {
  countImpossibleAccelerations,
  detectTeleport,
  detectVehicle,
  looksSynthetic,
  type Rejection,
  type RunSource,
  traceFingerprint,
  validateRawTrace,
} from '../gps/validation.ts';

export interface ProcessRunInput {
  raw: readonly RawPoint[];
  source: RunSource;
  now: number;
  cfg: GameConfig;
  /** fournisseurs de MNT, du plus précis au plus grossier ; null = pas de réseau */
  dem: readonly DemProvider[] | null;
  /** déjà compté aujourd'hui pour ce joueur (plafonds journaliers) */
  alreadyToday: { km: number; dplusM: number };
}

export interface ProcessedCell {
  cell: string;
  region: string;
  zone: string;
  meters: number;
  elevationM: number | null;
}

export interface RunMetrics {
  startedAt: number;
  endedAt: number;
  durationS: number;
  movingS: number;
  distanceM: number;
  dplusM: number;
  dplusSource: string;
  avgPaceSecPerKm: number | null;
  rawPoints: number;
  rejectedRatio: number;
  fingerprint: string;
}

export type ProcessRunResult =
  | { status: 'rejected'; rejection: Rejection; metrics: Partial<RunMetrics> }
  | {
      status: 'validated';
      metrics: RunMetrics;
      cells: ProcessedCell[];
      troops: TroopsResult;
      xp: number;
      /** anomalies non bloquantes, pour modération */
      flags: string[];
    };

/** Essaie chaque MNT couvrant la trace, du plus précis au plus grossier. */
async function demClimb(
  track: readonly LatLng[],
  centers: readonly LatLng[],
  providers: readonly DemProvider[],
): Promise<{ dplusM: number; source: string; cellElevations: (number | null)[]; errors: string[] } | null> {
  const errors: string[] = [];
  for (const provider of providers) {
    if (!track.every((p) => provider.covers(p))) continue;
    try {
      const climb = await computeDemClimb(track, provider, provider.resolution === 'fine' ? DEFAULT_DEM_CLIMB : COARSE_DEM_CLIMB);
      let cellElevations: (number | null)[] = centers.map(() => null);
      try {
        cellElevations = centers.length > 0 ? await provider.elevations(centers) : [];
      } catch (e) {
        errors.push(`${provider.name} cells: ${(e as Error).message}`);
      }
      return { dplusM: climb.dplusM, source: provider.name, cellElevations, errors };
    } catch (e) {
      errors.push(`${provider.name}: ${(e as Error).message}`);
    }
  }
  return null;
}

const hhmm = (t: number): string => new Date(t).toISOString().slice(11, 16);

/**
 * Traitement serveur complet d'une course. Le serveur ne fait jamais confiance au client :
 * il repart de la trace brute et recalcule tout.
 */
export async function processRun(input: ProcessRunInput): Promise<ProcessRunResult> {
  const { cfg } = input;
  const ac = cfg.antiCheat;
  const pre = validateRawTrace(input.raw, { now: input.now, source: input.source, cfg: ac });
  const fingerprint = traceFingerprint(input.raw);
  if (pre) return { status: 'rejected', rejection: pre, metrics: { fingerprint, rawPoints: input.raw.length } };

  const raw = [...input.raw].sort((a, b) => a.t - b.t);
  const { points, engine } = filterTrack(raw, cfg.gps, { smooth: true });
  const startedAt = raw[0]!.t;
  const endedAt = raw[raw.length - 1]!.t;
  const base: Partial<RunMetrics> = {
    startedAt,
    endedAt,
    durationS: Math.round((endedAt - startedAt) / 1000),
    rawPoints: raw.length,
    rejectedRatio: engine.rejectedRatio(),
    fingerprint,
  };
  const reject = (rejection: Rejection): ProcessRunResult => ({ status: 'rejected', rejection, metrics: base });

  if (engine.rejectedRatio() > ac.maxRejectedRatio || points.length < ac.minPoints) {
    return reject({ code: 'poor_signal', details: { rejectedPercent: Math.round(engine.rejectedRatio() * 100) } });
  }
  const vehicle = detectVehicle(points, ac);
  if (vehicle.detected) {
    return reject({
      code: 'vehicle',
      details: {
        speedKmh: Math.round(vehicle.maxWindowSpeedKmh * 10) / 10,
        from: hhmm(vehicle.from!),
        to: hhmm(vehicle.to!),
      },
    });
  }
  const teleport = detectTeleport(points, ac);
  if (teleport.detected) {
    return reject({ code: 'teleport', details: { distanceM: Math.round(teleport.distanceM), at: hhmm(teleport.at!) } });
  }

  const acc = new DistanceAccumulator(cfg.gps);
  let movingMs = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    acc.add(p);
    if (i > 0 && !p.afterGap && p.speed >= 0.8) movingMs += p.t - points[i - 1]!.t;
  }
  const distanceM = acc.totalM;
  if (distanceM < ac.minDistanceM) return reject({ code: 'too_short', details: { distanceM: Math.round(distanceM) } });

  const flags: string[] = [];
  const accelerations = countImpossibleAccelerations(points, ac);
  if (accelerations > ac.maxAccelerationEvents) flags.push(`accelerations:${accelerations}`);
  if (acc.gapBridgedM > distanceM * 0.2) flags.push(`gaps:${Math.round(acc.gapBridgedM)}m`);
  if (input.source !== 'simulation' && looksSynthetic(raw)) flags.push('synthetic');

  // D+ par modèle numérique de terrain (jamais l'altitude GPS brute)
  let dplusM: number;
  let dplusSource: string;
  const cells = crossedCells(points, cfg.h3.territoryRes, cfg.territory.minMetersInCell);
  let cellElevations: (number | null)[] = cells.map(() => null);
  const dem = await demClimb(points, cells.map((c) => cellCenter(c.cell)), input.dem ?? []);
  if (dem) {
    dplusM = dem.dplusM;
    dplusSource = dem.source;
    cellElevations = dem.cellElevations;
    flags.push(...dem.errors.map((e) => `dem:${e}`));
  } else {
    dplusM = gpsFallbackClimb(points, distanceM);
    dplusSource = 'gps';
    if (input.dem && input.dem.length > 0) flags.push('dem_unavailable');
  }

  const troops = computeTroops({ distanceM, dplusM }, input.alreadyToday, cfg.troops);
  const movingS = Math.round(movingMs / 1000);
  const xp = runXp({ distanceM: troops.countedKm * 1000, dplusM: troops.countedDplusM, movingS }, cfg.xp);
  return {
    status: 'validated',
    metrics: {
      startedAt,
      endedAt,
      durationS: base.durationS!,
      movingS,
      distanceM: Math.round(distanceM),
      dplusM: Math.round(dplusM),
      dplusSource,
      avgPaceSecPerKm: distanceM > 0 ? Math.round(((endedAt - startedAt) / distanceM) * 1000) / 1000 : null,
      rawPoints: raw.length,
      rejectedRatio: Math.round(engine.rejectedRatio() * 1000) / 1000,
      fingerprint,
    },
    cells: cells.map((c, i) => ({
      cell: c.cell,
      region: regionOf(c.cell, cfg.h3),
      zone: zoneOf(c.cell, cfg.h3),
      meters: Math.round(c.meters),
      elevationM: cellElevations[i] ?? null,
    })),
    troops,
    xp,
    flags,
  };
}
