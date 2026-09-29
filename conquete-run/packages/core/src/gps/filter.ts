import { LocalProjection, haversineM } from '../geo/geodesy.ts';
import {
  type AxisState,
  type AxisStep,
  type ScalarState,
  initAxis,
  predictAxis,
  rtsSmooth,
  scalarStep,
  updateAxis,
} from './kalman.ts';
import {
  DEFAULT_GPS_CONFIG,
  type FilteredPoint,
  type GpsPipelineConfig,
  type PointRejection,
  type RawPoint,
} from './types.ts';

/** Précision supposée quand elle est absente (ex. GPX de montre). */
const DEFAULT_ACCURACY_M = 8;
const ACC_HISTORY = 20;

export interface PushResult {
  accepted: FilteredPoint | null;
  rejection: PointRejection | null;
}

interface Pending {
  raw: RawPoint;
  acc: number;
}

interface HistoryEntry {
  x: AxisStep;
  y: AxisStep;
  t: number;
  alt: number | null;
  afterGap: boolean;
}

/**
 * Moteur de filtrage incrémental : c'est LA chaîne unique, utilisée
 * - en direct par l'app (point par point, premier plan comme arrière-plan),
 * - par le serveur (en lot, avec lissage arrière RTS en plus).
 */
export class GpsFilterEngine {
  private proj: LocalProjection | null = null;
  private x: AxisState | null = null;
  private y: AxisState | null = null;
  private alt: ScalarState | null = null;
  private lastT = -Infinity;
  private lastFilterT = -Infinity;
  private lastAccepted: FilteredPoint | null = null;
  private readonly accHistory: number[] = [];
  private pending: Pending[] = [];
  private readonly history: HistoryEntry[] | null;
  readonly stats: Record<PointRejection | 'accepted' | 'total', number> = {
    total: 0,
    accepted: 0,
    mocked: 0,
    time: 0,
    accuracy: 0,
    jump: 0,
    duplicate: 0,
    invalid: 0,
  };

  constructor(
    readonly cfg: GpsPipelineConfig = DEFAULT_GPS_CONFIG,
    opts: { keepHistory?: boolean } = {},
  ) {
    this.history = opts.keepHistory ? [] : null;
  }

  /** Seuil de précision adaptatif courant (m). */
  accuracyThreshold(): number {
    if (this.accHistory.length < 5) return this.cfg.baseAccuracyM;
    const sorted = [...this.accHistory].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    return Math.min(
      this.cfg.maxAccuracyM,
      Math.max(this.cfg.baseAccuracyM, Math.min(this.cfg.adaptiveAccuracyMaxM, 1.5 * median)),
    );
  }

  push(raw: RawPoint): PushResult {
    this.stats.total++;
    const r = this.evaluate(raw);
    if (r.rejection) this.stats[r.rejection]++;
    else this.stats.accepted++;
    return r;
  }

  private reject(rejection: PointRejection): PushResult {
    return { accepted: null, rejection };
  }

  private evaluate(raw: RawPoint): PushResult {
    if (
      !Number.isFinite(raw.t) ||
      !Number.isFinite(raw.lat) ||
      !Number.isFinite(raw.lng) ||
      Math.abs(raw.lat) > 90 ||
      Math.abs(raw.lng) > 180 ||
      (raw.lat === 0 && raw.lng === 0)
    ) {
      return this.reject('invalid');
    }
    if (raw.mocked) return this.reject('mocked');
    if (raw.t < this.lastT) return this.reject('time');
    if (raw.t === this.lastT) return this.reject('duplicate');
    this.lastT = raw.t;

    const acc = raw.acc != null && raw.acc > 0 ? raw.acc : DEFAULT_ACCURACY_M;
    this.accHistory.push(acc);
    if (this.accHistory.length > ACC_HISTORY) this.accHistory.shift();
    if (acc > this.accuracyThreshold()) return this.reject('accuracy');

    if (!this.proj || !this.x || !this.y || !this.lastAccepted) {
      return { accepted: this.reset(raw, acc, false), rejection: null };
    }

    const dt = (raw.t - this.lastFilterT) / 1000;
    const distFromLast = haversineM(this.lastAccepted, raw);
    const plausible = (d: number, dtS: number, accA: number, accB: number): boolean =>
      d - 2 * (accA + accB) <= this.cfg.maxRunnerSpeedMps * Math.max(dtS, 1);

    if (dt > this.cfg.gapS) {
      // Coupure : on ne lisse pas à travers ; on repart si le saut est physiquement possible.
      if (plausible(distFromLast, dt, acc, this.lastAccepted.sigma)) {
        this.pending = [];
        return { accepted: this.reset(raw, acc, true), rejection: null };
      }
      return this.handleJump(raw, acc);
    }

    const { x: mx, y: my } = this.proj.toXY(raw);
    const q = this.cfg.processNoise;
    const px = predictAxis(this.x, dt, q);
    const py = predictAxis(this.y, dt, q);
    const rVar = (acc * this.cfg.accuracyToSigma) ** 2;
    const innov2 = ((mx - px.p) ** 2) / (px.a + rVar) + ((my - py.p) ** 2) / (py.a + rVar);
    const speedOk = plausible(distFromLast, dt, acc, this.lastAccepted.sigma);
    // Porte de Mahalanobis à 5σ (2 degrés de liberté) + contrôle de vitesse physique.
    if (!speedOk || innov2 > 2 * 25) return this.handleJump(raw, acc);

    this.pending = [];
    const ux = updateAxis(px, mx, rVar);
    const uy = updateAxis(py, my, rVar);
    this.x = ux;
    this.y = uy;
    this.lastFilterT = raw.t;
    const altitude = this.updateAltitude(raw, acc, dt);
    const fp = this.toFiltered(raw.t, altitude, false);
    this.history?.push({
      x: { filtered: ux, predicted: px, dt },
      y: { filtered: uy, predicted: py, dt },
      t: raw.t,
      alt: altitude,
      afterGap: false,
    });
    this.lastAccepted = fp;
    return { accepted: fp, rejection: null };
  }

  /**
   * Point incohérent avec la trajectoire : rejeté. Si plusieurs rejets consécutifs sont
   * cohérents entre eux, c'est le filtre qui s'était trompé (ex. premier point faux) : on
   * réancre sur le dernier.
   */
  private handleJump(raw: RawPoint, acc: number): PushResult {
    const prev = this.pending[this.pending.length - 1];
    if (prev) {
      const d = haversineM(prev.raw, raw);
      const dt = (raw.t - prev.raw.t) / 1000;
      if (d - 2 * (prev.acc + acc) > this.cfg.maxRunnerSpeedMps * Math.max(dt, 1)) this.pending = [];
    }
    this.pending.push({ raw, acc });
    if (this.pending.length >= this.cfg.reanchorAfter) {
      this.pending = [];
      return { accepted: this.reset(raw, acc, true), rejection: null };
    }
    return this.reject('jump');
  }

  private reset(raw: RawPoint, acc: number, afterGap: boolean): FilteredPoint {
    if (!this.proj) this.proj = new LocalProjection(raw);
    const { x, y } = this.proj.toXY(raw);
    const posVar = (acc * this.cfg.accuracyToSigma) ** 2;
    this.x = initAxis(x, posVar);
    this.y = initAxis(y, posVar);
    this.lastFilterT = raw.t;
    const altitude = this.updateAltitude(raw, acc, 0, true);
    const fp = this.toFiltered(raw.t, altitude, afterGap);
    this.history?.push({
      x: { filtered: this.x, predicted: this.x, dt: 0 },
      y: { filtered: this.y, predicted: this.y, dt: 0 },
      t: raw.t,
      alt: altitude,
      afterGap,
    });
    this.lastAccepted = fp;
    return fp;
  }

  private updateAltitude(raw: RawPoint, acc: number, dt: number, reset = false): number | null {
    if (raw.alt == null || !Number.isFinite(raw.alt)) return this.alt?.x ?? null;
    const sigma = raw.altAcc != null && raw.altAcc > 0 ? raw.altAcc : acc * 1.5;
    const r = sigma * sigma;
    if (reset && this.alt && Math.abs(raw.alt - this.alt.x) > 3 * sigma) this.alt = null;
    if (this.alt && Math.abs(raw.alt - this.alt.x) > 60 + 5 * sigma) return this.alt.x; // aberrant
    // marche aléatoire : ~0,5 m/s vertical max en trail ⇒ q ≈ 0,25 m²/s
    this.alt = scalarStep(this.alt, raw.alt, r, 0.25, Math.max(dt, 0.001));
    return this.alt.x;
  }

  private toFiltered(t: number, alt: number | null, afterGap: boolean): FilteredPoint {
    const x = this.x!;
    const y = this.y!;
    const ll = this.proj!.toLatLng(x.p, y.p);
    return {
      t,
      lat: ll.lat,
      lng: ll.lng,
      sigma: Math.sqrt(Math.max(x.a, y.a)),
      speed: Math.hypot(x.v, y.v),
      alt,
      afterGap,
    };
  }

  /** Nombre de points non rejetés sur le total. */
  rejectedRatio(): number {
    return this.stats.total === 0 ? 0 : 1 - this.stats.accepted / this.stats.total;
  }

  /** Nombre d'étapes mémorisées (mode keepHistory). */
  historyLength(): number {
    return this.history?.length ?? 0;
  }

  /** Vrai si l'étape i ouvre un nouveau segment (après coupure ou réancrage). */
  isSegmentStart(i: number): boolean {
    return this.history?.[i]?.afterGap ?? false;
  }

  /**
   * Lissage RTS des étapes [from, to] (incluses), supposées dans un même segment.
   * Utilisé en lot (serveur) et en « retard fixe » (app : on lisse les ~10 dernières s).
   */
  smoothRange(from: number, to: number): FilteredPoint[] {
    if (!this.history || !this.proj) throw new Error('keepHistory requis');
    const seg = this.history.slice(from, to + 1);
    const sx = rtsSmooth(seg.map((e) => e.x));
    const sy = rtsSmooth(seg.map((e) => e.y));
    const out: FilteredPoint[] = [];
    for (let k = 0; k < seg.length; k++) {
      const ll = this.proj.toLatLng(sx[k]!.p, sy[k]!.p);
      out.push({
        t: seg[k]!.t,
        lat: ll.lat,
        lng: ll.lng,
        sigma: Math.sqrt(Math.max(sx[k]!.a, sy[k]!.a)),
        speed: Math.hypot(sx[k]!.v, sy[k]!.v),
        alt: seg[k]!.alt,
        afterGap: seg[k]!.afterGap,
      });
    }
    return out;
  }

  /**
   * Trace lissée (avant + arrière) : n'est disponible qu'avec keepHistory. Le lissage est
   * fait segment par segment (pas à travers les coupures).
   */
  smoothed(): FilteredPoint[] {
    const n = this.historyLength();
    const out: FilteredPoint[] = [];
    let start = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || this.isSegmentStart(i)) {
        out.push(...this.smoothRange(start, i - 1));
        start = i;
      }
    }
    return out;
  }
}

/** Filtre une trace complète (usage serveur / tests). */
export function filterTrack(
  raw: readonly RawPoint[],
  cfg: GpsPipelineConfig = DEFAULT_GPS_CONFIG,
  opts: { smooth?: boolean } = {},
): { points: FilteredPoint[]; engine: GpsFilterEngine } {
  const smooth = opts.smooth ?? true;
  const engine = new GpsFilterEngine(cfg, { keepHistory: smooth });
  const forward: FilteredPoint[] = [];
  for (const p of raw) {
    const r = engine.push(p);
    if (r.accepted) forward.push(r.accepted);
  }
  return { points: smooth ? engine.smoothed() : forward, engine };
}
