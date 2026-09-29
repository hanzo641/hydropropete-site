import { haversineM } from '../geo/geodesy.ts';
import { DEFAULT_GPS_CONFIG, type FilteredPoint, type GpsPipelineConfig } from './types.ts';

/**
 * Cumul de distance « à marge d'erreur » : on n'ajoute un déplacement que lorsqu'il dépasse
 * l'incertitude du filtre. À l'arrêt (feu rouge), le tremblement résiduel n'est pas compté.
 */
export class DistanceAccumulator {
  private anchor: FilteredPoint | null = null;
  private last: FilteredPoint | null = null;
  totalM = 0;
  /** distance comptée en ligne droite à travers des coupures de signal */
  gapBridgedM = 0;

  private readonly cfg: GpsPipelineConfig;

  constructor(cfg: GpsPipelineConfig = DEFAULT_GPS_CONFIG) {
    this.cfg = cfg;
  }

  add(p: FilteredPoint): number {
    const before = this.totalM;
    if (!this.anchor || !this.last) {
      this.anchor = p;
      this.last = p;
      return 0;
    }
    if (p.afterGap) {
      // Coupure (tunnel, poche…) : la ligne droite sous-estime si le chemin tourne. On
      // l'allonge selon la vitesse d'avant la coupure, dans la limite de +30 % (un chemin
      // serpente rarement plus), et seulement si le saut est physiquement plausible.
      const chord = haversineM(this.last, p);
      const dt = Math.max(1, (p.t - this.last.t) / 1000);
      if (chord / dt <= this.cfg.maxRunnerSpeedMps) {
        const bridged = Math.min(Math.max(chord, this.last.speed * dt), chord * 1.3);
        this.totalM += haversineM(this.anchor, this.last) + bridged;
        this.gapBridgedM += bridged;
      }
      this.anchor = p;
      this.last = p;
      return this.totalM - before;
    }
    if (p.speed < this.cfg.stationarySpeedMps) {
      this.last = p;
      return 0;
    }
    const d = haversineM(this.anchor, p);
    const threshold = Math.max(this.cfg.minStepM, this.cfg.marginSigmaK * p.sigma);
    if (d >= threshold) {
      this.totalM += d;
      this.anchor = p;
    }
    this.last = p;
    return this.totalM - before;
  }
}

/** Allure sur fenêtre glissante (s/km), null à l'arrêt. */
export class PaceWindow {
  private readonly samples: { t: number; d: number }[] = [];

  private readonly windowS: number;

  constructor(windowS: number = DEFAULT_GPS_CONFIG.paceWindowS) {
    this.windowS = windowS;
  }

  add(t: number, totalDistM: number): void {
    this.samples.push({ t, d: totalDistM });
    const limit = t - this.windowS * 1000 * 2;
    while (this.samples.length > 2 && this.samples[0]!.t < limit) this.samples.shift();
  }

  /** Allure en secondes par km, ou null si déplacement insuffisant sur la fenêtre. */
  paceSecPerKm(now?: number): number | null {
    const last = this.samples[this.samples.length - 1];
    if (!last) return null;
    const tNow = now ?? last.t;
    const from = tNow - this.windowS * 1000;
    let first = this.samples[0]!;
    for (const s of this.samples) {
      if (s.t >= from) {
        first = s;
        break;
      }
    }
    const dd = last.d - first.d;
    const dtS = (tNow - first.t) / 1000;
    if (dtS < this.windowS * 0.5 || dd < 15) return null;
    return (dtS / dd) * 1000;
  }
}

/** D+ / D- avec seuil d'hystérésis sur une altitude déjà lissée. */
export class HysteresisClimb {
  private ref: number | null = null;
  gainM = 0;
  lossM = 0;

  private readonly thresholdM: number;

  constructor(thresholdM: number) {
    this.thresholdM = thresholdM;
  }

  add(alt: number | null): void {
    if (alt == null || !Number.isFinite(alt)) return;
    if (this.ref == null) {
      this.ref = alt;
      return;
    }
    if (alt >= this.ref + this.thresholdM) {
      this.gainM += alt - this.ref;
      this.ref = alt;
    } else if (alt <= this.ref - this.thresholdM) {
      this.lossM += this.ref - alt;
      this.ref = alt;
    }
  }
}

export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm > 3600) return '--:--';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm - m * 60);
  return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
