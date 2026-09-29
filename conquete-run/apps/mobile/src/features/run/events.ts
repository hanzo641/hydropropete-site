import type { RawPoint } from '@conquete/core';

/** Diffusion des nouveaux points aux écrans ouverts (même processus JS). */
type Listener = (pts: readonly RawPoint[]) => void;
const listeners = new Set<Listener>();

export function onPoints(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitPoints(pts: readonly RawPoint[]): void {
  for (const fn of listeners) fn(pts);
}
