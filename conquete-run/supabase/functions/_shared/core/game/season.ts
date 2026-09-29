import type { GameConfig } from './config.ts';

/** Points individuels de saison. */
export function seasonPoints(
  s: { captures: number; troopsDeployed: number; km: number },
  cfg: GameConfig['score'],
): number {
  return Math.round(s.captures * cfg.perCapture + s.troopsDeployed * cfg.perTroopDeployed + s.km * cfg.perKm);
}

export type SeasonTitle = 'conqueror' | 'strategist' | 'builder' | 'explorer' | 'sherpa';

export interface PlayerSeasonLine {
  userId: string;
  zone: string;
  points: number;
  regionsTaken: number;
  reinforcements: number;
  distinctCells: number;
  dplusM: number;
}

/** Titres de fin de saison, par zone : le meilleur de chaque catégorie. */
export function seasonTitles(lines: readonly PlayerSeasonLine[]): { userId: string; zone: string; title: SeasonTitle }[] {
  const byZone = new Map<string, PlayerSeasonLine[]>();
  for (const l of lines) byZone.set(l.zone, [...(byZone.get(l.zone) ?? []), l]);
  const out: { userId: string; zone: string; title: SeasonTitle }[] = [];
  const categories: [SeasonTitle, (l: PlayerSeasonLine) => number][] = [
    ['conqueror', (l) => l.points],
    ['strategist', (l) => l.regionsTaken],
    ['builder', (l) => l.reinforcements],
    ['explorer', (l) => l.distinctCells],
    ['sherpa', (l) => l.dplusM],
  ];
  for (const [zone, ls] of byZone) {
    for (const [title, key] of categories) {
      const best = [...ls].sort((a, b) => key(b) - key(a) || a.userId.localeCompare(b.userId))[0];
      if (best && key(best) > 0) out.push({ userId: best.userId, zone, title });
    }
  }
  return out;
}
