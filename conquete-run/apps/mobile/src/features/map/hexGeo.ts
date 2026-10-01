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
import { soldierImageId, squadSize, tierForLevel } from '@/ui/soldierArt';

export interface HexView {
  cell: string;
  region: string;
  owner: number | null;
  garrison: number;
  /** garnison sauvage estimée (altitude inconnue) */
  estimated: boolean;
  contested: boolean;
  /** faction qui contrôle la région de la case */
  regionFaction: number | null;
  /** niveau du capitaine (tenue des soldats) ; null = garnison sauvage */
  captain: number | null;
  /** soldats masqués (la séquence de bataille les dessine elle-même) */
  hideSquad?: boolean;
}

/** Garnison à partir de laquelle un territoire est une « forteresse » (anneau doré). */
export const FORTRESS_GARRISON = 15;

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
      return {
        cell,
        region: r.region,
        owner: r.owner_faction,
        garrison: Number(r.garrison),
        estimated: false,
        contested: r.contested,
        regionFaction: r.region_faction,
        captain: r.owner_faction != null ? (r.captain_level ?? 1) : null,
      };
    }
    if (r && r.wild_garrison != null) {
      return { cell, region: r.region, owner: null, garrison: Number(r.wild_garrison), estimated: false, contested: r.contested, regionFaction: r.region_faction, captain: null };
    }
    return {
      cell,
      region: regionOf(cell, cfg.h3),
      owner: null,
      garrison: wildGarrison(cell, null, seasonSeed, cfg.wild),
      estimated: true,
      contested: false,
      regionFaction: null,
      captain: null,
    };
  });
}

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, string | number | boolean>>;

/** Hauteur (m) d'un territoire en 3D : croît avec la racine de la garnison. */
export function extrusionHeight(garrison: number): number {
  return Math.round(30 + Math.sqrt(Math.max(0, garrison)) * 55);
}

export function hexFeatures(
  hexes: readonly HexView[],
  lit: ReadonlySet<string> = new Set(),
  myFaction: number | null = null,
): GeoJSON.FeatureCollection {
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
        owned: h.owner != null,
        height: h.owner ? extrusionHeight(h.garrison) : 0,
        // opacité selon la garnison : un territoire solide est plus « plein »
        opacity: h.owner ? Math.min(0.6, 0.25 + h.garrison / 40) : 0.05,
        contested: h.contested,
        lit: lit.has(h.cell),
        wild: h.owner == null,
        mine: myFaction != null && h.owner === myFaction,
        fort: h.garrison >= FORTRESS_GARRISON,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Propriétés d'une escouade de soldats (couches `squad-*`, voir layers.ts). */
function squadProps(owner: number | null, captain: number | null, garrison: number) {
  const tier = owner == null ? 0 : tierForLevel(captain);
  return {
    squad: squadSize(garrison),
    soldier: soldierImageId(owner, tier),
    captainImg: soldierImageId(owner, tier, true),
  };
}

export function labelFeatures(hexes: readonly HexView[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: hexes.map((h) => {
      const c = cellCenter(h.cell);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: {
          label: `${h.estimated ? '≈' : ''}${Math.round(h.garrison)}`,
          owned: h.owner != null,
          color: h.owner ? (factionById(h.owner)?.color ?? WILD_COLOR) : '#3A3F48',
          fort: h.garrison >= FORTRESS_GARRISON,
          ...squadProps(h.owner, h.captain, h.hideSquad ? 0 : h.garrison),
        },
      };
    }),
  };
}

/** L'armée du joueur (troupes pas encore déployées) qui l'accompagne sur la carte. */
export function armyFeature(army: { at: LatLng; troops: number } | null | undefined, faction: number | null, level: number | null): GeoJSON.FeatureCollection {
  if (!army || army.troops <= 0 || faction == null) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [army.at.lng, army.at.lat] },
        properties: { label: `⚔ ${army.troops}`, owned: true, ...squadProps(faction, level ?? 1, army.troops * 2) },
      },
    ],
  };
}

/** Contour d'une liste de cases (surbrillance : course en cours, sélection). */
export function outlineFeatures(cells: readonly string[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cells.map((cell) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [cellPolygon(cell)] },
      properties: { cell },
    })),
  };
}

export function regionFeatures(hexes: readonly HexView[], cfg: GameConfig, front: string | null = null): GeoJSON.FeatureCollection {
  const controller = new Map<string, number | null>();
  for (const h of hexes) if (!controller.has(h.region) || h.regionFaction != null) controller.set(h.region, h.regionFaction);
  if (front && !controller.has(front)) controller.set(front, null);
  return {
    type: 'FeatureCollection',
    features: [...controller].map(([region, f]) => ({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: regionPolygon(region, cfg.h3) },
      properties: { region, controlled: f != null, front: region === front, color: f != null ? (factionById(f)?.color ?? '#FFFFFF') : '#FFFFFF' },
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
