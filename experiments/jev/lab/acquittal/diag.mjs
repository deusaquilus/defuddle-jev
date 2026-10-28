import { readFileSync, readdirSync } from 'node:fs';
import { loadApi, capture, fixtureUrl } from './harness.mjs';
const REPO = '/home/alexi/git/defuddle'; const api = loadApi(REPO + '/dist');
const files = readdirSync(REPO + '/tests/fixtures').filter(f => f.endsWith('.html')).sort();
const miss = {}; let shown = 0;
for (const f of files) {
  const name = f.replace(/\.html$/, ''); const html = readFileSync(`${REPO}/tests/fixtures/${f}`, 'utf8');
  const cap = await capture(api, html, fixtureUrl(name, html));
  const got = new Set(cap.removals.filter(r => r.final).map(r => r.step + '|' + r.reason + '|' + r.text.slice(0, 60)));
  for (const r of (cap.result?.debug?.removals || [])) {
    const k = r.step + '|' + (r.reason || '') + '|' + (r.text || '').replace(/[ \s]+/g, ' ').trim().slice(0, 60);
    if (!got.has(k)) { const key = r.step + ' / ' + (r.reason || '').replace(/partial match: .*/, 'partial').replace(/score: .*/, 'score'); miss[key] = (miss[key] || 0) + 1; if (shown < 6) { shown++; console.log('MISS', name, JSON.stringify(r).slice(0, 200)); } }
  }
}
console.log(miss);
