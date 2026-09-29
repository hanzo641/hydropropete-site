import { describe, expect, it } from 'vitest';
import { polylineLengthM } from '../src/geo/geodesy.ts';
import { computeDemClimb, GridDemProvider, type DemProvider } from '../src/gps/dem.ts';
import { filterTrack } from '../src/gps/filter.ts';
import { DistanceAccumulator } from '../src/gps/metrics.ts';
import { LiveTracker } from '../src/gps/tracker.ts';
import type { RawPoint } from '../src/gps/types.ts';
import { loadGrid, loadReference, mulberry32, PROFILES, simulateGps } from './helpers/simulate.ts';

const CASES = [
  { trace: 'ville-pau', profile: PROFILES.ville },
  { trace: 'foret-bastard', profile: PROFILES.foret },
  { trace: 'montagne-ayous', profile: PROFILES.montagne },
] as const;
const SEEDS = (process.env.GPS_SEEDS ?? '1,2,3,4,5').split(',').map(Number);

/**
 * MNT « serveur » : même terrain que la référence + un écart spatialement lisse d'environ
 * 1 m (deux MNT différents divergent de façon lisse, pas point par point).
 */
function noisyDem(name: string, seed: number): DemProvider {
  const grid = new GridDemProvider(loadGrid(name));
  const r = mulberry32(seed * 7919);
  const [p1, p2, l1, l2] = [r() * 6.28, r() * 6.28, 200 + r() * 200, 200 + r() * 200];
  return {
    name: 'grid+field',
    covers: (p) => grid.covers(p),
    elevations: async (pts) =>
      (await grid.elevations(pts)).map((e, i) => {
        if (e == null) return null;
        const x = (pts[i]!.lng * 111_320 * Math.cos((pts[i]!.lat * Math.PI) / 180)) / l1;
        const y = (pts[i]!.lat * 111_320) / l2;
        return e + Math.sin(2 * Math.PI * x + p1) * Math.cos(2 * Math.PI * y + p2);
      }),
  };
}

function naiveDistance(points: readonly RawPoint[]): number {
  return polylineLengthM(points);
}

function naiveDplus(points: readonly RawPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += Math.max(0, (points[i]!.alt ?? 0) - (points[i - 1]!.alt ?? 0));
  return d;
}

async function referenceDplus(name: string, truth: readonly RawPoint[]): Promise<number> {
  const res = await computeDemClimb(truth, new GridDemProvider(loadGrid(name)), {
    stepM: 10,
    medianWindow: 1,
    hysteresisM: 1,
  });
  return res.dplusM;
}

describe('précision GPS sur traces réelles bruitées', () => {
  for (const { trace, profile } of CASES) {
    describe(trace, () => {
      const truth = loadReference(trace);
      const refDist = polylineLengthM(truth);

      it('la trace de référence est exploitable', () => {
        expect(truth.length).toBeGreaterThan(1000);
        expect(refDist).toBeGreaterThan(3000);
      });

      for (const seed of SEEDS) {
        it(`graine ${seed} : distance serveur (Kalman + RTS) < 3 %, D+ MNT < 10 %`, async () => {
          const noisy = simulateGps(truth, profile, seed);
          const { points } = filterTrack(noisy);
          const acc = new DistanceAccumulator();
          for (const p of points) acc.add(p);
          const distErr = Math.abs(acc.totalM - refDist) / refDist;

          const refDplus = await referenceDplus(trace, truth);
          const dem = await computeDemClimb(points, noisyDem(trace, seed));
          const dplusErr = refDplus > 0 ? Math.abs(dem.dplusM - refDplus) / refDplus : 0;

          console.info(
            `${trace} s${seed}: ref ${(refDist / 1000).toFixed(3)} km → filtré ${(acc.totalM / 1000).toFixed(3)} km ` +
              `(${(distErr * 100).toFixed(2)} %), brut naïf ${(naiveDistance(noisy) / 1000).toFixed(3)} km | ` +
              `D+ ref ${refDplus.toFixed(0)} m → MNT ${dem.dplusM.toFixed(0)} m (${(dplusErr * 100).toFixed(1)} %), ` +
              `GPS brut naïf ${naiveDplus(noisy).toFixed(0)} m`,
          );
          expect(distErr).toBeLessThan(0.03);
          // Terrain plat : 10 % d'un D+ de 30 m (3 m) est plus fin que la précision d'un MNT ;
          // on tolère alors 8 m en absolu.
          if (refDplus >= 80) expect(dplusErr).toBeLessThan(0.1);
          else expect(Math.abs(dem.dplusM - refDplus)).toBeLessThan(8);
        });

        it(`graine ${seed} : distance live (filtre avant seul) < 3 %`, () => {
          const noisy = simulateGps(truth, profile, seed);
          const tracker = new LiveTracker();
          for (const p of noisy) tracker.push(p);
          const s = tracker.finish();
          const err = Math.abs(s.distanceM - refDist) / refDist;
          expect(err).toBeLessThan(0.03);
        });
      }

      it('D+ live (altitude GPS lissée + hystérésis) nettement meilleur que le D+ brut', async () => {
        const refDplus = await referenceDplus(trace, truth);
        for (const seed of SEEDS) {
          const noisy = simulateGps(truth, profile, seed);
          const tracker = new LiveTracker();
          for (const p of noisy) tracker.push(p);
          const live = tracker.finish().dplusM;
          const naive = naiveDplus(noisy);
          console.info(`${trace} s${seed}: D+ ref ${refDplus.toFixed(0)} live ${live.toFixed(0)} naïf ${naive.toFixed(0)}`);
          // au moins 10× plus proche que la somme brute des altitudes GPS
          expect(Math.abs(live - refDplus) * 10).toBeLessThan(Math.abs(naive - refDplus));
          // estimation live indicative (le chiffre officiel vient du MNT) : ±30 % ou ±75 m
          expect(Math.abs(live - refDplus)).toBeLessThan(Math.max(75, refDplus * 0.3));
        }
      });
    });
  }
});
