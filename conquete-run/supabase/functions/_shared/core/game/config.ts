import { DEFAULT_ANTI_CHEAT, type AntiCheatConfig } from '../gps/validation.ts';
import { DEFAULT_GPS_CONFIG, type GpsPipelineConfig } from '../gps/types.ts';

/**
 * Tous les paramètres de jeu. La valeur effective = DEFAULT_GAME_CONFIG fusionnée avec le
 * JSON de la table `game_config` (puis les surcharges de la saison). Modifiable sans
 * redéployer l'app.
 */
export interface GameConfig {
  h3: { territoryRes: number; regionRes: number; zoneRes: number };
  troops: {
    perKm: number;
    perDplus100m: number;
    deployWindowHours: number;
    dailyKmCap: number;
    dailyDplusCap: number;
  };
  territory: { minMetersInCell: number };
  combat: { defenseMultiplier: number; minGarrisonAfterCapture: number; maxGarrison: number };
  erosion: { dailyRate: number; abandonThreshold: number };
  region: { controlThreshold: number; troopBonus: number };
  wild: { base: number; altitudeStartM: number; altitudeStepM: number; jitter: number; max: number };
  factions: { count: number; balanceMargin: number; balanceMinPlayers: number };
  /** série : jours consécutifs avec une course validée d'au moins minKm */
  streak: { minKm: number; bonusPerDay: number; maxBonus: number };
  /** front du jour : une région par zone où les prises comptent plus */
  front: { pointsMultiplier: number; xpMultiplier: number };
  season: { lengthDays: number };
  xp: {
    perKm: number;
    per10mDplus: number;
    perActiveMinute: number;
    perCapture: number;
    perReinforce: number;
  };
  score: { perCapture: number; perTroopDeployed: number; perKm: number };
  privacy: { defaultRadiusM: number; minRadiusM: number; maxRadiusM: number; trimStartEndM: number };
  gps: GpsPipelineConfig;
  antiCheat: AntiCheatConfig;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  h3: { territoryRes: 8, regionRes: 6, zoneRes: 4 },
  troops: { perKm: 1, perDplus100m: 1, deployWindowHours: 48, dailyKmCap: 42, dailyDplusCap: 3000 },
  territory: { minMetersInCell: 30 },
  combat: { defenseMultiplier: 1.2, minGarrisonAfterCapture: 1, maxGarrison: 60 },
  erosion: { dailyRate: 0.05, abandonThreshold: 1 },
  region: { controlThreshold: 0.5, troopBonus: 0.1 },
  wild: { base: 1, altitudeStartM: 300, altitudeStepM: 400, jitter: 1, max: 6 },
  factions: { count: 2, balanceMargin: 0.1, balanceMinPlayers: 6 },
  streak: { minKm: 2, bonusPerDay: 0.1, maxBonus: 0.5 },
  front: { pointsMultiplier: 2, xpMultiplier: 1.5 },
  season: { lengthDays: 28 },
  xp: { perKm: 10, per10mDplus: 1, perActiveMinute: 2, perCapture: 15, perReinforce: 3 },
  score: { perCapture: 10, perTroopDeployed: 1, perKm: 1 },
  privacy: { defaultRadiusM: 300, minRadiusM: 200, maxRadiusM: 1000, trimStartEndM: 200 },
  gps: DEFAULT_GPS_CONFIG,
  antiCheat: DEFAULT_ANTI_CHEAT,
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Fusion profonde tolérante : seules les clés connues et du bon type sont prises en compte
 * (une faute de frappe dans la table ne casse pas le jeu).
 */
export function mergeConfig<T>(base: T, override: unknown): T {
  if (!isObject(override) || !isObject(base)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override)) {
    if (!(k in out)) continue;
    const cur = out[k];
    if (isObject(cur)) out[k] = mergeConfig(cur, v);
    else if (typeof cur === typeof v) out[k] = v;
  }
  return out as T;
}

export function resolveConfig(...overrides: unknown[]): GameConfig {
  return overrides.reduce<GameConfig>((acc, o) => mergeConfig(acc, o), DEFAULT_GAME_CONFIG);
}

/** Vérifie la cohérence des paramètres ; renvoie la liste des problèmes. */
export function validateConfig(c: GameConfig): string[] {
  const errors: string[] = [];
  const check = (ok: boolean, msg: string): void => {
    if (!ok) errors.push(msg);
  };
  check(c.h3.zoneRes < c.h3.regionRes && c.h3.regionRes < c.h3.territoryRes, 'h3 : zone < région < territoire');
  check(c.h3.territoryRes >= 6 && c.h3.territoryRes <= 10, 'h3.territoryRes entre 6 et 10');
  check(c.combat.defenseMultiplier >= 1, 'combat.defenseMultiplier ≥ 1');
  check(c.erosion.dailyRate >= 0 && c.erosion.dailyRate < 1, 'erosion.dailyRate dans [0, 1[');
  check(c.region.controlThreshold > 0 && c.region.controlThreshold <= 1, 'region.controlThreshold dans ]0, 1]');
  check(c.factions.count >= 2 && c.factions.count <= 4, 'factions.count entre 2 et 4');
  check(c.wild.max >= c.wild.base, 'wild.max ≥ wild.base');
  check(c.troops.deployWindowHours > 0, 'troops.deployWindowHours > 0');
  return errors;
}

export type { Json };
