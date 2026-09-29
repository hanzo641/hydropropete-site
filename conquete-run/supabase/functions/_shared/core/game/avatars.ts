/**
 * Avatars de joueur (style « low-poly » vectoriel, dessinés pour le jeu, libres de droits).
 * Données pures : l'app les rend avec react-native-svg, les pages web en SVG.
 * Huit avatars sont libres dès l'inscription ; cinq se débloquent avec les rangs.
 * Les niveaux de déblocage sont dupliqués en SQL (avatar_unlock_level) : un test vérifie
 * la cohérence.
 */

export interface AvatarShape {
  /** tracé SVG dans une boîte 0–100 */
  d: string;
  fill: string;
  opacity?: number;
}

export interface Avatar {
  id: string;
  name: { fr: string; en: string };
  /** niveau requis (1 = libre) */
  unlockLevel: number;
  bg: string;
  shapes: AvatarShape[];
}

/** Disque en tracé SVG. */
const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

const DARK = '#15171C';

export const AVATARS: readonly Avatar[] = [
  {
    id: 'renard',
    name: { fr: 'Renard', en: 'Fox' },
    unlockLevel: 1,
    bg: '#22304F',
    shapes: [
      { d: 'M22 12 L42 34 L22 46 Z', fill: '#D9582A' },
      { d: 'M78 12 L58 34 L78 46 Z', fill: '#D9582A' },
      { d: 'M26 21 L37 34 L27 40 Z', fill: '#3A1F14' },
      { d: 'M74 21 L63 34 L73 40 Z', fill: '#3A1F14' },
      { d: 'M22 42 L50 30 L78 42 L71 63 L50 88 L29 63 Z', fill: '#F07A35' },
      { d: 'M50 30 L63 45 L50 60 L37 45 Z', fill: '#FF9A55' },
      { d: 'M29 63 L50 88 L41 67 Z', fill: '#F6EFE6' },
      { d: 'M71 63 L50 88 L59 67 Z', fill: '#F6EFE6' },
      { d: 'M41 67 L50 72 L59 67 L50 88 Z', fill: '#EDE3D6' },
      { d: 'M35 50 L45 52 L37 56 Z', fill: DARK },
      { d: 'M65 50 L55 52 L63 56 Z', fill: DARK },
      { d: 'M45 80 L55 80 L50 87 Z', fill: DARK },
    ],
  },
  {
    id: 'loup',
    name: { fr: 'Loup', en: 'Wolf' },
    unlockLevel: 1,
    bg: '#172231',
    shapes: [
      { d: 'M23 8 L43 32 L20 42 Z', fill: '#5E6773' },
      { d: 'M77 8 L57 32 L80 42 Z', fill: '#5E6773' },
      { d: 'M27 16 L38 31 L26 37 Z', fill: '#3E4550' },
      { d: 'M73 16 L62 31 L74 37 Z', fill: '#3E4550' },
      { d: 'M18 38 L50 26 L82 38 L75 64 L50 91 L25 64 Z', fill: '#7D8794' },
      { d: 'M33 58 L50 49 L67 58 L59 79 L50 91 L41 79 Z', fill: '#C9CED6' },
      { d: 'M26 44 L46 47 L35 53 Z', fill: '#4A525D' },
      { d: 'M74 44 L54 47 L65 53 Z', fill: '#4A525D' },
      { d: 'M33 50 L45 51 L38 56 Z', fill: '#F7B32B' },
      { d: 'M67 50 L55 51 L62 56 Z', fill: '#F7B32B' },
      { d: 'M38 51 L41 51 L39 54 Z', fill: DARK },
      { d: 'M62 51 L59 51 L61 54 Z', fill: DARK },
      { d: 'M45 81 L55 81 L50 87 Z', fill: DARK },
    ],
  },
  {
    id: 'aigle',
    name: { fr: 'Aigle', en: 'Eagle' },
    unlockLevel: 1,
    bg: '#2E2119',
    shapes: [
      { d: 'M24 58 L40 70 L33 96 L14 84 Z', fill: '#6B4423' },
      { d: 'M76 58 L60 70 L67 96 L86 84 Z', fill: '#6B4423' },
      { d: 'M40 70 L60 70 L67 96 L33 96 Z', fill: '#7A4E2A' },
      { d: 'M26 32 Q50 8 74 30 L76 58 L60 70 L40 70 L24 56 Z', fill: '#F2F0EA' },
      { d: 'M50 22 Q66 20 74 30 L76 58 L62 60 Z', fill: '#DCD8CE' },
      { d: 'M50 46 L76 52 Q74 70 57 73 L50 62 Z', fill: '#F7B32B' },
      { d: 'M67 63 Q74 69 63 75 Z', fill: '#C98A12' },
      { d: 'M33 37 L55 33 L53 38 L35 41 Z', fill: '#8A8A8A' },
      { d: 'M39 42 L51 40 L46 49 Z', fill: DARK },
      { d: 'M44 42 L47 42 L46 45 Z', fill: '#F7B32B' },
    ],
  },
  {
    id: 'chamois',
    name: { fr: 'Chamois', en: 'Chamois' },
    unlockLevel: 1,
    bg: '#1F3526',
    shapes: [
      { d: 'M36 30 Q28 6 43 5 Q37 15 42 30 Z', fill: DARK },
      { d: 'M64 30 Q72 6 57 5 Q63 15 58 30 Z', fill: DARK },
      { d: 'M20 35 L37 36 L30 45 Z', fill: '#B08A5E' },
      { d: 'M80 35 L63 36 L70 45 Z', fill: '#B08A5E' },
      { d: 'M33 28 L67 28 L71 54 L58 88 L42 88 L29 54 Z', fill: '#D9B889' },
      { d: 'M44 40 L56 40 L57 72 L50 80 L43 72 Z', fill: '#F2E8D8' },
      { d: 'M34 39 L44 41 L44 68 L38 58 Z', fill: '#3B2A1A' },
      { d: 'M66 39 L56 41 L56 68 L62 58 Z', fill: '#3B2A1A' },
      { d: 'M37 46 L42 47 L39 50 Z', fill: '#F2E8D8' },
      { d: 'M63 46 L58 47 L61 50 Z', fill: '#F2E8D8' },
      { d: 'M45 81 L55 81 L50 87 Z', fill: '#3B2A1A' },
    ],
  },
  {
    id: 'lynx',
    name: { fr: 'Lynx', en: 'Lynx' },
    unlockLevel: 1,
    bg: '#2A2238',
    shapes: [
      { d: 'M21 2 L26 13 L23 13 Z', fill: DARK },
      { d: 'M79 2 L74 13 L77 13 Z', fill: DARK },
      { d: 'M21 11 L41 34 L20 41 Z', fill: '#C79B6A' },
      { d: 'M79 11 L59 34 L80 41 Z', fill: '#C79B6A' },
      { d: 'M18 40 L50 30 L82 40 L85 62 L66 85 L34 85 L15 62 Z', fill: '#D6AD7B' },
      { d: 'M15 62 L31 70 L34 85 Z', fill: '#EFE3CF' },
      { d: 'M85 62 L69 70 L66 85 Z', fill: '#EFE3CF' },
      { d: 'M39 62 L50 57 L61 62 L57 78 L43 78 Z', fill: '#F4EADB' },
      { d: 'M57 37 L61 39 L58 42 Z', fill: '#8A6440' },
      { d: 'M42 36 L46 38 L43 41 Z', fill: '#8A6440' },
      { d: 'M71 56 L75 58 L72 61 Z', fill: '#8A6440' },
      { d: 'M29 56 L25 58 L28 61 Z', fill: '#8A6440' },
      { d: 'M33 48 L45 50 L36 55 Z', fill: '#7CC47F' },
      { d: 'M67 48 L55 50 L64 55 Z', fill: '#7CC47F' },
      { d: 'M38 49 L40 49 L39 53 Z', fill: DARK },
      { d: 'M62 49 L60 49 L61 53 Z', fill: DARK },
      { d: 'M46 62 L54 62 L50 67 Z', fill: '#3A2A22' },
    ],
  },
  {
    id: 'ours',
    name: { fr: 'Ours', en: 'Bear' },
    unlockLevel: 1,
    bg: '#1C2E31',
    shapes: [
      { d: circle(27, 28, 11), fill: '#6B4A32' },
      { d: circle(73, 28, 11), fill: '#6B4A32' },
      { d: circle(27, 28, 5), fill: '#4A3222' },
      { d: circle(73, 28, 5), fill: '#4A3222' },
      { d: circle(50, 57, 33), fill: '#7A5638' },
      { d: ellipse(50, 70, 15, 12), fill: '#C9A27A' },
      { d: 'M43 63 L57 63 L50 71 Z', fill: '#2A1A12' },
      { d: circle(37, 50, 3.8), fill: DARK },
      { d: circle(63, 50, 3.8), fill: DARK },
      { d: circle(38, 49, 1.2), fill: '#FFFFFF' },
      { d: circle(64, 49, 1.2), fill: '#FFFFFF' },
    ],
  },
  {
    id: 'hibou',
    name: { fr: 'Hibou', en: 'Owl' },
    unlockLevel: 1,
    bg: '#1B1F3B',
    shapes: [
      { d: 'M20 16 L37 30 L20 37 Z', fill: '#6E5238' },
      { d: 'M80 16 L63 30 L80 37 Z', fill: '#6E5238' },
      { d: 'M20 30 L80 30 L84 61 L50 93 L16 61 Z', fill: '#8C6A4B' },
      { d: circle(35, 50, 14), fill: '#E7D8BE' },
      { d: circle(65, 50, 14), fill: '#E7D8BE' },
      { d: circle(35, 50, 8), fill: '#F7B32B' },
      { d: circle(65, 50, 8), fill: '#F7B32B' },
      { d: circle(35, 50, 4), fill: DARK },
      { d: circle(65, 50, 4), fill: DARK },
      { d: 'M46 58 L54 58 L50 71 Z', fill: '#D08A1E' },
      { d: 'M37 77 L42 82 L47 77 Z', fill: '#6E5238' },
      { d: 'M53 77 L58 82 L63 77 Z', fill: '#6E5238' },
      { d: 'M45 85 L50 90 L55 85 Z', fill: '#6E5238' },
    ],
  },
  {
    id: 'lievre',
    name: { fr: 'Lièvre', en: 'Hare' },
    unlockLevel: 1,
    bg: '#1E3440',
    shapes: [
      { d: 'M32 42 Q24 3 38 3 Q47 3 45 42 Z', fill: '#CFC4B4' },
      { d: 'M35 38 Q31 10 38 10 Q43 10 42 38 Z', fill: '#E8A6A0' },
      { d: 'M68 42 Q76 3 62 3 Q53 3 55 42 Z', fill: '#CFC4B4' },
      { d: 'M65 38 Q69 10 62 10 Q57 10 58 38 Z', fill: '#E8A6A0' },
      { d: circle(50, 63, 27), fill: '#D8CEBF' },
      { d: ellipse(43, 72, 9, 7), fill: '#F0EAE0' },
      { d: ellipse(57, 72, 9, 7), fill: '#F0EAE0' },
      { d: circle(39, 57, 4), fill: DARK },
      { d: circle(61, 57, 4), fill: DARK },
      { d: circle(40, 56, 1.3), fill: '#FFFFFF' },
      { d: circle(62, 56, 1.3), fill: '#FFFFFF' },
      { d: 'M46 65 L54 65 L50 70 Z', fill: '#D07C84' },
    ],
  },
  {
    id: 'chevalier',
    name: { fr: 'Chevalier', en: 'Knight' },
    unlockLevel: 11,
    bg: '#2A2F3A',
    shapes: [
      { d: 'M50 3 Q76 6 67 31 L54 27 Q59 14 50 3 Z', fill: '#E4572E' },
      { d: 'M23 45 Q23 17 50 15 Q77 17 77 45 L77 81 Q50 95 23 81 Z', fill: '#B8C0CC' },
      { d: 'M50 15 Q77 17 77 45 L77 81 Q63 89 50 91 Z', fill: '#9AA3B1' },
      { d: 'M23 48 L77 48 L77 59 L23 59 Z', fill: '#3A4150' },
      { d: 'M29 52 L71 52 L71 55 L29 55 Z', fill: '#0E1116' },
      { d: 'M48 15 L52 15 L52 91 L48 91 Z', fill: '#E3E8EF', opacity: 0.6 },
      { d: 'M38 67 L42 67 L42 71 L38 71 Z', fill: '#3A4150' },
      { d: 'M58 67 L62 67 L62 71 L58 71 Z', fill: '#3A4150' },
      { d: 'M38 74 L42 74 L42 78 L38 78 Z', fill: '#3A4150' },
      { d: 'M58 74 L62 74 L62 78 L58 78 Z', fill: '#3A4150' },
    ],
  },
  {
    id: 'samourai',
    name: { fr: 'Samouraï', en: 'Samurai' },
    unlockLevel: 26,
    bg: '#3A1618',
    shapes: [
      { d: 'M50 31 L26 5 L33 5 L50 22 L67 5 L74 5 Z', fill: '#F2B705' },
      { d: 'M19 45 Q19 21 50 19 Q81 21 81 45 Z', fill: '#1F1F24' },
      { d: 'M48 19 L52 19 L52 45 L48 45 Z', fill: '#F2B705' },
      { d: 'M10 45 L90 45 L81 53 L19 53 Z', fill: '#2D2D34' },
      { d: 'M15 53 L30 53 L26 78 L13 71 Z', fill: '#2D2D34' },
      { d: 'M85 53 L70 53 L74 78 L87 71 Z', fill: '#2D2D34' },
      { d: 'M30 53 L70 53 L66 79 L50 91 L34 79 Z', fill: '#B3261E' },
      { d: 'M35 58 L46 60 L38 63 Z', fill: DARK },
      { d: 'M65 58 L54 60 L62 63 Z', fill: DARK },
      { d: 'M40 72 L60 72 L50 81 Z', fill: '#F2E8D8' },
      { d: 'M38 69 L50 66 L62 69 L50 70 Z', fill: DARK },
    ],
  },
  {
    id: 'dragon',
    name: { fr: 'Dragon', en: 'Dragon' },
    unlockLevel: 46,
    bg: '#112A25',
    shapes: [
      { d: 'M30 31 L15 4 L37 24 Z', fill: '#E8E0C8' },
      { d: 'M70 31 L85 4 L63 24 Z', fill: '#E8E0C8' },
      { d: 'M41 29 L46 17 L51 29 Z', fill: '#1E7A35' },
      { d: 'M49 29 L54 17 L59 29 Z', fill: '#1E7A35' },
      { d: 'M25 28 L75 28 L81 55 L66 89 L34 89 L19 55 Z', fill: '#2BA84A' },
      { d: 'M38 58 L62 58 L60 85 L40 85 Z', fill: '#7FD37F' },
      { d: 'M23 40 L46 44 L28 49 Z', fill: '#1E7A35' },
      { d: 'M77 40 L54 44 L72 49 Z', fill: '#1E7A35' },
      { d: 'M31 46 L44 48 L34 53 Z', fill: '#F7B32B' },
      { d: 'M69 46 L56 48 L66 53 Z', fill: '#F7B32B' },
      { d: 'M37 46 L39 46 L38 52 Z', fill: DARK },
      { d: 'M63 46 L61 46 L62 52 Z', fill: DARK },
      { d: 'M43 76 L47 76 L46 80 Z', fill: '#0E3B1E' },
      { d: 'M57 76 L53 76 L54 80 Z', fill: '#0E3B1E' },
    ],
  },
  {
    id: 'phenix',
    name: { fr: 'Phénix', en: 'Phoenix' },
    unlockLevel: 71,
    bg: '#2B1030',
    shapes: [
      { d: 'M50 3 Q61 17 57 31 Q71 13 73 31 Q86 22 77 45 L23 45 Q14 22 27 31 Q29 13 43 31 Q39 17 50 3 Z', fill: '#F7B32B' },
      { d: 'M50 13 Q57 24 53 36 L47 36 Q43 24 50 13 Z', fill: '#FFE08A' },
      { d: 'M25 41 Q50 26 75 41 L73 71 L50 92 L27 71 Z', fill: '#E4572E' },
      { d: 'M37 50 Q50 43 63 50 L61 71 L50 81 L39 71 Z', fill: '#F28C3A' },
      { d: 'M44 61 L56 61 L50 78 Z', fill: '#FFD166' },
      { d: 'M33 52 L45 54 L36 58 Z', fill: '#1A0A0A' },
      { d: 'M67 52 L55 54 L64 58 Z', fill: '#1A0A0A' },
      { d: 'M14 60 L27 66 L22 80 Z', fill: '#F7B32B', opacity: 0.8 },
      { d: 'M86 60 L73 66 L78 80 Z', fill: '#F7B32B', opacity: 0.8 },
    ],
  },
  {
    id: 'titan',
    name: { fr: 'Titan', en: 'Titan' },
    unlockLevel: 91,
    bg: '#1A1530',
    shapes: [
      { d: 'M25 27 L31 7 L40 20 L50 3 L60 20 L69 7 L75 27 Z', fill: '#F2B705' },
      { d: 'M47 13 L53 13 L50 19 Z', fill: '#EF4444' },
      { d: 'M21 30 L79 30 L81 77 L50 95 L19 77 Z', fill: '#D4A017' },
      { d: 'M50 30 L79 30 L81 77 L50 95 Z', fill: '#B8860B' },
      { d: 'M27 46 L73 46 L73 55 L56 55 L56 81 L44 81 L44 55 L27 55 Z', fill: '#1A1530' },
      { d: 'M31 48 L42 48 L42 53 L31 53 Z', fill: '#6EE7F9' },
      { d: 'M58 48 L69 48 L69 53 L58 53 Z', fill: '#6EE7F9' },
    ],
  },
];

export const DEFAULT_AVATAR_ID = 'renard';

export function avatarById(id: string | null | undefined): Avatar {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0]!;
}

export function isAvatarUnlocked(id: string, level: number): boolean {
  const a = AVATARS.find((x) => x.id === id);
  return a != null && level >= a.unlockLevel;
}

/** SVG autonome (pages web, exports). */
export function avatarSvg(id: string, size = 64): string {
  const a = avatarById(id);
  const shapes = a.shapes
    .map((s) => `<path d="${s.d}" fill="${s.fill}"${s.opacity != null ? ` fill-opacity="${s.opacity}"` : ''}/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}"><circle cx="50" cy="50" r="50" fill="${a.bg}"/>${shapes}</svg>`;
}
