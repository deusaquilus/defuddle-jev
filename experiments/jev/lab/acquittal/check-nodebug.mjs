import { readFileSync, readdirSync } from 'node:fs';
import { loadApi, capture, captureNoDebug, fixtureUrl } from './harness.mjs';
const REPO = '/home/alexi/git/defuddle'; const api = loadApi(REPO + '/dist');
let both = 0, onlyDebug = 0, onlyNo = 0, selAgree = 0, selTot = 0;
for (const f of readdirSync(REPO + '/tests/fixtures').filter(f => f.endsWith('.html')).sort()) {
  const name = f.replace(/\.html$/, ''); const html = readFileSync(`${REPO}/tests/fixtures/${f}`, 'utf8'); const url = fixtureUrl(name, html);
  const a = await capture(api, html, url), b = await captureNoDebug(api, html, url);
  const A = new Map(a.removals.map(r => [r.fp, r])), B = new Map(b.removals.map(r => [r.fp, r]));
  for (const k of A.keys()) { if (B.has(k)) { both++; const x = A.get(k), y = B.get(k); if (x.step === 'removeBySelector') { selTot++; if (x.selector === y.selector) selAgree++; } } else onlyDebug++; }
  for (const k of B.keys()) if (!A.has(k)) onlyNo++;
}
console.log({ both, onlyDebug, onlyNo, selector_agreement: `${selAgree}/${selTot}` });
