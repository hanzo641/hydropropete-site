/**
 * MODE LOCAL — tout le jeu tourne sur le téléphone, sans compte ni serveur :
 * inscription, validation des courses (même chaîne que le serveur), troupes, déploiement,
 * combats, érosion, régions, front du jour, série, trophées, et une guerre simulée
 * (IA de la faction adverse + coéquipiers fictifs) pour tester seul dès aujourd'hui.
 *
 * Stockage : un simple magasin clé → JSON (SQLite kv-store dans l'app, Map dans les tests).
 */
import type { BBox } from '../geo/h3.ts';
import type {
  DeployResultRow,
  DeployTargetRow,
  FeedEvent,
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
} from '../api/types.ts';
import { AVATARS, avatarForLevel, DEFAULT_AVATAR_ID, isAvatarUnlocked } from '../game/avatars.ts';
import { effectiveTroops, type FactionId, type HexSnapshot, resolveAttack, round4 } from '../game/combat.ts';
import { type GameConfig, resolveConfig } from '../game/config.ts';
import { type Allocation, validateAllocations } from '../game/deployment.ts';
import { erodedGarrison } from '../game/erosion.ts';
import { activeFactions, enemyOf } from '../game/factions.ts';
import { frontOfDay } from '../game/front.ts';
import { levelFromXp, newTrophies, type PlayerStats } from '../game/progression.ts';
import { regionController } from '../game/region.ts';
import { localDay } from '../game/streak.ts';
import { hash01, wildGarrison } from '../game/wild.ts';
import { aiDailyBudget, aiTurn, npcName, NPC_NAMES, seedWorld } from '../game/world.ts';
import { cellCenter, regionOf, territoriesPerRegion, zoneAt, zoneOf } from '../geo/h3.ts';
import type { DemProvider } from '../gps/dem.ts';
import { processRun } from '../server/processRun.ts';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface WorldCell {
  o: FactionId | null;
  g: number;
  /** dernière mise à jour de la garnison (ms) */
  u: number;
  /** dernière attaque (ms) */
  a: number | null;
  /** niveau du capitaine : dernier joueur qui a pris ou renforcé la case (cosmétique) */
  c?: number;
}

interface LocalProfile extends Profile {
  center: { lat: number; lng: number };
  points: number;
  reinforcements: number;
  best_pace_s_per_km: number | null;
  early_runs: number;
  night_runs: number;
  max_altitude_captured_m: number;
  created_at: string;
}

interface LocalSeason {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  wild_seed: string;
}

interface Npc {
  id: string;
  name: string;
  faction: FactionId;
  avatar: string;
  points: number;
  captures: number;
}

interface DeploymentLog {
  h3: string;
  outcome: string;
  before_owner: FactionId | null;
  actor: string; // 'me' ou identifiant de PNJ
  faction: FactionId;
  at: number;
}

const PERIOD_MS = 8 * 3_600_000;

/** Niveau (stable) d'un PNJ : surtout des Joggers et Coureurs, quelques vétérans. */
export function npcLevel(id: string): number {
  return 4 + Math.floor(Math.pow(hash01(`${id}:level`), 1.7) * 80);
}

/** Avatar d'un PNJ : la tenue de son rang. */
function npcAvatar(id: string): string {
  return avatarForLevel(npcLevel(id)).id;
}

/** Capitaine des territoires de départ (avant toute bataille) : variété stable par case. */
function seedCaptainLevel(cell: string): number {
  return 2 + Math.floor(Math.pow(hash01(`${cell}:captain`), 2) * 50);
}
const DAY_MS = 86_400_000;
const ME = 'local-player';

export const LOCAL_CONFIG_OVERRIDES = {
  // en local, les courses simulées comptent (c'est un bac à sable) et on garde 30 jours de marge
  antiCheat: { allowSimulatedRuns: true, maxUploadDelayDays: 30 },
};

export class LocalGame {
  private readonly kv: KeyValueStore;
  readonly cfg: GameConfig;
  private readonly dem: () => DemProvider[];
  private readonly now: () => number;
  private readonly listeners = new Set<(what: 'hexes' | 'feed') => void>();

  constructor(opts: { kv: KeyValueStore; cfg?: GameConfig; dem?: () => DemProvider[]; now?: () => number }) {
    this.kv = opts.kv;
    this.cfg = resolveConfig(opts.cfg ?? {}, LOCAL_CONFIG_OVERRIDES);
    this.dem = opts.dem ?? (() => []);
    this.now = opts.now ?? (() => Date.now());
  }

  // ───────────────────────── stockage ─────────────────────────

  private read<T>(key: string, fallback: T): T {
    const v = this.kv.getItem(`cr:${key}`);
    if (v == null) return fallback;
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    this.kv.setItem(`cr:${key}`, JSON.stringify(value));
  }

  private seq(): number {
    const n = this.read<number>('seq', 0) + 1;
    this.write('seq', n);
    return n;
  }

  private emit(what: 'hexes' | 'feed'): void {
    for (const l of this.listeners) l(what);
  }

  subscribe(onChange: (what: 'hexes' | 'feed') => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }

  private profileRaw(): LocalProfile | null {
    const p = this.read<LocalProfile | null>('profile', null);
    // anciennes parties (avatars animaux) : la plus belle tenue débloquée
    if (p && !AVATARS.some((a) => a.id === p.avatar_id)) return { ...p, avatar_id: avatarForLevel(p.level).id };
    return p;
  }

  private season(): LocalSeason {
    return this.read<LocalSeason>('season', {
      id: 1,
      name: 'Saison 1',
      starts_at: new Date(this.now()).toISOString(),
      ends_at: new Date(this.now() + this.cfg.season.lengthDays * DAY_MS).toISOString(),
      wild_seed: 'local',
    });
  }

  private world(): Record<string, WorldCell> {
    return this.read<Record<string, WorldCell>>('world', {});
  }

  private runs(): RunRow[] {
    return this.read<RunRow[]>('runs', []);
  }

  private npcs(): Npc[] {
    return this.read<Npc[]>('npcs', []);
  }

  private pushEvents(events: Omit<FeedEvent, 'id'>[]): void {
    if (events.length === 0) return;
    const all = this.read<FeedEvent[]>('events', []);
    for (const e of events) all.unshift({ ...e, id: this.seq() });
    all.sort((a, b) => b.created_at.localeCompare(a.created_at));
    this.write('events', all.slice(0, 150));
    this.emit('feed');
  }

  private logDeployments(logs: DeploymentLog[]): void {
    if (logs.length === 0) return;
    const all = this.read<DeploymentLog[]>('deployments', []);
    all.push(...logs);
    this.write('deployments', all.slice(-1500));
  }

  // ───────────────────────── état de la carte ─────────────────────────

  private wildAt(cell: string): number {
    const cache = this.read<Record<string, number>>('wild', {});
    return cache[cell] ?? wildGarrison(cell, null, this.season().wild_seed, this.cfg.wild);
  }

  private stateNow(world: Record<string, WorldCell>, cell: string, t = this.now()): HexSnapshot {
    const w = world[cell];
    if (!w) return { owner: null, garrison: this.wildAt(cell) };
    return { owner: w.o, garrison: erodedGarrison(w.g, w.u, t, this.cfg.erosion) };
  }

  private controllers(world: Record<string, WorldCell>): Map<string, FactionId | null> {
    const counts = new Map<string, Map<FactionId, number>>();
    for (const [cell, w] of Object.entries(world)) {
      if (w.o == null) continue;
      const region = regionOf(cell, this.cfg.h3);
      const m = counts.get(region) ?? new Map<FactionId, number>();
      m.set(w.o, (m.get(w.o) ?? 0) + 1);
      counts.set(region, m);
    }
    const out = new Map<string, FactionId | null>();
    for (const [region, m] of counts) out.set(region, regionController(m, territoriesPerRegion(region, this.cfg.h3), this.cfg.region));
    return out;
  }

  private frontToday(world: Record<string, WorldCell>): string | null {
    const by = new Map<string, Set<FactionId>>();
    for (const [cell, w] of Object.entries(world)) {
      if (w.o == null) continue;
      const r = regionOf(cell, this.cfg.h3);
      by.set(r, (by.get(r) ?? new Set()).add(w.o));
    }
    return frontOfDay([...by].map(([region, f]) => ({ region, factions: f.size })), localDay(this.now()));
  }

  // ───────────────────────── profil ─────────────────────────

  async getMyProfile(): Promise<Profile | null> {
    return this.profileRaw();
  }

  async onboard(input: OnboardingInput): Promise<Profile> {
    const factions = activeFactions(this.cfg.factions).map((f) => f.id);
    const faction = input.faction != null && factions.includes(input.faction) ? input.faction : factions[this.now() % factions.length]!;
    const enemy = enemyOf(faction, this.cfg.factions) ?? factions.find((f) => f !== faction)!;
    const now = this.now();
    const seed = `${now.toString(36)}-${Math.floor(hash01(String(now)) * 1e9).toString(36)}`;
    const season: LocalSeason = {
      id: 1,
      name: 'Saison 1',
      starts_at: new Date(now).toISOString(),
      ends_at: new Date(now + this.cfg.season.lengthDays * DAY_MS).toISOString(),
      wild_seed: seed,
    };
    const profile: LocalProfile = {
      id: ME,
      username: input.username,
      faction_id: faction,
      home_zone: zoneAt(input.position, this.cfg.h3),
      locale: input.locale,
      avatar_id: isAvatarUnlocked(input.avatarId, 1) ? input.avatarId : DEFAULT_AVATAR_ID,
      xp: 0,
      level: 1,
      runs_count: 0,
      total_km: 0,
      total_dplus_m: 0,
      captures_count: 0,
      regions_taken: 0,
      distinct_cells: 0,
      streak_days: 0,
      streak_last_day: null,
      center: input.position,
      points: 0,
      reinforcements: 0,
      best_pace_s_per_km: null,
      early_runs: 0,
      night_runs: 0,
      max_altitude_captured_m: 0,
      created_at: new Date(now).toISOString(),
    };
    const world: Record<string, WorldCell> = {};
    for (const h of seedWorld({ center: input.position, playerFaction: faction, enemyFaction: enemy, seed }, this.cfg)) {
      world[h.cell] = { o: h.owner, g: h.garrison, u: now, a: null };
    }
    const npcs: Npc[] = [];
    for (const f of [faction, enemy]) {
      for (const [i, name] of (NPC_NAMES[f] ?? []).slice(0, 6).entries()) {
        npcs.push({
          id: `npc:${f}:${i}`,
          name,
          faction: f,
          avatar: DEFAULT_AVATAR_ID,
          points: Math.floor(hash01(`${seed}:${name}:p`) * 40),
          captures: 0,
        });
      }
    }
    this.write('profile', profile);
    this.write('season', season);
    this.write('world', world);
    this.write('npcs', npcs);
    this.write('ai', { lastTick: now, turn: 0 });
    this.write('victories', {});
    this.pushEvents([
      {
        kind: 'season_end',
        faction_id: enemy,
        actor_name: null,
        h3: null,
        payload: { welcome: true },
        created_at: new Date(now).toISOString(),
      },
    ]);
    return profile;
  }

  async zoneFactionCounts(): Promise<Map<number, number>> {
    const m = new Map<number, number>();
    for (const n of this.npcs()) m.set(n.faction, (m.get(n.faction) ?? 0) + 1);
    return m;
  }

  async setAvatar(id: string): Promise<void> {
    const p = this.profileRaw();
    if (!p) return;
    if (!isAvatarUnlocked(id, p.level)) throw new Error('avatar_locked');
    this.write('profile', { ...p, avatar_id: id });
  }

  async setLocale(locale: 'fr' | 'en'): Promise<void> {
    const p = this.profileRaw();
    if (p) this.write('profile', { ...p, locale });
  }

  // ───────────────────────── carte ─────────────────────────

  async hexesInBBox(b: BBox): Promise<HexRow[]> {
    const world = this.world();
    const wild = this.read<Record<string, number>>('wild', {});
    const ctrl = this.controllers(world);
    const now = this.now();
    const inBox = (cell: string): boolean => {
      const c = cellCenter(cell);
      return c.lat >= b.south && c.lat <= b.north && c.lng >= b.west && c.lng <= b.east;
    };
    const rows: HexRow[] = [];
    const seen = new Set<string>();
    for (const [cell, w] of Object.entries(world)) {
      if (!inBox(cell)) continue;
      seen.add(cell);
      const region = regionOf(cell, this.cfg.h3);
      rows.push({
        h3: cell,
        region,
        zone: zoneOf(cell, this.cfg.h3),
        owner_faction: w.o,
        garrison: erodedGarrison(w.g, w.u, now, this.cfg.erosion),
        wild_garrison: wild[cell] ?? null,
        elevation_m: null,
        last_attacked_at: w.a ? new Date(w.a).toISOString() : null,
        contested: w.a != null && now - w.a < DAY_MS,
        region_faction: ctrl.get(region) ?? null,
        captain_level: w.o != null ? (w.c ?? seedCaptainLevel(cell)) : null,
      });
    }
    for (const [cell, g] of Object.entries(wild)) {
      if (seen.has(cell) || !inBox(cell)) continue;
      const region = regionOf(cell, this.cfg.h3);
      rows.push({
        h3: cell,
        region,
        zone: zoneOf(cell, this.cfg.h3),
        owner_faction: null,
        garrison: null,
        wild_garrison: g,
        elevation_m: null,
        last_attacked_at: null,
        contested: false,
        region_faction: ctrl.get(region) ?? null,
      });
    }
    return rows;
  }

  /** Graine de saison (garnisons sauvages affichées par l'app). */
  seasonInfo(): LocalSeason {
    return this.season();
  }

  // ───────────────────────── courses ─────────────────────────

  async submitRun(input: SubmitRunInput): Promise<SubmitRunResponse> {
    const profile = this.profileRaw();
    if (!profile) throw new Error('onboarding_required');
    const runs = this.runs();
    const existing = runs.find((r) => r.client_run_id === input.clientRunId);
    if (existing) return { run: existing, trophies: [], duplicate: true };

    const now = this.now();
    const firstT = input.points.reduce((m, p) => Math.min(m, p.t), Infinity);
    const day = localDay(Number.isFinite(firstT) ? firstT : now, input.tzOffsetMin);
    const alreadyToday = runs
      .filter((r) => r.status === 'validated' && r.started_at && localDay(Date.parse(r.started_at), input.tzOffsetMin) === day)
      .reduce((a, r) => ({ km: a.km + Number(r.counted_km), dplusM: a.dplusM + Number(r.dplus_m ?? 0) }), { km: 0, dplusM: 0 });

    const result = await processRun({
      raw: input.points,
      source: input.source,
      now,
      cfg: this.cfg,
      dem: this.dem(),
      alreadyToday,
      streak: { days: profile.streak_days, lastDay: profile.streak_last_day },
      tzOffsetMin: input.tzOffsetMin,
    });
    const season = this.season();
    const id = `run-${this.seq()}`;
    let run: RunRow;
    let trophies: string[] = [];
    if (result.status === 'rejected') {
      const m = result.metrics;
      run = {
        id,
        client_run_id: input.clientRunId,
        source: input.source,
        status: 'rejected',
        rejection_code: result.rejection.code,
        rejection_details: result.rejection.details,
        started_at: new Date(m.startedAt ?? (Number.isFinite(firstT) ? firstT : now)).toISOString(),
        duration_s: m.durationS ?? null,
        moving_s: null,
        distance_m: null,
        dplus_m: null,
        dplus_source: null,
        counted_km: 0,
        troops_earned: 0,
        troops_remaining: 0,
        deploy_deadline: null,
        cells: [],
        xp_earned: 0,
        season_id: season.id,
        bonus_troops: 0,
      };
    } else {
      const m = result.metrics;
      run = {
        id,
        client_run_id: input.clientRunId,
        source: input.source,
        status: 'validated',
        rejection_code: null,
        rejection_details: null,
        started_at: new Date(m.startedAt).toISOString(),
        duration_s: m.durationS,
        moving_s: m.movingS,
        distance_m: m.distanceM,
        dplus_m: m.dplusM,
        dplus_source: m.dplusSource,
        counted_km: result.troops.countedKm,
        troops_earned: result.troops.troops,
        troops_remaining: result.troops.troops,
        deploy_deadline: result.troops.troops > 0 ? new Date(now + this.cfg.troops.deployWindowHours * 3_600_000).toISOString() : null,
        cells: result.cells.map((c) => ({ cell: c.cell, region: c.region, zone: c.zone, meters: c.meters })),
        xp_earned: result.xp,
        season_id: season.id,
        bonus_troops: result.troops.bonusTroops,
      };
      // garnisons sauvages exactes (altitude du modèle de terrain)
      const wild = this.read<Record<string, number>>('wild', {});
      for (const c of result.cells) if (c.elevationM != null) wild[c.cell] = wildGarrison(c.cell, c.elevationM, season.wild_seed, this.cfg.wild);
      this.write('wild', wild);
      // cases explorées
      const seen = this.read<Record<string, number>>('cells_seen', {});
      let newCells = 0;
      for (const c of result.cells) {
        if (seen[c.cell] == null) {
          seen[c.cell] = now;
          newCells++;
        }
      }
      this.write('cells_seen', seen);
      const localHour = new Date(m.startedAt + input.tzOffsetMin * 60_000).getUTCHours();
      const xp = profile.xp + result.xp;
      const p: LocalProfile = {
        ...profile,
        xp,
        level: levelFromXp(xp).level,
        runs_count: profile.runs_count + 1,
        total_km: profile.total_km + m.distanceM / 1000,
        total_dplus_m: profile.total_dplus_m + m.dplusM,
        distinct_cells: profile.distinct_cells + newCells,
        streak_days: result.streak.days,
        streak_last_day: result.streak.lastDay,
        points: profile.points + Math.round(result.troops.countedKm * this.cfg.score.perKm),
        best_pace_s_per_km:
          m.distanceM >= 1000 && m.avgPaceSecPerKm != null
            ? Math.min(profile.best_pace_s_per_km ?? Infinity, m.avgPaceSecPerKm)
            : profile.best_pace_s_per_km,
        early_runs: profile.early_runs + (localHour < 7 ? 1 : 0),
        night_runs: profile.night_runs + (localHour >= 21 ? 1 : 0),
      };
      trophies = this.awardTrophies(p);
    }
    this.write('runs', [run, ...runs].slice(0, 300));
    return { run, trophies, duplicate: false };
  }

  private awardTrophies(p: LocalProfile): string[] {
    const already = new Set(this.read<string[]>('trophies', []));
    const stats: PlayerStats = {
      runs: p.runs_count,
      totalKm: p.total_km,
      totalDplusM: p.total_dplus_m,
      level: p.level,
      captures: p.captures_count,
      regionsTaken: p.regions_taken,
      maxAltitudeCapturedM: p.max_altitude_captured_m,
      bestPaceSecPerKm: p.best_pace_s_per_km,
      earlyRuns: p.early_runs,
      nightRuns: p.night_runs,
      distinctCells: p.distinct_cells,
    };
    const won = newTrophies(stats, already);
    const xp = p.xp + won.reduce((s, t) => s + t.xp, 0);
    this.write('profile', { ...p, xp, level: levelFromXp(xp).level });
    if (won.length) this.write('trophies', [...already, ...won.map((t) => t.id)]);
    return won.map((t) => t.id);
  }

  async getRun(id: string): Promise<RunRow> {
    const r = this.runs().find((x) => x.id === id);
    if (!r) throw new Error('run_not_found');
    return r;
  }

  async myRuns(limit = 50): Promise<RunRow[]> {
    return this.runs().slice(0, limit);
  }

  async pendingDeployments(): Promise<RunRow[]> {
    const now = this.now();
    return this.runs().filter((r) => r.troops_remaining > 0 && r.deploy_deadline != null && Date.parse(r.deploy_deadline) > now);
  }

  // ───────────────────────── déploiement ─────────────────────────

  async deployTargets(runId: string): Promise<DeployTargetRow[]> {
    const run = await this.getRun(runId);
    const world = this.world();
    const ctrl = this.controllers(world);
    return run.cells.map((c) => {
      const st = this.stateNow(world, c.cell);
      return { h3: c.cell, region: c.region, owner_faction: st.owner, garrison: st.garrison, region_controller: ctrl.get(c.region) ?? null };
    });
  }

  async deployTroops(runId: string, allocations: Allocation[]): Promise<DeployResultRow[]> {
    const profile = this.profileRaw();
    if (!profile?.faction_id) throw new Error('onboarding_required');
    const runs = this.runs();
    const idx = runs.findIndex((r) => r.id === runId);
    const run = runs[idx];
    if (!run) throw new Error('run_not_found');
    const now = this.now();
    if (!run.deploy_deadline || Date.parse(run.deploy_deadline) < now) throw new Error('deadline_passed');
    const err = validateAllocations(allocations, new Set(run.cells.map((c) => c.cell)), run.troops_remaining);
    if (err) throw new Error(err);

    const faction = profile.faction_id;
    const world = this.world();
    const ctrlBefore = this.controllers(world);
    const front = this.frontToday(world);
    const results: DeployResultRow[] = [];
    const logs: DeploymentLog[] = [];
    let captures = 0;
    let frontCaptures = 0;
    let reinforcements = 0;
    let troops = 0;
    for (const a of [...allocations].sort((x, y) => x.cell.localeCompare(y.cell))) {
      const cell = run.cells.find((c) => c.cell === a.cell)!;
      const cur = this.stateNow(world, a.cell, now);
      const eff = effectiveTroops(a.troops, ctrlBefore.get(cell.region) === faction, this.cfg.region);
      const r = resolveAttack(cur, faction, eff, this.cfg.combat, this.cfg.erosion.abandonThreshold);
      const captain = r.outcome === 'damaged' ? world[a.cell]?.c : profile.level;
      world[a.cell] = { o: r.after.owner, g: r.after.garrison, u: now, a: r.outcome === 'reinforced' ? (world[a.cell]?.a ?? null) : now, ...(captain != null ? { c: captain } : {}) };
      results.push({
        h3: a.cell,
        troops: a.troops,
        effective: eff,
        outcome: r.outcome,
        before_owner: cur.owner,
        before_garrison: round4(cur.garrison),
        after_owner: r.after.owner,
        after_garrison: r.after.garrison,
      });
      logs.push({ h3: a.cell, outcome: r.outcome, before_owner: cur.owner, actor: 'me', faction, at: now });
      troops += a.troops;
      if (r.outcome === 'captured') {
        captures++;
        if (cell.region === front) frontCaptures++;
      } else if (r.outcome === 'reinforced') reinforcements++;
    }
    this.write('world', world);
    this.logDeployments(logs);
    runs[idx] = { ...run, troops_remaining: run.troops_remaining - troops };
    this.write('runs', runs);

    // régions gagnées / perdues
    const ctrlAfter = this.controllers(world);
    const events: Omit<FeedEvent, 'id'>[] = [];
    let regionsGained = 0;
    for (const [region, f] of ctrlAfter) {
      const before = ctrlBefore.get(region) ?? null;
      if (f !== before) {
        if (f != null) {
          events.push({ kind: 'region_gained', faction_id: f, actor_name: null, h3: null, payload: { region }, created_at: new Date(now).toISOString() });
          if (f === faction) regionsGained++;
        }
        if (before != null) {
          events.push({ kind: 'region_lost', faction_id: before, actor_name: null, h3: null, payload: { region }, created_at: new Date(now).toISOString() });
        }
      }
    }
    if (captures > 0) {
      events.push({
        kind: 'capture',
        faction_id: faction,
        actor_name: profile.username,
        h3: results.find((r) => r.outcome === 'captured')?.h3 ?? null,
        payload: { count: captures, front: frontCaptures },
        created_at: new Date(now).toISOString(),
      });
    } else if (reinforcements >= 3) {
      events.push({ kind: 'defense', faction_id: faction, actor_name: profile.username, h3: null, payload: { count: reinforcements }, created_at: new Date(now).toISOString() });
    }
    this.pushEvents(events);

    const s = this.cfg.score;
    const xpGain =
      captures * this.cfg.xp.perCapture +
      reinforcements * this.cfg.xp.perReinforce +
      Math.round(frontCaptures * this.cfg.xp.perCapture * (this.cfg.front.xpMultiplier - 1));
    const p: LocalProfile = {
      ...profile,
      captures_count: profile.captures_count + captures,
      regions_taken: profile.regions_taken + regionsGained,
      reinforcements: profile.reinforcements + reinforcements,
      points:
        profile.points +
        captures * s.perCapture +
        troops * s.perTroopDeployed +
        Math.round(frontCaptures * s.perCapture * (this.cfg.front.pointsMultiplier - 1)),
      xp: profile.xp + xpGain,
      level: levelFromXp(profile.xp + xpGain).level,
    };
    this.awardTrophies(p);
    this.emit('hexes');
    return results;
  }

  // ───────────────────────── social ─────────────────────────

  async zoneFeed(_zone?: string, limit = 30): Promise<FeedEvent[]> {
    return this.read<FeedEvent[]>('events', []).slice(0, limit);
  }

  async zoneLeaderboard(): Promise<ZoneLeaderboardRow[]> {
    const p = this.profileRaw();
    const rows: Omit<ZoneLeaderboardRow, 'rank'>[] = this.npcs().map((n) => ({
      user_id: n.id,
      username: n.name,
      faction_id: n.faction,
      avatar_id: npcAvatar(n.id),
      points: n.points,
      captures: n.captures,
    }));
    if (p) rows.push({ user_id: ME, username: p.username, faction_id: p.faction_id ?? 0, avatar_id: p.avatar_id, points: p.points, captures: p.captures_count });
    rows.sort((a, b) => b.points - a.points || a.username.localeCompare(b.username));
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  async teamOverview(): Promise<TeamOverview> {
    const p = this.profileRaw();
    const world = this.world();
    const f = p?.faction_id ?? null;
    const members = [
      ...(p ? [{ id: ME, username: p.username, level: p.level, avatar_id: p.avatar_id }] : []),
      ...this.npcs()
        .filter((n) => n.faction === f)
        .map((n) => ({ id: n.id, username: n.name, level: npcLevel(n.id), avatar_id: npcAvatar(n.id) })),
    ];
    const hexes = Object.values(world).filter((w) => w.o === f && f != null).length;
    const regions = [...this.controllers(world).values()].filter((x) => x === f && f != null).length;
    return { members, hexes, regions };
  }

  async warOverview(): Promise<WarOverview> {
    const world = this.world();
    const daily = this.read<Record<string, Record<string, number>>>('daily', {});
    const victories = this.read<Record<string, number>>('victories', {});
    const season = this.season();
    return {
      factions: activeFactions(this.cfg.factions).map((f) => {
        const hexes = Object.values(world).filter((w) => w.o === f.id).length;
        return {
          faction_id: f.id,
          hexes_zone: hexes,
          hexes_world: hexes,
          territory_days: Object.values(daily).reduce((s, d) => s + (d[String(f.id)] ?? 0), 0),
          victories: victories[String(f.id)] ?? 0,
        };
      }),
      front: this.frontToday(world),
      season: { id: season.id, name: season.name, ends_at: season.ends_at },
    };
  }

  async nemesis(): Promise<Nemesis | null> {
    const logs = this.read<DeploymentLog[]>('deployments', []);
    const mine = new Map<string, number>();
    for (const l of logs) if (l.actor === 'me' && l.outcome === 'captured' && !mine.has(l.h3)) mine.set(l.h3, l.at);
    const count = new Map<string, number>();
    for (const l of logs) {
      if (l.actor === 'me' || l.outcome !== 'captured') continue;
      const t = mine.get(l.h3);
      if (t != null && l.at > t) count.set(l.actor, (count.get(l.actor) ?? 0) + 1);
    }
    let best: [string, number] | null = null;
    for (const e of count) if (!best || e[1] > best[1]) best = e;
    if (!best) return null;
    const npc = this.npcs().find((n) => n.id === best![0]);
    if (!npc) return null;
    return { user_id: npc.id, username: npc.name, avatar_id: npcAvatar(npc.id), faction_id: npc.faction, taken: best[1] };
  }

  async myTrophies(): Promise<string[]> {
    return this.read<string[]>('trophies', []);
  }

  async weeklyProgress(): Promise<WeeklyProgress> {
    const now = new Date(this.now());
    const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
    const runs = this.runs().filter((r) => r.status === 'validated' && r.started_at && Date.parse(r.started_at) >= monday);
    const logs = this.read<DeploymentLog[]>('deployments', []);
    const seen = this.read<Record<string, number>>('cells_seen', {});
    return {
      distance: runs.reduce((s, r) => s + Number(r.counted_km), 0),
      dplus: runs.reduce((s, r) => s + Number(r.dplus_m ?? 0), 0),
      wild_captures: logs.filter((l) => l.actor === 'me' && l.outcome === 'captured' && l.before_owner == null && l.at >= monday).length,
      new_cells: Object.values(seen).filter((t) => t >= monday).length,
    };
  }

  // ───────────────────────── la guerre continue sans toi ─────────────────────────

  /**
   * Fait jouer l'IA pour chaque période de 8 h écoulée (au plus 7 jours de rattrapage) :
   * érosion, contre-attaques ennemies, renforts alliés, scores du jour, fin de saison.
   */
  async tick(): Promise<number> {
    const profile = this.profileRaw();
    if (!profile?.faction_id) return 0;
    const ai = this.read<{ lastTick: number; turn: number }>('ai', { lastTick: this.now(), turn: 0 });
    const now = this.now();
    // longue absence : on ne rejoue que les 7 derniers jours (le monde « dormait » avant)
    if (now - ai.lastTick > 21 * PERIOD_MS) ai.lastTick = now - 21 * PERIOD_MS;
    const periods = Math.min(21, Math.floor((now - ai.lastTick) / PERIOD_MS));
    if (periods <= 0) return 0;
    const me = profile.faction_id;
    const enemy = enemyOf(me, this.cfg.factions) ?? activeFactions(this.cfg.factions).find((f) => f.id !== me)!.id;
    let world = this.world();
    let season = this.season();
    const npcs = this.npcs();
    const daily = this.read<Record<string, Record<string, number>>>('daily', {});
    const events: Omit<FeedEvent, 'id'>[] = [];
    const logs: DeploymentLog[] = [];
    let turn = ai.turn;

    for (let i = 1; i <= periods; i++) {
      const t = ai.lastTick + i * PERIOD_MS;
      turn++;
      // érosion matérialisée, abandons
      for (const [cell, w] of Object.entries(world)) {
        const g = erodedGarrison(w.g, w.u, t, this.cfg.erosion);
        if (g < this.cfg.erosion.abandonThreshold) delete world[cell];
        else world[cell] = { ...w, g, u: t };
      }
      const troops7 = this.runs()
        .filter((r) => r.status === 'validated' && r.started_at && Date.parse(r.started_at) > t - 7 * DAY_MS)
        .reduce((s, r) => s + r.troops_earned, 0);
      const ctrlBefore = this.controllers(world);
      const snapshot = new Map<string, HexSnapshot>(Object.entries(world).map(([c, w]) => [c, { owner: w.o, garrison: w.g }]));
      const wildOf = (cell: string): number => this.wildAt(cell);
      const captains = new Map<string, number>();
      for (const [side, faction, rival] of [
        ['enemy', enemy, me],
        ['ally', me, enemy],
      ] as const) {
        const budget = Math.max(side === 'enemy' ? 2 : 1, Math.round(aiDailyBudget(troops7, side) / 3));
        const actions = aiTurn(snapshot, faction, budget, { rival, seed: `${season.wild_seed}:${turn}:${side}`, wildOf, aggression: side === 'enemy' ? 0.7 : 0.3 }, this.cfg);
        const actorNpc = npcs.filter((n) => n.faction === faction);
        const actor = actorNpc[Math.floor(hash01(`${season.wild_seed}:${turn}:${side}:who`) * actorNpc.length)];
        let caps = 0;
        let firstCap: string | null = null;
        for (const a of actions) {
          if (a.outcome !== 'damaged') captains.set(a.cell, actor ? npcLevel(actor.id) : seedCaptainLevel(a.cell));
          if (a.outcome === 'captured') {
            caps++;
            firstCap = firstCap ?? a.cell;
          }
          logs.push({ h3: a.cell, outcome: a.outcome, before_owner: a.before.owner, actor: actor?.id ?? `npc:${faction}`, faction, at: t });
        }
        if (actor) {
          actor.points += caps * this.cfg.score.perCapture + budget;
          actor.captures += caps;
        }
        if (caps > 0) {
          events.push({
            kind: 'capture',
            faction_id: faction,
            actor_name: actor?.name ?? npcName(faction, `${turn}`),
            h3: firstCap,
            payload: { count: caps, npc: true },
            created_at: new Date(t).toISOString(),
          });
        }
      }
      // applique le résultat des tours
      const next: Record<string, WorldCell> = {};
      for (const [cell, s] of snapshot) {
        const prev = world[cell];
        const changed = !prev || prev.o !== s.owner || Math.abs(prev.g - s.garrison) > 1e-6;
        const c = captains.get(cell) ?? (prev && prev.o === s.owner ? prev.c : undefined);
        next[cell] = { o: s.owner, g: s.garrison, u: changed ? t : (prev?.u ?? t), a: changed && prev?.o !== s.owner ? t : (prev?.a ?? null), ...(c != null ? { c } : {}) };
      }
      world = next;
      const ctrlAfter = this.controllers(world);
      for (const [region, f] of ctrlAfter) {
        const before = ctrlBefore.get(region) ?? null;
        if (f !== before && f != null) {
          events.push({ kind: 'region_gained', faction_id: f, actor_name: null, h3: null, payload: { region }, created_at: new Date(t).toISOString() });
        }
      }
      // score du jour (territoire-jours)
      const day = localDay(t);
      if (!daily[day]) {
        const counts: Record<string, number> = {};
        for (const w of Object.values(world)) if (w.o != null) counts[String(w.o)] = (counts[String(w.o)] ?? 0) + 1;
        daily[day] = counts;
      }
      // fin de saison : victoire, nouvelle carte
      if (t >= Date.parse(season.ends_at)) {
        const totals = new Map<number, number>();
        for (const d of Object.values(daily)) for (const [f, n] of Object.entries(d)) totals.set(Number(f), (totals.get(Number(f)) ?? 0) + n);
        const winner = [...totals].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const victories = this.read<Record<string, number>>('victories', {});
        if (winner != null) victories[String(winner)] = (victories[String(winner)] ?? 0) + 1;
        this.write('victories', victories);
        events.push({ kind: 'season_end', faction_id: winner, actor_name: null, h3: null, payload: { season: season.name }, created_at: new Date(t).toISOString() });
        const nextId = season.id + 1;
        const seed = `${season.wild_seed}-s${nextId}`;
        season = {
          id: nextId,
          name: `Saison ${nextId}`,
          starts_at: new Date(t).toISOString(),
          ends_at: new Date(t + this.cfg.season.lengthDays * DAY_MS).toISOString(),
          wild_seed: seed,
        };
        world = {};
        for (const h of seedWorld({ center: profile.center, playerFaction: me, enemyFaction: enemy, seed }, this.cfg)) world[h.cell] = { o: h.owner, g: h.garrison, u: t, a: null };
        for (const n of npcs) {
          n.points = 0;
          n.captures = 0;
        }
        this.write('profile', { ...this.profileRaw()!, points: 0 });
        this.write('daily', {});
        for (const k of Object.keys(daily)) delete daily[k];
      }
    }
    this.write('world', world);
    this.write('season', season);
    this.write('npcs', npcs);
    this.write('daily', daily);
    this.write('ai', { lastTick: ai.lastTick + periods * PERIOD_MS, turn });
    this.logDeployments(logs);
    this.pushEvents(events);
    this.emit('hexes');
    return periods;
  }

  async exportData(): Promise<unknown> {
    const dump: Record<string, unknown> = {};
    for (const k of ['profile', 'season', 'runs', 'events', 'trophies', 'world', 'npcs', 'deployments', 'cells_seen']) dump[k] = this.read(k, null);
    return { exported_at: new Date(this.now()).toISOString(), mode: 'local', ...dump };
  }

  async deleteAccount(): Promise<void> {
    for (const k of ['profile', 'season', 'world', 'wild', 'runs', 'events', 'deployments', 'trophies', 'cells_seen', 'npcs', 'ai', 'daily', 'victories', 'seq']) {
      this.kv.removeItem(`cr:${k}`);
    }
    this.emit('hexes');
  }
}
