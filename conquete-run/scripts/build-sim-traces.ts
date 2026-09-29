/**
 * Génère les traces du mode simulation de l'app à partir des traces de référence, avec un
 * bruit GPS réaliste (même simulateur que les tests) : le mode simulation exerce ainsi toute
 * la chaîne de filtrage. Usage : node --experimental-strip-types scripts/build-sim-traces.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadReference, PROFILES, simulateGps } from '../packages/core/test/helpers/simulate.ts';

const out = fileURLToPath(new URL('../apps/mobile/src/features/run/sim-traces/', import.meta.url));
const traces = [
  ['ville-pau', PROFILES.ville],
  ['foret-bastard', PROFILES.foret],
  ['montagne-ayous', PROFILES.montagne],
] as const;
for (const [name, profile] of traces) {
  const pts = simulateGps(loadReference(name), profile, 2026);
  const t0 = pts[0]!.t;
  // format compact : [dt (s), lat, lng, acc, alt]
  const rows = pts.map((p) => [
    Math.round((p.t - t0) / 1000),
    Number(p.lat.toFixed(6)),
    Number(p.lng.toFixed(6)),
    p.acc,
    p.alt == null ? null : Math.round(p.alt * 10) / 10,
  ]);
  writeFileSync(`${out}${name}.json`, JSON.stringify(rows));
  console.log(name, rows.length, 'points');
}
