import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG as C } from '../src/game/config.ts';
import { activeFactions, enemyOf } from '../src/game/factions.ts';
import { frontOfDay } from '../src/game/front.ts';
import { addDays, currentStreak, localDay, nextStreak, streakAtRisk, streakBonus } from '../src/game/streak.ts';
import { computeTroops } from '../src/game/troops.ts';
import { aiDailyBudget, aiTurn, npcName, seedWorld } from '../src/game/world.ts';
import { wildGarrison } from '../src/game/wild.ts';
import type { HexSnapshot } from '../src/game/combat.ts';

const PAU = { lat: 43.2951, lng: -0.3708 };

describe('deux factions en guerre', () => {
  it('Braise contre Marée par défaut', () => {
    expect(activeFactions(C.factions).map((f) => f.slug)).toEqual(['braise', 'maree']);
    expect(enemyOf(1, C.factions)).toBe(2);
    expect(enemyOf(2, C.factions)).toBe(1);
    expect(enemyOf(1, { ...C.factions, count: 3 })).toBeNull();
  });
});

describe('série', () => {
  it('jours consécutifs, remise à 1 après un trou, inchangée le même jour', () => {
    let s = nextStreak({ days: 0, lastDay: null }, '2026-09-28', true);
    expect(s).toEqual({ days: 1, lastDay: '2026-09-28' });
    s = nextStreak(s, '2026-09-29', true);
    expect(s.days).toBe(2);
    s = nextStreak(s, '2026-09-29', true);
    expect(s.days).toBe(2);
    expect(nextStreak(s, '2026-09-30', false)).toEqual(s);
    expect(nextStreak(s, '2026-10-02', true).days).toBe(1);
  });
  it('affichage, alerte et bonus', () => {
    const s = { days: 4, lastDay: '2026-09-28' };
    expect(currentStreak(s, '2026-09-29')).toBe(4);
    expect(streakAtRisk(s, '2026-09-29')).toBe(true);
    expect(currentStreak(s, '2026-09-30')).toBe(0);
    expect(streakBonus(1, C.streak)).toBe(0);
    expect(streakBonus(3, C.streak)).toBeCloseTo(0.2);
    expect(streakBonus(12, C.streak)).toBe(0.5);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(localDay(Date.UTC(2026, 8, 29, 23, 30), 120)).toBe('2026-09-30');
  });
  it('le bonus de série augmente les troupes', () => {
    const base = computeTroops({ distanceM: 10_000, dplusM: 0 }, { km: 0, dplusM: 0 }, C.troops, 0);
    const boosted = computeTroops({ distanceM: 10_000, dplusM: 0 }, { km: 0, dplusM: 0 }, C.troops, 0.3);
    expect(base.troops).toBe(10);
    expect(boosted.troops).toBe(13);
    expect(boosted.bonusTroops).toBe(3);
  });
});

describe('front du jour', () => {
  it('déterministe, préfère les régions disputées', () => {
    const regions = [
      { region: 'a', factions: 1 },
      { region: 'b', factions: 2 },
      { region: 'c', factions: 2 },
    ];
    const f = frontOfDay(regions, '2026-09-29');
    expect(['b', 'c']).toContain(f);
    expect(frontOfDay(regions, '2026-09-29')).toBe(f);
    expect(frontOfDay([], '2026-09-29')).toBeNull();
  });
});

describe('monde simulé (mode local)', () => {
  const seed = 'test-seed';
  const world = seedWorld({ center: PAU, playerFaction: 1, enemyFaction: 2, seed }, C);
  it('un front ennemi, quelques alliés, voisinage libre', () => {
    const enemy = world.filter((h) => h.owner === 2).length;
    const ally = world.filter((h) => h.owner === 1).length;
    expect(enemy).toBeGreaterThan(15);
    expect(ally).toBeGreaterThan(3);
    expect(enemy).toBeGreaterThan(ally);
    expect(seedWorld({ center: PAU, playerFaction: 1, enemyFaction: 2, seed }, C)).toEqual(world);
  });
  it('l’IA ennemie avance sur sa frontière et dépense exactement son budget', () => {
    const map = new Map<string, HexSnapshot>(world.map((h) => [h.cell, { owner: h.owner, garrison: h.garrison }]));
    const before = [...map.values()].filter((h) => h.owner === 2).length;
    const actions = aiTurn(map, 2, 20, { rival: 1, seed: 'turn1', wildOf: (c) => wildGarrison(c, null, seed, C.wild) }, C);
    const spent = actions.reduce((s, a) => s + a.troops, 0);
    expect(spent).toBe(20);
    expect(actions.some((a) => a.outcome === 'captured')).toBe(true);
    expect([...map.values()].filter((h) => h.owner === 2).length).toBeGreaterThan(before);
  });
  it('budget proportionné à l’activité du joueur, borné', () => {
    expect(aiDailyBudget(0, 'enemy')).toBe(6);
    expect(aiDailyBudget(70, 'enemy')).toBe(13);
    expect(aiDailyBudget(10_000, 'enemy')).toBe(30);
    expect(aiDailyBudget(0, 'ally')).toBe(3);
  });
  it('noms de coureurs fictifs stables', () => {
    expect(npcName(2, 'x')).toBe(npcName(2, 'x'));
  });
});
