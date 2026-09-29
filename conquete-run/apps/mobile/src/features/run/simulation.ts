import type { RawPoint } from '@conquete/core';
import { ingest } from './locationTask';

/** Trace compacte embarquée : [dt (s), lat, lng, acc, alt] */
export type CompactTrace = [number, number, number, number | null, number | null][];

export const BUILTIN_TRACES = {
  'ville-pau': () => require('./sim-traces/ville-pau.json') as CompactTrace,
  'foret-bastard': () => require('./sim-traces/foret-bastard.json') as CompactTrace,
  'montagne-ayous': () => require('./sim-traces/montagne-ayous.json') as CompactTrace,
} as const;
export type BuiltinTrace = keyof typeof BUILTIN_TRACES;

export function fromRawPoints(pts: readonly RawPoint[]): CompactTrace {
  const t0 = pts[0]?.t ?? 0;
  return pts.map((p) => [Math.round((p.t - t0) / 1000), p.lat, p.lng, p.acc, p.alt]);
}

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Rejoue une trace à la place du vrai GPS, via LA MÊME fonction d'ingestion que la tâche
 * système. Les horodatages sont décalés dans le passé pour que la course se termine « maintenant »
 * (jamais dans le futur, sinon le serveur la refuserait).
 */
export function startReplay(trace: CompactTrace, speed: number, onDone: () => void): void {
  stopReplay();
  if (trace.length === 0) return;
  const durationMs = trace[trace.length - 1]![0] * 1000;
  const wallStart = Date.now();
  const t0 = wallStart - durationMs + durationMs / speed;
  let i = 0;
  timer = setInterval(() => {
    const simElapsedMs = (Date.now() - wallStart) * speed;
    const batch: RawPoint[] = [];
    while (i < trace.length && trace[i]![0] * 1000 <= simElapsedMs) {
      const [dt, lat, lng, acc, alt] = trace[i]!;
      batch.push({ t: t0 + dt * 1000, lat, lng, acc, alt, altAcc: null, speed: null, mocked: false });
      i++;
    }
    if (batch.length) ingest(batch);
    if (i >= trace.length) {
      stopReplay();
      onDone();
    }
  }, 250);
}

export function stopReplay(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
