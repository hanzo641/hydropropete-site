import type { GameConfig } from './config.ts';
import { effectiveTroops, resolveAttack, type AttackResult, type FactionId, type HexSnapshot } from './combat.ts';

export interface DeployTarget {
  cell: string;
  region: string;
  /** état actuel (érosion appliquée ; garnison sauvage calculée si non stocké) */
  state: HexSnapshot;
  /** faction qui contrôle la région de ce territoire */
  regionController: FactionId | null;
}

export interface Allocation {
  cell: string;
  troops: number;
}

export type AllocationError = 'not_crossed' | 'too_many_troops' | 'invalid_troops' | 'duplicate_cell' | 'empty';

/** Vérifications communes à l'app et au serveur. */
export function validateAllocations(
  allocs: readonly Allocation[],
  crossed: ReadonlySet<string>,
  available: number,
): AllocationError | null {
  if (allocs.length === 0) return 'empty';
  const seen = new Set<string>();
  let total = 0;
  for (const a of allocs) {
    if (!Number.isInteger(a.troops) || a.troops <= 0) return 'invalid_troops';
    if (!crossed.has(a.cell)) return 'not_crossed';
    if (seen.has(a.cell)) return 'duplicate_cell';
    seen.add(a.cell);
    total += a.troops;
  }
  return total > available ? 'too_many_troops' : null;
}

/** Aperçu local du résultat (le serveur fait foi : l'état peut avoir changé entre-temps). */
export function previewDeployment(
  targets: ReadonlyMap<string, DeployTarget>,
  allocs: readonly Allocation[],
  faction: FactionId,
  cfg: GameConfig,
): Map<string, AttackResult> {
  const out = new Map<string, AttackResult>();
  for (const a of allocs) {
    const t = targets.get(a.cell);
    if (!t) continue;
    const troops = effectiveTroops(a.troops, t.regionController === faction, cfg.region);
    out.set(a.cell, resolveAttack(t.state, faction, troops, cfg.combat, cfg.erosion.abandonThreshold));
  }
  return out;
}

/** Troupes (entières) nécessaires pour prendre un territoire ennemi ou sauvage. */
export function troopsToCapture(t: DeployTarget, faction: FactionId, cfg: GameConfig): number {
  const bonus = t.regionController === faction ? 1 + cfg.region.troopBonus : 1;
  return Math.max(1, Math.ceil((t.state.garrison * cfg.combat.defenseMultiplier) / bonus - 1e-9));
}

/**
 * Répartition automatique proposée : d'abord les prises les moins chères, puis les
 * renforts des territoires alliés les plus faibles, le reste sur la dernière prise.
 */
export function autoDistribute(
  targets: readonly DeployTarget[],
  available: number,
  faction: FactionId,
  cfg: GameConfig,
): Allocation[] {
  const alloc = new Map<string, number>();
  let left = available;
  const add = (cell: string, n: number): void => {
    alloc.set(cell, (alloc.get(cell) ?? 0) + n);
    left -= n;
  };
  const attackable = targets
    .filter((t) => t.state.owner !== faction)
    .map((t) => ({ t, need: troopsToCapture(t, faction, cfg) }))
    .sort((a, b) => a.need - b.need || a.t.cell.localeCompare(b.t.cell));
  let lastCapture: string | null = null;
  for (const { t, need } of attackable) {
    if (need > left) continue;
    add(t.cell, need);
    lastCapture = t.cell;
  }
  const own = targets.filter((t) => t.state.owner === faction).sort((a, b) => a.state.garrison - b.state.garrison);
  let i = 0;
  while (left > 0 && own.length > 0) {
    add(own[i % own.length]!.cell, 1);
    i++;
  }
  if (left > 0) {
    const fallback = lastCapture ?? attackable[0]?.t.cell ?? targets[0]?.cell;
    if (fallback) add(fallback, left);
  }
  return [...alloc.entries()].map(([cell, troops]) => ({ cell, troops }));
}
