import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG as C, mergeConfig, resolveConfig, validateConfig } from '../src/game/config.ts';
import { effectiveTroops, resolveAttack } from '../src/game/combat.ts';
import { autoDistribute, previewDeployment, troopsToCapture, validateAllocations, type DeployTarget } from '../src/game/deployment.ts';
import { daysUntilAbandon, erodedGarrison, isAbandoned } from '../src/game/erosion.ts';
import { assignFaction } from '../src/game/factions.ts';
import { isoWeek, levelFromXp, newTrophies, rankForLevel, runXp, weeklyChallenges, xpForLevel, type PlayerStats } from '../src/game/progression.ts';
import { regionController } from '../src/game/region.ts';
import { seasonPoints, seasonTitles } from '../src/game/season.ts';
import { computeTroops } from '../src/game/troops.ts';
import { hash01, wildGarrison } from '../src/game/wild.ts';
import { cellsInBBox, crossedCells, neighbors, regionOf, territoriesPerRegion, territoryAt, zoneOf } from '../src/geo/h3.ts';
import { coarsen, isInPrivacyZone, maskTrace } from '../src/geo/privacy.ts';

const PAU = { lat: 43.2951, lng: -0.3708 };

describe('configuration serveur', () => {
  it('fusion tolérante : clés inconnues et mauvais types ignorés', () => {
    const c = resolveConfig({ combat: { defenseMultiplier: 1.5, typo: 3 }, erosion: { dailyRate: 'x' } });
    expect(c.combat.defenseMultiplier).toBe(1.5);
    expect(c.erosion.dailyRate).toBe(0.05);
    expect('typo' in c.combat).toBe(false);
    expect(mergeConfig(C, null)).toBe(C);
  });
  it('valide la cohérence', () => {
    expect(validateConfig(C)).toEqual([]);
    expect(validateConfig(resolveConfig({ h3: { regionRes: 9 } })).length).toBeGreaterThan(0);
  });
});

describe('troupes', () => {
  it('1 troupe/km + 1 troupe/100 m D+ (exemple des règles : 7,8 km + 230 m = 10)', () => {
    expect(computeTroops({ distanceM: 7800, dplusM: 230 }, { km: 0, dplusM: 0 }, C.troops).troops).toBe(10);
  });
  it('plafond journalier', () => {
    const r = computeTroops({ distanceM: 20_000, dplusM: 0 }, { km: 30, dplusM: 0 }, C.troops);
    expect(r.troops).toBe(12);
    expect(r.capped).toBe(true);
    expect(computeTroops({ distanceM: 5000, dplusM: 0 }, { km: 50, dplusM: 0 }, C.troops).troops).toBe(0);
  });
});

describe('garnisons sauvages', () => {
  it('plus fortes en montagne, déterministes, plafonnées', () => {
    const cell = territoryAt(PAU, C.h3);
    const plain = wildGarrison(cell, 200, 's1', C.wild);
    const mountain = wildGarrison(cell, 1500, 's1', C.wild);
    expect(plain).toBeGreaterThanOrEqual(1);
    expect(plain).toBeLessThanOrEqual(2);
    expect(mountain).toBeGreaterThanOrEqual(4);
    expect(mountain).toBeLessThanOrEqual(5);
    expect(wildGarrison(cell, 1500, 's1', C.wild)).toBe(mountain);
    expect(wildGarrison(cell, 9000, 's1', C.wild)).toBe(6);
    expect(wildGarrison(cell, null, 's1', C.wild)).toBeLessThanOrEqual(2);
  });
  it('hash01 uniforme sur [0,1[', () => {
    const v = Array.from({ length: 2000 }, (_, i) => hash01(`x${i}`));
    expect(Math.min(...v)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...v)).toBeLessThan(1);
    expect(v.reduce((a, b) => a + b, 0) / v.length).toBeCloseTo(0.5, 1);
  });
});

describe('combat', () => {
  it('exemple des règles : 10 − 8/1,2 = 3,33 puis 5 ≥ 4 ⇒ pris avec 1', () => {
    const a = resolveAttack({ owner: 2, garrison: 10 }, 1, 8, C.combat);
    expect(a.outcome).toBe('damaged');
    expect(a.after.garrison).toBeCloseTo(3.3333, 4);
    const b = resolveAttack(a.after, 1, 5, C.combat);
    expect(b.outcome).toBe('captured');
    expect(b.after).toEqual({ owner: 1, garrison: 1 });
  });
  it('prise d’un sauvage avec surplus', () => {
    expect(resolveAttack({ owner: null, garrison: 2 }, 3, 10, C.combat).after).toEqual({ owner: 3, garrison: 7.6 });
  });
  it('renfort plafonné', () => {
    expect(resolveAttack({ owner: 1, garrison: 55 }, 1, 20, C.combat).after.garrison).toBe(60);
  });
  it('bonus de région +10 %', () => {
    expect(effectiveTroops(10, true, C.region)).toBe(11);
    expect(effectiveTroops(10, false, C.region)).toBe(10);
  });
});

describe('érosion', () => {
  it('5 %/jour continu et abandon sous 1', () => {
    const t0 = 0;
    expect(erodedGarrison(10, t0, 86_400_000, C.erosion)).toBe(9.5);
    expect(erodedGarrison(10, t0, 2 * 86_400_000, C.erosion)).toBeCloseTo(9.025, 4);
    expect(isAbandoned(0.99, C.erosion)).toBe(true);
    expect(daysUntilAbandon(10, C.erosion)).toBeCloseTo(44.9, 0);
    expect(daysUntilAbandon(3, C.erosion)).toBeCloseTo(21.4, 0);
  });
});

describe('régions', () => {
  it('contrôle à 50 % et majorité stricte', () => {
    expect(regionController(new Map([[1, 25], [2, 10]]), 49, C.region)).toBe(1);
    expect(regionController(new Map([[1, 24], [2, 10]]), 49, C.region)).toBeNull();
    expect(regionController(new Map([[1, 3], [2, 3]]), 6, { ...C.region, controlThreshold: 0.5 })).toBeNull();
    expect(regionController(new Map([[1, 49]]), 49, { ...C.region, controlThreshold: 1 })).toBe(1);
  });
});

describe('factions', () => {
  it('rééquilibrage par zone', () => {
    const counts = new Map([[1, 6], [2, 2], [3, 2]]);
    const r = assignFaction(counts, 1, C.factions);
    expect(r.locked).toEqual([1]);
    expect([2, 3]).toContain(r.faction);
    expect(assignFaction(counts, 2, C.factions).faction).toBe(2);
    expect(assignFaction(new Map([[1, 2]]), 1, C.factions).faction).toBe(1); // zone trop petite
    expect(assignFaction(new Map([[1, 1], [2, 0], [3, 1]]), null, C.factions).faction).toBe(2);
  });
});

describe('progression', () => {
  it('niveaux et rangs du prototype', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(250)).toEqual({ level: 3, currentXp: 0, nextXp: 200 });
    expect(rankForLevel(10).id).toBe('debutant');
    expect(rankForLevel(11).id).toBe('jogger');
    expect(rankForLevel(95).id).toBe('maitre');
  });
  it('XP de course', () => {
    expect(runXp({ distanceM: 10_000, dplusM: 200, movingS: 3000 }, C.xp)).toBe(100 + 20 + 100);
  });
  it('trophées', () => {
    const s: PlayerStats = {
      runs: 1, totalKm: 5, totalDplusM: 1200, level: 2, captures: 1, regionsTaken: 0,
      maxAltitudeCapturedM: 0, bestPaceSecPerKm: 290, earlyRuns: 0, nightRuns: 0, distinctCells: 3,
    };
    const ids = newTrophies(s, new Set(['first_run'])).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['first_capture', 'dplus_1000', 'sprinter']));
    expect(ids).not.toContain('first_run');
  });
  it('défis hebdomadaires déterministes', () => {
    const w = isoWeek(Date.UTC(2026, 8, 29));
    expect(w).toBe('2026-W40');
    const a = weeklyChallenges('u1', w, 5);
    expect(a).toHaveLength(3);
    expect(weeklyChallenges('u1', w, 5)).toEqual(a);
  });
});

describe('saison', () => {
  it('points et titres par zone', () => {
    expect(seasonPoints({ captures: 3, troopsDeployed: 20, km: 12.4 }, C.score)).toBe(62);
    const titles = seasonTitles([
      { userId: 'a', zone: 'z', points: 50, regionsTaken: 0, reinforcements: 5, distinctCells: 10, dplusM: 100 },
      { userId: 'b', zone: 'z', points: 40, regionsTaken: 1, reinforcements: 1, distinctCells: 30, dplusM: 900 },
    ]);
    expect(titles).toEqual(expect.arrayContaining([
      { userId: 'a', zone: 'z', title: 'conqueror' },
      { userId: 'b', zone: 'z', title: 'strategist' },
      { userId: 'b', zone: 'z', title: 'sherpa' },
    ]));
  });
});

describe('déploiement', () => {
  const t = (cell: string, owner: number | null, garrison: number, rc: number | null = null): DeployTarget => ({
    cell, region: 'r', state: { owner, garrison }, regionController: rc,
  });
  it('validation', () => {
    const crossed = new Set(['a', 'b']);
    expect(validateAllocations([{ cell: 'a', troops: 3 }], crossed, 5)).toBeNull();
    expect(validateAllocations([{ cell: 'c', troops: 3 }], crossed, 5)).toBe('not_crossed');
    expect(validateAllocations([{ cell: 'a', troops: 3 }, { cell: 'b', troops: 3 }], crossed, 5)).toBe('too_many_troops');
    expect(validateAllocations([{ cell: 'a', troops: 1.5 }], crossed, 5)).toBe('invalid_troops');
    expect(validateAllocations([{ cell: 'a', troops: 1 }, { cell: 'a', troops: 1 }], crossed, 5)).toBe('duplicate_cell');
  });
  it('répartition auto : prises les moins chères d’abord, puis renforts', () => {
    const targets = [t('w1', null, 1), t('e1', 2, 10), t('o1', 1, 2), t('w2', null, 2)];
    expect(troopsToCapture(targets[0]!, 1, C)).toBe(2);
    const alloc = autoDistribute(targets, 6, 1, C);
    expect(alloc.reduce((s, a) => s + a.troops, 0)).toBe(6);
    const map = new Map(alloc.map((a) => [a.cell, a.troops]));
    expect(map.get('w1')).toBe(2);
    expect(map.get('w2')).toBe(3);
    expect(map.get('e1')).toBeUndefined();
    const preview = previewDeployment(new Map(targets.map((x) => [x.cell, x])), alloc, 1, C);
    expect(preview.get('w1')!.outcome).toBe('captured');
  });
});

describe('grille H3', () => {
  it('territoire rés. 8, région rés. 6 (49 territoires), zone rés. 4', () => {
    const cell = territoryAt(PAU, C.h3);
    expect(cell).toMatch(/^88/);
    expect(territoriesPerRegion(regionOf(cell, C.h3), C.h3)).toBe(49);
    expect(zoneOf(cell, C.h3)).toMatch(/^84/);
    expect(neighbors(cell)).toHaveLength(6);
  });
  it('cases traversées : ≥ 30 m dans la case', () => {
    const line = Array.from({ length: 300 }, (_, i) => ({ lat: PAU.lat + i * 5 / 111_320, lng: PAU.lng }));
    const cells = crossedCells(line, 8, 30);
    expect(cells.length).toBeGreaterThanOrEqual(2);
    for (const c of cells) expect(c.meters).toBeGreaterThanOrEqual(30);
  });
  it('emprise visible limitée', () => {
    const small = cellsInBBox({ south: 43.28, west: -0.39, north: 43.31, east: -0.35 }, 8);
    expect(small!.length).toBeGreaterThan(10);
    expect(cellsInBBox({ south: 42, west: -2, north: 45, east: 2 }, 8)).toBeNull();
  });
});

describe('confidentialité', () => {
  it('masque le domicile et les extrémités', () => {
    const line = Array.from({ length: 200 }, (_, i) => ({ lat: PAU.lat + i * 10 / 111_320, lng: PAU.lng }));
    const zone = { ...line[100]!, radiusM: 100 };
    expect(isInPrivacyZone(line[105]!, [zone])).toBe(true);
    const masked = maskTrace(line, [zone], 200);
    expect(masked.length).toBeLessThan(200 - 40 - 20);
    expect(masked.some((p) => isInPrivacyZone(p, [zone]))).toBe(false);
    expect(coarsen({ lat: 43.29514, lng: -0.37081 })).toEqual({ lat: 43.295, lng: -0.371 });
  });
});

describe('avatars', () => {
  it('13 avatars, 8 libres, identifiants uniques, déblocage par niveau', async () => {
    const { AVATARS, isAvatarUnlocked, avatarById, avatarSvg } = await import('../src/game/avatars.ts');
    expect(AVATARS).toHaveLength(13);
    expect(new Set(AVATARS.map((a) => a.id)).size).toBe(13);
    expect(AVATARS.filter((a) => a.unlockLevel === 1)).toHaveLength(8);
    expect(isAvatarUnlocked('dragon', 45)).toBe(false);
    expect(isAvatarUnlocked('dragon', 46)).toBe(true);
    expect(avatarById('inconnu').id).toBe('renard');
    expect(avatarSvg('loup')).toMatch(/^<svg.*<\/svg>$/);
  });
});
