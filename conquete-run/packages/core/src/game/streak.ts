import type { GameConfig } from './config.ts';

/**
 * Série 🔥 : nombre de jours consécutifs avec au moins une course validée d'au moins
 * `streak.minKm`. Chaque jour de série ajoute +10 % de troupes (jusqu'à +50 %).
 * Les jours sont des jours LOCAUX du coureur (AAAA-MM-JJ).
 */
export interface StreakState {
  days: number;
  lastDay: string | null;
}

/** Jour local (AAAA-MM-JJ) d'un instant, avec le décalage horaire du coureur en minutes. */
export function localDay(t: number, tzOffsetMin = 0): string {
  return new Date(t + tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Série après une course faite le jour `runDay` (inchangée si la course ne compte pas). */
export function nextStreak(prev: StreakState, runDay: string, qualifies: boolean): StreakState {
  if (!qualifies) return prev;
  if (prev.lastDay === runDay) return { days: Math.max(1, prev.days), lastDay: runDay };
  if (prev.lastDay != null && addDays(prev.lastDay, 1) === runDay) return { days: prev.days + 1, lastDay: runDay };
  if (prev.lastDay != null && prev.lastDay > runDay) return prev; // course ancienne envoyée en retard
  return { days: 1, lastDay: runDay };
}

/** Série affichée aujourd'hui : elle tient tant que la dernière course date d'hier ou d'aujourd'hui. */
export function currentStreak(s: StreakState, today: string): number {
  if (!s.lastDay) return 0;
  return s.lastDay === today || addDays(s.lastDay, 1) === today ? s.days : 0;
}

/** Vrai si la série s'éteint ce soir faute de course aujourd'hui. */
export function streakAtRisk(s: StreakState, today: string): boolean {
  return s.days > 0 && s.lastDay != null && addDays(s.lastDay, 1) === today;
}

/** Bonus de troupes : +10 % par jour de série au-delà du premier, plafonné. */
export function streakBonus(days: number, cfg: GameConfig['streak']): number {
  return Math.min(cfg.maxBonus, cfg.bonusPerDay * Math.max(0, days - 1));
}
