import { DEFAULT_GAME_CONFIG, type GameConfig, resolveConfig } from '@conquete/core';
import { GAME_MODE, getLocalGame } from '@/backend';
import { supabase } from './supabase';

export interface Season {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  status: 'upcoming' | 'active' | 'closed';
  wild_seed: string;
  config_overrides: unknown;
  is_demo: boolean;
}

let cached: { cfg: GameConfig; season: Season | null; at: number } | null = null;

function localConfig(): { cfg: GameConfig; season: Season | null; at: number } {
  const g = getLocalGame();
  const s = g.seasonInfo();
  return {
    cfg: g.cfg,
    season: { ...s, status: 'active', config_overrides: null, is_demo: false },
    at: Date.now(),
  };
}

/** Paramètres de jeu effectifs, relus toutes les 10 minutes (modifiables sans nouvelle version). */
export async function loadGameConfig(force = false): Promise<{ cfg: GameConfig; season: Season | null }> {
  if (GAME_MODE === 'local') {
    cached = localConfig();
    return cached;
  }
  if (!force && cached && Date.now() - cached.at < 600_000) return cached;
  try {
    const [{ data: gc }, { data: season }] = await Promise.all([
      supabase.from('game_config').select('config').eq('id', 1).maybeSingle(),
      supabase.from('seasons').select('*').eq('status', 'active').maybeSingle(),
    ]);
    const s = (season as Season | null) ?? null;
    cached = { cfg: resolveConfig(gc?.config, s?.config_overrides), season: s, at: Date.now() };
  } catch {
    cached = cached ?? { cfg: DEFAULT_GAME_CONFIG, season: null, at: 0 };
  }
  return cached;
}

export function currentConfig(): GameConfig {
  if (GAME_MODE === 'local') return getLocalGame().cfg;
  return cached?.cfg ?? DEFAULT_GAME_CONFIG;
}
