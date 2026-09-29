/**
 * submit-run : reçoit la trace GPS BRUTE d'une course, la revalide entièrement (le client
 * n'est jamais cru), calcule distance, D+ (modèle de terrain), cases traversées, troupes et
 * XP, puis enregistre le tout de façon atomique (record_run).
 */
import {
  cellCenter,
  newTrophies,
  type PlayerStats,
  processRun,
  type ProcessRunResult,
  type RawPoint,
  type RunSource,
  traceFingerprint,
  wildGarrison,
} from '../_shared/core/index.ts';
import { demProviders, loadConfig } from '../_shared/game.ts';
import { handler, HttpError, json, readJson, requireUser, serviceClient } from '../_shared/http.ts';

/** Point compact : [t, lat, lng, acc, alt, altAcc, speed, mocked(0|1)] */
type CompactPoint = [number, number, number, number | null, number | null, number | null, number | null, number?];

interface SubmitRunBody {
  clientRunId: string;
  source: RunSource;
  points: CompactPoint[];
  /** décalage horaire local en minutes (Date.getTimezoneOffset inversé), pour les trophées */
  tzOffsetMin?: number;
  device?: Record<string, string | number | boolean | null>;
}

const SOURCES: RunSource[] = ['gps', 'simulation', 'healthkit', 'health_connect'];

function parse(body: SubmitRunBody, maxPoints: number): RawPoint[] {
  if (typeof body.clientRunId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.clientRunId)) {
    throw new HttpError(400, 'invalid_client_run_id');
  }
  if (!SOURCES.includes(body.source)) throw new HttpError(400, 'invalid_source');
  if (!Array.isArray(body.points) || body.points.length > maxPoints) throw new HttpError(400, 'invalid_points');
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return body.points.map((p) => {
    if (!Array.isArray(p) || p.length < 3) throw new HttpError(400, 'invalid_points');
    return {
      t: num(p[0]) ?? NaN,
      lat: num(p[1]) ?? NaN,
      lng: num(p[2]) ?? NaN,
      acc: num(p[3]),
      alt: num(p[4]),
      altAcc: num(p[5]),
      speed: num(p[6]),
      mocked: p[7] === 1,
    };
  });
}

Deno.serve(
  handler(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    const { cfg, season } = await loadConfig(db);
    const body = await readJson<SubmitRunBody>(req, 8_000_000);
    const raw = parse(body, cfg.antiCheat.maxPoints);

    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!profile?.faction_id) throw new HttpError(403, 'onboarding_required');

    // Idempotence : un renvoi (réseau coupé) renvoie le résultat déjà calculé.
    const { data: existing } = await db
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .eq('client_run_id', body.clientRunId)
      .maybeSingle();
    if (existing) return json({ run: existing, duplicate: true });

    const now = Date.now();
    const fingerprint = traceFingerprint(raw);
    const { count: sameTrace } = await db
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('fingerprint', fingerprint)
      .eq('status', 'validated');

    // Déjà compté aujourd'hui (jour UTC du départ) pour les plafonds journaliers.
    const first = raw.reduce((m, p) => (Number.isFinite(p.t) ? Math.min(m, p.t) : m), Infinity);
    const dayStart = new Date(Number.isFinite(first) ? first : now);
    dayStart.setUTCHours(0, 0, 0, 0);
    const { data: today } = await db
      .from('runs')
      .select('counted_km, counted_dplus_m')
      .eq('user_id', user.id)
      .eq('status', 'validated')
      .gte('started_at', dayStart.toISOString())
      .lt('started_at', new Date(dayStart.getTime() + 86_400_000).toISOString());
    const alreadyToday = (today ?? []).reduce(
      (a, r) => ({ km: a.km + Number(r.counted_km), dplusM: a.dplusM + Number(r.counted_dplus_m) }),
      { km: 0, dplusM: 0 },
    );

    const result: ProcessRunResult =
      (sameTrace ?? 0) > 0
        ? { status: 'rejected', rejection: { code: 'duplicate', details: {} }, metrics: { fingerprint } }
        : await processRun({ raw, source: body.source, now, cfg, dem: demProviders(), alreadyToday });

    const compactPoints = body.points;
    const base = {
      user_id: user.id,
      client_run_id: body.clientRunId,
      source: body.source,
      fingerprint,
      raw_points: raw.length,
      points: compactPoints,
      device: body.device ?? null,
    };

    let payload: Record<string, unknown>;
    if (result.status === 'rejected') {
      const m = result.metrics;
      payload = {
        ...base,
        status: 'rejected',
        rejection_code: result.rejection.code,
        rejection_details: result.rejection.details,
        started_at: new Date(m.startedAt ?? (Number.isFinite(first) ? first : now)).toISOString(),
        ended_at: m.endedAt ? new Date(m.endedAt).toISOString() : null,
        duration_s: m.durationS ?? null,
        troops: 0,
        cells: [],
      };
    } else {
      const m = result.metrics;
      const localHour = new Date(m.startedAt + (body.tzOffsetMin ?? 0) * 60_000).getUTCHours();
      payload = {
        ...base,
        status: 'validated',
        started_at: new Date(m.startedAt).toISOString(),
        ended_at: new Date(m.endedAt).toISOString(),
        duration_s: m.durationS,
        moving_s: m.movingS,
        distance_m: m.distanceM,
        dplus_m: m.dplusM,
        dplus_source: m.dplusSource,
        counted_km: result.troops.countedKm,
        counted_dplus_m: result.troops.countedDplusM,
        troops: result.troops.troops,
        xp: result.xp,
        flags: result.flags,
        pace_s_per_km: m.avgPaceSecPerKm,
        local_hour: localHour,
        cells: result.cells.map((c) => {
          const center = cellCenter(c.cell);
          return {
            ...c,
            lat: center.lat,
            lng: center.lng,
            elevationSource: c.elevationM != null ? m.dplusSource : null,
            wild: season ? wildGarrison(c.cell, c.elevationM, season.wild_seed, cfg.wild) : null,
          };
        }),
      };
    }

    const { data: recorded, error } = await db.rpc('record_run', { p: payload });
    if (error) throw error;

    // Trophées (non bloquant pour la course)
    let trophies: string[] = [];
    if (result.status === 'validated') {
      const [{ data: fresh }, { data: earned }] = await Promise.all([
        db.from('profiles').select('*').eq('id', user.id).single(),
        db.from('trophies_earned').select('trophy_id').eq('user_id', user.id),
      ]);
      if (fresh) {
        const stats: PlayerStats = {
          runs: fresh.runs_count,
          totalKm: Number(fresh.total_km),
          totalDplusM: Number(fresh.total_dplus_m),
          level: fresh.level,
          captures: fresh.captures_count,
          regionsTaken: fresh.regions_taken,
          maxAltitudeCapturedM: fresh.max_altitude_captured_m,
          bestPaceSecPerKm: fresh.best_pace_s_per_km == null ? null : Number(fresh.best_pace_s_per_km),
          earlyRuns: fresh.early_runs,
          nightRuns: fresh.night_runs,
          distinctCells: fresh.distinct_cells,
        };
        const won = newTrophies(stats, new Set((earned ?? []).map((e) => e.trophy_id as string)));
        if (won.length > 0) {
          await db.rpc('award_trophies', {
            p_user: user.id,
            p_ids: won.map((t) => t.id),
            p_xp: won.reduce((s, t) => s + t.xp, 0),
          });
          trophies = won.map((t) => t.id);
        }
      }
    }

    const { data: run } = await db.from('runs').select('*').eq('id', (recorded as { run_id: string }).run_id).single();
    return json({ run, trophies, duplicate: false });
  }),
);
