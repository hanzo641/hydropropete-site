/**
 * Avatars de joueur : les soldats du jeu, une tenue par rang (le dessin vit dans l'app,
 * apps/mobile/src/ui/soldierArt.ts, et prend la couleur du camp du joueur).
 * La Recrue est libre dès l'inscription ; chaque rang débloque la tenue suivante.
 * Les niveaux de déblocage sont dupliqués en SQL (avatar_unlock_level) : un test vérifie
 * la cohérence.
 */

export interface Avatar {
  id: string;
  name: { fr: string; en: string };
  /** niveau requis (1 = libre) */
  unlockLevel: number;
  /** tenue du soldat (1 = Recrue … 6 = Légende) */
  tier: 1 | 2 | 3 | 4 | 5 | 6;
}

export const AVATARS: readonly Avatar[] = [
  { id: 'recrue', name: { fr: 'Recrue', en: 'Recruit' }, unlockLevel: 1, tier: 1 },
  { id: 'fantassin', name: { fr: 'Fantassin', en: 'Footman' }, unlockLevel: 11, tier: 2 },
  { id: 'eclaireur', name: { fr: 'Éclaireur', en: 'Scout' }, unlockLevel: 26, tier: 3 },
  { id: 'chevalier', name: { fr: 'Chevalier', en: 'Knight' }, unlockLevel: 46, tier: 4 },
  { id: 'garde', name: { fr: 'Garde d’élite', en: 'Elite guard' }, unlockLevel: 71, tier: 5 },
  { id: 'legende', name: { fr: 'Légende', en: 'Legend' }, unlockLevel: 91, tier: 6 },
];

export const DEFAULT_AVATAR_ID = 'recrue';

/** Avatar connu, sinon la Recrue (anciens avatars animaux compris). */
export function avatarById(id: string | null | undefined): Avatar {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}

export function isAvatarUnlocked(id: string, level: number): boolean {
  const a = AVATARS.find((x) => x.id === id);
  return a != null && level >= a.unlockLevel;
}

/** La plus belle tenue débloquée à ce niveau. */
export function avatarForLevel(level: number): Avatar {
  let best = AVATARS[0]!;
  for (const a of AVATARS) if (level >= a.unlockLevel) best = a;
  return best;
}
