import type { SubmitRunResponse } from '@conquete/core';
import { backend } from '@/backend';
import * as store from './storage';

export type { SubmitRunResponse };

/**
 * Envoie la trace BRUTE au backend (serveur, ou moteur local) qui recalcule tout.
 * Idempotent grâce à clientRunId.
 */
export async function uploadRun(localId: string): Promise<SubmitRunResponse> {
  const run = store.getRun(localId);
  if (!run) throw new Error('run_not_found');
  const points = store.readPoints(localId, run.started_at ?? 0);
  try {
    const res = await backend().submitRun({
      clientRunId: localId,
      source: run.source,
      tzOffsetMin: -new Date().getTimezoneOffset(),
      points,
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
