import { type LatLng, resamplePolyline } from '../geo/geodesy.ts';
import { HysteresisClimb } from './metrics.ts';

/**
 * Fournisseur d'altitude à partir d'un modèle numérique de terrain (MNT).
 * Le D+ officiel d'une course est calculé avec un MNT, jamais avec l'altitude GPS brute
 * (qui surestime le D+ d'un facteur 2 à 3).
 */
export interface DemProvider {
  readonly name: string;
  covers(p: LatLng): boolean;
  /** altitudes (m) dans l'ordre des points ; null si inconnue */
  elevations(points: readonly LatLng[]): Promise<(number | null)[]>;
}

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Emprises (approx.) couvertes par le RGE ALTI de l'IGN : métropole, Corse, DROM. */
const IGN_BBOXES: [number, number, number, number][] = [
  // [minLat, minLng, maxLat, maxLng]
  [41.3, -5.2, 51.15, 9.6], // métropole + Corse
  [15.8, -61.85, 16.55, -61.0], // Guadeloupe
  [14.35, -61.25, 14.9, -60.8], // Martinique
  [2.1, -54.6, 5.8, -51.6], // Guyane
  [-21.4, 55.2, -20.85, 55.85], // La Réunion
  [-13.05, 44.95, -12.6, 45.3], // Mayotte
];

/**
 * API d'altimétrie de la Géoplateforme IGN (gratuite, sans clé), ressource
 * « ign_rge_alti_wld » : RGE ALTI 1 à 5 m en France, mondial basse résolution ailleurs.
 */
export class IgnAltiProvider implements DemProvider {
  readonly name = 'ign';
  constructor(
    private readonly fetchFn: FetchLike,
    private readonly opts: { batch?: number; baseUrl?: string } = {},
  ) {}

  covers(p: LatLng): boolean {
    return IGN_BBOXES.some(([a, b, c, d]) => p.lat >= a && p.lat <= c && p.lng >= b && p.lng <= d);
  }

  async elevations(points: readonly LatLng[]): Promise<(number | null)[]> {
    const batch = this.opts.batch ?? 150;
    const base = this.opts.baseUrl ?? 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
    const out: (number | null)[] = [];
    for (let i = 0; i < points.length; i += batch) {
      const chunk = points.slice(i, i + batch);
      const lon = chunk.map((p) => p.lng.toFixed(6)).join('|');
      const lat = chunk.map((p) => p.lat.toFixed(6)).join('|');
      const url = `${base}?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld&delimiter=|&indent=false&measures=false&zonly=true`;
      const res = await this.fetchFn(url);
      if (!res.ok) throw new Error(`IGN alti HTTP ${res.status}`);
      const body = (await res.json()) as { elevations?: unknown };
      if (!Array.isArray(body.elevations) || body.elevations.length !== chunk.length) {
        throw new Error('IGN alti : réponse inattendue');
      }
      for (const e of body.elevations) out.push(typeof e === 'number' && e > -1000 ? e : null);
    }
    return out;
  }
}

/**
 * Open Topo Data (opentopodata.org ou instance auto-hébergée). Plusieurs jeux de données
 * séparés par des virgules = repli automatique (ex. « eudem25m,srtm30m »).
 * L'API publique est limitée à 1 requête/s et 100 points/requête.
 */
export class OpenTopoDataProvider implements DemProvider {
  readonly name = 'opentopodata';
  constructor(
    private readonly fetchFn: FetchLike,
    private readonly opts: { baseUrl?: string; datasets?: string; minIntervalMs?: number } = {},
  ) {}

  covers(p: LatLng): boolean {
    return p.lat >= -60 && p.lat <= 60; // SRTM ; EU-DEM couvre l'Europe au-delà
  }

  async elevations(points: readonly LatLng[]): Promise<(number | null)[]> {
    const base = (this.opts.baseUrl ?? 'https://api.opentopodata.org').replace(/\/$/, '');
    const datasets = this.opts.datasets ?? 'eudem25m,srtm30m';
    const interval = this.opts.minIntervalMs ?? 1100;
    const out: (number | null)[] = [];
    for (let i = 0; i < points.length; i += 100) {
      if (i > 0 && interval > 0) await sleep(interval);
      const chunk = points.slice(i, i + 100);
      const locations = chunk.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('|');
      const res = await this.fetchFn(`${base}/v1/${datasets}?locations=${locations}`);
      if (!res.ok) throw new Error(`Open Topo Data HTTP ${res.status}`);
      const body = (await res.json()) as { results?: { elevation: number | null }[] };
      if (!Array.isArray(body.results) || body.results.length !== chunk.length) {
        throw new Error('Open Topo Data : réponse inattendue');
      }
      for (const r of body.results) out.push(typeof r.elevation === 'number' ? r.elevation : null);
    }
    return out;
  }
}

/** Grille régulière d'altitudes (tests, cache local). */
export interface DemGrid {
  originLat: number;
  originLng: number;
  dLat: number;
  dLng: number;
  rows: number;
  cols: number;
  /** altitudes en décimètres, ligne par ligne (sud → nord), colonne ouest → est */
  data: number[];
}

export function gridElevation(g: DemGrid, p: LatLng): number | null {
  const fr = (p.lat - g.originLat) / g.dLat;
  const fc = (p.lng - g.originLng) / g.dLng;
  if (fr < 0 || fc < 0 || fr > g.rows - 1 || fc > g.cols - 1) return null;
  const r0 = Math.min(g.rows - 2, Math.floor(fr));
  const c0 = Math.min(g.cols - 2, Math.floor(fc));
  const tr = fr - r0;
  const tc = fc - c0;
  const v = (r: number, c: number): number => g.data[r * g.cols + c]! / 10;
  const a = v(r0, c0) * (1 - tc) + v(r0, c0 + 1) * tc;
  const b = v(r0 + 1, c0) * (1 - tc) + v(r0 + 1, c0 + 1) * tc;
  return a * (1 - tr) + b * tr;
}

export class GridDemProvider implements DemProvider {
  readonly name = 'grid';
  constructor(private readonly grid: DemGrid) {}
  covers(p: LatLng): boolean {
    return gridElevation(this.grid, p) != null;
  }
  elevations(points: readonly LatLng[]): Promise<(number | null)[]> {
    return Promise.resolve(points.map((p) => gridElevation(this.grid, p)));
  }
}

/** Essaie les fournisseurs dans l'ordre ; le premier qui couvre la trace et répond gagne. */
export class ChainDemProvider implements DemProvider {
  readonly name = 'chain';
  lastUsed: string | null = null;
  readonly errors: string[] = [];
  constructor(private readonly providers: readonly DemProvider[]) {}

  covers(p: LatLng): boolean {
    return this.providers.some((d) => d.covers(p));
  }

  async elevations(points: readonly LatLng[]): Promise<(number | null)[]> {
    for (const provider of this.providers) {
      if (!points.every((p) => provider.covers(p))) continue;
      try {
        const res = await provider.elevations(points);
        const known = res.filter((e) => e != null).length;
        if (known >= points.length * 0.9) {
          this.lastUsed = provider.name;
          return res;
        }
        this.errors.push(`${provider.name}: couverture ${known}/${points.length}`);
      } catch (e) {
        this.errors.push(`${provider.name}: ${(e as Error).message}`);
      }
    }
    throw new Error(`aucun MNT disponible (${this.errors.join(' ; ')})`);
  }
}

export interface DemClimbOptions {
  /** pas de rééchantillonnage (m) */
  stepM: number;
  /** fenêtre du filtre médian (impair) */
  medianWindow: number;
  /** hystérésis (m) */
  hysteresisM: number;
}

/** MNT fin et « sol nu » (IGN RGE ALTI 1–5 m) : peu de bruit, on garde le détail. */
export const DEFAULT_DEM_CLIMB: DemClimbOptions = { stepM: 20, medianWindow: 1, hysteresisM: 1.5 };
/** MNT grossier (SRTM 30 m, EU-DEM 25 m) : bruit et canopée, on lisse davantage. */
export const COARSE_DEM_CLIMB: DemClimbOptions = { stepM: 30, medianWindow: 3, hysteresisM: 3 };

export interface DemClimbResult {
  dplusM: number;
  dminusM: number;
  minAltM: number | null;
  maxAltM: number | null;
  samples: number;
  /** profil (distance m, altitude m) pour affichage */
  profile: { d: number; alt: number }[];
}

function medianFilter(values: number[], window: number): number[] {
  if (window <= 1) return values;
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1)).sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)]!;
  });
}

/** Calcule le D+ d'une trace (déjà filtrée) à partir d'un MNT. */
export async function computeDemClimb(
  track: readonly LatLng[],
  dem: DemProvider,
  opts: DemClimbOptions = DEFAULT_DEM_CLIMB,
): Promise<DemClimbResult> {
  const samples = resamplePolyline(track, opts.stepM);
  if (samples.length < 2) return { dplusM: 0, dminusM: 0, minAltM: null, maxAltM: null, samples: 0, profile: [] };
  const raw = await dem.elevations(samples.map((s) => s.point));
  // interpolation des trous éventuels
  const filled: number[] = [];
  let lastKnown: number | null = null;
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v != null) {
      lastKnown = v;
      filled.push(v);
    } else {
      const next = raw.slice(i + 1).find((x) => x != null) ?? null;
      filled.push(lastKnown ?? next ?? 0);
    }
  }
  const smooth = medianFilter(filled, opts.medianWindow);
  const climb = new HysteresisClimb(opts.hysteresisM);
  for (const a of smooth) climb.add(a);
  return {
    dplusM: climb.gainM,
    dminusM: climb.lossM,
    minAltM: Math.min(...smooth),
    maxAltM: Math.max(...smooth),
    samples: samples.length,
    profile: smooth.map((alt, i) => ({ d: samples[i]!.distM, alt })),
  };
}

/**
 * Repli quand aucun MNT ne répond : D+ à partir de l'altitude GPS lissée, avec une
 * hystérésis large et un plafond de pente moyenne (30 %) pour limiter la surestimation.
 */
export function gpsFallbackClimb(
  points: readonly { alt: number | null }[],
  distanceM: number,
  hysteresisM = 8,
): number {
  const c = new HysteresisClimb(hysteresisM);
  for (const p of points) c.add(p.alt);
  return Math.min(c.gainM, distanceM * 0.3);
}
