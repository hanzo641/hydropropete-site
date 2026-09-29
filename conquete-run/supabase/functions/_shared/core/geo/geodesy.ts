/** Outils géodésiques simples (précision métrique suffisante à l'échelle d'une course). */

export interface LatLng {
  lat: number;
  lng: number;
}

export const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number): number => (deg * Math.PI) / 180;
const toDeg = (rad: number): number => (rad * 180) / Math.PI;

/** Distance orthodromique (haversine) en mètres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Projection locale plane (équirectangulaire) autour d'une origine : x vers l'est, y vers le
 * nord, en mètres. Erreur < 0,1 % sur quelques dizaines de km, ce qui suffit pour filtrer.
 */
export class LocalProjection {
  private readonly cosLat: number;

  readonly origin: LatLng;

  constructor(origin: LatLng) {
    this.origin = origin;
    this.cosLat = Math.cos(toRad(origin.lat));
  }

  toXY(p: LatLng): { x: number; y: number } {
    return {
      x: toRad(p.lng - this.origin.lng) * EARTH_RADIUS_M * this.cosLat,
      y: toRad(p.lat - this.origin.lat) * EARTH_RADIUS_M,
    };
  }

  toLatLng(x: number, y: number): LatLng {
    return {
      lat: this.origin.lat + toDeg(y / EARTH_RADIUS_M),
      lng: this.origin.lng + toDeg(x / (EARTH_RADIUS_M * this.cosLat)),
    };
  }
}

/** Point intermédiaire (interpolation linéaire, valable sur de courtes distances). */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Longueur d'une polyligne en mètres. */
export function polylineLengthM(points: readonly LatLng[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineM(points[i - 1]!, points[i]!);
  return d;
}

/**
 * Rééchantillonne une polyligne à pas constant (en mètres), extrémités incluses.
 * Renvoie aussi la distance cumulée de chaque point.
 */
export function resamplePolyline(
  points: readonly LatLng[],
  stepM: number,
): { point: LatLng; distM: number }[] {
  const out: { point: LatLng; distM: number }[] = [];
  if (points.length === 0) return out;
  out.push({ point: points[0]!, distM: 0 });
  let carried = 0; // distance parcourue depuis le dernier échantillon
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const seg = haversineM(a, b);
    if (seg === 0) continue;
    let pos = stepM - carried; // position du prochain échantillon dans ce segment
    while (pos <= seg) {
      out.push({ point: interpolate(a, b, pos / seg), distM: total + pos });
      pos += stepM;
    }
    carried = seg - (pos - stepM);
    total += seg;
  }
  const last = points[points.length - 1]!;
  const prev = out[out.length - 1]!;
  if (total - prev.distM > 0.5) out.push({ point: last, distM: total });
  return out;
}
