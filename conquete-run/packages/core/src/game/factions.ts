import type { GameConfig } from './config.ts';
import type { FactionId } from './combat.ts';

export interface Faction {
  id: FactionId;
  slug: string;
  color: string;
  name: { fr: string; en: string };
}

export const FACTIONS: readonly Faction[] = [
  { id: 1, slug: 'braise', color: '#E4572E', name: { fr: 'Braise', en: 'Ember' } },
  { id: 2, slug: 'sylve', color: '#2BA84A', name: { fr: 'Sylve', en: 'Grove' } },
  { id: 3, slug: 'maree', color: '#2E86DE', name: { fr: 'Marée', en: 'Tide' } },
  { id: 4, slug: 'ambre', color: '#F2B705', name: { fr: 'Ambre', en: 'Amber' } },
];

export const WILD_COLOR = '#8A8F98';

export function activeFactions(cfg: GameConfig['factions']): Faction[] {
  return FACTIONS.slice(0, cfg.count);
}

export function factionById(id: FactionId | null | undefined): Faction | null {
  return FACTIONS.find((f) => f.id === id) ?? null;
}

export interface FactionAssignment {
  faction: FactionId;
  /** factions fermées dans la zone (surreprésentées) */
  locked: FactionId[];
}

/**
 * Rééquilibrage par zone : une faction est fermée si sa part dépasse la part équitable
 * de plus de `balanceMargin`, dès que la zone compte `balanceMinPlayers` joueurs.
 * Sans choix (ou choix fermé) : la faction la moins représentée (départage déterministe).
 */
export function assignFaction(
  zoneCounts: ReadonlyMap<FactionId, number>,
  requested: FactionId | null,
  cfg: GameConfig['factions'],
  tieBreak = 0,
): FactionAssignment {
  const ids = activeFactions(cfg).map((f) => f.id);
  const total = ids.reduce((s, id) => s + (zoneCounts.get(id) ?? 0), 0);
  const fair = 1 / ids.length;
  const locked =
    total + 1 < cfg.balanceMinPlayers
      ? []
      : ids.filter((id) => ((zoneCounts.get(id) ?? 0) + 1) / (total + 1) > fair + cfg.balanceMargin);
  if (requested != null && ids.includes(requested) && !locked.includes(requested)) {
    return { faction: requested, locked };
  }
  const min = Math.min(...ids.map((id) => zoneCounts.get(id) ?? 0));
  const candidates = ids.filter((id) => (zoneCounts.get(id) ?? 0) === min);
  return { faction: candidates[Math.abs(tieBreak) % candidates.length]!, locked };
}
