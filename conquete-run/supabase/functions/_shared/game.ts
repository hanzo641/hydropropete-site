import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type DemProvider,
  type GameConfig,
  IgnAltiProvider,
  OpenTopoDataProvider,
  resolveConfig,
} from './core/index.ts';

export interface SeasonRow {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  wild_seed: string;
  config_overrides: unknown;
  is_demo: boolean;
}

/** Configuration effective (défauts du core + game_config + surcharges de la saison active). */
export async function loadConfig(db: SupabaseClient): Promise<{ cfg: GameConfig; season: SeasonRow | null }> {
  const [{ data: gc, error: e1 }, { data: season, error: e2 }] = await Promise.all([
    db.from('game_config').select('config').eq('id', 1).single(),
    db.from('seasons').select('*').eq('status', 'active').maybeSingle(),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const s = season as SeasonRow | null;
  return { cfg: resolveConfig(gc?.config, s?.config_overrides), season: s };
}

/**
 * Fournisseurs de MNT selon DEM_PROVIDERS (défaut « ign,opentopodata »).
 * OPENTOPODATA_URL permet de pointer vers une instance auto-hébergée.
 */
export function demProviders(): DemProvider[] {
  const names = (Deno.env.get('DEM_PROVIDERS') ?? 'ign,opentopodata').split(',').map((s) => s.trim());
  const out: DemProvider[] = [];
  for (const n of names) {
    if (n === 'ign') out.push(new IgnAltiProvider(fetch));
    if (n === 'opentopodata') {
      out.push(
        new OpenTopoDataProvider(fetch, {
          baseUrl: Deno.env.get('OPENTOPODATA_URL') ?? undefined,
          datasets: Deno.env.get('OPENTOPODATA_DATASETS') ?? undefined,
        }),
      );
    }
  }
  return out;
}
