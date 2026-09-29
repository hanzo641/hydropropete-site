import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG, resolveConfig } from '../src/game/config.ts';
import { parseGpx } from '../src/gps/gpx.ts';
import { processRun } from '../src/server/processRun.ts';

const DIR = fileURLToPath(new URL('../../../test-data/gpx/real/', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.gpx'));

describe.skipIf(files.length === 0)('vraies traces (test-data/gpx/real)', () => {
  for (const f of files) {
    it(`${f} : validée par le serveur`, async () => {
      const raw = parseGpx(readFileSync(DIR + f, 'utf8'));
      const cfg = resolveConfig(DEFAULT_GAME_CONFIG, { antiCheat: { maxUploadDelayDays: 100_000 } });
      const r = await processRun({ raw, source: 'gps', now: raw[raw.length - 1]!.t + 60_000, cfg, dem: null, alreadyToday: { km: 0, dplusM: 0 } });
      expect(r.status, JSON.stringify(r.status === 'rejected' ? r.rejection : {})).toBe('validated');
    });
  }
});
