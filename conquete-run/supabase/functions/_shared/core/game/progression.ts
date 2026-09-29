import type { GameConfig } from './config.ts';
import { hash01 } from './wild.ts';

/** Rangs repris du prototype RunLeveling. */
export const RANKS = [
  { id: 'debutant', minLevel: 1, color: '#6B7280', name: { fr: 'Débutant', en: 'Rookie' } },
  { id: 'jogger', minLevel: 11, color: '#10B981', name: { fr: 'Jogger', en: 'Jogger' } },
  { id: 'coureur', minLevel: 26, color: '#3B82F6', name: { fr: 'Coureur', en: 'Runner' } },
  { id: 'athlete', minLevel: 46, color: '#8B5CF6', name: { fr: 'Athlète', en: 'Athlete' } },
  { id: 'champion', minLevel: 71, color: '#F59E0B', name: { fr: 'Champion', en: 'Champion' } },
  { id: 'maitre', minLevel: 91, color: '#EF4444', name: { fr: 'Maître', en: 'Master' } },
] as const;

export type Rank = (typeof RANKS)[number];
export type RankId = Rank['id'];

/** XP pour passer du niveau n au niveau n+1 (formule du prototype). */
export function xpForLevel(n: number): number {
  return 100 + 50 * (n - 1);
}

export function levelFromXp(totalXp: number): { level: number; currentXp: number; nextXp: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpForLevel(level) && level < 200) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, currentXp: rest, nextXp: xpForLevel(level) };
}

export function rankForLevel(level: number): Rank {
  let r: Rank = RANKS[0];
  for (const rank of RANKS) if (level >= rank.minLevel) r = rank;
  return r;
}

export function runXp(
  run: { distanceM: number; dplusM: number; movingS: number },
  cfg: GameConfig['xp'],
): number {
  return Math.round(
    (run.distanceM / 1000) * cfg.perKm + (run.dplusM / 10) * cfg.per10mDplus + (run.movingS / 60) * cfg.perActiveMinute,
  );
}

/** Statistiques cumulées d'un joueur, utilisées pour les trophées. */
export interface PlayerStats {
  runs: number;
  totalKm: number;
  totalDplusM: number;
  level: number;
  captures: number;
  regionsTaken: number;
  maxAltitudeCapturedM: number;
  bestPaceSecPerKm: number | null;
  earlyRuns: number;
  nightRuns: number;
  distinctCells: number;
}

export interface Trophy {
  id: string;
  icon: string;
  xp: number;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  earned: (s: PlayerStats) => boolean;
}

const t = (
  id: string,
  icon: string,
  xp: number,
  fr: [string, string],
  en: [string, string],
  earned: (s: PlayerStats) => boolean,
): Trophy => ({ id, icon, xp, name: { fr: fr[0], en: en[0] }, description: { fr: fr[1], en: en[1] }, earned });

export const TROPHIES: readonly Trophy[] = [
  // repris du prototype
  t('first_run', '🎯', 50, ['Premier pas', 'Termine ta première course'], ['First step', 'Finish your first run'], (s) => s.runs >= 1),
  t('five_sessions', '🚀', 100, ['En route', '5 courses'], ['On the way', '5 runs'], (s) => s.runs >= 5),
  t('twenty_five_sessions', '🔥', 250, ['Déterminé', '25 courses'], ['Determined', '25 runs'], (s) => s.runs >= 25),
  t('marathon', '🏅', 300, ['Marathonien', '42 km cumulés'], ['Marathoner', '42 km in total'], (s) => s.totalKm >= 42),
  t('hundred_km', '💯', 500, ['Centurion', '100 km cumulés'], ['Centurion', '100 km in total'], (s) => s.totalKm >= 100),
  t('sprinter', '⚡', 200, ['Sprinter', 'Une course à moins de 5:00/km'], ['Sprinter', 'A run under 5:00/km'], (s) => s.bestPaceSecPerKm != null && s.bestPaceSecPerKm < 300),
  t('early_bird', '🌅', 75, ['Lève-tôt', 'Cours avant 7 h'], ['Early bird', 'Run before 7 am'], (s) => s.earlyRuns >= 1),
  t('night_owl', '🌙', 75, ['Noctambule', 'Cours après 21 h'], ['Night owl', 'Run after 9 pm'], (s) => s.nightRuns >= 1),
  t('level_10', '📈', 100, ['Apprenti', 'Niveau 10'], ['Apprentice', 'Level 10'], (s) => s.level >= 10),
  t('level_25', '🎖️', 200, ['Confirmé', 'Niveau 25'], ['Seasoned', 'Level 25'], (s) => s.level >= 25),
  // conquête
  t('first_capture', '🚩', 50, ['Premier drapeau', 'Prends ton premier territoire'], ['First flag', 'Capture your first territory'], (s) => s.captures >= 1),
  t('captures_10', '🗺️', 150, ['Conquérant', '10 territoires pris'], ['Conqueror', '10 territories captured'], (s) => s.captures >= 10),
  t('captures_50', '🏰', 400, ['Seigneur', '50 territoires pris'], ['Warlord', '50 territories captured'], (s) => s.captures >= 50),
  t('captures_200', '👑', 1000, ['Empereur', '200 territoires pris'], ['Emperor', '200 territories captured'], (s) => s.captures >= 200),
  t('first_region', '🛡️', 300, ['Stratège', 'Participe à la prise d’une région'], ['Strategist', 'Help take a region'], (s) => s.regionsTaken >= 1),
  t('dplus_1000', '⛰️', 150, ['Grimpeur', '1 000 m de D+ cumulés'], ['Climber', '1,000 m elevation gain'], (s) => s.totalDplusM >= 1000),
  t('dplus_10000', '🏔️', 600, ['Sherpa', '10 000 m de D+ cumulés'], ['Sherpa', '10,000 m elevation gain'], (s) => s.totalDplusM >= 10000),
  t('summit_2000', '🦅', 300, ['Sommet', 'Prends un territoire au-dessus de 2 000 m'], ['Summit', 'Capture a territory above 2,000 m'], (s) => s.maxAltitudeCapturedM >= 2000),
  t('explorer_100', '🧭', 250, ['Explorateur', 'Traverse 100 territoires différents'], ['Explorer', 'Cross 100 different territories'], (s) => s.distinctCells >= 100),
];

export function newTrophies(stats: PlayerStats, already: ReadonlySet<string>): Trophy[] {
  return TROPHIES.filter((tr) => !already.has(tr.id) && tr.earned(stats));
}

export type ChallengeKind = 'distance' | 'dplus' | 'wild_captures' | 'new_cells';

export interface Challenge {
  id: string;
  kind: ChallengeKind;
  target: number;
  xp: number;
}

/** Numéro de semaine ISO (pour les défis hebdomadaires). */
export function isoWeek(ts: number): string {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** 3 défis solo par semaine, tirés de façon déterministe par joueur et adaptés au niveau. */
export function weeklyChallenges(userId: string, week: string, level: number): Challenge[] {
  const scale = 1 + Math.min(level, 60) / 30;
  const pool: { kind: ChallengeKind; targets: number[]; xp: number }[] = [
    { kind: 'distance', targets: [10, 15, 20, 30], xp: 120 },
    { kind: 'dplus', targets: [150, 300, 500, 800], xp: 120 },
    { kind: 'wild_captures', targets: [2, 4, 6, 10], xp: 100 },
    { kind: 'new_cells', targets: [5, 10, 15, 25], xp: 100 },
  ];
  const picks = [...pool].sort((a, b) => hash01(`${userId}:${week}:${a.kind}`) - hash01(`${userId}:${week}:${b.kind}`)).slice(0, 3);
  return picks.map((p) => {
    const idx = Math.min(p.targets.length - 1, Math.floor(hash01(`${week}:${userId}:${p.kind}:t`) * 2 + (scale - 1) * 1.5));
    return { id: `${week}:${p.kind}`, kind: p.kind, target: p.targets[idx]!, xp: Math.round(p.xp * scale) };
  });
}
