import { invokeFunction, type RunRow } from '@/lib/api';
import * as store from './storage';

export interface SubmitRunResponse {
  run: RunRow;
  trophies: string[];
  duplicate: boolean;
}

/** Envoie la trace BRUTE (le serveur recalcule tout). Idempotent grâce à clientRunId. */
export async function uploadRun(localId: string): Promise<SubmitRunResponse> {
  const run = store.getRun(localId);
  if (!run) throw new Error('run_not_found');
  const points = store.readPoints(localId, run.started_at ?? 0);
  try {
    const res = await invokeFunction<SubmitRunResponse>('submit-run', {
      clientRunId: localId,
      source: run.source,
      tzOffsetMin: -new Date().getTimezoneOffset(),
      points: points.map((p) => [
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
    store.markUploaded(localId, res.run.id);
    return res;
  } catch (e) {
    store.markUploadFailed(localId, (e as Error).message);
    throw e;
  }
}

/** Renvoie les courses en attente (hors ligne au moment de la fin de course). */
export async function flushUploads(): Promise<number> {
  let ok = 0;
  for (const run of store.pendingUploads()) {
    try {
      await uploadRun(run.id);
      ok++;
    } catch {
      /* on réessaiera plus tard */
    }
  }
  return ok;
}
