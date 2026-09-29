import { describe, expect, it } from 'vitest';
import { haversineM, resamplePolyline } from '../src/geo/geodesy.ts';
import {
  ChainDemProvider,
  computeDemClimb,
  type DemProvider,
  IgnAltiProvider,
  OpenTopoDataProvider,
  type FetchLike,
} from '../src/gps/dem.ts';
import { filterTrack, GpsFilterEngine } from '../src/gps/filter.ts';
import { parseGpx, toGpx } from '../src/gps/gpx.ts';
import { DistanceAccumulator, formatDuration, formatPace, HysteresisClimb, PaceWindow } from '../src/gps/metrics.ts';
import { evaluateReadiness, LiveTracker } from '../src/gps/tracker.ts';
import type { RawPoint } from '../src/gps/types.ts';
import {
  countImpossibleAccelerations,
  detectTeleport,
  detectVehicle,
  looksSynthetic,
  traceFingerprint,
  validateRawTrace,
} from '../src/gps/validation.ts';
import { gaussian, loadReference, mulberry32, PROFILES, simulateGps } from './helpers/simulate.ts';

const T0 = Date.UTC(2026, 5, 1, 8, 0, 0);
const M = 1 / 111_320;

function straightLine(n: number, speed: number, opts: Partial<RawPoint> = {}): RawPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    t: T0 + i * 1000,
    lat: 43.3 + i * speed * M,
    lng: -0.37,
    acc: 5,
    alt: 200,
    altAcc: 8,
    speed: null,
    ...opts,
  }));
}

describe('géodésie', () => {
  it('haversine ≈ 111,32 km par degré de latitude', () => {
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
  it('rééchantillonnage à pas constant', () => {
    const r = resamplePolyline([{ lat: 43, lng: 0 }, { lat: 43 + 100 * M, lng: 0 }], 25);
    expect(r.map((s) => Math.round(s.distM))).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('filtre GPS', () => {
  it('à l’arrêt, le tremblement ne crée pas de distance (10 min immobile)', () => {
    const g = gaussian(mulberry32(42));
    let ex = 0;
    let ey = 0;
    const pts: RawPoint[] = Array.from({ length: 600 }, (_, i) => {
      ex = ex * 0.99 + g() * 0.3;
      ey = ey * 0.99 + g() * 0.3;
      return { t: T0 + i * 1000, lat: 43.3 + (ey + g() * 2) * M, lng: -0.37 + (ex + g() * 2) * M * 1.37, acc: 8, alt: 200, altAcc: 10, speed: 0 };
    });
    const naive = pts.slice(1).reduce((d, p, i) => d + haversineM(pts[i]!, p), 0);
    const tracker = new LiveTracker();
    for (const p of pts) tracker.push(p);
    const s = tracker.finish();
    expect(naive).toBeGreaterThan(1000);
    // < 0,1 m/s de dérive résiduelle (contre ~2 m/s en somme brute)
    expect(s.distanceM).toBeLessThan(60);
    expect(s.paceSecPerKm).toBeNull();
  });

  it('rejette un saut aberrant isolé et le point simulé', () => {
    const pts = straightLine(60, 3);
    pts[30] = { ...pts[30]!, lat: pts[30]!.lat + 400 * M };
    pts[40] = { ...pts[40]!, mocked: true };
    const engine = new GpsFilterEngine();
    for (const p of pts) engine.push(p);
    expect(engine.stats.jump).toBe(1);
    expect(engine.stats.mocked).toBe(1);
  });

  it('rejette les points trop imprécis (> 20 m) sans signal durablement dégradé', () => {
    const pts = straightLine(60, 3);
    pts[20] = { ...pts[20]!, acc: 45 };
    pts[21] = { ...pts[21]!, acc: 60 };
    const engine = new GpsFilterEngine();
    for (const p of pts) engine.push(p);
    expect(engine.stats.accuracy).toBe(2);
  });

  it('seuil adaptatif : sous canopée (précision 28 m durable) on garde les points', () => {
    const pts = straightLine(80, 3, { acc: 28 });
    const engine = new GpsFilterEngine();
    for (const p of pts) engine.push(p);
    expect(engine.accuracyThreshold()).toBeGreaterThanOrEqual(28);
    expect(engine.stats.accepted).toBeGreaterThan(70);
  });

  it('réancre si le premier point était faux', () => {
    const pts = straightLine(40, 3);
    pts[0] = { ...pts[0]!, lat: pts[0]!.lat + 800 * M };
    const { points, engine } = filterTrack(pts);
    expect(engine.stats.jump).toBeGreaterThan(0);
    const last = points[points.length - 1]!;
    expect(haversineM(last, pts[pts.length - 1]!)).toBeLessThan(10);
  });

  it('ne compte pas une téléportation à travers une coupure', () => {
    const a = straightLine(40, 3);
    const b = straightLine(40, 3).map((p) => ({ ...p, t: p.t + 100_000, lat: p.lat + 0.05 }));
    const { points } = filterTrack([...a, ...b]);
    const acc = new DistanceAccumulator();
    for (const p of points) acc.add(p);
    expect(acc.totalM).toBeLessThan(300);
    expect(detectTeleport(points).detected).toBe(true);
  });

  it('rejouer les mêmes points redonne le même état (reprise après arrêt de l’app)', () => {
    const noisy = simulateGps(loadReference('ville-pau'), PROFILES.ville, 9).slice(0, 900);
    const a = new LiveTracker();
    for (const p of noisy) a.push(p);
    const b = new LiveTracker();
    for (const p of noisy.slice(0, 400)) b.push(p);
    const mid = b.snapshot();
    const c = new LiveTracker(); // app tuée puis relancée : rejeu depuis SQLite
    for (const p of noisy.slice(0, 400)) c.push(p);
    expect(c.snapshot()).toEqual(mid);
    for (const p of noisy.slice(400)) c.push(p);
    expect(c.snapshot()).toEqual(a.snapshot());
  });
});

describe('allure et dénivelé', () => {
  it('allure sur fenêtre glissante de 30 s', () => {
    const w = new PaceWindow(30);
    for (let i = 0; i <= 60; i++) w.add(T0 + i * 1000, i * 3.333);
    expect(w.paceSecPerKm()!).toBeCloseTo(300, 0);
    expect(formatPace(w.paceSecPerKm())).toBe('5:00');
  });
  it('hystérésis', () => {
    const c = new HysteresisClimb(5);
    for (const a of [100, 103, 101, 104, 110, 108, 120, 90]) c.add(a);
    expect(c.gainM).toBe(20);
    expect(c.lossM).toBe(30);
  });
  it('formatDuration', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(65_000)).toBe('01:05');
  });
});

describe('GPS prêt', () => {
  const pt = (s: number, acc: number): RawPoint => ({ t: T0 + s * 1000, lat: 43, lng: 0, acc, alt: null, altAcc: null, speed: null });
  it('prêt après 3 points ≤ 15 m', () => {
    expect(evaluateReadiness([pt(1, 12), pt(2, 10), pt(3, 9)], T0, T0 + 3000).state).toBe('ready');
  });
  it('faible puis autorisé après 45 s', () => {
    const r = [pt(50, 22), pt(51, 20), pt(52, 21)];
    expect(evaluateReadiness(r, T0 + 30_000, T0 + 52_000).canStart).toBe(false);
    expect(evaluateReadiness(r, T0, T0 + 52_000)).toMatchObject({ state: 'weak', canStart: true });
  });
  it('recherche sans point récent', () => {
    expect(evaluateReadiness([pt(1, 5)], T0, T0 + 60_000).state).toBe('searching');
  });
});

describe('GPX', () => {
  it('lecture / écriture aller-retour', () => {
    const pts = straightLine(5, 3);
    const back = parseGpx(toGpx('test <&>', pts));
    expect(back).toHaveLength(5);
    expect(back[2]!.lat).toBeCloseTo(pts[2]!.lat, 6);
    expect(back[2]!.t).toBe(pts[2]!.t);
    expect(back[2]!.alt).toBe(200);
  });
  it('les traces de référence se lisent', () => {
    expect(loadReference('montagne-ayous').length).toBeGreaterThan(3000);
  });
});

describe('anti-triche', () => {
  const now = T0 + 3_600_000;
  it('refuse les positions simulées, les courses simulées, trop anciennes ou futures', () => {
    expect(validateRawTrace(straightLine(60, 3, { mocked: true }), { now, source: 'gps' })?.code).toBe('mocked');
    expect(validateRawTrace(straightLine(60, 3), { now, source: 'simulation' })?.code).toBe('simulated');
    expect(validateRawTrace(straightLine(60, 3), { now: now + 8 * 86_400_000, source: 'gps' })?.code).toBe('too_old');
    expect(validateRawTrace(straightLine(60, 3), { now: T0 - 3_600_000, source: 'gps' })?.code).toBe('future');
    expect(validateRawTrace(straightLine(10, 3), { now, source: 'gps' })?.code).toBe('too_few_points');
    expect(validateRawTrace(straightLine(60, 3), { now, source: 'gps' })).toBeNull();
  });
  it('détecte un véhicule (25 km/h pendant 4 min) mais pas un coureur rapide (17 km/h)', () => {
    const car = filterTrack(straightLine(300, 25 / 3.6)).points;
    const v = detectVehicle(car);
    expect(v.detected).toBe(true);
    expect(v.maxWindowSpeedKmh).toBeGreaterThan(22);
    const fast = filterTrack(straightLine(600, 17 / 3.6)).points;
    expect(detectVehicle(fast).detected).toBe(false);
  });
  it('une vraie course ne déclenche ni véhicule ni accélérations', () => {
    const { points } = filterTrack(simulateGps(loadReference('foret-bastard'), PROFILES.foret, 3));
    expect(detectVehicle(points).detected).toBe(false);
    expect(countImpossibleAccelerations(points)).toBeLessThan(20);
    expect(detectTeleport(points).detected).toBe(false);
  });
  it('signale une trace trop parfaite, pas une trace réelle bruitée', () => {
    expect(looksSynthetic(straightLine(300, 3))).toBe(true);
    expect(looksSynthetic(simulateGps(loadReference('ville-pau'), PROFILES.ville, 1))).toBe(false);
  });
  it('empreinte stable', () => {
    const a = straightLine(100, 3);
    expect(traceFingerprint(a)).toBe(traceFingerprint([...a]));
    expect(traceFingerprint(a)).not.toBe(traceFingerprint(straightLine(100, 3.1)));
  });
});

describe('fournisseurs de MNT', () => {
  const pts = [{ lat: 43.3, lng: -0.37 }, { lat: 43.31, lng: -0.37 }];
  it('IGN : format de requête et de réponse', async () => {
    const urls: string[] = [];
    const fetchFn: FetchLike = async (url) => {
      urls.push(url);
      return { ok: true, status: 200, json: async () => ({ elevations: [200.5, -99999] }) };
    };
    const ign = new IgnAltiProvider(fetchFn);
    expect(ign.covers(pts[0]!)).toBe(true);
    expect(ign.covers({ lat: 40.7, lng: -74 })).toBe(false);
    expect(await ign.elevations(pts)).toEqual([200.5, null]);
    expect(urls[0]).toContain('resource=ign_rge_alti_wld');
  });
  it('Open Topo Data : lots de 100 points', async () => {
    let calls = 0;
    const fetchFn: FetchLike = async (url) => {
      calls++;
      const n = url.split('locations=')[1]!.split('|').length;
      return { ok: true, status: 200, json: async () => ({ results: Array.from({ length: n }, () => ({ elevation: 12 })) }) };
    };
    const otd = new OpenTopoDataProvider(fetchFn, { minIntervalMs: 0 });
    const many = Array.from({ length: 250 }, (_, i) => ({ lat: 45 + i * 1e-4, lng: 6 }));
    expect((await otd.elevations(many)).length).toBe(250);
    expect(calls).toBe(3);
  });
  it('chaîne : repli sur le fournisseur suivant en cas de panne', async () => {
    const broken: DemProvider = { name: 'a', resolution: 'fine', covers: () => true, elevations: async () => { throw new Error('down'); } };
    const ok: DemProvider = { name: 'b', resolution: 'coarse', covers: () => true, elevations: async (p) => p.map((_, i) => 100 + i * 10) };
    const chain = new ChainDemProvider([broken, ok]);
    const track = Array.from({ length: 20 }, (_, i) => ({ lat: 43 + i * 20 * M, lng: 0 }));
    const r = await computeDemClimb(track, chain);
    expect(chain.lastUsed).toBe('b');
    expect(r.dplusM).toBeGreaterThan(100);
    expect(chain.errors[0]).toContain('down');
  });
});
