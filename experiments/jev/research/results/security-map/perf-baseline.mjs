// Parse-latency baseline across all fixtures (linkedom), to compare against Jev call latency.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const { Defuddle } = await import('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = await import('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const dir = '/home/alexi/git/defuddle/tests/fixtures';
const files = readdirSync(dir).filter(f => f.endsWith('.html'));
const times = [];
for (const f of files) {
  const html = readFileSync(join(dir, f), 'utf8');
  const doc = parseLinkedomHTML(html, 'https://example.com/' + f);
  const t0 = performance.now();
  await Defuddle(doc, 'https://example.com/' + f, { useAsync: false });
  times.push({ f, ms: performance.now() - t0, bytes: html.length });
}
times.sort((a, b) => a.ms - b.ms);
const q = p => times[Math.min(times.length - 1, Math.floor(p * times.length))].ms;
const out = { n: times.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: times[times.length - 1], total: times.reduce((s, t) => s + t.ms, 0) };
console.log(JSON.stringify(out, null, 1));
writeFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/security-map/perf-baseline.json', JSON.stringify({ ...out, times }, null, 1));
