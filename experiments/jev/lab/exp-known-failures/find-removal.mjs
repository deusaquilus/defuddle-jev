// Usage: node find-removal.mjs <html-file> <url> <needle>  -- removal records whose FULL text contains needle
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { Defuddle } = require('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const [file, url, needle] = process.argv.slice(2);
const doc = parseLinkedomHTML(fs.readFileSync(file, 'utf8'), url);
const L = console.log; console.log = console.info = console.warn = console.debug = console.error = () => {};
const r = await Defuddle(doc, url, { debug: true, fetch: async () => { throw new Error('offline'); } });
console.log = L;
const rems = r.debug?.removals || [];
L('removal keys:', Object.keys(rems[0] || {}));
const alnum = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const n = alnum(needle);
let shown = 0;
for (const x of rems) {
  const t = alnum(x.text);
  if (t.includes(n)) {
    shown++;
    L(`- ${x.step} | ${x.reason} | ${x.selector || ''} | textlen=${(x.text || '').length} | tag=${x.tagName || x.element || ''} | html=${(x.html || x.outerHTML || '').slice(0, 300).replace(/\s+/g, ' ')}`);
    L(`    text: ${(x.text || '').slice(0, 200).replace(/\s+/g, ' ')}`);
    if (shown >= 6) break;
  }
}
L(`matches: ${shown} of ${rems.length}; output words ${r.wordCount}; html has <th>: ${/<th[ >]/.test(r.content)} imgs: ${(r.content.match(/<img/g) || []).length}`);
