import type { RawPoint } from '@conquete/core';
import { kv } from '@/lib/kv';

/**
 * Version web (aperçu dans un navigateur) du stockage des courses : même interface que
 * storage.ts (SQLite), en mémoire avec copie dans localStorage.
 */
export type LocalRunState = 'warming' | 'running' | 'finished' | 'discarded';
export type UploadStatus = 'none' | 'pending' | 'done' | 'failed';

export interface LocalRun {
  id: string;
  state: LocalRunState;
  source: 'gps' | 'simulation';
  sim_name: string | null;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
  upload_status: UploadStatus;
  server_run_id: string | null;
  last_error: string | null;
  attempts: number;
}

const KEY = 'cr:web:runs';
let runs: LocalRun[] = JSON.parse(kv.getItem(KEY) ?? '[]') as LocalRun[];
const points = new Map<string, RawPoint[]>();
const save = () => kv.setItem(KEY, JSON.stringify(runs));
const update = (id: string, patch: Partial<LocalRun>) => {
  runs = runs.map((r) => (r.id === id ? { ...r, ...patch } : r));
  save();
};

export function createRun(id: string, source: 'gps' | 'simulation', simName: string | null): LocalRun {
  const run: LocalRun = {
    id,
    state: 'warming',
    source,
    sim_name: simName,
    created_at: Date.now(),
    started_at: null,
    ended_at: null,
    upload_status: 'none',
    server_run_id: null,
    last_error: null,
    attempts: 0,
  };
  runs = [...runs, run];
  save();
  return run;
}

export function getRun(id: string): LocalRun | null {
  return runs.find((r) => r.id === id) ?? null;
}

export function getActiveRun(): LocalRun | null {
  return [...runs].reverse().find((r) => r.state === 'warming' || r.state === 'running') ?? null;
}

export function appendPoints(runId: string, pts: readonly RawPoint[]): void {
  const list = points.get(runId) ?? [];
  const seen = new Set(list.map((p) => Math.round(p.t)));
  for (const p of pts) if (!seen.has(Math.round(p.t))) list.push({ ...p, t: Math.round(p.t) });
  list.sort((a, b) => a.t - b.t);
  points.set(runId, list);
}

export function readPoints(runId: string, fromT = 0): RawPoint[] {
  return (points.get(runId) ?? []).filter((p) => p.t >= fromT);
}

export function recentPoints(runId: string, n: number): RawPoint[] {
  return (points.get(runId) ?? []).slice(-n);
}

export function markStarted(runId: string, t: number): void {
  update(runId, { state: 'running', started_at: t });
  points.set(runId, readPoints(runId, t));
}

export function markFinished(runId: string, t: number): void {
  update(runId, { state: 'finished', ended_at: t, upload_status: 'pending' });
}

export function discardRun(runId: string): void {
  update(runId, { state: 'discarded', upload_status: 'none' });
  points.delete(runId);
}

export function pendingUploads(): LocalRun[] {
  return runs.filter((r) => r.state === 'finished' && (r.upload_status === 'pending' || r.upload_status === 'failed'));
}

export function markUploaded(runId: string, serverRunId: string): void {
  update(runId, { upload_status: 'done', server_run_id: serverRunId, last_error: null });
  points.delete(runId);
}

export function markUploadFailed(runId: string, error: string): void {
  const r = getRun(runId);
  update(runId, { upload_status: 'failed', last_error: error, attempts: (r?.attempts ?? 0) + 1 });
}

export function wipeLocalData(): void {
  runs = [];
  points.clear();
  save();
}
