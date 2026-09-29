/**
 * export-data : export de TOUTES les données personnelles du joueur (droit d'accès et de
 * portabilité RGPD). L'app convertit aussi chaque trace en GPX.
 */
import { handler, json, requireUser, serviceClient } from '../_shared/http.ts';

Deno.serve(
  handler(async (req) => {
    const db = serviceClient();
    const user = await requireUser(req, db);
    const uid = user.id;
    const [profile, settings, runs, traces, deployments, trophies, seasons, events, cells] = await Promise.all([
      db.from('profiles').select('*').eq('id', uid).maybeSingle(),
      db.rpc('my_private_settings_export', { p_user: uid }),
      db.from('runs').select('*').eq('user_id', uid).order('started_at'),
      db.from('run_traces').select('run_id, points, created_at').eq('user_id', uid),
      db.from('deployments').select('*').eq('user_id', uid).order('created_at'),
      db.from('trophies_earned').select('*').eq('user_id', uid),
      db.from('player_season_stats').select('*').eq('user_id', uid),
      db.from('events').select('*').eq('actor_id', uid),
      db.from('player_cells').select('*').eq('user_id', uid),
    ]);
    return json({
      exported_at: new Date().toISOString(),
      account: { id: uid, email: user.email ?? null, created_at: user.created_at },
      profile: profile.data,
      private_settings: settings.data,
      runs: runs.data ?? [],
      traces: traces.data ?? [],
      deployments: deployments.data ?? [],
      trophies: trophies.data ?? [],
      season_stats: seasons.data ?? [],
      feed_events: events.data ?? [],
      visited_cells: cells.data ?? [],
    });
  }),
);
