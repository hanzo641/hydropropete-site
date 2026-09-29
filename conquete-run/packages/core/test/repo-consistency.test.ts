import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_CONFIG } from '../src/game/config.ts';
import { AVATARS } from '../src/game/avatars.ts';
import { FACTIONS } from '../src/game/factions.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

describe('cohérence du dépôt', () => {
  it('les valeurs par défaut SQL (dernière définition de game_defaults) = DEFAULT_GAME_CONFIG', () => {
    const dir = join(ROOT, 'supabase/migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const last = files.filter((f) => readFileSync(join(dir, f), 'utf8').includes('function public.game_defaults()')).at(-1)!;
    const sql = readFileSync(join(dir, last), 'utf8');
    const m = /select '(\{.*\})'::jsonb/.exec(sql);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1]!)).toEqual(DEFAULT_GAME_CONFIG);
  });

  it('les factions SQL (après la migration v2) = FACTIONS', () => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/20260929000008_war_v2.sql'), 'utf8');
    for (const f of FACTIONS) expect(sql).toMatch(new RegExp(`color = '${f.color}'.*where id = ${f.id};`));
    expect(sql).toContain("slug = 'maree', color = '#2E7DFF', name_fr = 'Marée', name_en = 'Tide' where id = 2");
  });

  it('les niveaux de déblocage des avatars SQL = AVATARS', () => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/20260929000007_avatars.sql'), 'utf8');
    for (const a of AVATARS) expect(sql).toContain(`when '${a.id}' then ${a.unlockLevel}`);
    expect(sql.match(/when '/g)?.length).toBe(AVATARS.length);
  });

  it('le test SQL de parité est généré à partir des vecteurs actuels', () => {
    expect(() => execFileSync('node', [join(ROOT, 'scripts/gen-sql-vectors.mjs'), '--check'])).not.toThrow();
  });

  it('la copie du core pour les Edge Functions est à jour', () => {
    expect(() => execFileSync('node', [join(ROOT, 'scripts/sync-core-to-edge.mjs'), '--check'])).not.toThrow();
  });
});
