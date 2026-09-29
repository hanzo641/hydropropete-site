import { describe, expect, it } from 'vitest';
import { autoDistribute } from '../src/game/deployment.ts';
import { DEFAULT_GAME_CONFIG } from '../src/game/config.ts';
import { LocalGame, type KeyValueStore } from '../src/local/game.ts';
import { loadReference, PROFILES, simulateGps } from './helpers/simulate.ts';

class MemoryKV implements KeyValueStore {
  readonly m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

const trace = simulateGps(loadReference('ville-pau'), PROFILES.ville, 3);
const start = trace[0]!.t;
const end = trace[trace.length - 1]!.t;
const PAU = { lat: 43.2951, lng: -0.3708 };

describe('mode local : une partie complète sur le téléphone', () => {
  let now = start - 3_600_000;
  const kv = new MemoryKV();
  const game = new LocalGame({ kv, now: () => now });

  it('inscription : profil, monde simulé, coureurs fictifs', async () => {
    const p = await game.onboard({
      username: 'Thomas',
      faction: 1,
      avatarId: 'loup',
      locale: 'fr',
      position: PAU,
      birthYear: null,
      gpsConsent: true,
      termsVersion: 'local',
    });
    expect(p.faction_id).toBe(1);
    expect(p.avatar_id).toBe('loup');
    const rows = await game.hexesInBBox({ south: 43.2, north: 43.4, west: -0.5, east: -0.25 });
    expect(rows.filter((r) => r.owner_faction === 2).length).toBeGreaterThan(10);
    expect((await game.zoneLeaderboard()).length).toBe(13);
  });

  let runId = '';
  it('une course validée donne des troupes et de l’XP', async () => {
    now = end + 600_000;
    const res = await game.submitRun({ clientRunId: 'run-abc-12345', source: 'gps', points: trace, tzOffsetMin: 120 });
    expect(res.run.status).toBe('validated');
    expect(res.run.troops_earned).toBeGreaterThanOrEqual(4);
    expect(res.run.cells.length).toBeGreaterThan(2);
    expect(res.trophies).toContain('first_run');
    runId = res.run.id;
    const again = await game.submitRun({ clientRunId: 'run-abc-12345', source: 'gps', points: trace, tzOffsetMin: 120 });
    expect(again.duplicate).toBe(true);
    const p = (await game.getMyProfile())!;
    expect(p.streak_days).toBe(1);
    expect(p.runs_count).toBe(1);
    expect((await game.pendingDeployments()).length).toBe(1);
  });

  it('déploiement : prises, fil, points, troupes consommées', async () => {
    const targets = await game.deployTargets(runId);
    expect(targets.length).toBeGreaterThan(2);
    const run = await game.getRun(runId);
    const alloc = autoDistribute(
      targets.map((t) => ({ cell: t.h3, region: t.region, state: { owner: t.owner_faction, garrison: t.garrison }, regionController: t.region_controller })),
      run.troops_remaining,
      1,
      DEFAULT_GAME_CONFIG,
    );
    const results = await game.deployTroops(runId, alloc);
    expect(results.some((r) => r.outcome === 'captured')).toBe(true);
    expect((await game.getRun(runId)).troops_remaining).toBe(0);
    const feed = await game.zoneFeed();
    expect(feed[0]!.kind === 'capture' || feed.some((e) => e.actor_name === 'Thomas')).toBe(true);
    expect((await game.getMyProfile())!.captures_count).toBeGreaterThan(0);
    await expect(game.deployTroops(runId, [{ cell: targets[0]!.h3, troops: 1 }])).rejects.toThrow('too_many_troops');
  });

  it('la guerre continue : l’ennemi contre-attaque pendant la nuit', async () => {
    const before = (await game.zoneFeed(undefined, 150)).length;
    now += 26 * 3_600_000;
    const periods = await game.tick();
    expect(periods).toBe(3);
    const feed = await game.zoneFeed(undefined, 150);
    expect(feed.length).toBeGreaterThan(before);
    expect(feed.some((e) => e.kind === 'capture' && e.faction_id === 2)).toBe(true);
    const war = await game.warOverview();
    expect(war.factions).toHaveLength(2);
    expect(war.factions[0]!.territory_days).toBeGreaterThan(0);
    expect(await game.tick()).toBe(0);
  });

  it('série sur deux jours consécutifs, défis de la semaine', async () => {
    const shifted = trace.map((p) => ({ ...p, t: p.t + 86_400_000 }));
    now = shifted[shifted.length - 1]!.t + 600_000;
    const res = await game.submitRun({ clientRunId: 'run-abc-67890', source: 'simulation', points: shifted, tzOffsetMin: 120 });
    expect(res.run.status).toBe('validated');
    expect((await game.getMyProfile())!.streak_days).toBe(2);
    expect(res.run.bonus_troops).toBeGreaterThanOrEqual(0);
    const w = await game.weeklyProgress();
    expect(w.distance).toBeGreaterThan(9);
  });

  it('fin de saison : victoire comptée à vie, nouvelle carte', async () => {
    now += 30 * 86_400_000;
    await game.tick();
    const war = await game.warOverview();
    expect(war.factions.reduce((s, f) => s + f.victories, 0)).toBe(1);
    expect(war.season!.name).toBe('Saison 2');
  });

  it('export et remise à zéro', async () => {
    const dump = (await game.exportData()) as { mode: string };
    expect(dump.mode).toBe('local');
    await game.deleteAccount();
    expect(await game.getMyProfile()).toBeNull();
  });
});
