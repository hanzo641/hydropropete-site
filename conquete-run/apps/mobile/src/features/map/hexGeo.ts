import {
  type BBox,
  cellCenter,
  cellPolygon,
  cellsInBBox,
  factionById,
  type GameConfig,
  type LatLng,
  regionOf,
  regionPolygon,
  WILD_COLOR,
  wildGarrison,
} from '@conquete/core';
import type { HexRow } from '@/lib/api';

export interface HexView {
  cell: string;
  region: string;
  owner: number | null;
  garrison: number;
  /** garnison sauvage estimée (altitude inconnue) */
  estimated: boolean;
  contested: boolean;
}

/** États de toutes les cases visibles : stockées (serveur) ou sauvages (calculées). */
export function visibleHexes(
  bbox: BBox,
  rows: ReadonlyMap<string, HexRow>,
  cfg: GameConfig,
  seasonSeed: string,
): HexView[] | null {
  const cells = cellsInBBox(bbox, cfg.h3.territoryRes, 2500);
  if (!cells) return null;
  return cells.map((cell) => {
    const r = rows.get(cell);
    // état stocké : territoire tenu, ou ruine neutre après une attaque
    if (r && r.garrison != null) {
      return { cell, region: r.region, owner: r.owner_faction, garrison: Number(r.garrison), estimated: false, contested: r.contested };
    }
    if (r && r.wild_garrison != null) {
      return { cell, region: r.region, owner: null, garrison: Number(r.wild_garrison), estimated: false, contested: r.contested };
    }
    return {
      cell,
      region: regionOf(cell, cfg.h3),
      owner: null,
      garrison: wildGarrison(cell, null, seasonSeed, cfg.wild),
      estimated: true,
      contested: false,
    };
  });
}

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, string | number | boolean>>;

export function hexFeatures(hexes: readonly HexView[], lit: ReadonlySet<string> = new Set()): GeoJSON.FeatureCollection {
  const features: Feature[] = [];
  for (const h of hexes) {
    const color = h.owner ? (factionById(h.owner)?.color ?? WILD_COLOR) : WILD_COLOR;
    features.push({
      type: 'Feature',
      id: h.cell,
      geometry: { type: 'Polygon', coordinates: [cellPolygon(h.cell)] },
      properties: {
        cell: h.cell,
        color,
        // opacité selon la garnison : un territoire solide est plus « plein »
        opacity: h.owner ? Math.min(0.65, 0.22 + h.garrison / 40) : 0.08,
        contested: h.contested,
        lit: lit.has(h.cell),
        wild: h.owner == null,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function labelFeatures(hexes: readonly HexView[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hexes.map((h) => {
      const c = cellCenter(h.cell);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: { label: `${h.estimated ? '≈' : ''}${Math.round(h.garrison)}`, owned: h.owner != null },
      };
    }),
  };
}

export function regionFeatures(regions: Iterable<string>, cfg: GameConfig): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [...regions].map((region) => ({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: regionPolygon(region, cfg.h3) },
      properties: { region },
    })),
  };
}

export function lineFeature(track: readonly LatLng[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      track.length > 1
        ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: track.map((p) => [p.lng, p.lat]) }, properties: {} }]
        : [],
  };
}
