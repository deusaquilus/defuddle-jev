import { readFileSync, readdirSync } from 'node:fs';
import { loadApi, capture, fixtureUrl } from './harness.mjs';
const REPO = '/home/alexi/git/defuddle'; const api = loadApi(REPO + '/dist');
const rows = [];
for (const f of readdirSync(REPO + '/tests/fixtures').filter(f => f.endsWith('.html')).sort()) {
  const name = f.replace(/\.html$/, ''); const html = readFileSync(`${REPO}/tests/fixtures/${f}`, 'utf8');
  const cap = await capture(api, html, fixtureUrl(name, html));
  rows.push([name, cap.stats.recorded_final, cap.stats.captured_final, cap.stats.captured, cap.stats.passes, cap.stats.dropped_from_queue]);
}
rows.sort((a, b) => (b[1] - b[2]) - (a[1] - a[2]));
console.log('name recorded_final captured_final captured_all passes dropped'); for (const r of rows.slice(0, 12)) console.log(r.join(' '));
