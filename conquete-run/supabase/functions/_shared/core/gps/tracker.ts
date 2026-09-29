import { haversineM } from '../geo/geodesy.ts';
import { GpsFilterEngine } from './filter.ts';
import { DistanceAccumulator, HysteresisClimb, PaceWindow } from './metrics.ts';
import { DEFAULT_GPS_CONFIG, type FilteredPoint, type GpsPipelineConfig, type RawPoint } from './types.ts';

export interface LiveSnapshot {
  startedAt: number | null;
  lastT: number | null;
  elapsedMs: number;
  movingMs: number;
  distanceM: number;
  paceSecPerKm: number | null;
  avgPaceSecPerKm: number | null;
  altitudeM: number | null;
  /** estimation live (le D+ officiel est recalculé par le serveur) */
  dplusM: number;
  accuracyM: number | null;
  rawCount: number;
  acceptedCount: number;
  rejectedRatio: number;
  /** dernière position filtrée (temps réel, non retardée) */
  last: FilteredPoint | null;
}

const MOVING_SPEED_MPS = 0.8;

/**
 * Suivi d'une course en direct. Alimenté point par point par la tâche de localisation
 * (via la persistance SQLite) ou par le mode simulation. Rejouer les mêmes points
 * redonne exactement le même état : c'est ce qui permet de reprendre après que l'app
 * a été tuée.
 *
 * Distance : filtre de Kalman avant + lisseur RTS à retard fixe (≈ 10 s). La distance
 * « validée » porte sur les points lissés ; on y ajoute une part provisoire entre le
 * dernier point lissé et la position courante, pour un affichage sans retard.
 */
export class LiveTracker {
  private readonly engine: GpsFilterEngine;
  private readonly distance: DistanceAccumulator;
  private readonly pace: PaceWindow;
  private readonly climb: HysteresisClimb;
  private startedAt: number | null = null;
  private lastT: number | null = null;
  private lastCommitted: FilteredPoint | null = null;
  private committedIdx = 0;
  private segStart = 0;
  private movingMs = 0;
  private lastAccuracy: number | null = null;
  private lastPoint: FilteredPoint | null = null;
  private readonly listeners = new Set<(p: FilteredPoint) => void>();

  readonly cfg: GpsPipelineConfig;

  constructor(cfg: GpsPipelineConfig = DEFAULT_GPS_CONFIG) {
    this.cfg = cfg;
    this.engine = new GpsFilterEngine(cfg, { keepHistory: true });
    this.distance = new DistanceAccumulator(cfg);
    this.pace = new PaceWindow(cfg.paceWindowS);
    this.climb = new HysteresisClimb(cfg.liveDplusHysteresisM);
  }

  /** Abonnement aux points retenus, en temps réel (ex. allumage des cases traversées). */
  onPoint(fn: (p: FilteredPoint) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  push(raw: RawPoint): FilteredPoint | null {
    if (this.startedAt == null) this.startedAt = raw.t;
    this.lastT = Math.max(this.lastT ?? raw.t, raw.t);
    this.lastAccuracy = raw.acc;
    const { accepted } = this.engine.push(raw);
    if (!accepted) return null;
    const n = this.engine.historyLength();
    if (accepted.afterGap) {
      // coupure : on valide tout le segment précédent, lissé complètement
      this.commitRange(this.committedIdx, n - 2, this.segStart);
      this.segStart = n - 1;
      this.committedIdx = n - 1;
    }
    const lag = this.cfg.liveSmoothingLag;
    while (n - 1 - this.committedIdx >= lag) {
      const from = Math.max(this.committedIdx, this.segStart);
      const smoothed = this.engine.smoothRange(from, n - 1);
      this.commit(smoothed[this.committedIdx - from]!);
      this.committedIdx++;
    }
    this.climb.add(accepted.alt);
    this.lastPoint = accepted;
    for (const l of this.listeners) l(accepted);
    return accepted;
  }

  /** Fin de course : valide les derniers points (lissage complet). */
  finish(): LiveSnapshot {
    this.commitRange(this.committedIdx, this.engine.historyLength() - 1, this.segStart);
    this.committedIdx = this.engine.historyLength();
    return this.snapshot();
  }

  private commitRange(from: number, to: number, segStart: number): void {
    if (to < from) return;
    const base = Math.max(segStart, 0);
    const smoothed = this.engine.smoothRange(base, to);
    for (let i = from; i <= to; i++) this.commit(smoothed[i - base]!);
  }

  private commit(p: FilteredPoint): void {
    const prev = this.lastCommitted;
    this.distance.add(p);
    this.pace.add(p.t, this.distance.totalM);
    if (prev && !p.afterGap && p.speed >= MOVING_SPEED_MPS) this.movingMs += p.t - prev.t;
    this.lastCommitted = p;
  }

  private provisionalM(): number {
    const a = this.lastCommitted;
    const b = this.lastPoint;
    if (!a || !b || b.t <= a.t) return 0;
    const d = haversineM(a, b);
    return d > Math.max(this.cfg.minStepM, this.cfg.marginSigmaK * b.sigma) ? d : 0;
  }

  snapshot(now?: number): LiveSnapshot {
    const elapsedMs = this.startedAt == null ? 0 : Math.max(0, (now ?? this.lastT ?? 0) - this.startedAt);
    const dist = this.distance.totalM + this.provisionalM();
    return {
      startedAt: this.startedAt,
      lastT: this.lastT,
      elapsedMs,
      movingMs: this.movingMs,
      distanceM: dist,
      paceSecPerKm: this.pace.paceSecPerKm(),
      avgPaceSecPerKm: dist > 50 ? (elapsedMs / 1000 / dist) * 1000 : null,
      altitudeM: this.lastPoint?.alt ?? null,
      dplusM: this.climb.gainM,
      accuracyM: this.lastAccuracy,
      rawCount: this.engine.stats.total,
      acceptedCount: this.engine.stats.accepted,
      rejectedRatio: this.engine.rejectedRatio(),
      last: this.lastPoint,
    };
  }
}

export type GpsReadinessState = 'searching' | 'weak' | 'ready';

export interface GpsReadiness {
  state: GpsReadinessState;
  accuracyM: number | null;
  /** vrai si l'utilisateur peut démarrer (prêt, ou « faible » après l'attente maximale) */
  canStart: boolean;
}

/**
 * Évalue si le signal est assez bon pour démarrer : 3 points consécutifs récents à ≤ 15 m,
 * ou ≤ 25 m après 45 s d'attente (démarrage possible avec avertissement).
 */
export function evaluateReadiness(
  recent: readonly RawPoint[],
  waitingSinceMs: number,
  now: number,
): GpsReadiness {
  const fresh = recent.filter((p) => now - p.t < 10_000 && !p.mocked);
  const last = fresh[fresh.length - 1];
  if (!last) return { state: 'searching', accuracyM: null, canStart: false };
  const acc = last.acc;
  const last3 = fresh.slice(-3);
  const allBelow = (m: number): boolean =>
    last3.length === 3 && last3.every((p) => p.acc != null && p.acc <= m);
  if (allBelow(15)) return { state: 'ready', accuracyM: acc, canStart: true };
  const waitedS = (now - waitingSinceMs) / 1000;
  if (allBelow(25) && waitedS >= 45) return { state: 'weak', accuracyM: acc, canStart: true };
  return { state: acc != null && acc <= 25 ? 'weak' : 'searching', accuracyM: acc, canStart: false };
}
