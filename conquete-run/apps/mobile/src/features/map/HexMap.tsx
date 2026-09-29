import type { BBox, LatLng } from '@conquete/core';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  type PressEventWithFeatures,
  UserLocation,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native';
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from 'react';
import { type NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { Glass } from '@/ui/components';
import { font, space } from '@/ui/theme';
import type { HexView } from './hexGeo';
import { MAP_LIGHT, mapLayers, SOURCES } from './layers';
import { NIGHT_STYLE } from './nightStyle';
import { useHexData } from './useHexData';

const CUSTOM_STYLE = process.env.EXPO_PUBLIC_MAP_STYLE_URL;

export interface FlyTarget {
  center: LatLng;
  zoom?: number;
  /** change à chaque demande (même centre deux fois de suite) */
  key: number;
  duration?: number;
}

export interface HexMapProps {
  center: LatLng | null;
  zoom?: number;
  pitch?: number;
  /** cases à mettre en évidence (course en cours, déploiement) */
  lit?: readonly string[];
  track?: readonly LatLng[];
  /** emprise à cadrer (fin de course) */
  fitTo?: BBox | null;
  followUser?: boolean;
  overlay?: ReactNode;
  front?: string | null;
  selected?: string | null;
  onSelectHex?: (h: HexView | null) => void;
  flyTo?: FlyTarget | null;
  showUser?: boolean;
  /** marge basse des mentions OpenStreetMap (au-dessus de la barre d'onglets) */
  attributionBottom?: number;
}

/**
 * Plateau de jeu : carte nocturne, territoires en relief (hauteur = garnison), régions,
 * front du jour. Chargement par zone visible (≤ 2 500 cases calculées localement, seules
 * les cases stockées sont demandées au backend) et mises à jour en direct.
 */
export function HexMap({
  center,
  zoom = 13.6,
  pitch = 0,
  lit,
  track,
  fitTo,
  followUser,
  overlay,
  front,
  selected,
  onSelectHex,
  flyTo,
  showUser = true,
  attributionBottom = 8,
}: HexMapProps) {
  const camera = useRef<CameraRef>(null);
  const { palette, onBounds, tooWide, byCell, data } = useHexData({ lit, track, front, selected });
  const layers = useMemo(() => mapLayers({ accent: palette.main, pitch }), [palette.main, pitch]);

  useEffect(() => {
    if (fitTo) {
      camera.current?.fitBounds([fitTo.west, fitTo.south, fitTo.east, fitTo.north], {
        padding: { top: 60, bottom: 60, left: 40, right: 40 },
        duration: 700,
      });
    }
  }, [fitTo]);

  const flyKey = flyTo?.key ?? 0;
  useEffect(() => {
    // on ne vole qu'à chaque nouvelle demande (clé), pas à chaque rendu
    if (flyTo) camera.current?.flyTo({ center: [flyTo.center.lng, flyTo.center.lat], zoom: flyTo.zoom ?? 14, pitch, duration: flyTo.duration ?? 1400 });
  }, [flyKey, pitch]);

  const onRegionDidChange = useCallback(
    (e: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      const [west, south, east, north] = e.nativeEvent.bounds;
      onBounds({ west, south, east, north });
    },
    [onBounds],
  );

  const onHexPress = useCallback(
    (e: NativeSyntheticEvent<PressEventWithFeatures>) => {
      const cell = e.nativeEvent.features.find((f) => typeof f.properties?.cell === 'string')?.properties?.cell as string | undefined;
      if (cell && onSelectHex) {
        e.stopPropagation();
        onSelectHex(byCell.get(cell) ?? null);
      }
    },
    [byCell, onSelectHex],
  );

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={CUSTOM_STYLE || NIGHT_STYLE}
        onRegionDidChange={onRegionDidChange}
        onPress={() => onSelectHex?.(null)}
        light={MAP_LIGHT}
        attribution
        attributionPosition={{ bottom: attributionBottom, left: 8 }}
        logo={false}
        compass={false}>
        <Camera
          ref={camera}
          initialViewState={center ? { center: [center.lng, center.lat], zoom, pitch } : { zoom: 3, center: [2.35, 46.6] }}
          trackUserLocation={followUser ? 'course' : undefined}
          minZoom={3}
          maxZoom={17.5}
        />
        {SOURCES.map((id) => (
          <GeoJSONSource key={id} id={id} data={data[id === 'region-lines' ? 'regions' : id]} onPress={id === 'hexes' && onSelectHex ? onHexPress : undefined}>
            {layers
              .filter((l) => l.source === id)
              .map(({ source: _s, ...l }) => (
                <Layer key={l.id} {...l} />
              ))}
          </GeoJSONSource>
        ))}
        {showUser && <UserLocation heading accuracy animated />}
      </Map>
      {tooWide && (
        <View style={styles.banner} pointerEvents="none">
          <Glass style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 999 }}>
            <Text style={[font.bodyBold, { fontSize: 14 }]}>{t('map.tooWide')}</Text>
          </Glass>
        </View>
      )}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', top: '45%', alignSelf: 'center' },
});
