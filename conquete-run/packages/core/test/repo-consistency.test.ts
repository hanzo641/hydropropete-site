import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../src/game/config.ts';
import { FACTIONS } from '../src/game/factions.ts';

const ROOT = join(__dirname, '../../..');

describe('cohérence du dépôt', () => {
  it('les valeurs par défaut SQL (game_defaults) = DEFAULT_GAME_CONFIG', () => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/20260929000001_schema.sql'), 'utf8');
    const m = /select '(\{.*\})'::jsonb/.exec(sql);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(DEFAULT_GAME_CONFIG);
  });

  it('les factions SQL = FACTIONS', () => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/20260929000001_schema.sql'), 'utf8');
    for (const f of FACTIONS) {
      expect(sql).toContain(`(${f.id}, '${f.slug}', '${f.color}', '${f.name.fr}', '${f.name.en}')`);
    }
  });

  it('la copie du core pour les Edge Functions est à jour', () => {
    expect(() => execFileSync('node', [join(ROOT, 'scripts/sync-core-to-edge.mjs'), '--check'])).not.toThrow();
  });
});
