// Usage: node toggle.mjs <html-file> <url> <needle>  -- which disabled step restores the needle?
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { Defuddle } = require('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const [file, url, needle, contentSel] = process.argv.slice(2);
const html = fs.readFileSync(file, 'utf8');
const configs = {
  default: {},
  noExact: { removeExactSelectors: false },
  noPartial: { removePartialSelectors: false },
  noScoring: { removeLowScoring: false },
  noHidden: { removeHiddenElements: false },
  noPatterns: { removeContentPatterns: false },
  noSmallImages: { removeSmallImages: false },
  allOff: { removeExactSelectors: false, removePartialSelectors: false, removeLowScoring: false, removeHiddenElements: false, removeContentPatterns: false },
};
if (contentSel) configs.contentSelector = { contentSelector: contentSel };
const q = () => {}; const L = console.log;
const alnum = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
for (const [name, opts] of Object.entries(configs)) {
  const doc = parseLinkedomHTML(html, url);
  console.log = console.info = console.warn = console.debug = console.error = q;
  let r; try { r = await Defuddle(doc, url, { ...opts, fetch: async () => { throw new Error('offline'); } }); } catch (e) { r = { content: '', wordCount: -1 }; }
  console.log = L;
  const text = alnum((r.content || '').replace(/<[^>]+>/g, ' '));
  L(`${name.padEnd(16)} words=${String(r.wordCount).padEnd(6)} needle=${text.includes(alnum(needle))}`);
}
