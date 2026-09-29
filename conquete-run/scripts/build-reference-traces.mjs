#!/usr/bin/env node
/**
 * Construit les traces GPX de référence utilisées par les tests GPS.
 *
 * - Géométrie : itinéraires piétons réels (OpenStreetMap) calculés par le serveur OSRM
 *   public de FOSSGIS (routing.openstreetmap.de, profil « foot »).
 * - Altitude : IGN RGE ALTI via l'API d'altimétrie de la Géoplateforme (data.geopf.fr),
 *   échantillonnée sur une grille régulière (≈ 30 m) couvrant la trace, enregistrée dans
 *   test-data/dem/<nom>.json (sert aussi de « modèle de terrain » simulé dans les tests).
 * - Temps : un coureur virtuel suit l'itinéraire à 1 Hz, vitesse modulée par la pente
 *   (loi de type Tobler) et avec des arrêts (feux rouges, photo au sommet).
 *
 * Usage : node scripts/build-reference-traces.mjs   (réseau requis, ~2 minutes)
 * Les fichiers générés sont versionnés : les tests n'ont PAS besoin du réseau.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GRID_STEP_M = 30;

const TRACES = [
  {
    name: 'ville-pau',
    label: 'Ville — Pau centre (boulevard des Pyrénées, parc Beaumont, château)',
    waypoints: [
      [-0.37, 43.2946], [-0.359, 43.2968], [-0.3625, 43.301], [-0.3675, 43.3045],
      [-0.3755, 43.3005], [-0.3753, 43.2951], [-0.37, 43.2946],
    ],
    start: '2026-06-02T06:30:00Z',
    baseSpeed: 3.0,
    stops: [ { at: 0.22, s: 35 }, { at: 0.51, s: 25 }, { at: 0.8, s: 40 } ],
  },
  {
    name: 'foret-bastard',
    label: 'Forêt — forêt de Bastard (Pau nord)',
    waypoints: [
      [-0.3623, 43.3375], [-0.37, 43.342], [-0.356, 43.346], [-0.352, 43.338],
      [-0.3623, 43.3375],
    ],
    start: '2026-06-04T17:45:00Z',
    baseSpeed: 2.8,
    stops: [ { at: 0.6, s: 20 } ],
  },
  {
    name: 'montagne-ayous',
    label: 'Montagne — Bious-Artigues → refuge d’Ayous (aller-retour)',
    waypoints: [ [-0.452, 42.87], [-0.4912, 42.8484], [-0.452, 42.87] ],
    start: '2026-07-11T07:10:00Z',
    baseSpeed: 2.7,
    stops: [ { at: 0.5, s: 120 } ],
  },
];

const R = 6371008.8;
const rad = (d) => (d * Math.PI) / 180;
function haversine(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchJson(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'conquete-run-test-data/1.0' } });
      if (res.ok) return await res.json();
      console.warn(`HTTP ${res.status} ${url.slice(0, 100)}`);
    } catch (e) {
      console.warn(`fetch error ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(`échec ${url.slice(0, 120)}`);
}

async function route(waypoints) {
  const coords = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson`;
  const data = await fetchJson(url);
  return data.routes[0].geometry.coordinates; // [lng, lat][]
}

async function ignElevations(points) {
  const out = [];
  const BATCH = 180;
  for (let i = 0; i < points.length; i += BATCH) {
    const chunk = points.slice(i, i + BATCH);
    const lon = chunk.map((p) => p[0].toFixed(6)).join('|');
    const lat = chunk.map((p) => p[1].toFixed(6)).join('|');
    const url = `https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=${lon}&lat=${lat}&resource=ign_rge_alti_wld&delimiter=|&indent=false&measures=false&zonly=true`;
    const data = await fetchJson(url);
    out.push(...data.elevations.map((e) => (e < -1000 ? null : e)));
    if ((i / BATCH) % 10 === 0) process.stdout.write(`  alti ${i}/${points.length}\r`);
  }
  return out;
}

async function buildGrid(line) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of line) {
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
  }
  const marginDeg = 250 / 111_320;
  minLat -= marginDeg; maxLat += marginDeg;
  const lngMargin = marginDeg / Math.cos(rad((minLat + maxLat) / 2));
  minLng -= lngMargin; maxLng += lngMargin;
  const dLat = GRID_STEP_M / 111_320;
  const dLng = dLat / Math.cos(rad((minLat + maxLat) / 2));
  const rows = Math.ceil((maxLat - minLat) / dLat) + 1;
  const cols = Math.ceil((maxLng - minLng) / dLng) + 1;
  const pts = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push([minLng + c * dLng, minLat + r * dLat]);
  console.log(`  grille ${rows}×${cols} = ${pts.length} points`);
  const elev = await ignElevations(pts);
  // bouche les éventuels trous (hors couverture) par la moyenne des voisins valides
  for (let i = 0; i < elev.length; i++) if (elev[i] == null) elev[i] = elev[i - 1] ?? elev[i + 1] ?? 0;
  return {
    source: 'IGN RGE ALTI (Géoplateforme, ign_rge_alti_wld)',
    originLat: minLat, originLng: minLng, dLat, dLng, rows, cols,
    // décimètres entiers pour compacité
    data: elev.map((e) => Math.round(e * 10)),
  };
}

function gridElevation(grid, lng, lat) {
  const fr = (lat - grid.originLat) / grid.dLat;
  const fc = (lng - grid.originLng) / grid.dLng;
  const r0 = Math.max(0, Math.min(grid.rows - 2, Math.floor(fr)));
  const c0 = Math.max(0, Math.min(grid.cols - 2, Math.floor(fc)));
  const tr = Math.min(1, Math.max(0, fr - r0));
  const tc = Math.min(1, Math.max(0, fc - c0));
  const v = (r, c) => grid.data[r * grid.cols + c] / 10;
  const a = v(r0, c0) * (1 - tc) + v(r0, c0 + 1) * tc;
  const b = v(r0 + 1, c0) * (1 - tc) + v(r0 + 1, c0 + 1) * tc;
  return a * (1 - tr) + b * tr;
}

/** Coureur virtuel à 1 Hz le long de la ligne. */
function simulateRunner(line, grid, cfg) {
  // longueur cumulée
  const cum = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
  const total = cum[cum.length - 1];
  const at = (d) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - cum[i - 1]) / seg));
    return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t];
  };
  const pts = [];
  let d = 0;
  let t = Date.parse(cfg.start);
  const stops = cfg.stops.map((s) => ({ d: s.at * total, s: s.s, done: false }));
  let wobble = 0;
  let k = 0;
  while (d < total) {
    const p = at(d);
    pts.push({ lng: p[0], lat: p[1], ele: gridElevation(grid, p[0], p[1]), t });
    const stop = stops.find((s) => !s.done && d >= s.d);
    if (stop) {
      stop.done = true;
      for (let i = 0; i < stop.s; i++) {
        t += 1000;
        pts.push({ lng: p[0], lat: p[1], ele: gridElevation(grid, p[0], p[1]), t });
      }
    }
    // pente sur 20 m devant
    const ahead = at(Math.min(total, d + 20));
    const slope = (gridElevation(grid, ahead[0], ahead[1]) - gridElevation(grid, p[0], p[1])) / 20;
    const tobler = Math.exp(-3.5 * Math.abs(slope + 0.05)) / Math.exp(-3.5 * 0.05);
    wobble = 0.9 * wobble + 0.1 * Math.sin(k++ / 37) * 0.25; // variations d'allure lentes
    const v = Math.max(0.9, cfg.baseSpeed * tobler + wobble);
    d += v;
    t += 1000;
  }
  const last = line[line.length - 1];
  pts.push({ lng: last[0], lat: last[1], ele: gridElevation(grid, last[0], last[1]), t });
  return pts;
}

function toGpx(name, label, pts) {
  const body = pts
    .map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}"><ele>${p.ele.toFixed(2)}</ele><time>${new Date(p.t).toISOString()}</time></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="conquete-run build-reference-traces" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>${label}. Géométrie © contributeurs OpenStreetMap (ODbL) via OSRM FOSSGIS ; altitude IGN RGE ALTI. Trace de RÉFÉRENCE (sans bruit).</desc>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`;
}

for (const tr of TRACES) {
  console.log(`▶ ${tr.name}`);
  const line = await route(tr.waypoints);
  const grid = await buildGrid(line);
  const pts = simulateRunner(line, grid, tr);
  mkdirSync(join(ROOT, 'test-data/gpx'), { recursive: true });
  mkdirSync(join(ROOT, 'test-data/dem'), { recursive: true });
  writeFileSync(join(ROOT, `test-data/gpx/${tr.name}.gpx`), toGpx(tr.name, tr.label, pts));
  writeFileSync(join(ROOT, `test-data/dem/${tr.name}.json`), JSON.stringify(grid));
  let dist = 0;
  let dplus = 0;
  for (let i = 1; i < pts.length; i++) {
    dist += haversine([pts[i - 1].lng, pts[i - 1].lat], [pts[i].lng, pts[i].lat]);
    dplus += Math.max(0, pts[i].ele - pts[i - 1].ele);
  }
  console.log(`  ${pts.length} points, ${(dist / 1000).toFixed(2)} km, D+ brut ${dplus.toFixed(0)} m, durée ${((pts.at(-1).t - pts[0].t) / 60000).toFixed(1)} min`);
}
