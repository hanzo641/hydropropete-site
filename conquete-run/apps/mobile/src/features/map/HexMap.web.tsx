import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '@/i18n';
import { Glass } from '@/ui/components';
import { font, space } from '@/ui/theme';
import type { HexMapProps } from './HexMap';
import { MAP_LIGHT, mapLayers, SOURCES } from './layers';
import { NIGHT_STYLE } from './nightStyle';
import { useHexData } from './useHexData';

export type { FlyTarget, HexMapProps } from './HexMap';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Version web du plateau (aperçu navigateur, captures) : mêmes données et mêmes couches
 * que la carte native, rendues avec MapLibre GL JS.
 */
export function HexMap({ center, zoom = 13.6, pitch = 0, lit, track, fitTo, overlay, front, selected, onSelectHex, flyTo, showUser = true }: HexMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const { palette, onBounds, tooWide, byCell, data } = useHexData({ lit, track, front, selected });
  const layers = useMemo(() => mapLayers({ accent: palette.main, pitch }), [palette.main, pitch]);

  useEffect(() => {
    if (!container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: NIGHT_STYLE as maplibregl.StyleSpecification,
      center: center ? [center.lng, center.lat] : [2.35, 46.6],
      zoom: center ? zoom : 3,
      pitch,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = m;
    const emit = () => {
      const b = m.getBounds();
      onBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
    };
    m.on('load', () => {
      m.setLight(MAP_LIGHT as maplibregl.LightSpecification);
      for (const id of SOURCES) m.addSource(id, { type: 'geojson', data: EMPTY });
      setReady(true);
      emit();
    });
    m.on('moveend', emit);
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    for (const l of layers) if (m.getLayer(l.id)) m.removeLayer(l.id);
    for (const l of layers) m.addLayer(l as maplibregl.LayerSpecification);
  }, [ready, layers]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    for (const id of SOURCES) (m.getSource(id) as maplibregl.GeoJSONSource | undefined)?.setData(data[id === 'region-lines' ? 'regions' : id]);
  }, [ready, data]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready || !onSelectHex) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['hex-extrusion', 'hex-ground', 'hex-wild'] });
      const cell = f.find((x) => typeof x.properties?.cell === 'string')?.properties?.cell as string | undefined;
      onSelectHex(cell ? (byCell.get(cell) ?? null) : null);
    };
    m.on('click', handler);
    return () => {
      m.off('click', handler);
    };
  }, [ready, onSelectHex, byCell]);

  useEffect(() => {
    if (ready) mapRef.current?.easeTo({ pitch, duration: 600 });
  }, [pitch, ready]);

  useEffect(() => {
    if (fitTo && mapRef.current) mapRef.current.fitBounds([[fitTo.west, fitTo.south], [fitTo.east, fitTo.north]], { padding: 40, duration: 700 });
  }, [fitTo]);

  const flyKey = flyTo?.key ?? 0;
  useEffect(() => {
    if (flyTo && mapRef.current) mapRef.current.flyTo({ center: [flyTo.center.lng, flyTo.center.lat], zoom: flyTo.zoom ?? 14, pitch, duration: flyTo.duration ?? 1400 });
  }, [flyKey]);

  // position du joueur (point bleu)
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !center || !showUser) return;
    if (!marker.current) {
      const el = document.createElement('div');
      el.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#3B82F6;border:3px solid #fff;box-shadow:0 0 0 8px rgba(59,130,246,0.25)';
      marker.current = new maplibregl.Marker({ element: el }).setLngLat([center.lng, center.lat]).addTo(m);
    } else marker.current.setLngLat([center.lng, center.lat]);
  }, [center, showUser]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {tooWide && (
        <View style={{ position: 'absolute', top: '45%', alignSelf: 'center' }} pointerEvents="none">
          <Glass style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: 999 }}>
            <Text style={[font.bodyBold, { fontSize: 14 }]}>{t('map.tooWide')}</Text>
          </Glass>
        </View>
      )}
      {overlay}
    </View>
  );
}
