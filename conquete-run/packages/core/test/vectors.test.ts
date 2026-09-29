/**
 * Vecteurs de parité : les règles critiques existent en TypeScript (app, Edge Functions)
 * ET en SQL (résolution atomique en base). On fige ici des cas calculés par le TS dans
 * test-data/vectors/*.json ; `npm run gen:sql-vectors` en fait un test pgTAP qui vérifie
 * que le SQL donne exactement les mêmes résultats.
 * Mise à jour volontaire : UPDATE_VECTORS=1 npx vitest run test/vectors.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { effectiveTroops, resolveAttack } from '../src/game/combat.ts';
import { DEFAULT_GAME_CONFIG as C } from '../src/game/config.ts';
import { erodedGarrison } from '../src/game/erosion.ts';
import { levelFromXp } from '../src/game/progression.ts';
import { regionController } from '../src/game/region.ts';
import { mulberry32 } from './helpers/simulate.ts';

const DIR = fileURLToPath(new URL('../../../test-data/vectors/', import.meta.url));

function combatCases() {
  const r = mulberry32(20260929);
  const cases = [
    // cas des règles et cas limites
    { owner: 2, garrison: 10, attacker: 1, troops: 8, bonus: false },
    { owner: 2, garrison: 3.3333, attacker: 1, troops: 5, bonus: false },
    { owner: null, garrison: 2, attacker: 3, troops: 10, bonus: false },
    { owner: null, garrison: 1.4, attacker: 1, troops: 1, bonus: true },
    { owner: 1, garrison: 55, attacker: 1, troops: 20, bonus: false },
    { owner: 2, garrison: 5, attacker: 1, troops: 6, bonus: false },
    { owner: 2, garrison: 1.5, attacker: 3, troops: 1, bonus: false },
    { owner: 2, garrison: 60, attacker: 1, troops: 90, bonus: true },
  ];
  for (let i = 0; i < 60; i++) {
    cases.push({
      owner: r() < 0.25 ? null : 1 + Math.floor(r() * 3),
      garrison: Math.round(r() * 300000) / 10000,
      attacker: 1 + Math.floor(r() * 3),
      troops: 1 + Math.floor(r() * 40),
      bonus: r() < 0.3,
    });
  }
  return cases.map((c) => {
    const eff = effectiveTroops(c.troops, c.bonus, C.region);
    const res = resolveAttack({ owner: c.owner, garrison: c.garrison }, c.attacker, eff, C.combat, C.erosion.abandonThreshold);
    return { ...c, effective: eff, outcome: res.outcome, afterOwner: res.after.owner, afterGarrison: res.after.garrison };
  });
}

function erosionCases() {
  return [
    [10, 1],
    [10, 2.5],
    [37.1234, 0.25],
    [3, 21],
    [60, 44.9],
    [1.2, 0.1],
  ].map(([g, days]) => ({ garrison: g!, days: days!, eroded: erodedGarrison(g!, 0, days! * 86_400_000, C.erosion) }));
}

function regionCases() {
  const cases: { counts: [number, number][]; expected: number | null }[] = [
    { counts: [[1, 25], [2, 10]], expected: null },
    { counts: [[1, 24], [2, 10]], expected: null },
    { counts: [[1, 30], [2, 19]], expected: null },
    { counts: [[2, 25], [3, 25]], expected: null },
    { counts: [[3, 49]], expected: null },
    { counts: [], expected: null },
  ];
  return cases.map((c) => ({ ...c, expected: regionController(new Map(c.counts), 49, C.region) }));
}

function levelCases() {
  return [0, 99, 100, 250, 1000, 5000, 20_000, 209_250].map((xp) => ({ xp, level: levelFromXp(xp).level }));
}

const ALL = { combat: combatCases(), erosion: erosionCases(), region: regionCases(), level: levelCases() };

describe('vecteurs de parité TS ↔ SQL', () => {
  for (const [name, data] of Object.entries(ALL)) {
    it(`${name} : stable`, () => {
      const file = `${DIR}${name}.json`;
      if (process.env.UPDATE_VECTORS || !existsSync(file)) writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
      expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(JSON.parse(JSON.stringify(data)));
    });
  }
});
