import { factionById } from '@conquete/core';

/**
 * Direction artistique « nuit de bataille » : fond presque noir bleuté, surfaces vitrées,
 * et TOUTE l'interface prend la couleur de la faction du joueur (braise ou marée).
 */
export const colors = {
  bg: '#06080C',
  bgRaised: '#0B0F16',
  surface: '#111722',
  surfaceHigh: '#1A2231',
  glass: 'rgba(14,19,28,0.78)',
  glassStrong: 'rgba(10,14,21,0.92)',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#F4F6FA',
  textDim: '#8E99AB',
  textMute: '#586274',
  gold: '#FFC53D',
  danger: '#FF4D5E',
  success: '#2EE59D',
  info: '#5AB0FF',
  wild: '#7C8595',
  // conservé pour les écrans secondaires (valeur neutre avant le choix de faction)
  accent: '#FFC53D',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 22, xl: 28, pill: 999 } as const;

/** Familles chargées au démarrage (voir app/_layout.tsx). */
export const fonts = {
  display: 'BarlowCondensed_800ExtraBold_Italic',
  displayUpright: 'BarlowCondensed_800ExtraBold',
  label: 'BarlowCondensed_700Bold',
  labelSemi: 'BarlowCondensed_600SemiBold',
  body: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  bodyHeavy: 'Manrope_800ExtraBold',
} as const;

export const font = {
  hero: { fontFamily: fonts.display, fontSize: 52, color: colors.text, letterSpacing: 0.5, lineHeight: 54 },
  h1: { fontFamily: fonts.display, fontSize: 34, color: colors.text, letterSpacing: 0.4, lineHeight: 38 },
  h2: { fontFamily: fonts.displayUpright, fontSize: 24, color: colors.text, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  h3: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  label: { fontFamily: fonts.label, fontSize: 13, color: colors.textDim, letterSpacing: 1.6, textTransform: 'uppercase' as const },
  body: { fontFamily: fonts.body, fontSize: 15, color: colors.text, lineHeight: 21 },
  bodyBold: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
  stat: { fontFamily: fonts.display, fontSize: 44, color: colors.text, fontVariant: ['tabular-nums' as const], lineHeight: 48 },
};

export interface Palette {
  /** couleur principale */
  main: string;
  /** dégradé [clair, foncé] */
  gradient: [string, string];
  /** halo / ombre colorée */
  glow: string;
  /** fond très sombre teinté */
  tint: string;
  /** texte sur la couleur principale */
  on: string;
}

const NEUTRAL: Palette = { main: colors.gold, gradient: ['#FFD86B', '#F59E0B'], glow: 'rgba(255,197,61,0.45)', tint: '#141108', on: '#140F02' };

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Palette d'une faction (ou neutre dorée si aucune). */
export function paletteOf(factionId: number | null | undefined): Palette {
  const f = factionById(factionId);
  if (!f) return NEUTRAL;
  const [r, g, b] = hexToRgb(f.color);
  return {
    main: f.color,
    gradient: f.gradient,
    glow: `rgba(${r},${g},${b},0.5)`,
    tint: `rgb(${Math.round(r * 0.09 + 6)},${Math.round(g * 0.09 + 8)},${Math.round(b * 0.09 + 12)})`,
    on: '#FFFFFF',
  };
}
