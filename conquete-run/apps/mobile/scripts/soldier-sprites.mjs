// Génère les sprites des soldats pour la carte (assets/soldiers/*@2x.png) à partir de
// src/ui/soldierArt.ts. Outil de développement : nécessite esbuild et Playwright (Chromium).
//   node scripts/soldier-sprites.mjs
//   (NODE_PATH peut pointer vers une installation globale de ces outils)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '.tmp', 'soldierArt.cjs');
await build({ entryPoints: [join(root, 'src/ui/soldierArt.ts')], bundle: true, format: 'cjs', platform: 'node', outfile: out, logLevel: 'error' });
const art = require(out);

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 128, height: 160 } });
const dir = join(root, 'assets', 'soldiers');
mkdirSync(dir, { recursive: true });
const looks = [[null, 0], ...[1, 2].flatMap((f) => [1, 2, 3, 4, 5, 6].map((t) => [f, t]))];
const ids = [];
for (const [f, t] of looks) {
  for (const captain of [false, true]) {
    const id = art.soldierImageId(f, t, captain);
    await page.setContent(`<html><body style="margin:0;background:transparent">${art.soldierSvg(f, t, captain).replace('<svg ', '<svg width="128" height="160" ')}</body></html>`);
    writeFileSync(join(dir, `${id}@2x.png`), await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 128, height: 160 } }));
    ids.push(id);
  }
}
await browser.close();
// table des images, chargée par la carte (require statiques pour Metro)
const lines = ids.map((id) => `  '${id}': require('../../../assets/soldiers/${id}.png'),`);
writeFileSync(
  join(root, 'src/features/map/soldierImages.ts'),
  `// Généré par scripts/soldier-sprites.mjs — ne pas modifier à la main.\nexport const SOLDIER_IMAGES: Record<string, number> = {\n${lines.join('\n')}\n};\n`,
);
console.log(`${ids.length} sprites`);
