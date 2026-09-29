import { haversineM, type LatLng } from './geodesy.ts';

/** Zone de confidentialité (domicile, travail…) : rien de ce qui s'y passe n'est public. */
export interface PrivacyZone extends LatLng {
  radiusM: number;
}

export function isInPrivacyZone(p: LatLng, zones: readonly PrivacyZone[]): boolean {
  return zones.some((z) => haversineM(z, p) <= z.radiusM);
}

/**
 * Masque une trace avant tout affichage à un tiers : retire les points dans les zones de
 * confidentialité, et les `trimM` premiers et derniers mètres (même sans zone déclarée,
 * le départ et l'arrivée d'une course révèlent souvent le domicile).
 */
export function maskTrace<T extends LatLng>(points: readonly T[], zones: readonly PrivacyZone[], trimM: number): T[] {
  if (points.length === 0) return [];
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let start = 0;
  while (start < points.length && haversineM(first, points[start]!) < trimM) start++;
  let end = points.length - 1;
  while (end >= start && haversineM(last, points[end]!) < trimM) end--;
  return points.slice(start, end + 1).filter((p) => !isInPrivacyZone(p, zones));
}

/** Arrondi à ~100 m : on ne stocke jamais la position exacte du domicile. */
export function coarsen(p: LatLng): LatLng {
  return { lat: Math.round(p.lat * 1000) / 1000, lng: Math.round(p.lng * 1000) / 1000 };
}
