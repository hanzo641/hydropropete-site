#!/usr/bin/env node
/**
 * Copie packages/core/src → supabase/functions/_shared/core (les Edge Functions Deno ne
 * peuvent pas importer de façon fiable des fichiers hors de supabase/functions au
 * déploiement). `--check` échoue si la copie n'est pas à jour (utilisé par les tests).
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'packages/core/src');
const DST = join(ROOT, 'supabase/functions/_shared/core');

function list(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? list(p) : [p];
  });
}

if (process.argv.includes('--check')) {
  const a = list(SRC).map((p) => relative(SRC, p)).sort();
  const b = list(DST).map((p) => relative(DST, p)).sort();
  const stale =
    a.join() !== b.join() || a.some((f) => readFileSync(join(SRC, f), 'utf8') !== readFileSync(join(DST, f), 'utf8'));
  if (stale) {
    console.error('supabase/functions/_shared/core est périmé : lancez `npm run sync:edge`');
    process.exit(1);
  }
  console.log('copie du core à jour');
} else {
  rmSync(DST, { recursive: true, force: true });
  cpSync(SRC, DST, { recursive: true });
  console.log(`core copié vers ${relative(ROOT, DST)}`);
}
