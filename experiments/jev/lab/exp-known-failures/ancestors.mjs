// Usage: node ancestors.mjs <html-file> <url> <needle text>
// Finds the deepest element containing the needle text, then lists ancestors with the exact/partial selectors they match.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const C = require('/home/alexi/git/defuddle/dist/constants.js');
const [file, url, needle] = process.argv.slice(2);
const doc = parseLinkedomHTML(fs.readFileSync(file, 'utf8'), url);
for (const el of Array.from(doc.querySelectorAll('script,style,noscript,template,svg'))) el.remove();
const alnum = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const n = alnum(needle);
let target = null;
for (const el of Array.from(doc.body.querySelectorAll('*'))) if (alnum(el.textContent).includes(n)) target = el; // deepest in doc order wins
if (!target) { console.log('needle not found'); process.exit(0); }
const partials = C.PARTIAL_SELECTORS.map(p => ({ p, re: new RegExp(p, 'i') }));
let a = target;
while (a && a.tagName !== 'HTML') {
  const cls = a.getAttribute('class') || '', id = a.getAttribute('id') || '';
  const exact = C.EXACT_SELECTORS.filter(s => { try { return a.matches(s); } catch { return false; } });
  const attrs = cls + ' ' + (a.getAttribute('data-testid') || '') + ' ' + (a.getAttribute('data-qa') || '') + ' ' + (a.getAttribute('data-cy') || '');
  const part = partials.filter(x => x.re.test(attrs) || (id && x.re.test(id))).map(x => x.p);
  const words = (a.textContent || '').trim().split(/\s+/).length;
  console.log(`${a.tagName.toLowerCase()}${id ? '#' + id : ''}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 4).join('.') : ''} [${words}w] exact=${JSON.stringify(exact)} partial=${JSON.stringify(part.slice(0, 5))}`);
  a = a.parentElement;
}
