/** Thème sombre unique (jeu de carte nocturne, lisible en extérieur avec contraste élevé). */
export const colors = {
  bg: '#0E1116',
  surface: '#171B22',
  surfaceHigh: '#212733',
  border: '#2C3340',
  text: '#F2F4F8',
  textDim: '#A3ACBA',
  accent: '#F7B32B',
  danger: '#EF4444',
  success: '#22C55E',
  info: '#60A5FA',
  wild: '#8A8F98',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 13, color: colors.textDim },
  stat: { fontSize: 34, fontWeight: '800' as const, color: colors.text, fontVariant: ['tabular-nums' as const] },
};
