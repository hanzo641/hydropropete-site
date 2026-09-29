import { type Allocation, zoneAt } from '@conquete/core';
import { currentConfig } from '@/lib/gameConfig';
import { supabase } from '@/lib/supabase';
import type {
  BBox,
  DeployResultRow,
  DeployTargetRow,
  FeedEvent,
  GameBackend,
  HexRow,
  Nemesis,
  OnboardingInput,
  Profile,
  RunRow,
  SubmitRunInput,
  SubmitRunResponse,
  TeamOverview,
  WarOverview,
  WeeklyProgress,
  ZoneLeaderboardRow,
} from './types';

function unwrap<T>(r: { data: T | null; error: { message: string; code?: string } | null }): T {
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.code });
  return r.data as T;
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

/** La vraie guerre multijoueur : tout passe par Supabase (RLS, RPC, Edge Functions). */
export class OnlineBackend implements GameBackend {
  readonly mode = 'online' as const;

  async getMyProfile(): Promise<Profile | null> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    return unwrap(await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle()) as Profile | null;
  }

  async onboard(p: OnboardingInput): Promise<Profile> {
    const zone = zoneAt(p.position, currentConfig().h3);
    unwrap(
      await supabase.rpc('complete_onboarding', {
        p_username: p.username,
        p_faction: p.faction,
        p_zone: zone,
        p_birth_year: p.birthYear,
        p_locale: p.locale,
        p_gps_consent: p.gpsConsent,
        p_terms_version: p.termsVersion,
      }),
    );
    await this.setAvatar(p.avatarId);
    return (await this.getMyProfile())!;
  }

  async zoneFactionCounts(zone: string): Promise<Map<number, number>> {
    const rows = unwrap(await supabase.rpc('zone_faction_counts', { p_zone: zone })) as { faction_id: number; players: number }[];
    return new Map(rows.map((r) => [r.faction_id, Number(r.players)]));
  }

  async setAvatar(id: string): Promise<void> {
    unwrap(await supabase.rpc('set_avatar', { p_avatar: id }));
  }

  async setLocale(locale: 'fr' | 'en'): Promise<void> {
    const { data: u } = await supabase.auth.getUser();
    if (u.user) await supabase.from('profiles').update({ locale, updated_at: new Date().toISOString() }).eq('id', u.user.id);
  }

  async hexesInBBox(b: BBox): Promise<HexRow[]> {
    return unwrap(
      await supabase.rpc('hexes_in_bbox', { p_south: b.south, p_west: b.west, p_north: b.north, p_east: b.east }),
    ) as HexRow[];
  }

  async submitRun(input: SubmitRunInput): Promise<SubmitRunResponse> {
    return invokeFunction<SubmitRunResponse>('submit-run', {
      clientRunId: input.clientRunId,
      source: input.source,
      tzOffsetMin: input.tzOffsetMin,
      points: input.points.map((p) => [
        p.t,
        Number(p.lat.toFixed(7)),
        Number(p.lng.toFixed(7)),
        p.acc == null ? null : Math.round(p.acc * 10) / 10,
        p.alt == null ? null : Math.round(p.alt * 10) / 10,
        p.altAcc == null ? null : Math.round(p.altAcc * 10) / 10,
        p.speed == null ? null : Math.round(p.speed * 100) / 100,
        p.mocked ? 1 : 0,
      ]),
      device: { platform: process.env.EXPO_OS ?? 'unknown' },
    });
  }

  async getRun(id: string): Promise<RunRow> {
    return unwrap(await supabase.from('runs').select('*').eq('id', id).single()) as RunRow;
  }

  async myRuns(limit = 50): Promise<RunRow[]> {
    return unwrap(await supabase.from('runs').select('*').order('started_at', { ascending: false }).limit(limit)) as RunRow[];
  }

  async pendingDeployments(): Promise<RunRow[]> {
    return unwrap(
      await supabase
        .from('runs')
        .select('*')
        .gt('troops_remaining', 0)
        .gt('deploy_deadline', new Date().toISOString())
        .order('started_at', { ascending: false }),
    ) as RunRow[];
  }

  async deployTargets(runId: string): Promise<DeployTargetRow[]> {
    return unwrap(await supabase.rpc('deploy_targets', { p_run: runId })) as DeployTargetRow[];
  }

  async deployTroops(runId: string, allocations: Allocation[]): Promise<DeployResultRow[]> {
    return unwrap(
      await supabase.rpc('deploy_troops', {
        p_run: runId,
        p_allocations: allocations.map((a) => ({ cell: a.cell, troops: a.troops })),
      }),
    ) as DeployResultRow[];
  }

  async zoneFeed(zone: string, limit = 30): Promise<FeedEvent[]> {
    return unwrap(
      await supabase.from('events').select('*').eq('zone', zone).order('created_at', { ascending: false }).limit(limit),
    ) as FeedEvent[];
  }

  async zoneLeaderboard(zone: string): Promise<ZoneLeaderboardRow[]> {
    return unwrap(await supabase.rpc('zone_leaderboard', { p_zone: zone, p_limit: 30 })) as ZoneLeaderboardRow[];
  }

  async teamOverview(zone: string): Promise<TeamOverview> {
    return unwrap(await supabase.rpc('team_overview', { p_zone: zone })) as TeamOverview;
  }

  async warOverview(zone: string): Promise<WarOverview> {
    return unwrap(await supabase.rpc('war_overview', { p_zone: zone })) as WarOverview;
  }

  async nemesis(): Promise<Nemesis | null> {
    const rows = unwrap(await supabase.rpc('my_nemesis')) as Nemesis[];
    return rows[0] ?? null;
  }

  async myTrophies(): Promise<string[]> {
    const { data: u } = await supabase.auth.getUser();
    const rows = unwrap(await supabase.from('trophies_earned').select('trophy_id').eq('user_id', u.user?.id ?? '')) as {
      trophy_id: string;
    }[];
    return rows.map((r) => r.trophy_id);
  }

  async weeklyProgress(): Promise<WeeklyProgress> {
    return unwrap(await supabase.rpc('my_weekly_progress')) as WeeklyProgress;
  }

  subscribe(zone: string | null, onChange: (what: 'hexes' | 'feed') => void): () => void {
    const channel = supabase
      .channel(`live-${zone ?? 'all'}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hex_state' }, () => onChange('hexes'))
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events', ...(zone ? { filter: `zone=eq.${zone}` } : {}) },
        () => onChange('feed'),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }

  async tick(): Promise<void> {
    /* le monde avance côté serveur (pg_cron) */
  }

  async exportData(): Promise<unknown> {
    return invokeFunction('export-data', {});
  }

  async deleteAccount(): Promise<void> {
    await invokeFunction('delete-account', { confirm: true });
  }
}

// Fonctions propres au mode en ligne (confidentialité)
export async function setPrivacyZone(lat: number | null, lng: number | null, radiusM: number): Promise<void> {
  unwrap(await supabase.rpc('set_privacy_zone', { p_lat: lat, p_lng: lng, p_radius_m: radiusM }));
}

export async function getPrivacySettings(): Promise<{ privacy_radius_m: number; has_zone: boolean } | null> {
  const rows = unwrap(await supabase.rpc('my_privacy_settings')) as { privacy_radius_m: number; has_zone: boolean }[];
  return rows[0] ?? null;
}

export async function getGpsConsent(): Promise<boolean> {
  return Boolean(unwrap(await supabase.rpc('my_gps_consent')));
}

export async function setGpsConsent(granted: boolean): Promise<void> {
  unwrap(await supabase.rpc(granted ? 'grant_gps_consent' : 'revoke_gps_consent'));
}
