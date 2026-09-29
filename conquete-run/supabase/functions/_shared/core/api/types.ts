import type { Allocation } from '../game/deployment.ts';
import type { RawPoint } from '../gps/types.ts';
import type { BBox } from '../geo/h3.ts';

/** Contrat entre l'app et ses deux backends (serveur Supabase / mode local sur le téléphone). */
export interface Profile {
  id: string;
  username: string;
  faction_id: number | null;
  home_zone: string | null;
  locale: 'fr' | 'en';
  avatar_id: string;
  xp: number;
  level: number;
  runs_count: number;
  total_km: number;
  total_dplus_m: number;
  captures_count: number;
  regions_taken: number;
  distinct_cells: number;
  streak_days: number;
  streak_last_day: string | null;
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
  bonus_troops?: number;
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
  region_faction: number | null;
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


export interface ZoneLeaderboardRow {
  user_id: string;
  username: string;
  faction_id: number;
  avatar_id: string;
  points: number;
  captures: number;
  rank: number;
}

export interface WarFactionRow {
  faction_id: number;
  hexes_zone: number;
  hexes_world: number;
  territory_days: number;
  victories: number;
}

export interface WarOverview {
  factions: WarFactionRow[];
  /** région du front du jour */
  front: string | null;
  season: { id: number; name: string; ends_at: string } | null;
}

export interface Nemesis {
  user_id: string;
  username: string;
  avatar_id: string;
  faction_id: number;
  taken: number;
}

export interface SubmitRunResponse {
  run: RunRow;
  trophies: string[];
  duplicate: boolean;
}

export interface SubmitRunInput {
  clientRunId: string;
  source: 'gps' | 'simulation';
  points: RawPoint[];
  tzOffsetMin: number;
}

export interface OnboardingInput {
  username: string;
  faction: number | null;
  avatarId: string;
  locale: 'fr' | 'en';
  /** position (mode local : centre du monde simulé ; en ligne : seule la zone est envoyée) */
  position: { lat: number; lng: number };
  birthYear: number | null;
  gpsConsent: boolean;
  termsVersion: string;
}

export interface TeamOverview {
  members: { id: string; username: string; level: number; avatar_id: string }[];
  hexes: number;
  regions: number;
}

export interface WeeklyProgress {
  distance: number;
  dplus: number;
  wild_captures: number;
  new_cells: number;
}


export type GameMode = 'online' | 'local';

/**
 * Tout ce dont les écrans ont besoin. Deux implémentations : `online` (Supabase, la vraie
 * guerre multijoueur) et `local` (entraînement sur le téléphone, ennemi simulé).
 */
export interface GameBackend {
  readonly mode: GameMode;
  getMyProfile(): Promise<Profile | null>;
  onboard(input: OnboardingInput): Promise<Profile>;
  zoneFactionCounts(zone: string): Promise<Map<number, number>>;
  setAvatar(id: string): Promise<void>;
  setLocale(locale: 'fr' | 'en'): Promise<void>;
  hexesInBBox(b: BBox): Promise<HexRow[]>;
  submitRun(input: SubmitRunInput): Promise<SubmitRunResponse>;
  getRun(id: string): Promise<RunRow>;
  myRuns(limit?: number): Promise<RunRow[]>;
  pendingDeployments(): Promise<RunRow[]>;
  deployTargets(runId: string): Promise<DeployTargetRow[]>;
  deployTroops(runId: string, allocations: Allocation[]): Promise<DeployResultRow[]>;
  zoneFeed(zone: string, limit?: number): Promise<FeedEvent[]>;
  zoneLeaderboard(zone: string): Promise<ZoneLeaderboardRow[]>;
  teamOverview(zone: string): Promise<TeamOverview>;
  warOverview(zone: string): Promise<WarOverview>;
  nemesis(): Promise<Nemesis | null>;
  myTrophies(): Promise<string[]>;
  weeklyProgress(): Promise<WeeklyProgress>;
  /** mises à jour en direct de la carte et du fil ; renvoie la fonction de désabonnement */
  subscribe(zone: string | null, onChange: (what: 'hexes' | 'feed') => void): () => void;
  /** fait avancer le monde (mode local : tours de l'IA) */
  tick(): Promise<void>;
  exportData(): Promise<unknown>;
  deleteAccount(): Promise<void>;
}
