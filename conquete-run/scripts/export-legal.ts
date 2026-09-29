/** Publie les textes légaux de l'app en Markdown (legal/*.md) pour un site web / les stores. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LEGAL } from '../apps/mobile/src/legal/texts.ts';

const dir = fileURLToPath(new URL('../legal/', import.meta.url));
mkdirSync(dir, { recursive: true });
for (const [lang, docs] of Object.entries(LEGAL)) {
  for (const [name, doc] of Object.entries(docs)) {
    const file = `${dir}${name}.${lang}.md`;
    writeFileSync(file, `<!-- Généré depuis apps/mobile/src/legal/texts.ts — modifier la source puis npm run legal:export -->\n\n# ${doc.title}\n\n${doc.body}\n`);
    console.log(file);
  }
}
