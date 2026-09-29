import {
  CellTracker,
  evaluateReadiness,
  type GpsReadiness,
  type LatLng,
  type LiveSnapshot,
  LiveTracker,
  type RawPoint,
} from '@conquete/core';
import * as Crypto from 'expo-crypto';
import { useSyncExternalStore } from 'react';
import { currentConfig } from '@/lib/gameConfig';
import { onPoints } from './events';
import { isTracking, startTracking, stopTracking } from './locationTask';
import { type CompactTrace, startReplay, stopReplay } from './simulation';
import * as store from './storage';

export type Phase = 'idle' | 'warming' | 'running' | 'finished';

export interface RunSessionState {
  phase: Phase;
  localRunId: string | null;
  source: 'gps' | 'simulation';
  simulation: { name: string; speed: number } | null;
  readiness: GpsReadiness;
  warmingSince: number;
  /** heure de départ (chrono) */
  startedAt: number | null;
  snapshot: LiveSnapshot | null;
  litCells: string[];
  /** trace filtrée sous-échantillonnée (affichage uniquement, jamais partagée) */
  track: LatLng[];
}

const IDLE: RunSessionState = {
  phase: 'idle',
  localRunId: null,
  source: 'gps',
  simulation: null,
  readiness: { state: 'searching', accuracyM: null, canStart: false },
  warmingSince: 0,
  startedAt: null,
  snapshot: null,
  litCells: [],
  track: [],
};

let state: RunSessionState = IDLE;
const listeners = new Set<() => void>();
let tracker: LiveTracker | null = null;
let cells: CellTracker | null = null;
let unsubscribe: (() => void) | null = null;
let pendingSim: CompactTrace | null = null;
let lastEmit = 0;

function set(patch: Partial<RunSessionState>, force = false): void {
  state = { ...state, ...patch };
  const now = Date.now();
  if (!force && now - lastEmit < 500) return; // ≤ 2 rafraîchissements/s de l'UI
  lastEmit = now;
  for (const fn of listeners) fn();
}

export function getRunSession(): RunSessionState {
  return state;
}

export function useRunSession(): RunSessionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

function newTrackers(): void {
  const cfg = currentConfig();
  tracker = new LiveTracker(cfg.gps);
  cells = new CellTracker(cfg.h3.territoryRes, cfg.territory.minMetersInCell);
}

function feed(pts: readonly RawPoint[]): void {
  if (state.phase === 'warming') {
    if (state.source === 'simulation') return;
    const run = state.localRunId;
    if (!run) return;
    set({ readiness: evaluateReadiness(store.recentPoints(run, 5), state.warmingSince, Date.now()) });
    return;
  }
  if (state.phase !== 'running' || !tracker || !cells) return;
  let lit = state.litCells;
  let track = state.track;
  for (const p of pts) {
    const f = tracker.push(p);
    if (!f) continue;
    const newly = cells.add(f);
    if (newly.length) lit = [...lit, ...newly];
    const last = track[track.length - 1];
    if (!last || Math.abs(last.lat - f.lat) + Math.abs(last.lng - f.lng) > 0.00005) track = [...track, { lat: f.lat, lng: f.lng }];
  }
  set({ snapshot: tracker.snapshot(Date.now()), litCells: lit, track });
}

function subscribe(): void {
  unsubscribe?.();
  unsubscribe = onPoints(feed);
}

/** Étape 1 : préchauffage du GPS (écran « GPS prêt »). */
export async function prepare(
  source: 'gps' | 'simulation',
  sim?: { name: string; speed: number; trace: CompactTrace },
): Promise<void> {
  const existing = store.getActiveRun();
  if (existing) store.discardRun(existing.id);
  const run = store.createRun(Crypto.randomUUID(), source, sim?.name ?? null);
  pendingSim = sim?.trace ?? null;
  state = {
    ...IDLE,
    phase: 'warming',
    localRunId: run.id,
    source,
    simulation: sim ? { name: sim.name, speed: sim.speed } : null,
    warmingSince: Date.now(),
    readiness:
      source === 'simulation' ? { state: 'ready', accuracyM: 5, canStart: true } : { state: 'searching', accuracyM: null, canStart: false },
  };
  subscribe();
  set({}, true);
  if (source === 'gps') await startTracking();
}

/** Étape 2 : départ. */
export function start(): void {
  if (state.phase !== 'warming' || !state.localRunId) return;
  const t0 = Date.now();
  store.markStarted(state.localRunId, t0);
  newTrackers();
  set({ phase: 'running', startedAt: t0, snapshot: tracker!.snapshot(t0), litCells: [], track: [] }, true);
  if (state.source === 'simulation' && pendingSim && state.simulation) {
    startReplay(pendingSim, state.simulation.speed, () => set({}, true));
  }
}

/** Fin : arrêt du GPS, validation locale ; renvoie l'identifiant local à envoyer. */
export async function finish(): Promise<string | null> {
  const id = state.localRunId;
  if (!id) return null;
  stopReplay();
  await stopTracking();
  const snapshot = tracker?.finish() ?? state.snapshot;
  store.markFinished(id, Date.now());
  unsubscribe?.();
  set({ phase: 'finished', snapshot }, true);
  return id;
}

export async function discard(): Promise<void> {
  stopReplay();
  await stopTracking();
  if (state.localRunId) store.discardRun(state.localRunId);
  unsubscribe?.();
  state = IDLE;
  set({}, true);
}

export function reset(): void {
  state = IDLE;
  set({}, true);
}

/** Tic d'horloge (chrono affiché même sans nouveau point). */
export function tick(): void {
  if (state.phase === 'running' && tracker) set({ snapshot: tracker.snapshot(Date.now()) });
}

/**
 * Au démarrage de l'app : si une course était en cours (app tuée, téléphone redémarré),
 * on reconstruit l'état en rejouant tous les points stockés, puis on relance le GPS.
 */
export async function restoreIfNeeded(): Promise<boolean> {
  const run = store.getActiveRun();
  if (!run) return false;
  if (run.state === 'warming' || run.source === 'simulation') {
    store.discardRun(run.id);
    return false;
  }
  state = { ...IDLE, phase: 'running', localRunId: run.id, source: 'gps', warmingSince: run.created_at, startedAt: run.started_at };
  newTrackers();
  const pts = store.readPoints(run.id, run.started_at ?? 0);
  subscribe();
  feed(pts);
  set({}, true);
  if (!(await isTracking())) await startTracking();
  return true;
}
