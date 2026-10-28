// Tally every debug removal (step + reason) across all fixtures, using the dist build, offline.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const dir = join(REPO, 'tests/fixtures');
const files = readdirSync(dir).filter(f => f.endsWith('.html')).sort();
const offlineFetch = async () => { throw new Error('network disabled'); };
const byStep = {}, byReason = {}, partialPatterns = {}, fixturesWithStep = {}, selectorKinds = {};
let total = 0, fixtures = 0; const origLog = console.log; const origWarn = console.warn; const origErr = console.error;
for (const f of files) {
	const name = basename(f, '.html');
	const html = readFileSync(join(dir, f), 'utf8');
	const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/);
	const url = (fm ? JSON.parse(fm[1]).url : null) || `https://${name.replace(/^[a-z]+--/, '')}`;
	let res; console.log = () => {}; console.warn = () => {}; console.error = () => {}; try { res = await Defuddle(parseLinkedomHTML(html, url), url, { debug: true, fetch: offlineFetch }); } catch (e) { continue; } finally { console.log = origLog; console.warn = origWarn; console.error = origErr; }
	fixtures++;
	const seen = new Set();
	for (const r of res.debug?.removals || []) {
		total++;
		byStep[r.step] = (byStep[r.step] || 0) + 1;
		let reason = r.reason || '';
		if (r.step === 'removeBySelector') {
			const kind = reason.startsWith('partial') ? 'partial' : 'exact';
			selectorKinds[kind] = (selectorKinds[kind] || 0) + 1;
			if (kind === 'partial') { const p = reason.replace(/^partial match:\s*/, ''); partialPatterns[p] = (partialPatterns[p] || 0) + 1; }
			reason = r.step + ':' + kind;
		} else if (r.step === 'scoreAndRemove') reason = 'scoreAndRemove:score<0';
		else if (r.step === 'removeHiddenElements') reason = 'hidden:' + reason.replace(/class:.*/, 'class:*');
		else reason = r.step + ':' + reason;
		byReason[reason] = (byReason[reason] || 0) + 1;
		if (!seen.has(r.step)) { seen.add(r.step); fixturesWithStep[r.step] = (fixturesWithStep[r.step] || 0) + 1; }
	}
}
const sortObj = o => Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
const out = { fixtures, total_removals: total, byStep: sortObj(byStep), fixturesWithStep: sortObj(fixturesWithStep), selectorKinds, byReason: sortObj(byReason), topPartialPatterns: Object.fromEntries(Object.entries(sortObj(partialPatterns)).slice(0, 40)), distinctPartialPatternsFired: Object.keys(partialPatterns).length };
writeFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/extraction-decision-inventory/removal-reasons.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
