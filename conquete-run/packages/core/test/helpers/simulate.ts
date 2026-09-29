/**
 * Simulateur de bruit GPS réaliste pour les tests.
 *
 * L'erreur d'un GPS de téléphone n'est pas un bruit blanc : c'est surtout une dérive lente
 * (multi-trajets, géométrie des satellites) modélisée par un processus de Gauss-Markov du
 * premier ordre, plus un petit bruit blanc. On ajoute des sauts (multi-trajets en ville),
 * des trous (tunnel, poche), des rafales de mauvaise précision, et une altitude GPS
 * bruitée et biaisée.
 *
 * Calibrage : les puces GNSS des téléphones filtrent déjà leurs positions ; l'erreur
 * résiduelle à 1 Hz est dominée par une dérive de σ 4–6 m au temps de corrélation de
 * l'ordre de la minute (multi-trajets, changements de constellation), plus 1,5–2,5 m de
 * bruit blanc en conditions difficiles (canopée, rues étroites). Les profils ci-dessous
 * sont volontairement plus sévères que la moyenne observée.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGpx } from '../../src/gps/gpx.ts';
import type { RawPoint } from '../../src/gps/types.ts';
import type { DemGrid } from '../../src/gps/dem.ts';

export const TEST_DATA = fileURLToPath(new URL('../../../../test-data', import.meta.url));

export function loadReference(name: string): RawPoint[] {
  return parseGpx(readFileSync(join(TEST_DATA, 'gpx', `${name}.gpx`), 'utf8'));
}

export function loadGrid(name: string): DemGrid {
  return JSON.parse(readFileSync(join(TEST_DATA, 'dem', `${name}.json`), 'utf8')) as DemGrid;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): () => number {
  return () => {
    const u = Math.max(rand(), 1e-12);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

export interface NoiseProfile {
  /** écart-type stationnaire de la dérive corrélée, par axe (m) */
  sigmaM: number;
  /** temps de corrélation (s) */
  tauS: number;
  /** bruit blanc par axe (m) */
  whiteM: number;
  /** sauts multi-trajets par heure, amplitude (m), durée (points) */
  jumpsPerHour: number;
  jumpM: [number, number];
  /** trous de signal : nombre et durée (s) */
  gaps: number;
  gapS: [number, number];
  /** rafales de mauvaise précision : nombre, durée (s), erreur supplémentaire (m) */
  bursts: number;
  burstS: [number, number];
  burstExtraM: number;
  /** altitude GPS : dérive (m), temps de corrélation (s), biais (m), bruit blanc (m) */
  altSigmaM: number;
  altTauS: number;
  altBiasM: number;
  altWhiteM: number;
  /** probabilité de perdre un point isolé */
  dropProb: number;
}

export const PROFILES: Record<'ville' | 'foret' | 'montagne', NoiseProfile> = {
  ville: {
    sigmaM: 5, tauS: 60, whiteM: 1.5, jumpsPerHour: 8, jumpM: [25, 120],
    gaps: 2, gapS: [20, 45], bursts: 1, burstS: [40, 70], burstExtraM: 15,
    altSigmaM: 8, altTauS: 60, altBiasM: 12, altWhiteM: 3, dropProb: 0.02,
  },
  foret: {
    sigmaM: 6, tauS: 45, whiteM: 2.5, jumpsPerHour: 5, jumpM: [20, 80],
    gaps: 1, gapS: [20, 40], bursts: 2, burstS: [30, 60], burstExtraM: 12,
    altSigmaM: 10, altTauS: 60, altBiasM: -8, altWhiteM: 4, dropProb: 0.03,
  },
  montagne: {
    sigmaM: 4, tauS: 90, whiteM: 1.5, jumpsPerHour: 3, jumpM: [30, 150],
    gaps: 1, gapS: [40, 70], bursts: 1, burstS: [40, 60], burstExtraM: 10,
    altSigmaM: 10, altTauS: 90, altBiasM: 20, altWhiteM: 3, dropProb: 0.02,
  },
};

const M_PER_DEG_LAT = 111_320;

export function simulateGps(truth: readonly RawPoint[], profile: NoiseProfile, seed: number): RawPoint[] {
  const rand = mulberry32(seed);
  const gauss = gaussian(rand);
  const n = truth.length;
  const between = (r: [number, number]): number => r[0] + rand() * (r[1] - r[0]);

  // intervalles de trous / rafales, loin des extrémités
  const pickInterval = (durS: [number, number]): [number, number] => {
    const len = Math.round(between(durS));
    const start = Math.floor(n * 0.1 + rand() * (n * 0.8 - len));
    return [start, start + len];
  };
  const gaps = Array.from({ length: profile.gaps }, () => pickInterval(profile.gapS));
  const bursts = Array.from({ length: profile.bursts }, () => pickInterval(profile.burstS));
  const durationH = (truth[n - 1]!.t - truth[0]!.t) / 3_600_000;
  const jumpCount = Math.round(profile.jumpsPerHour * durationH);
  const jumps = new Map<number, { dx: number; dy: number; len: number; smallAcc: boolean }>();
  for (let j = 0; j < jumpCount; j++) {
    const at = Math.floor(n * 0.05 + rand() * n * 0.9);
    const size = between(profile.jumpM);
    const ang = rand() * 2 * Math.PI;
    jumps.set(at, { dx: Math.cos(ang) * size, dy: Math.sin(ang) * size, len: 1 + Math.floor(rand() * 3), smallAcc: rand() < 0.5 });
  }

  let ex = gauss() * profile.sigmaM;
  let ey = gauss() * profile.sigmaM;
  let ez = gauss() * profile.altSigmaM;
  let jumpLeft = 0;
  let jump: { dx: number; dy: number; smallAcc: boolean } | null = null;
  const out: RawPoint[] = [];
  for (let i = 0; i < n; i++) {
    const p = truth[i]!;
    const dt = i === 0 ? 1 : (p.t - truth[i - 1]!.t) / 1000;
    const phi = Math.exp(-dt / profile.tauS);
    const k = Math.sqrt(1 - phi * phi);
    ex = ex * phi + k * profile.sigmaM * gauss();
    ey = ey * phi + k * profile.sigmaM * gauss();
    const phiZ = Math.exp(-dt / profile.altTauS);
    ez = ez * phiZ + Math.sqrt(1 - phiZ * phiZ) * profile.altSigmaM * gauss();

    const newJump = jumps.get(i);
    if (newJump) {
      jump = newJump;
      jumpLeft = newJump.len;
    }
    if (gaps.some(([a, b]) => i >= a && i < b)) continue;
    if (rand() < profile.dropProb) continue;

    const inBurst = bursts.some(([a, b]) => i >= a && i < b);
    let dx = ex + gauss() * profile.whiteM;
    let dy = ey + gauss() * profile.whiteM;
    const baseSigma = Math.hypot(profile.sigmaM, profile.whiteM) / Math.SQRT2;
    let acc = 1.5 * baseSigma * Math.exp(gauss() * 0.2);
    if (inBurst) {
      dx += gauss() * profile.burstExtraM;
      dy += gauss() * profile.burstExtraM;
      acc = 1.5 * (baseSigma + profile.burstExtraM) * Math.exp(gauss() * 0.15);
    }
    if (jump && jumpLeft > 0) {
      dx += jump.dx;
      dy += jump.dy;
      if (!jump.smallAcc) acc = Math.max(acc, 0.5 * Math.hypot(jump.dx, jump.dy));
      jumpLeft--;
    }
    const cosLat = Math.cos((p.lat * Math.PI) / 180);
    out.push({
      t: p.t,
      lat: p.lat + dy / M_PER_DEG_LAT,
      lng: p.lng + dx / (M_PER_DEG_LAT * cosLat),
      acc: Math.round(acc * 10) / 10,
      alt: p.alt != null ? p.alt + profile.altBiasM + ez + gauss() * profile.altWhiteM : null,
      altAcc: Math.round(1.5 * profile.altSigmaM * 10) / 10,
      speed: null,
      mocked: false,
    });
  }
  return out;
}
