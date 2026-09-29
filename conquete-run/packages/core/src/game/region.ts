import type { GameConfig } from './config.ts';
import type { FactionId } from './combat.ts';

/**
 * Faction qui contrôle une région : celle qui détient au moins `controlThreshold` des
 * territoires de la région ET strictement plus que toute autre (donc au plus une).
 */
export function regionController(
  counts: ReadonlyMap<FactionId, number>,
  totalTerritories: number,
  cfg: GameConfig['region'],
): FactionId | null {
  let best: FactionId | null = null;
  let bestN = 0;
  let tie = false;
  for (const [f, n] of counts) {
    if (n > bestN) {
      best = f;
      bestN = n;
      tie = false;
    } else if (n === bestN) {
      tie = true;
    }
  }
  if (best == null || tie || totalTerritories <= 0) return null;
  return bestN / totalTerritories >= cfg.controlThreshold - 1e-9 ? best : null;
}
