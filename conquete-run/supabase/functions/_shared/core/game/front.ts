import { hash01 } from './wild.ts';

/**
 * Front du jour ⚔️ : chaque jour, une région de la zone devient le front. Les territoires
 * pris sur le front rapportent double. Choix déterministe (même front pour tous), parmi
 * les régions disputées si possible.
 */
export function frontOfDay(regions: readonly { region: string; factions: number }[], day: string): string | null {
  if (regions.length === 0) return null;
  const disputed = regions.filter((r) => r.factions >= 2);
  const pool = disputed.length > 0 ? disputed : regions;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const r of pool) {
    const s = hash01(`${day}:${r.region}`);
    if (s < bestScore) {
      bestScore = s;
      best = r.region;
    }
  }
  return best;
}
