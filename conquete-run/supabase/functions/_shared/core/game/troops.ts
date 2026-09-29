import type { GameConfig } from './config.ts';

export interface TroopsResult {
  troops: number;
  /** dont troupes gagnées grâce à la série */
  bonusTroops: number;
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
  /** bonus de série (0,1 = +10 %) */
  bonus = 0,
): TroopsResult {
  const km = Math.max(0, run.distanceM / 1000);
  const dplus = Math.max(0, run.dplusM);
  const countedKm = Math.max(0, Math.min(km, cfg.dailyKmCap - alreadyToday.km));
  const countedDplusM = Math.max(0, Math.min(dplus, cfg.dailyDplusCap - alreadyToday.dplusM));
  const base = countedKm * cfg.perKm + (countedDplusM / 100) * cfg.perDplus100m;
  const troops = Math.floor(base * (1 + Math.max(0, bonus)) + 1e-9);
  return {
    troops,
    bonusTroops: troops - Math.floor(base + 1e-9),
    countedKm,
    countedDplusM,
    capped: countedKm < km - 1e-9 || countedDplusM < dplus - 1e-9,
  };
}
