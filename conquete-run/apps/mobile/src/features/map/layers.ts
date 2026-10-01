import type { LayerSpecification, LightSpecification } from '@maplibre/maplibre-react-native';
import { colors } from '@/ui/theme';

/** Sources GeoJSON du plateau (mêmes identifiants sur mobile et sur le web). */
export const SOURCES = ['regions', 'hexes', 'region-lines', 'lit', 'selected', 'track', 'labels', 'army'] as const;
export type SourceId = (typeof SOURCES)[number];

/**
 * Couches du plateau, dans l'ordre d'affichage : partagées entre la carte native
 * (MapLibre React Native) et la version web (MapLibre GL JS).
 */
type MapLayer = LayerSpecification & { source: SourceId };

/**
 * Escouades : jusqu'à 5 soldats par case (capitaine à l'étendard devant, les autres en V
 * derrière), dessinés du fond vers l'avant. Décalages en pixels de l'image (64 × 80).
 */
const SLOTS: readonly { slot: number; offset: [number, number] }[] = [
  { slot: 3, offset: [-17, -15] },
  { slot: 4, offset: [17, -15] },
  { slot: 1, offset: [-32, -5] },
  { slot: 2, offset: [32, -5] },
  { slot: 0, offset: [0, 4] },
];
export const SQUAD_LAYER_IDS = SLOTS.flatMap(({ slot }) => [`squad-${slot}`, `army-${slot}`]);
export const BOB_MS = 900;

/** Petit mouvement des soldats (respiration) : les rangs alternent haut / bas. */
export function squadTranslate(slot: number, phase: number): [number, number] {
  return [0, (slot + phase) % 2 === 0 ? -1.6 : 0.6];
}

function squadLayers(source: 'labels' | 'army', phase: number): MapLayer[] {
  return SLOTS.map(({ slot, offset }) => ({
    id: `${source === 'army' ? 'army' : 'squad'}-${slot}`,
    source,
    type: 'symbol' as const,
    minzoom: source === 'army' ? 11 : 12.5,
    // garnisons sauvages : soldats seulement de près (moins de bruit)
    filter: ['all', ['>', ['get', 'squad'], slot], ['any', ['get', 'owned'], ['>=', ['zoom'], 14]]],
    layout: {
      'icon-image': slot === 0 ? ['get', 'captainImg'] : ['get', 'soldier'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 12.5, 0.38, 14, 0.58, 16, 0.85, 17.5, 1],
      'icon-offset': offset,
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-pitch-alignment': 'viewport',
      'symbol-z-order': 'source',
    },
    paint: {
      'icon-translate': squadTranslate(slot, phase),
      'icon-translate-transition': { duration: BOB_MS, delay: 0 },
      'icon-opacity': source === 'army' ? 1 : ['case', ['get', 'owned'], 1, 0.8],
    },
  })) as MapLayer[];
}

export function mapLayers({ accent, pitch, phase = 0 }: { accent: string; pitch: number; phase?: number }): MapLayer[] {
  return [
    { id: 'region-tint', source: 'regions', type: 'fill', filter: ['==', ['get', 'controlled'], true], paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.08 } },
    { id: 'hex-wild', source: 'hexes', type: 'fill', filter: ['==', ['get', 'wild'], true], paint: { 'fill-color': '#9AA4B5', 'fill-opacity': 0.04 } },
    { id: 'hex-grid', source: 'hexes', type: 'line', paint: { 'line-color': 'rgba(170,185,210,0.16)', 'line-width': 0.8 } },
    {
      id: 'hex-ground',
      source: 'hexes',
      type: 'fill',
      filter: ['==', ['get', 'owned'], true],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['get', 'lit'], 0.75, ['get', 'opacity']] },
    },
    {
      id: 'hex-extrusion',
      source: 'hexes',
      type: 'fill-extrusion',
      filter: ['==', ['get', 'owned'], true],
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': pitch > 0 ? 0.78 : 0,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'hex-contested',
      source: 'hexes',
      type: 'line',
      filter: ['==', ['get', 'contested'], true],
      paint: { 'line-color': colors.danger, 'line-width': 2.2, 'line-dasharray': [2, 1.5] },
    },
    {
      id: 'region-line',
      source: 'region-lines',
      type: 'line',
      paint: {
        'line-color': ['case', ['get', 'controlled'], ['get', 'color'], 'rgba(255,255,255,0.35)'],
        'line-width': ['case', ['get', 'controlled'], 2.6, 1.4],
        'line-opacity': ['case', ['get', 'controlled'], 0.9, 0.5],
      },
    },
    { id: 'front-glow', source: 'region-lines', type: 'line', filter: ['==', ['get', 'front'], true], paint: { 'line-color': colors.gold, 'line-width': 12, 'line-blur': 8, 'line-opacity': 0.55 } },
    { id: 'front-line', source: 'region-lines', type: 'line', filter: ['==', ['get', 'front'], true], paint: { 'line-color': colors.gold, 'line-width': 2.6, 'line-dasharray': [3, 1.5] } },
    { id: 'lit-glow', source: 'lit', type: 'line', paint: { 'line-color': accent, 'line-width': 9, 'line-blur': 6, 'line-opacity': 0.8 } },
    { id: 'lit-line', source: 'lit', type: 'line', paint: { 'line-color': '#FFFFFF', 'line-width': 1.8, 'line-opacity': 0.9 } },
    { id: 'sel-glow', source: 'selected', type: 'line', paint: { 'line-color': '#FFFFFF', 'line-width': 10, 'line-blur': 7, 'line-opacity': 0.6 } },
    { id: 'sel-line', source: 'selected', type: 'line', paint: { 'line-color': '#FFFFFF', 'line-width': 2.5 } },
    {
      id: 'track-glow',
      source: 'track',
      type: 'line',
      paint: { 'line-color': accent, 'line-width': 12, 'line-blur': 8, 'line-opacity': 0.6 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    },
    { id: 'track-line', source: 'track', type: 'line', paint: { 'line-color': '#FFFFFF', 'line-width': 3.5 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
    ...squadLayers('labels', phase),
    ...squadLayers('army', phase),
    // garnisons : territoires tenus dès le zoom 12, sauvages seulement de près (moins de bruit)
    {
      id: 'hex-labels-wild',
      source: 'labels',
      type: 'symbol',
      minzoom: 14,
      filter: ['==', ['get', 'owned'], false],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11.5,
        'text-anchor': 'top',
        'text-offset': [0, 0.15],
        'text-allow-overlap': false,
        'text-pitch-alignment': 'viewport',
      },
      paint: { 'text-color': 'rgba(210,218,230,0.7)', 'text-halo-color': 'rgba(0,0,0,0.9)', 'text-halo-width': 1.2 },
    },
    {
      id: 'hex-labels',
      source: 'labels',
      type: 'symbol',
      minzoom: 12,
      filter: ['==', ['get', 'owned'], true],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['case', ['get', 'fort'], 15, 12.5],
        'text-anchor': 'top',
        'text-offset': [0, 0.15],
        'text-allow-overlap': false,
        'text-pitch-alignment': 'viewport',
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': ['get', 'color'],
        'text-halo-width': 1.6,
      },
    },
    {
      id: 'army-label',
      source: 'army',
      type: 'symbol',
      minzoom: 11,
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 14,
        'text-anchor': 'top',
        'text-offset': [0, 0.3],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-pitch-alignment': 'viewport',
      },
      paint: { 'text-color': colors.gold, 'text-halo-color': 'rgba(0,0,0,0.95)', 'text-halo-width': 1.8 },
    },
  ];
}

/** Lumière des reliefs (territoires en 3D). */
export const MAP_LIGHT: LightSpecification = { anchor: 'viewport', position: [1.4, 200, 35], color: '#FFFFFF', intensity: 0.32 };
