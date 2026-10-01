import { useEffect, useState } from 'react';
import { BOB_MS } from './layers';

/** Phase du petit mouvement des soldats (0 / 1), alternée tant que la carte est affichée. */
export function useSquadBob(enabled: boolean): number {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setPhase((p) => 1 - p), BOB_MS);
    return () => clearInterval(id);
  }, [enabled]);
  return phase;
}
