#!/usr/bin/env node
/**
 * Génère supabase/tests/database/10_parity_vectors.test.sql à partir de
 * test-data/vectors/*.json (cas calculés par le TypeScript du core).
 * `--check` échoue si le fichier généré n'est pas à jour.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const load = (n) => JSON.parse(readFileSync(`${root}test-data/vectors/${n}.json`, 'utf8'));
const combat = load('combat');
const erosion = load('erosion');
const region = load('region');
const level = load('level');

const num = (x) => String(x);
const sm = (x) => (x == null ? 'null::smallint' : `${x}::smallint`);
const lines = [];
lines.push('-- FICHIER GÉNÉRÉ par scripts/gen-sql-vectors.mjs — ne pas modifier à la main.');
lines.push('-- Parité TS ↔ SQL : chaque cas a été calculé par packages/core.');
lines.push('begin;');
const total = combat.length + erosion.length + region.length + level.length;
lines.push(`select plan(${total});`);

combat.forEach((c, i) => {
  const expected = `${c.outcome}|${c.afterOwner ?? 'null'}|${num(c.afterGarrison)}`;
  lines.push(
    `select is((select outcome || '|' || coalesce(owner::text, 'null') || '|' || trim_scale(garrison)::text ` +
      `from public.apply_attack(${sm(c.owner)}, ${num(c.garrison)}, ${sm(c.attacker)}, public.effective_troops(${c.troops}, ${c.bonus}))), ` +
      `'${expected}', 'combat #${i + 1}');`,
  );
});

erosion.forEach((e, i) => {
  lines.push(
    `select is(trim_scale(public.eroded(${num(e.garrison)}, '2026-01-01T00:00:00Z'::timestamptz, ` +
      `'2026-01-01T00:00:00Z'::timestamptz + interval '1 second' * ${Math.round(e.days * 86400)}))::text, '${num(e.eroded)}', 'érosion #${i + 1}');`,
  );
});

lines.push(`insert into public.seasons (name, starts_at, ends_at, status) values ('vecteurs', now() - interval '1 day', now() + interval '1 day', 'closed');`);
region.forEach((r, i) => {
  const reg = `vec-region-${i}`;
  for (const [f, n] of r.counts) {
    lines.push(
      `insert into public.cells (h3, region, zone, center) select '${reg}-' || ${f} || '-' || g, '${reg}', 'z', ` +
        `extensions.st_makepoint(0, 0)::extensions.geography from generate_series(1, ${n}) g;`,
    );
    lines.push(
      `insert into public.hex_state (season_id, h3, region, zone, owner_faction, garrison) select ` +
        `(select id from public.seasons where name = 'vecteurs'), '${reg}-' || ${f} || '-' || g, '${reg}', 'z', ${f}, 5 from generate_series(1, ${n}) g;`,
    );
  }
  lines.push(
    `select is(public.region_controller_of((select id from public.seasons where name = 'vecteurs'), '${reg}'), ${sm(r.expected)}, 'région #${i + 1}');`,
  );
});

level.forEach((l, i) => lines.push(`select is(public.level_from_xp(${l.xp}), ${l.level}, 'niveau #${i + 1}');`));

lines.push('select * from finish();', 'rollback;', '');
const out = lines.join('\n');
const target = `${root}supabase/tests/database/10_parity_vectors.test.sql`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== out) {
    console.error('10_parity_vectors.test.sql périmé : lancez `npm run gen:sql-vectors`');
    process.exit(1);
  }
} else {
  writeFileSync(target, out);
  console.log(`${total} vecteurs → ${target}`);
}
