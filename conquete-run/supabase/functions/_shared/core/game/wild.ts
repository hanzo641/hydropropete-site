import type { GameConfig } from './config.ts';

/** Hachage FNV-1a 32 bits → [0, 1[. Identique partout (app, serveur, tests). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}

/**
 * Garnison d'un territoire sauvage (jamais stockée, recalculée à la volée) :
 * base + 1 par tranche d'altitude au-dessus du seuil + variation déterministe de saison.
 * Altitude inconnue ⇒ pas de bonus (l'app affiche alors une estimation « ≈ »).
 */
export function wildGarrison(
  cell: string,
  elevationM: number | null,
  seasonSeed: string,
  cfg: GameConfig['wild'],
): number {
  const alt = elevationM ?? 0;
  // une tranche complète au-dessus du seuil = +1 (300 m → 0, 700 m → 1, 1 500 m → 3)
  const altitudeBonus = Math.max(0, Math.floor((alt - cfg.altitudeStartM) / cfg.altitudeStepM));
  const jitter = Math.round(cfg.jitter * hash01(`${seasonSeed}:${cell}`) * 10) / 10;
  return Math.min(cfg.max, Math.round((cfg.base + altitudeBonus + jitter) * 10) / 10);
}
