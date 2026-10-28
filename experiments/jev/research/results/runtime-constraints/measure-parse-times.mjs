// Measures Defuddle parse time per fixture using the Node build (dist/node.js) under linkedom,
// with network disabled, mirroring tests/perf.test.ts. Writes JSON + prints a distribution.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const { DefuddleClass } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const dir = join(REPO, 'tests/fixtures');
const offlineFetch = async () => { throw new Error('network disabled'); };
const rows = [];
const stepTotals = {};
for (const file of readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
	const html = readFileSync(join(dir, file), 'utf8');
	const name = basename(file, '.html');
	const url = `https://${name.replace(/^[a-z]+--/, '').replace(/:/g, '/')}`;
	// warm-up run discarded? No: single cold run per fixture like perf.test.ts; JIT warms across fixtures.
	const t0 = performance.now();
	const doc = parseLinkedomHTML(html, url);
	const t1 = performance.now();
	const d = new DefuddleClass(doc, { url, profile: true, fetch: offlineFetch });
	const res = await d.parseAsync();
	const t2 = performance.now();
	const row = { name, bytes: html.length, domMs: +(t1 - t0).toFixed(1), parseMs: +(t2 - t1).toFixed(1), words: res.wordCount, profile: res.profile ?? {} };
	for (const [k, v] of Object.entries(row.profile)) stepTotals[k] = (stepTotals[k] ?? 0) + v;
	rows.push(row);
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const pm = rows.map(r => r.parseMs), dm = rows.map(r => r.domMs);
const summary = {
	n: rows.length,
	parseMs: { p50: q(pm, .5), p90: q(pm, .9), p99: q(pm, .99), max: Math.max(...pm), sum: +pm.reduce((a, b) => a + b, 0).toFixed(0) },
	domMs: { p50: q(dm, .5), p90: q(dm, .9), max: Math.max(...dm), sum: +dm.reduce((a, b) => a + b, 0).toFixed(0) },
	stepTotals: Object.fromEntries(Object.entries(stepTotals).sort((a, b) => b[1] - a[1])),
	slowest: [...rows].sort((a, b) => b.parseMs - a.parseMs).slice(0, 10).map(r => ({ name: r.name, kb: +(r.bytes / 1024).toFixed(0), parseMs: r.parseMs, domMs: r.domMs, words: r.words })),
};
writeFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/runtime-constraints/parse-times.json', JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
