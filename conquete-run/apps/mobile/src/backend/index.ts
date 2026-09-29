import {
  type Allocation,
  type GameBackend,
  type GameMode,
  IgnAltiProvider,
  LocalGame,
  OpenTopoDataProvider,
  type SubmitRunInput,
} from '@conquete/core';
import { kv } from '@/lib/kv';
import { isSupabaseConfigured } from '@/lib/supabase';
import { OnlineBackend } from './online';

/**
 * Mode de jeu : « online » (Supabase, vraie guerre multijoueur) si le serveur est configuré,
 * sinon « local » (tout sur le téléphone, ennemi simulé). EXPO_PUBLIC_GAME_MODE=local force
 * le mode local.
 */
export const GAME_MODE: GameMode =
  process.env.EXPO_PUBLIC_GAME_MODE === 'local' || !isSupabaseConfigured ? 'local' : 'online';

let localGame: LocalGame | null = null;

/** Appels au modèle de terrain bornés à 10 s : sans réseau, le D+ retombe sur le GPS. */
async function fetchWithTimeout(url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function getLocalGame(): LocalGame {
  if (!localGame) {
    localGame = new LocalGame({
      kv,
      // D+ par modèle de terrain même hors serveur (IGN en France, Open Topo Data ailleurs)
      dem: () => [new IgnAltiProvider(fetchWithTimeout), new OpenTopoDataProvider(fetchWithTimeout)],
    });
  }
  return localGame;
}

class LocalBackend implements GameBackend {
  readonly mode = 'local' as const;
  private get g(): LocalGame {
    return getLocalGame();
  }
  getMyProfile = () => this.g.getMyProfile();
  onboard: GameBackend['onboard'] = (i) => this.g.onboard(i);
  zoneFactionCounts = () => this.g.zoneFactionCounts();
  setAvatar = (id: string) => this.g.setAvatar(id);
  setLocale = (l: 'fr' | 'en') => this.g.setLocale(l);
  hexesInBBox: GameBackend['hexesInBBox'] = (b) => this.g.hexesInBBox(b);
  submitRun = (i: SubmitRunInput) => this.g.submitRun(i);
  getRun = (id: string) => this.g.getRun(id);
  myRuns = (limit?: number) => this.g.myRuns(limit);
  pendingDeployments = () => this.g.pendingDeployments();
  deployTargets = (runId: string) => this.g.deployTargets(runId);
  deployTroops = (runId: string, a: Allocation[]) => this.g.deployTroops(runId, a);
  zoneFeed = (zone: string, limit?: number) => this.g.zoneFeed(zone, limit);
  zoneLeaderboard = () => this.g.zoneLeaderboard();
  teamOverview = () => this.g.teamOverview();
  warOverview = () => this.g.warOverview();
  nemesis = () => this.g.nemesis();
  myTrophies = () => this.g.myTrophies();
  weeklyProgress = () => this.g.weeklyProgress();
  subscribe: GameBackend['subscribe'] = (_zone, onChange) => this.g.subscribe(onChange);
  tick = async () => {
    await this.g.tick();
  };
  exportData = () => this.g.exportData();
  deleteAccount = () => this.g.deleteAccount();
}

let instance: GameBackend | null = null;

export function backend(): GameBackend {
  if (!instance) instance = GAME_MODE === 'local' ? new LocalBackend() : new OnlineBackend();
  return instance;
}
