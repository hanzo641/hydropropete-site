import type { BBox, LatLng } from '@conquete/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hexesInBBox, type HexRow, subscribeLive } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentConfig, loadGameConfig } from '@/lib/gameConfig';
import { paletteOf } from '@/ui/theme';
import { armyFeature, hexFeatures, labelFeatures, lineFeature, outlineFeatures, regionFeatures, visibleHexes } from './hexGeo';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Données du plateau pour l'emprise visible (partagé mobile / web) : cases calculées
 * localement, cases stockées demandées au backend, mises à jour en direct.
 */
export type HexOverrides = ReadonlyMap<string, { owner: number | null; garrison: number; captain?: number | null; hideSquad?: boolean }>;

export function useHexData(opts: {
  lit?: readonly string[];
  track?: readonly LatLng[];
  front?: string | null;
  selected?: string | null;
  /** état affiché imposé pour certaines cases (séquence de bataille : avant / après) */
  overrides?: HexOverrides;
  /** troupes du joueur à déployer, affichées en armée à sa position */
  army?: { at: LatLng; troops: number } | null;
}) {
  const { profile } = useAuth();
  const palette = paletteOf(profile?.faction_id);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [rows, setRows] = useState<ReadonlyMap<string, HexRow>>(new globalThis.Map());
  const [seed, setSeed] = useState('');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBox = useRef<BBox | null>(null);

  useEffect(() => {
    void loadGameConfig().then(({ season }) => setSeed(season?.wild_seed ?? ''));
  }, []);

  const load = useCallback(async (b: BBox) => {
    try {
      const data = await hexesInBBox(b);
      setRows(new globalThis.Map(data.map((r) => [r.h3, r])));
    } catch {
      /* hors ligne : on garde l'affichage précédent */
    }
  }, []);

  const onBounds = useCallback(
    (b: BBox) => {
      lastBox.current = b;
      setBbox(b);
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void load(b), 350);
    },
    [load],
  );

  useEffect(() => {
    return subscribeLive(profile?.home_zone ?? null, (what) => {
      if (what === 'hexes' && lastBox.current) void load(lastBox.current);
    });
  }, [profile?.home_zone, load]);

  const cfg = currentConfig();
  const litList = useMemo(() => [...(opts.lit ?? [])], [opts.lit]);
  const litSet = useMemo(() => new Set(litList), [litList]);
  const hexes = useMemo(() => {
    const base = bbox ? visibleHexes(bbox, rows, cfg, seed) : [];
    if (!base || !opts.overrides || opts.overrides.size === 0) return base;
    return base.map((h) => {
      const o = opts.overrides?.get(h.cell);
      return o
        ? { ...h, owner: o.owner, garrison: o.garrison, estimated: false, contested: false, captain: o.owner == null ? null : (o.captain ?? h.captain ?? 1), hideSquad: o.hideSquad }
        : h;
    });
  }, [bbox, rows, cfg, seed, opts.overrides]);
  const byCell = useMemo(() => new globalThis.Map((hexes ?? []).map((h) => [h.cell, h])), [hexes]);
  const data = useMemo(
    () => ({
      hexes: hexFeatures(hexes ?? [], litSet, profile?.faction_id ?? null),
      labels: labelFeatures(hexes ?? []),
      regions: regionFeatures(hexes ?? [], cfg, opts.front ?? null),
      lit: litList.length ? outlineFeatures(litList) : EMPTY,
      selected: opts.selected ? outlineFeatures([opts.selected]) : EMPTY,
      track: lineFeature(opts.track ?? []),
      army: armyFeature(opts.army, profile?.faction_id ?? null, profile?.level ?? null),
    }),
    [hexes, litSet, litList, profile?.faction_id, profile?.level, cfg, opts.front, opts.selected, opts.track, opts.army],
  );
  return { palette, onBounds, tooWide: hexes === null, byCell, data };
}
