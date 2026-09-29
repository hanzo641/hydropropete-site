import { type BBox, type LatLng } from '@conquete/core';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { hexesInBBox, type HexRow } from '@/lib/api';
import { loadGameConfig, currentConfig } from '@/lib/gameConfig';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/ui/theme';
import { hexFeatures, labelFeatures, lineFeature, regionFeatures, visibleHexes } from './hexGeo';

export const MAP_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Carte des territoires. Chargement par zone visible : à chaque arrêt de la caméra, on
 * calcule les cases H3 de l'emprise (≤ 2 500) et on ne demande au serveur que les cases
 * stockées de cette emprise. Mises à jour en direct via Supabase Realtime.
 */
export function HexMap({
  center,
  zoom = 13.5,
  lit,
  track,
  fitTo,
  followUser,
  overlay,
}: {
  center: LatLng | null;
  zoom?: number;
  /** cases à mettre en évidence (course en cours, déploiement) */
  lit?: readonly string[];
  track?: readonly LatLng[];
  /** emprise à cadrer (fin de course) */
  fitTo?: BBox | null;
  followUser?: boolean;
  overlay?: ReactNode;
}) {
  const camera = useRef<CameraRef>(null);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [rows, setRows] = useState<ReadonlyMap<string, HexRow>>(new globalThis.Map());
  const [seed, setSeed] = useState('');
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void loadGameConfig().then(({ season }) => {
      setSeed(season?.wild_seed ?? '');
      setSeasonId(season?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (fitTo) camera.current?.fitBounds([fitTo.west, fitTo.south, fitTo.east, fitTo.north], { padding: { top: 40, bottom: 40, left: 40, right: 40 }, duration: 600 });
  }, [fitTo]);

  const load = useCallback(async (b: BBox) => {
    try {
      const data = await hexesInBBox(b);
      setRows(new globalThis.Map(data.map((r) => [r.h3, r])));
    } catch {
      /* hors ligne : on garde l'affichage précédent */
    }
  }, []);

  const onRegionDidChange = useCallback(
    (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const [west, south, east, north] = e.nativeEvent.bounds;
      const b = { west, south, east, north };
      setBbox(b);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void load(b), 400);
    },
    [load],
  );

  // Temps réel : on applique les changements des cases visibles.
  useEffect(() => {
    if (seasonId == null) return;
    const channel = supabase
      .channel(`hex-${seasonId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hex_state', filter: `season_id=eq.${seasonId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<HexRow> & { h3?: string };
          if (!row.h3) return;
          setRows((prev) => {
            if (!prev.has(row.h3!) && payload.eventType !== 'INSERT') return prev;
            const next = new globalThis.Map(prev);
            if (payload.eventType === 'DELETE') {
              const old = prev.get(row.h3!);
              if (old) next.set(row.h3!, { ...old, owner_faction: null, garrison: null });
            } else {
              next.set(row.h3!, { ...(prev.get(row.h3!) as HexRow), ...(row as HexRow), contested: true });
            }
            return next;
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [seasonId]);

  const cfg = currentConfig();
  const litSet = useMemo(() => new Set(lit ?? []), [lit]);
  const hexes = useMemo(() => (bbox ? visibleHexes(bbox, rows, cfg, seed) : []), [bbox, rows, cfg, seed]);
  const hexGeo = useMemo(() => hexFeatures(hexes ?? [], litSet), [hexes, litSet]);
  const labels = useMemo(() => labelFeatures(hexes ?? []), [hexes]);
  const regions = useMemo(() => regionFeatures(new Set((hexes ?? []).map((h) => h.region)), cfg), [hexes, cfg]);
  const line = useMemo(() => lineFeature(track ?? []), [track]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE} onRegionDidChange={onRegionDidChange} attribution logo={false}>
        <Camera
          ref={camera}
          initialViewState={center ? { center: [center.lng, center.lat], zoom } : { zoom: 3, center: [2.35, 46.6] }}
          trackUserLocation={followUser ? 'course' : undefined}
          minZoom={3}
        />
        <GeoJSONSource id="regions" data={regions}>
          <Layer id="region-line" type="line" paint={{ 'line-color': '#FFFFFF', 'line-width': 2.5, 'line-opacity': 0.55 }} />
        </GeoJSONSource>
        <GeoJSONSource id="hexes" data={hexGeo}>
          <Layer
            id="hex-fill"
            type="fill"
            paint={{
              'fill-color': ['get', 'color'],
              'fill-opacity': ['case', ['get', 'lit'], 0.7, ['get', 'opacity']],
            }}
          />
          <Layer
            id="hex-line"
            type="line"
            paint={{ 'line-color': ['get', 'color'], 'line-width': 1, 'line-opacity': 0.7 }}
          />
          <Layer
            id="hex-contested"
            type="line"
            filter={['==', ['get', 'contested'], true]}
            paint={{ 'line-color': colors.danger, 'line-width': 2.5, 'line-dasharray': [2, 2] }}
          />
          <Layer
            id="hex-lit"
            type="line"
            filter={['==', ['get', 'lit'], true]}
            paint={{ 'line-color': colors.accent, 'line-width': 3 }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="labels" data={labels}>
          <Layer
            id="hex-labels"
            type="symbol"
            minzoom={12.5}
            layout={{ 'text-field': ['get', 'label'], 'text-size': 13, 'text-allow-overlap': false }}
            paint={{
              'text-color': ['case', ['get', 'owned'], '#FFFFFF', '#D5D9E0'],
              'text-halo-color': '#000000',
              'text-halo-width': 1.2,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="track" data={line}>
          <Layer id="track-line" type="line" paint={{ 'line-color': colors.accent, 'line-width': 4 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }} />
        </GeoJSONSource>
      </Map>
      {hexes === null && (
        <View style={styles.banner} pointerEvents="none">
          <Text style={{ color: colors.text }}>{t('map.tooWide')}</Text>
        </View>
      )}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
});
