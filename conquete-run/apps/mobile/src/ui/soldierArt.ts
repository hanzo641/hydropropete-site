import { factionById, rankForLevel, RANKS } from '@conquete/core';

/**
 * Les soldats du jeu, dessinés en SVG (une seule source pour l'app et les sprites de la
 * carte, voir scripts/soldier-sprites.mjs). La tenue dépend du rang du joueur qui tient
 * le territoire : recrue → fantassin → éclaireur → chevalier → garde d'élite → légende.
 * Purement cosmétique : aucun effet sur les combats.
 */

/** 0 = garnison sauvage (milice), 1 à 6 = rangs Débutant → Maître. */
export type SoldierTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const SOLDIER_TIERS: readonly SoldierTier[] = [0, 1, 2, 3, 4, 5, 6];

export function tierForLevel(level: number | null | undefined): SoldierTier {
  if (level == null) return 1;
  const idx = RANKS.findIndex((r) => r.id === rankForLevel(level).id);
  return Math.min(6, Math.max(1, idx + 1)) as SoldierTier;
}

/** Identifiant de l'image (sprites de la carte) : `soldier-<camp>-<tenue>` / `captain-…`. */
export function soldierImageId(faction: number | null, tier: SoldierTier, captain = false): string {
  const side = faction == null || tier === 0 ? 'wild' : String(faction);
  return `${captain ? 'captain' : 'soldier'}-${side}-${side === 'wild' ? 0 : tier}`;
}

const INK = '#0B0E14';
const SKIN = '#F1C59B';
const STEEL = '#C9D2DE';
const STEEL_DARK = '#7D8899';
const GOLD = '#F7C948';
const GOLD_DARK = '#B7811B';
const WOOD = '#8B5A2B';

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const o = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

/**
 * Un soldat de face (viewBox 64 × 80). `captain` ajoute l'étendard du camp.
 */
export function soldierSvg(faction: number | null, tier: SoldierTier, captain = false): string {
  const wild = faction == null || tier === 0;
  const main = wild ? '#8E97A6' : (factionById(faction)?.color ?? '#8E97A6');
  const dark = shade(main, -0.45);
  const light = shade(main, 0.35);
  const parts: string[] = [];

  // aura de la légende
  if (tier === 6) parts.push(`<circle cx="32" cy="42" r="30" fill="${GOLD}" opacity="0.28"/><circle cx="32" cy="42" r="22" fill="${GOLD}" opacity="0.22"/>`);

  // étendard (derrière le soldat)
  if (captain) {
    const flag = wild ? STEEL_DARK : main;
    parts.push(`<path d="M51 4 L51 76" ${o} fill="none"/><path d="M51 4 L51 76" stroke="${tier === 6 ? GOLD : WOOD}" stroke-width="1.6"/>`);
    parts.push(
      wild
        ? `<path d="M51 7 L62 9 L59 13 L63 17 L52 20 Z" fill="${flag}" ${o}/>`
        : `<path d="M51 6 L63 6 L59 12.5 L63 19 L51 19 Z" fill="${flag}" ${o}/><circle cx="55.5" cy="12.5" r="2.4" fill="${tier >= 5 ? GOLD : '#FFFFFF'}"/>`,
    );
  }

  // cape
  if (tier === 3 || tier >= 5) {
    const cape = tier === 6 ? '#7A1F1F' : dark;
    parts.push(`<path d="M21 34 Q32 30 43 34 L50 72 Q32 76 14 72 Z" fill="${tier === 6 ? (faction === 2 ? '#1B3A8A' : cape) : cape}" ${o}/>`);
  }

  // arme tenue à droite (lance, hallebarde, gourdin, arc)
  if (tier === 0) parts.push(`<path d="M47 30 L49 66" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M47 30 L49 66" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/><path d="M45 27 L47 22 L49 27 M47 22 L47 31" ${o} fill="none"/>`);
  if (tier === 1) parts.push(`<path d="M48 36 L52 58" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M48 36 L52 58" stroke="${WOOD}" stroke-width="5" stroke-linecap="round"/>`);
  if (tier === 2) parts.push(`<path d="M48 8 L48 74" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M48 8 L48 74" stroke="${WOOD}" stroke-width="2.4"/><path d="M48 2 L51.5 11 L48 13 L44.5 11 Z" fill="${STEEL}" ${o}/>`);
  if (tier === 3) parts.push(`<path d="M50 22 Q60 42 50 62" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M50 22 Q60 42 50 62" fill="none" stroke="${WOOD}" stroke-width="2.6" stroke-linecap="round"/><path d="M50 22 L50 62" stroke="#E8E2D0" stroke-width="1"/>`);
  if (tier === 5)
    parts.push(
      `<path d="M48 6 L48 74" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M48 6 L48 74" stroke="${WOOD}" stroke-width="2.4"/><path d="M48 4 L48 12 M48 10 Q57 12 56 20 Q51 18 48 19" fill="${STEEL}" ${o}/><path d="M48 1 L50.5 7 L45.5 7 Z" fill="${STEEL}" ${o}/>`,
    );

  // jambes et bottes
  parts.push(`<rect x="23.5" y="58" width="7.5" height="15" rx="2.5" fill="#2A2F3A" ${o}/><rect x="33" y="58" width="7.5" height="15" rx="2.5" fill="#2A2F3A" ${o}/>`);
  parts.push(`<path d="M21.5 72 h10 v4 h-10 z M32.5 72 h10 v4 h-10 z" fill="${tier >= 4 ? (tier === 6 ? GOLD_DARK : STEEL_DARK) : '#3B2A1E'}" ${o}/>`);

  // bras (derrière le buste)
  const sleeve = tier >= 4 ? (tier === 6 ? GOLD : STEEL) : main;
  parts.push(`<rect x="13.5" y="35" width="8" height="19" rx="4" fill="${sleeve}" ${o}/><rect x="42.5" y="35" width="8" height="19" rx="4" fill="${sleeve}" ${o}/>`);
  parts.push(`<circle cx="17.5" cy="55" r="3.6" fill="${SKIN}" ${o}/><circle cx="46.5" cy="55" r="3.6" fill="${SKIN}" ${o}/>`);

  // tunique
  parts.push(`<path d="M21 34 Q32 29.5 43 34 L45.5 61 Q32 65.5 18.5 61 Z" fill="${main}" ${o}/>`);
  if (!wild) parts.push(`<path d="M32 33 L32 62" stroke="${light}" stroke-width="2.2" opacity="0.8"/>`);
  if (wild) parts.push(`<path d="M22 44 L27 47 M38 50 L42 46" stroke="${INK}" stroke-width="1.4" opacity="0.6"/>`);
  // cuirasse
  if (tier >= 4) {
    const plate = tier === 6 ? GOLD : STEEL;
    parts.push(`<path d="M22.5 35 Q32 31.5 41.5 35 L42.5 51 Q32 55 21.5 51 Z" fill="${plate}" ${o}/>`);
    parts.push(`<path d="M17 33.5 Q21 30 25.5 33.5 L24.5 39 Q20 40 16 38 Z M47 33.5 Q43 30 38.5 33.5 L39.5 39 Q44 40 48 38 Z" fill="${plate}" ${o}/>`);
    // tabard aux couleurs du camp : la faction reste lisible même en armure
    parts.push(`<path d="M28 36 L36 36 L36.5 52.5 L32 55 L27.5 52.5 Z" fill="${main}" ${o}/>`);
    if (tier >= 5) parts.push(`<path d="M22.5 35 Q32 31.5 41.5 35" fill="none" stroke="${tier === 6 ? '#FFF2B8' : GOLD}" stroke-width="1.6"/>`);
  }
  // ceinture
  parts.push(`<path d="M19.5 52 Q32 56 44.5 52 L44.8 56 Q32 60 19.2 56 Z" fill="#3B2A1E" ${o}/><rect x="29.5" y="53.5" width="5" height="4.5" rx="1" fill="${GOLD}" stroke="${INK}" stroke-width="1.2"/>`);

  // tête
  parts.push(`<circle cx="32" cy="22" r="10.5" fill="${SKIN}" ${o}/>`);
  const eyes = `<circle cx="28.3" cy="23" r="1.5" fill="${INK}"/><circle cx="35.7" cy="23" r="1.5" fill="${INK}"/><path d="M26 19.6 L30 20.6 M38 19.6 L34 20.6" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`;

  // coiffes
  switch (tier) {
    case 0: // capuche de milicien
      parts.push(eyes);
      parts.push(`<path d="M20.5 25 Q19 9 32 9 Q45 9 43.5 25 L41 25 Q41 14 32 14 Q23 14 23 25 Z" fill="#5F6675" ${o}/>`);
      break;
    case 1: // calot de recrue
      parts.push(eyes);
      parts.push(`<path d="M21.5 18.5 Q22 9.5 32 9.5 Q42 9.5 42.5 18.5 Z" fill="${dark}" ${o}/><path d="M21 18.5 H43" ${o}/>`);
      break;
    case 2: // casque de fer
      parts.push(eyes);
      parts.push(`<path d="M19 19.5 Q19 7.5 32 7.5 Q45 7.5 45 19.5 Z" fill="${STEEL}" ${o}/><path d="M16.5 19.5 H47.5" ${o}/><path d="M32 8 L32 19" stroke="${STEEL_DARK}" stroke-width="1.6"/>`);
      break;
    case 3: // capuche d'éclaireur
      parts.push(eyes);
      parts.push(`<path d="M19.5 27 Q17 6 32 6 Q47 6 44.5 27 L41.5 26 Q42 14 32 14 Q22 14 22.5 26 Z" fill="${dark}" ${o}/><path d="M32 6 Q33 2 37 1" fill="none" ${o}/>`);
      break;
    case 4: // heaume fermé
    case 5:
    case 6: {
      const helm = tier === 6 ? GOLD : STEEL;
      parts.push(`<path d="M20.5 28 Q19.5 9 32 9 Q44.5 9 43.5 28 Q32 31 20.5 28 Z" fill="${helm}" ${o}/>`);
      parts.push(`<path d="M23.5 21 H40.5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M32 22.5 L32 29" stroke="${tier === 6 ? GOLD_DARK : STEEL_DARK}" stroke-width="1.6"/>`);
      if (tier === 5) parts.push(`<path d="M32 9 Q30 -1 41 1 Q36 4 37 10 Z" fill="${main}" ${o}/>`);
      if (tier === 6) parts.push(`<path d="M22 11 L24 3 L28 8 L32 1 L36 8 L40 3 L42 11 Z" fill="${GOLD}" ${o}/><circle cx="32" cy="6" r="1.6" fill="${main}"/>`);
      break;
    }
  }

  // bouclier (bras gauche)
  if (tier >= 4) {
    const rim = tier === 6 ? GOLD_DARK : tier === 5 ? GOLD : STEEL_DARK;
    parts.push(`<path d="M7 38 Q15 35 23 38 L22 50 Q15 60 15 60 Q8 52 8 50 Z" fill="${main}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`);
    parts.push(`<path d="M9.5 40 Q15 38 20.5 40 L20 49 Q15 56.5 15 56.5 Q10 50.5 10 49 Z" fill="none" stroke="${rim}" stroke-width="1.8"/>`);
    parts.push(`<path d="M15 41 L15 54 M11 46 L19 46" stroke="${tier === 6 ? GOLD : '#FFFFFF'}" stroke-width="2" stroke-linecap="round"/>`);
  } else if (tier === 2) {
    parts.push(`<circle cx="15" cy="48" r="8" fill="${main}" ${o}/><circle cx="15" cy="48" r="2.6" fill="${STEEL}" stroke="${INK}" stroke-width="1.2"/>`);
  }

  // épée levée (chevalier, légende)
  if (tier === 4 || tier === 6) {
    const blade = tier === 6 ? '#FFF6D6' : '#EEF2F7';
    parts.push(`<path d="M46.5 52 L46.5 20 L49 15 L51.5 20 L51.5 52 Z" transform="translate(-2 0)" fill="${blade}" ${o}/>`);
    parts.push(`<path d="M41 52 H53" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M41 52 H53" stroke="${tier === 6 ? GOLD : STEEL_DARK}" stroke-width="2.6" stroke-linecap="round"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80">${parts.join('')}</svg>`;
}

/** Nombre de soldats affichés sur une case selon sa garnison (1 à 5). */
export function squadSize(garrison: number): number {
  if (garrison <= 0) return 0;
  if (garrison < 2.5) return 1;
  if (garrison < 5) return 2;
  if (garrison < 9) return 3;
  if (garrison < 15) return 4;
  return 5;
}
