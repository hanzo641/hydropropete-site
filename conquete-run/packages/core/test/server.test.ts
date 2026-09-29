import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG as C, resolveConfig } from '../src/game/config.ts';
import { GridDemProvider, type DemProvider } from '../src/gps/dem.ts';
import { processRun } from '../src/server/processRun.ts';
import { loadGrid, loadReference, PROFILES, simulateGps } from './helpers/simulate.ts';

const mountain = loadReference('montagne-ayous');
const noisy = simulateGps(mountain, PROFILES.montagne, 11);
const now = mountain[mountain.length - 1]!.t + 3_600_000;
const grid = new GridDemProvider(loadGrid('montagne-ayous'));

describe('processRun (serveur)', () => {
  it('valide une vraie course de montagne : distance, D+ MNT, cases, troupes, XP', async () => {
    const r = await processRun({ raw: noisy, source: 'gps', now, cfg: C, dem: [grid], alreadyToday: { km: 0, dplusM: 0 } });
    expect(r.status).toBe('validated');
    if (r.status !== 'validated') return;
    expect(r.metrics.distanceM / 12_248).toBeGreaterThan(0.97);
    expect(r.metrics.distanceM / 12_248).toBeLessThan(1.03);
    expect(r.metrics.dplusSource).toBe('grid');
    expect(r.metrics.dplusM).toBeGreaterThan(740);
    expect(r.metrics.dplusM).toBeLessThan(920);
    expect(r.troops.troops).toBe(Math.floor(r.metrics.distanceM / 1000 + r.metrics.dplusM / 100));
    expect(r.cells.length).toBeGreaterThanOrEqual(5); // aller-retour de 6 km sur le même sentier
    expect(r.cells.every((c) => c.elevationM != null && c.elevationM > 1300)).toBe(true);
    expect(r.cells[0]!.region).toMatch(/^86/);
    expect(r.xp).toBeGreaterThan(100);
  });

  it('sans MNT : repli sur l’altitude GPS lissée, signalé', async () => {
    const down: DemProvider = { name: 'down', resolution: 'fine', covers: () => true, elevations: async () => { throw new Error('503'); } };
    const r = await processRun({ raw: noisy, source: 'gps', now, cfg: C, dem: [down], alreadyToday: { km: 0, dplusM: 0 } });
    expect(r.status).toBe('validated');
    if (r.status !== 'validated') return;
    expect(r.metrics.dplusSource).toBe('gps');
    expect(r.flags).toContain('dem_unavailable');
  });

  it('rejette un trajet en voiture avec la plage horaire', async () => {
    const car = mountain.map((p, i) => ({ ...p, t: mountain[0]!.t + i * 250 })); // ×4 : ~40 km/h
    const r = await processRun({ raw: car, source: 'gps', now, cfg: C, dem: null, alreadyToday: { km: 0, dplusM: 0 } });
    expect(r.status).toBe('rejected');
    if (r.status !== 'rejected') return;
    expect(r.rejection.code).toBe('vehicle');
    expect(r.rejection.details.from).toMatch(/^\d\d:\d\d$/);
  });

  it('refuse les courses simulées sauf en saison de démo', async () => {
    const r = await processRun({ raw: noisy, source: 'simulation', now, cfg: C, dem: null, alreadyToday: { km: 0, dplusM: 0 } });
    expect(r.status === 'rejected' && r.rejection.code).toBe('simulated');
    const demo = resolveConfig({ antiCheat: { allowSimulatedRuns: true } });
    const ok = await processRun({ raw: noisy, source: 'simulation', now, cfg: demo, dem: null, alreadyToday: { km: 0, dplusM: 0 } });
    expect(ok.status).toBe('validated');
  });

  it('plafond journalier appliqué', async () => {
    const r = await processRun({ raw: noisy, source: 'gps', now, cfg: C, dem: [grid], alreadyToday: { km: 40, dplusM: 2900 } });
    expect(r.status === 'validated' && r.troops.troops).toBe(3);
  });

  it('signal trop mauvais', async () => {
    const bad = noisy.map((p) => ({ ...p, acc: 80 }));
    const r = await processRun({ raw: bad, source: 'gps', now, cfg: C, dem: null, alreadyToday: { km: 0, dplusM: 0 } });
    expect(r.status === 'rejected' && r.rejection.code).toBe('poor_signal');
  });
});
