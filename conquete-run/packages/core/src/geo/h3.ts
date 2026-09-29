import {
  cellToBoundary,
  cellToChildrenSize,
  cellToLatLng,
  cellToParent,
  getResolution,
  gridDisk,
  isValidCell,
  latLngToCell,
  polygonToCells,
} from 'h3-js';
import type { GameConfig } from '../game/config.ts';
import { haversineM, interpolate, type LatLng } from './geodesy.ts';

/**
 * Grille mondiale automatique : territoires = cellules H3 (rés. 8), régions = cellule
 * parente (rés. 6), zones = cellule parente (rés. 4). Rien n'est dessiné à la main.
 */
export type H3Res = Pick<GameConfig['h3'], 'territoryRes' | 'regionRes' | 'zoneRes'>;

export function territoryAt(p: LatLng, res: H3Res): string {
  return latLngToCell(p.lat, p.lng, res.territoryRes);
}

export function regionOf(cell: string, res: H3Res): string {
  return cellToParent(cell, res.regionRes);
}

export function zoneOf(cell: string, res: H3Res): string {
  return cellToParent(cell, res.zoneRes);
}

export function zoneAt(p: LatLng, res: H3Res): string {
  return latLngToCell(p.lat, p.lng, res.zoneRes);
}

export function isTerritory(cell: string, res: H3Res): boolean {
  return isValidCell(cell) && getResolution(cell) === res.territoryRes;
}

/** Nombre de territoires dans une région (49 pour 6 → 8, hors pentagones). */
export function territoriesPerRegion(region: string, res: H3Res): number {
  return cellToChildrenSize(region, res.territoryRes);
}

export function neighbors(cell: string): string[] {
  return gridDisk(cell, 1).filter((c) => c !== cell);
}

export function cellCenter(cell: string): LatLng {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** Contour GeoJSON ([lng, lat], fermé). */
export function cellPolygon(cell: string): [number, number][] {
  return cellToBoundary(cell, true) as [number, number][];
}

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Cellules d'une emprise (chargement de la carte par zone visible). Renvoie null si
 * l'emprise contient plus de `max` cellules (l'app affiche alors les régions).
 */
export function cellsInBBox(b: BBox, res: number, max = 2500): string[] | null {
  // estimation préalable pour ne pas générer des millions de cellules
  const diag = haversineM({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east });
  const cellAreaKm2 = [4.3e6, 6.1e5, 8.7e4, 1.2e4, 1770, 253, 36.1, 5.16, 0.737, 0.105, 0.015][res] ?? 0.737;
  if ((diag / 1000) ** 2 / 2 / cellAreaKm2 > max * 1.5) return null;
  const ring: [number, number][] = [
    [b.south, b.west],
    [b.south, b.east],
    [b.north, b.east],
    [b.north, b.west],
    [b.south, b.west],
  ];
  const cells = polygonToCells(ring, res, false);
  return cells.length > max ? null : cells;
}

export interface CrossedCell {
  cell: string;
  meters: number;
  /** horodatage de première entrée (si connu) */
  firstT: number | null;
}

/**
 * Suivi incrémental des cellules traversées : la distance de chaque petit pas (≤ 5 m) est
 * attribuée à la cellule de son milieu. Une cellule « compte » à partir de minMeters (30 m)
 * pour ne pas gagner une case frôlée à cause de l'imprécision GPS.
 */
export class CellTracker {
  private readonly meters = new Map<string, { meters: number; firstT: number | null }>();
  private readonly lit = new Set<string>();
  private readonly order: string[] = [];
  private last: (LatLng & { t?: number; afterGap?: boolean }) | null = null;

  private readonly res: number;
  private readonly minMeters: number;
  private readonly stepM: number;

  constructor(res: number, minMeters: number, stepM = 5) {
    this.res = res;
    this.minMeters = minMeters;
    this.stepM = stepM;
  }

  /** Ajoute un point filtré ; renvoie les cellules qui viennent de s'allumer. */
  add(p: LatLng & { t?: number; afterGap?: boolean }): string[] {
    const prev = this.last;
    this.last = p;
    if (!prev || p.afterGap) return [];
    const d = haversineM(prev, p);
    if (d === 0) return [];
    const n = Math.max(1, Math.ceil(d / this.stepM));
    const newlyLit: string[] = [];
    for (let i = 0; i < n; i++) {
      const mid = interpolate(prev, p, (i + 0.5) / n);
      const cell = latLngToCell(mid.lat, mid.lng, this.res);
      const e = this.meters.get(cell) ?? { meters: 0, firstT: p.t ?? null };
      e.meters += d / n;
      this.meters.set(cell, e);
      if (!this.lit.has(cell) && e.meters >= this.minMeters) {
        this.lit.add(cell);
        this.order.push(cell);
        newlyLit.push(cell);
      }
    }
    return newlyLit;
  }

  /** Cellules validées, dans l'ordre de passage. */
  cells(): CrossedCell[] {
    return this.order.map((cell) => ({ cell, meters: this.meters.get(cell)!.meters, firstT: this.meters.get(cell)!.firstT }));
  }

  has(cell: string): boolean {
    return this.lit.has(cell);
  }
}

export function crossedCells(
  points: readonly (LatLng & { t?: number; afterGap?: boolean })[],
  res: number,
  minMeters: number,
): CrossedCell[] {
  const tracker = new CellTracker(res, minMeters);
  for (const p of points) tracker.add(p);
  return tracker.cells();
}
