import type { Allocation } from '@conquete/core';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  username: string;
  faction_id: number | null;
  home_zone: string | null;
  locale: 'fr' | 'en';
  xp: number;
  level: number;
  runs_count: number;
  total_km: number;
  total_dplus_m: number;
  captures_count: number;
  regions_taken: number;
  distinct_cells: number;
}

export interface RunRow {
  id: string;
  client_run_id: string;
  source: string;
  status: 'validated' | 'rejected';
  rejection_code: string | null;
  rejection_details: Record<string, string | number> | null;
  started_at: string | null;
  duration_s: number | null;
  moving_s: number | null;
  distance_m: number | null;
  dplus_m: number | null;
  dplus_source: string | null;
  counted_km: number;
  troops_earned: number;
  troops_remaining: number;
  deploy_deadline: string | null;
  cells: { cell: string; region: string; zone: string; meters: number }[];
  xp_earned: number;
  season_id: number | null;
}

export interface HexRow {
  h3: string;
  region: string;
  zone: string;
  owner_faction: number | null;
  garrison: number | null;
  wild_garrison: number | null;
  elevation_m: number | null;
  last_attacked_at: string | null;
  contested: boolean;
}

export interface DeployTargetRow {
  h3: string;
  region: string;
  owner_faction: number | null;
  garrison: number;
  region_controller: number | null;
}

export interface DeployResultRow {
  h3: string;
  troops: number;
  effective: number;
  outcome: 'reinforced' | 'captured' | 'damaged';
  before_owner: number | null;
  before_garrison: number;
  after_owner: number | null;
  after_garrison: number;
}

export interface FeedEvent {
  id: number;
  kind: 'capture' | 'region_gained' | 'region_lost' | 'defense' | 'season_end';
  faction_id: number | null;
  actor_name: string | null;
  h3: string | null;
  payload: { count?: number } & Record<string, unknown>;
  created_at: string;
}

function unwrap<T>(r: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return r.data as T;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  return unwrap(await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle()) as Profile | null;
}

export async function completeOnboarding(p: {
  username: string;
  faction: number | null;
  zone: string;
  birthYear: number;
  locale: string;
  gpsConsent: boolean;
  termsVersion: string;
}): Promise<Profile> {
  return unwrap(
    await supabase.rpc('complete_onboarding', {
      p_username: p.username,
      p_faction: p.faction,
      p_zone: p.zone,
      p_birth_year: p.birthYear,
      p_locale: p.locale,
      p_gps_consent: p.gpsConsent,
      p_terms_version: p.termsVersion,
    }),
  ) as Profile;
}

export async function zoneFactionCounts(zone: string): Promise<Map<number, number>> {
  const rows = unwrap(await supabase.rpc('zone_faction_counts', { p_zone: zone })) as { faction_id: number; players: number }[];
  return new Map(rows.map((r) => [r.faction_id, Number(r.players)]));
}

export async function hexesInBBox(b: { south: number; west: number; north: number; east: number }): Promise<HexRow[]> {
  return unwrap(
    await supabase.rpc('hexes_in_bbox', { p_south: b.south, p_west: b.west, p_north: b.north, p_east: b.east }),
  ) as HexRow[];
}

export async function getRun(id: string): Promise<RunRow> {
  return unwrap(await supabase.from('runs').select('*').eq('id', id).single()) as RunRow;
}

export async function myRuns(limit = 50): Promise<RunRow[]> {
  return unwrap(await supabase.from('runs').select('*').order('started_at', { ascending: false }).limit(limit)) as RunRow[];
}

export async function pendingDeployments(): Promise<RunRow[]> {
  return unwrap(
    await supabase
      .from('runs')
      .select('*')
      .gt('troops_remaining', 0)
      .gt('deploy_deadline', new Date().toISOString())
      .order('started_at', { ascending: false }),
  ) as RunRow[];
}

export async function deployTargets(runId: string): Promise<DeployTargetRow[]> {
  return unwrap(await supabase.rpc('deploy_targets', { p_run: runId })) as DeployTargetRow[];
}

export async function deployTroops(runId: string, allocations: Allocation[]): Promise<DeployResultRow[]> {
  return unwrap(
    await supabase.rpc('deploy_troops', {
      p_run: runId,
      p_allocations: allocations.map((a) => ({ cell: a.cell, troops: a.troops })),
    }),
  ) as DeployResultRow[];
}

export async function zoneFeed(zone: string, limit = 30): Promise<FeedEvent[]> {
  return unwrap(
    await supabase.from('events').select('*').eq('zone', zone).order('created_at', { ascending: false }).limit(limit),
  ) as FeedEvent[];
}

export interface ZoneLeaderboardRow {
  user_id: string;
  username: string;
  faction_id: number;
  points: number;
  captures: number;
  rank: number;
}

export async function zoneLeaderboard(zone: string): Promise<ZoneLeaderboardRow[]> {
  return unwrap(await supabase.rpc('zone_leaderboard', { p_zone: zone, p_limit: 30 })) as ZoneLeaderboardRow[];
}

export interface FactionScoreRow {
  faction_id: number;
  territory_days: number;
  hexes_now: number;
}

export async function zoneFactionScores(zone: string | null): Promise<FactionScoreRow[]> {
  return unwrap(await supabase.rpc('faction_scores', { p_zone: zone })) as FactionScoreRow[];
}

export async function teamOverview(zone: string): Promise<{
  members: { id: string; username: string; level: number }[];
  hexes: number;
  regions: number;
}> {
  return unwrap(await supabase.rpc('team_overview', { p_zone: zone })) as {
    members: { id: string; username: string; level: number }[];
    hexes: number;
    regions: number;
  };
}

export async function myTrophies(): Promise<string[]> {
  const { data: u } = await supabase.auth.getUser();
  const rows = unwrap(await supabase.from('trophies_earned').select('trophy_id').eq('user_id', u.user?.id ?? '')) as {
    trophy_id: string;
  }[];
  return rows.map((r) => r.trophy_id);
}

export async function weeklyProgress(): Promise<{ distance: number; dplus: number; wild_captures: number; new_cells: number }> {
  return unwrap(await supabase.rpc('my_weekly_progress')) as {
    distance: number;
    dplus: number;
    wild_captures: number;
    new_cells: number;
  };
}

export async function setPrivacyZone(lat: number | null, lng: number | null, radiusM: number): Promise<void> {
  unwrap(await supabase.rpc('set_privacy_zone', { p_lat: lat, p_lng: lng, p_radius_m: radiusM }));
}

export async function getPrivacySettings(): Promise<{ privacy_radius_m: number; has_zone: boolean } | null> {
  const rows = unwrap(await supabase.rpc('my_privacy_settings')) as { privacy_radius_m: number; has_zone: boolean }[];
  return rows[0] ?? null;
}

export async function invokeFunction<T>(name: string, body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (error) {
    let code = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') code = ((await ctx.json()) as { error?: string }).error ?? code;
    } catch {
      /* corps illisible */
    }
    throw Object.assign(new Error(code), { code });
  }
  return data as T;
}
