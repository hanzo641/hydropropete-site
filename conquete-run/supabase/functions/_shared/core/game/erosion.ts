import type { GameConfig } from './config.ts';
import { round4 } from './combat.ts';

const DAY_MS = 86_400_000;

/** Garnison après érosion continue : G × (1 − taux)^jours. */
export function erodedGarrison(garrison: number, updatedAt: number, now: number, cfg: GameConfig['erosion']): number {
  const days = Math.max(0, (now - updatedAt) / DAY_MS);
  return round4(garrison * Math.pow(1 - cfg.dailyRate, days));
}

export function isAbandoned(garrison: number, cfg: GameConfig['erosion']): boolean {
  return garrison < cfg.abandonThreshold;
}

/** Jours avant abandon sans renfort. */
export function daysUntilAbandon(garrison: number, cfg: GameConfig['erosion']): number {
  if (garrison < cfg.abandonThreshold) return 0;
  if (cfg.dailyRate <= 0) return Infinity;
  return Math.log(cfg.abandonThreshold / garrison) / Math.log(1 - cfg.dailyRate);
}
