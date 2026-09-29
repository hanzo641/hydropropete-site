/**
 * Crée une SAISON DE DÉMO avec de faux joueurs dans une ville : génère un fichier SQL à
 * exécuter sur la base Supabase (SQL editor, ou psql "$DATABASE_URL" -f fichier.sql).
 *
 *   npm run demo:season -- --city pau [--players 30] [--days 10] [--seed 42] [--out fichier.sql]
 *   npm run demo:season -- --lat 45.76 --lng 4.84 --name Lyon
 *
 * Les courses de démo sont des boucles aléatoires plausibles (pas de vraies traces) ; les
 * déploiements passent par la même fonction atomique que l'app (admin_deploy_troops).
 * ⚠️ Ferme la saison active en cours (base de démo / de test uniquement).
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  AVATARS,
  autoDistribute,
  cellCenter,
  crossedCells,
  DEFAULT_GAME_CONFIG as C,
  type DeployTarget,
  effectiveTroops,
  type HexSnapshot,
  type LatLng,
  regionOf,
  resolveAttack,
  wildGarrison,
  zoneOf,
} from '../packages/core/src/index.ts';

const CITIES: Record<string, LatLng & { name: string }> = {
  pau: { name: 'Pau', lat: 43.2951, lng: -0.3708 },
  paris: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  lyon: { name: 'Lyon', lat: 45.764, lng: 4.8357 },
  marseille: { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  toulouse: { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  bordeaux: { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  nantes: { name: 'Nantes', lat: 47.2184, lng: -1.5536 },
  lille: { name: 'Lille', lat: 50.6292, lng: 3.0573 },
  grenoble: { name: 'Grenoble', lat: 45.1885, lng: 5.7245 },
  annecy: { name: 'Annecy', lat: 45.8992, lng: 6.1294 },
  chamonix: { name: 'Chamonix', lat: 45.9237, lng: 6.8694 },
};

const { values: args } = parseArgs({
  options: {
    city: { type: 'string', default: 'pau' },
    lat: { type: 'string' },
    lng: { type: 'string' },
    name: { type: 'string' },
    players: { type: 'string', default: '30' },
    days: { type: 'string', default: '10' },
    seed: { type: 'string', default: '42' },
    out: { type: 'string' },
  },
});

const city =
  args.lat && args.lng
    ? { name: args.name ?? 'Ville', lat: Number(args.lat), lng: Number(args.lng) }
    : CITIES[(args.city ?? 'pau').toLowerCase()];
if (!city) throw new Error(`ville inconnue : ${args.city} (connues : ${Object.keys(CITIES).join(', ')})`);
const PLAYERS = Number(args.players);
const DAYS = Number(args.days);

let s = Number(args.seed) >>> 0;
const rand = (): number => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const uuid = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(rand() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
const q = (v: string | null): string => (v == null ? 'null' : `'${v.replace(/'/g, "''")}'`);

const FREE_AVATARS = AVATARS.filter((a) => a.unlockLevel === 1).map((a) => a.id);
const NAMES = ['Foulée', 'Sentier', 'Dénivelé', 'Chamois', 'Gazelle', 'Traileur', 'Bitume', 'Crête', 'Isard', 'Col', 'Vallon', 'Garrigue', 'Bruyère', 'Torrent', 'Brume', 'Aube', 'Lièvre', 'Faucon', 'Lynx', 'Marmotte'];

/** Boucle aléatoire plausible (≈ km donnés) autour d'un point de départ. */
function loop(start: LatLng, km: number): LatLng[] {
  const n = 24;
  const radiusM = (km * 1000) / (2 * Math.PI);
  const phase = rand() * Math.PI * 2;
  const wobble = Array.from({ length: 4 }, () => rand() * 0.35);
  const center = {
    lat: start.lat + (Math.sin(phase) * radiusM) / 111_320,
    lng: start.lng + (Math.cos(phase) * radiusM) / (111_320 * Math.cos((start.lat * Math.PI) / 180)),
  };
  const pts: LatLng[] = [];
  for (let i = 0; i <= n * 10; i++) {
    const a = phase + Math.PI + (i / (n * 10)) * Math.PI * 2;
    const r = radiusM * (1 + wobble[0]! * Math.sin(3 * a) + wobble[1]! * Math.cos(5 * a));
    pts.push({
      lat: center.lat + (Math.sin(a) * r) / 111_320,
      lng: center.lng + (Math.cos(a) * r) / (111_320 * Math.cos((center.lat * Math.PI) / 180)),
    });
  }
  return pts;
}

const now = Date.now();
const sql: string[] = [
  `-- Saison de démo « ${city.name} » — ${PLAYERS} joueurs, ${DAYS} jours (généré par scripts/demo-season.ts)`,
  'begin;',
  "update public.seasons set status = 'closed' where status = 'active';",
  `select public.create_season(${q(`Démo — ${city.name}`)}, now() - interval '${DAYS} days', true, '{"antiCheat":{"allowSimulatedRuns":true}}'::jsonb);`,
];

const players = Array.from({ length: PLAYERS }, (_, i) => ({
  id: uuid(),
  username: `${NAMES[i % NAMES.length]}${i >= NAMES.length ? i : ''}_${Math.floor(rand() * 90 + 10)}`,
  faction: (i % 3) + 1,
  home: {
    lat: city.lat + (rand() - 0.5) * 0.1,
    lng: city.lng + (rand() - 0.5) * 0.14,
  },
}));
const zone = zoneOf(crossedCells([city, { lat: city.lat + 0.001, lng: city.lng }], C.h3.territoryRes, 0)[0]?.cell ?? '', C.h3);

for (const p of players) {
  sql.push(`insert into auth.users (id, email) values ('${p.id}', ${q(`${p.username.toLowerCase()}@demo.invalid`)});`);
  sql.push(
    `insert into public.profiles (id, username, faction_id, home_zone, avatar_id) values ('${p.id}', ${q(p.username)}, ${p.faction}, ${q(zone)}, '${FREE_AVATARS[Math.floor(rand() * FREE_AVATARS.length)]}');`,
  );
  sql.push(`insert into public.private_settings (user_id, birth_year, gps_consent_at, terms_accepted_at, terms_version) values ('${p.id}', 1990, now(), now(), 'demo');`);
}

// Simulation JS de l'état (pour choisir des déploiements pertinents) ; la base fait foi.
const state = new Map<string, HexSnapshot>();
const knownCells = new Set<string>();
const runs: { user: (typeof players)[number]; t: number; cells: ReturnType<typeof crossedCells>; km: number; dplus: number }[] = [];
for (const p of players) {
  const count = 4 + Math.floor(rand() * 7);
  for (let k = 0; k < count; k++) {
    const km = 4 + rand() * 10;
    const track = loop(p.home, km);
    runs.push({
      user: p,
      t: now - DAYS * 86_400_000 + rand() * (DAYS * 86_400_000 - 3_600_000),
      cells: crossedCells(track, C.h3.territoryRes, C.territory.minMetersInCell),
      km,
      dplus: Math.round(rand() * 180),
    });
  }
}
runs.sort((a, b) => a.t - b.t);

let deployments = 0;
for (const r of runs) {
  const runId = uuid();
  const troops = Math.floor(r.km + r.dplus / 100);
  const cellsJson = r.cells.map((c) => ({ cell: c.cell, region: regionOf(c.cell, C.h3), zone: zoneOf(c.cell, C.h3), meters: Math.round(c.meters) }));
  for (const c of r.cells) {
    if (knownCells.has(c.cell)) continue;
    knownCells.add(c.cell);
    const ctr = cellCenter(c.cell);
    sql.push(
      `insert into public.cells (h3, region, zone, center) values ('${c.cell}', '${regionOf(c.cell, C.h3)}', '${zoneOf(c.cell, C.h3)}', ` +
        `st_setsrid(st_makepoint(${ctr.lng.toFixed(6)}, ${ctr.lat.toFixed(6)}), 4326)::geography) on conflict do nothing;`,
    );
    sql.push(
      `insert into public.wild_cells (season_id, h3, garrison) select id, '${c.cell}', ${wildGarrison(c.cell, null, 'demo', C.wild)} from public.seasons where status = 'active' on conflict do nothing;`,
    );
    if (!state.has(c.cell)) state.set(c.cell, { owner: null, garrison: wildGarrison(c.cell, null, 'demo', C.wild) });
  }
  const started = new Date(r.t).toISOString();
  sql.push(
    `insert into public.runs (id, user_id, season_id, client_run_id, source, status, started_at, ended_at, duration_s, moving_s, distance_m, dplus_m, dplus_source, counted_km, counted_dplus_m, troops_earned, troops_remaining, deploy_deadline, cells, xp_earned) ` +
      `values ('${runId}', '${r.user.id}', public.current_season_id(), 'demo-${runId}', 'simulation', 'validated', '${started}', '${new Date(r.t + r.km * 330_000).toISOString()}', ` +
      `${Math.round(r.km * 330)}, ${Math.round(r.km * 320)}, ${Math.round(r.km * 1000)}, ${r.dplus}, 'demo', ${r.km.toFixed(3)}, ${r.dplus}, ${troops}, ${troops}, now() + interval '1 hour', ` +
      `'${JSON.stringify(cellsJson)}'::jsonb, ${Math.round(r.km * 10)});`,
  );
  sql.push(
    `update public.profiles set runs_count = runs_count + 1, total_km = total_km + ${r.km.toFixed(3)}, total_dplus_m = total_dplus_m + ${r.dplus}, xp = xp + ${Math.round(r.km * 10)}, level = public.level_from_xp(xp + ${Math.round(r.km * 10)}) where id = '${r.user.id}';`,
  );
  sql.push(
    `insert into public.player_season_stats (season_id, user_id, zone, faction_id, km, dplus_m, points) values (public.current_season_id(), '${r.user.id}', ${q(zone)}, ${r.user.faction}, ${r.km.toFixed(3)}, ${r.dplus}, ${Math.round(r.km)}) ` +
      `on conflict (season_id, user_id) do update set km = player_season_stats.km + excluded.km, dplus_m = player_season_stats.dplus_m + excluded.dplus_m, points = player_season_stats.points + excluded.points;`,
  );
  if (troops === 0 || r.cells.length === 0) continue;
  const targets: DeployTarget[] = r.cells.map((c) => ({
    cell: c.cell,
    region: regionOf(c.cell, C.h3),
    state: state.get(c.cell)!,
    regionController: null,
  }));
  const alloc = autoDistribute(targets, troops, r.user.faction, C);
  for (const a of alloc) {
    const cur = state.get(a.cell)!;
    state.set(a.cell, resolveAttack(cur, r.user.faction, effectiveTroops(a.troops, false, C.region), C.combat, C.erosion.abandonThreshold).after);
  }
  sql.push(`select count(*) from public.admin_deploy_troops('${r.user.id}', '${runId}', '${JSON.stringify(alloc)}'::jsonb);`);
  deployments++;
}
sql.push('select public.daily_tick();', 'commit;', '');

const owned = [...state.values()].filter((h) => h.owner != null);
const out = args.out ?? `supabase/demo/demo-${city.name.toLowerCase()}.sql`;
writeFileSync(out, sql.join('\n'));
console.log(`Saison de démo « ${city.name} » : ${PLAYERS} joueurs, ${runs.length} courses, ${deployments} déploiements,`);
console.log(`${knownCells.size} territoires traversés, ~${owned.length} conquis (estimation JS).`);
console.log(`→ ${out}\nÀ exécuter : psql "$DATABASE_URL" -f ${out}   (ou coller dans le SQL editor Supabase)`);
