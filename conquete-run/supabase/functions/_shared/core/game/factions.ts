import type { GameConfig } from './config.ts';
import type { FactionId } from './combat.ts';

export type Emblem = 'flame' | 'wave' | 'leaf' | 'sun';

export interface Faction {
  id: FactionId;
  slug: string;
  /** couleur principale (territoires, boutons) */
  color: string;
  /** dégradé des surfaces de la faction [clair, foncé] */
  gradient: [string, string];
  emblem: Emblem;
  name: { fr: string; en: string };
  motto: { fr: string; en: string };
  lore: { fr: string; en: string };
}

/**
 * La Guerre des Foulées : deux factions s'affrontent depuis toujours (les deux autres sont
 * en réserve pour une ouverture large, activables par `factions.count`).
 */
export const FACTIONS: readonly Faction[] = [
  {
    id: 1,
    slug: 'braise',
    color: '#FF4D2E',
    gradient: ['#FF8A3D', '#E0262B'],
    emblem: 'flame',
    name: { fr: 'Braise', en: 'Ember' },
    motto: { fr: 'Le feu ne recule jamais.', en: 'Fire never retreats.' },
    lore: {
      fr: 'Nés du premier feu, les coureurs de la Braise attaquent à l’aube et brûlent chaque rue qu’ils traversent.',
      en: 'Born of the first fire, Ember runners strike at dawn and set every street they cross ablaze.',
    },
  },
  {
    id: 2,
    slug: 'maree',
    color: '#2E7DFF',
    gradient: ['#38D5FF', '#1D4ED8'],
    emblem: 'wave',
    name: { fr: 'Marée', en: 'Tide' },
    motto: { fr: 'Rien n’arrête la vague.', en: 'Nothing stops the wave.' },
    lore: {
      fr: 'Patients et implacables, les coureurs de la Marée reviennent sans cesse et recouvrent tout sur leur passage.',
      en: 'Patient and relentless, Tide runners keep coming back and flood everything in their path.',
    },
  },
  {
    id: 3,
    slug: 'sylve',
    color: '#22C55E',
    gradient: ['#86EFAC', '#15803D'],
    emblem: 'leaf',
    name: { fr: 'Sylve', en: 'Grove' },
    motto: { fr: 'La forêt reprend tout.', en: 'The forest takes it all back.' },
    lore: { fr: 'Faction de réserve.', en: 'Reserve faction.' },
  },
  {
    id: 4,
    slug: 'ambre',
    color: '#F5B400',
    gradient: ['#FDE68A', '#B45309'],
    emblem: 'sun',
    name: { fr: 'Ambre', en: 'Amber' },
    motto: { fr: 'L’or se gagne.', en: 'Gold is earned.' },
    lore: { fr: 'Faction de réserve.', en: 'Reserve faction.' },
  },
];

export const WILD_COLOR = '#7C8595';

/** La faction adverse (à deux factions) ; null s'il y en a plus. */
export function enemyOf(id: FactionId, cfg: GameConfig['factions']): FactionId | null {
  const ids = activeFactions(cfg).map((f) => f.id);
  return ids.length === 2 ? (ids.find((x) => x !== id) ?? null) : null;
}

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
