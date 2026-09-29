import type { GameConfig } from './config.ts';

export type FactionId = number;

export interface HexSnapshot {
  owner: FactionId | null; // null = sauvage
  garrison: number;
}

export type Outcome = 'reinforced' | 'captured' | 'damaged';

export interface AttackResult {
  outcome: Outcome;
  before: HexSnapshot;
  after: HexSnapshot;
  /** troupes effectivement engagées (bonus de région inclus) */
  effectiveTroops: number;
}

/** Arrondi à 1e-4 pour une parité exacte avec le SQL (numeric(10,4)). */
export const round4 = (x: number): number => Math.round(x * 10_000) / 10_000;

/** Troupes effectives après bonus de région (+10 % si l'équipe contrôle la région). */
export function effectiveTroops(troops: number, controlsRegion: boolean, cfg: GameConfig['region']): number {
  return round4(controlsRegion ? troops * (1 + cfg.troopBonus) : troops);
}

/**
 * Résout l'envoi de troupes sur un territoire.
 * - allié : renfort (plafonné) ;
 * - ennemi / sauvage : A ≥ 1,2 G ⇒ pris avec max(A − 1,2 G, 1) ; sinon G − A / 1,2.
 */
export function resolveAttack(
  hex: HexSnapshot,
  attacker: FactionId,
  troops: number,
  cfg: GameConfig['combat'],
): AttackResult {
  const before = { owner: hex.owner, garrison: round4(hex.garrison) };
  if (troops <= 0) return { outcome: hex.owner === attacker ? 'reinforced' : 'damaged', before, after: before, effectiveTroops: 0 };
  if (hex.owner === attacker) {
    return {
      outcome: 'reinforced',
      before,
      after: { owner: attacker, garrison: round4(Math.min(cfg.maxGarrison, before.garrison + troops)) },
      effectiveTroops: troops,
    };
  }
  const needed = before.garrison * cfg.defenseMultiplier;
  if (troops >= needed - 1e-9) {
    const surplus = troops - needed;
    return {
      outcome: 'captured',
      before,
      after: {
        owner: attacker,
        garrison: round4(Math.min(cfg.maxGarrison, Math.max(cfg.minGarrisonAfterCapture, surplus))),
      },
      effectiveTroops: troops,
    };
  }
  return {
    outcome: 'damaged',
    before,
    after: { owner: hex.owner, garrison: round4(Math.max(0, before.garrison - troops / cfg.defenseMultiplier)) },
    effectiveTroops: troops,
  };
}
