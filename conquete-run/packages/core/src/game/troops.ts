import type { GameConfig } from './config.ts';

export interface TroopsResult {
  troops: number;
  /** km et D+ réellement comptés après plafond journalier */
  countedKm: number;
  countedDplusM: number;
  capped: boolean;
}

/**
 * 1 km validé = 1 troupe, +1 troupe par 100 m de D+ validé, dans la limite des plafonds
 * journaliers (ce qui a déjà été compté aujourd'hui est déduit).
 */
export function computeTroops(
  run: { distanceM: number; dplusM: number },
  alreadyToday: { km: number; dplusM: number },
  cfg: GameConfig['troops'],
): TroopsResult {
  const km = Math.max(0, run.distanceM / 1000);
  const dplus = Math.max(0, run.dplusM);
  const countedKm = Math.max(0, Math.min(km, cfg.dailyKmCap - alreadyToday.km));
  const countedDplusM = Math.max(0, Math.min(dplus, cfg.dailyDplusCap - alreadyToday.dplusM));
  const troops = Math.floor(countedKm * cfg.perKm + (countedDplusM / 100) * cfg.perDplus100m + 1e-9);
  return { troops, countedKm, countedDplusM, capped: countedKm < km - 1e-9 || countedDplusM < dplus - 1e-9 };
}
