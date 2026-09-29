import type { RawPoint } from '@conquete/core';
import * as SQLite from 'expo-sqlite';

/**
 * Persistance incrémentale des courses sur l'appareil (SQLite, API synchrone) : chaque point
 * reçu par la tâche de localisation est écrit immédiatement. Si l'app est tuée pendant la
 * course, rien n'est perdu : la course est reconstruite en rejouant les points.
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

let db: SQLite.SQLiteDatabase | null = null;

function database(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('runs.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY NOT NULL,
      state TEXT NOT NULL,
      source TEXT NOT NULL,
      sim_name TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER,
      upload_status TEXT NOT NULL DEFAULT 'none',
      server_run_id TEXT,
      last_error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS points (
      run_id TEXT NOT NULL,
      t INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      acc REAL,
      alt REAL,
      alt_acc REAL,
      speed REAL,
      mocked INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (run_id, t)
    );
  `);
  return db;
}

export function createRun(id: string, source: 'gps' | 'simulation', simName: string | null): LocalRun {
  const now = Date.now();
  database().runSync(
    "INSERT INTO runs (id, state, source, sim_name, created_at) VALUES (?, 'warming', ?, ?, ?)",
    id,
    source,
    simName,
    now,
  );
  return getRun(id)!;
}

export function getRun(id: string): LocalRun | null {
  return database().getFirstSync<LocalRun>('SELECT * FROM runs WHERE id = ?', id);
}

/** Course en cours (préchauffage ou enregistrement), s'il y en a une. */
export function getActiveRun(): LocalRun | null {
  return database().getFirstSync<LocalRun>(
    "SELECT * FROM runs WHERE state IN ('warming', 'running') ORDER BY created_at DESC LIMIT 1",
  );
}

export function appendPoints(runId: string, pts: readonly RawPoint[]): void {
  if (pts.length === 0) return;
  const d = database();
  d.withTransactionSync(() => {
    for (const p of pts) {
      d.runSync(
        'INSERT OR IGNORE INTO points (run_id, t, lat, lng, acc, alt, alt_acc, speed, mocked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        runId,
        Math.round(p.t),
        p.lat,
        p.lng,
        p.acc,
        p.alt,
        p.altAcc,
        p.speed,
        p.mocked ? 1 : 0,
      );
    }
  });
}

interface PointRow {
  t: number;
  lat: number;
  lng: number;
  acc: number | null;
  alt: number | null;
  alt_acc: number | null;
  speed: number | null;
  mocked: number;
}

const toRaw = (r: PointRow): RawPoint => ({
  t: r.t,
  lat: r.lat,
  lng: r.lng,
  acc: r.acc,
  alt: r.alt,
  altAcc: r.alt_acc,
  speed: r.speed,
  mocked: r.mocked === 1,
});

export function readPoints(runId: string, fromT = 0): RawPoint[] {
  return database()
    .getAllSync<PointRow>('SELECT * FROM points WHERE run_id = ? AND t >= ? ORDER BY t', runId, fromT)
    .map(toRaw);
}

export function recentPoints(runId: string, n: number): RawPoint[] {
  return database()
    .getAllSync<PointRow>('SELECT * FROM points WHERE run_id = ? ORDER BY t DESC LIMIT ?', runId, n)
    .map(toRaw)
    .reverse();
}

export function markStarted(runId: string, t: number): void {
  database().runSync("UPDATE runs SET state = 'running', started_at = ? WHERE id = ?", t, runId);
  // les points de préchauffage ne font pas partie de la course
  database().runSync('DELETE FROM points WHERE run_id = ? AND t < ?', runId, t);
}

export function markFinished(runId: string, t: number): void {
  database().runSync(
    "UPDATE runs SET state = 'finished', ended_at = ?, upload_status = 'pending' WHERE id = ?",
    t,
    runId,
  );
}

export function discardRun(runId: string): void {
  database().runSync("UPDATE runs SET state = 'discarded', upload_status = 'none' WHERE id = ?", runId);
  database().runSync('DELETE FROM points WHERE run_id = ?', runId);
}

export function pendingUploads(): LocalRun[] {
  return database().getAllSync<LocalRun>(
    "SELECT * FROM runs WHERE state = 'finished' AND upload_status IN ('pending', 'failed') ORDER BY created_at",
  );
}

export function markUploaded(runId: string, serverRunId: string): void {
  database().runSync(
    "UPDATE runs SET upload_status = 'done', server_run_id = ?, last_error = NULL WHERE id = ?",
    serverRunId,
    runId,
  );
  // la trace brute est désormais conservée par le serveur : on libère l'appareil
  database().runSync('DELETE FROM points WHERE run_id = ?', runId);
}

export function markUploadFailed(runId: string, error: string): void {
  database().runSync(
    "UPDATE runs SET upload_status = 'failed', last_error = ?, attempts = attempts + 1 WHERE id = ?",
    error,
    runId,
  );
}

/** Suppression de toutes les données locales (déconnexion, suppression de compte). */
export function wipeLocalData(): void {
  database().execSync('DELETE FROM points; DELETE FROM runs;');
}
