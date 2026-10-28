// Re-derive ground-truth labels for the existing 1,475 units with whitespace-correct text matching.
// The original builder (/home/alexi/git/defuddle/experiments/jev/research/build-block-dataset.mjs) used body.textContent of Defuddle's
// output HTML, which glues adjacent block elements ("...YouTube UI↩That's to say..."), so short units
// (headings, footnote items, list items) lost their shingles and were labeled 'removed' although the
// human-reviewed tests/expected/<fixture>.md keeps them. This script recomputes coverage against
// (a) Defuddle's output HTML with a space inserted after every tag and (b) the expected Markdown body
// (JSON preamble stripped, link URLs/images/tags removed), both punctuation-insensitive.
// No API calls. Run: node relabel.mjs   -> writes labels-corrected.jsonl and relabel-summary.json
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification';
const DATASET = '/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl';

const units = readFileSync(DATASET, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const byFixture = new Map();
for (const u of units) { if (!byFixture.has(u.fixture)) byFixture.set(u.fixture, []); byFixture.get(u.fixture).push(u); }

const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/[​‌‍﻿]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = s => norm(s).split(' ').filter(Boolean);
function shingles(ws, n = 5) { const out = []; for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(' ')); return out; }
function spacedText(html) {
	// insert a space after every tag so block/inline boundaries never glue words; drop script/style/svg/math annotations
	const doc = parseLinkedomHTML(`<html><body>${html.replace(/>/g, '> ')}</body></html>`);
	for (const el of Array.from(doc.querySelectorAll('script, style, noscript, template'))) el.remove();
	return doc.body ? doc.body.textContent : '';
}
function mdBody(fixture) {
	let raw = readFileSync(join(REPO, 'tests/expected', fixture + '.md'), 'utf8');
	raw = raw.replace(/^\s*```json[\s\S]*?```\s*/m, '');
	raw = raw.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')   // images -> alt
		.replace(/\]\([^)]*\)/g, '] ')                       // links -> text
		.replace(/<[^>]+>/g, ' ');                           // raw html tags
	return raw;
}
function coverage(unitWords, textWordSet, textJoined) {
	if (unitWords.length < 3) return null;
	if (unitWords.length < 5) return textJoined.includes(' ' + unitWords.join(' ') + ' ') ? 1 : 0;
	const sh = shingles(unitWords); let hit = 0; for (const s of sh) if (textWordSet.has(s)) hit++;
	return hit / sh.length;
}

const silent = fn => { const c = { ...console }; console.log = console.info = console.warn = console.debug = () => {}; try { return fn(); } finally { Object.assign(console, c); } };
const offlineFetch = async () => { throw new Error('network disabled'); };

const out = [];
const summary = { fixtures: 0, units: units.length, flips: { removed_to_kept: 0, kept_to_removed: 0, to_mixed: 0, unchanged: 0 }, policy: 0, mixed: 0, by_orig_label: {} };
for (const [fixture, us] of byFixture) {
	const html = readFileSync(join(REPO, 'tests/fixtures', fixture + '.html'), 'utf8');
	const url = us[0].url;
	const doc = parseLinkedomHTML(html, url);
	const result = await silent(() => Defuddle(doc, url, { debug: true, fetch: offlineFetch }));
	const outText = spacedText(result.content || '');
	const outWords = words(outText); const outSet = new Set(shingles(outWords)); const outJoined = ' ' + outWords.join(' ') + ' ';
	const md = mdBody(fixture);
	const mdWords = words(md); const mdSet = new Set(shingles(mdWords)); const mdJoined = ' ' + mdWords.join(' ') + ' ';
	const title = norm(result.title || us[0].page_title || '');
	summary.fixtures++;
	for (const u of us) {
		const truncated = u.html.endsWith('<!-- truncated -->');
		const uw = truncated ? words(u.text) : words(spacedText(u.html));
		const covOut = coverage(uw, outSet, outJoined);
		const covMd = coverage(uw, mdSet, mdJoined);
		const cov = Math.max(covOut ?? 0, covMd ?? 0);
		// <3 alphanumeric words after normalization (e.g. "int main() {", "Nat : Type"): cannot re-judge, keep the original label
		const fallback = covOut === null && covMd === null;
		let label = fallback ? u.label : cov >= 0.9 ? 'kept' : cov <= 0.1 ? 'removed' : 'mixed';
		const nt = norm(u.text);
		const isTitle = !!title && (nt === title || (uw.length <= 20 && nt.length > 10 && title.includes(nt)) || (u.tag === 'h1' && title.length > 0 && (title.includes(nt) || nt.includes(title))));
		const policy = isTitle || u.hints.looks_byline || u.hints.looks_date;
		const rec = { id: u.id, fixture, label_orig: u.label, label_corr: label, cov_out: covOut === null ? null : +covOut.toFixed(3), cov_md: covMd === null ? null : +covMd.toFixed(3), words_corr: uw.length, is_title: isTitle, policy, truncated, fallback };
		out.push(rec);
		if (label === 'mixed') { summary.flips.to_mixed++; summary.mixed++; }
		else if (label === u.label) summary.flips.unchanged++;
		else if (u.label === 'removed') summary.flips.removed_to_kept++;
		else summary.flips.kept_to_removed++;
		if (policy) summary.policy++;
		const k = `${u.label} -> ${label}`; summary.by_orig_label[k] = (summary.by_orig_label[k] || 0) + 1;
	}
}
writeFileSync(join(DIR, 'labels-corrected.jsonl'), out.map(r => JSON.stringify(r)).join('\n') + '\n');
summary.corrected_counts = { kept: out.filter(r => r.label_corr === 'kept').length, removed: out.filter(r => r.label_corr === 'removed').length, mixed: out.filter(r => r.label_corr === 'mixed').length };
summary.corrected_removed_policy = out.filter(r => r.label_corr === 'removed' && r.policy).length;
summary.corrected_kept_policy = out.filter(r => r.label_corr === 'kept' && r.policy).length;
writeFileSync(join(DIR, 'relabel-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
// show flips for eyeballing
const byId = new Map(units.map(u => [u.id, u]));
console.log('\n--- kept -> removed flips:');
for (const r of out.filter(r => r.label_orig === 'kept' && r.label_corr === 'removed')) console.log(r.id, '|', byId.get(r.id).text.slice(0, 100), '| cov_out', r.cov_out, 'cov_md', r.cov_md);
console.log('\n--- removed -> kept flips (first 40):');
for (const r of out.filter(r => r.label_orig === 'removed' && r.label_corr === 'kept').slice(0, 40)) console.log(r.id, '|', byId.get(r.id).tag, '|', byId.get(r.id).text.slice(0, 80), '| cov_out', r.cov_out, 'cov_md', r.cov_md, r.policy ? '| POLICY' : '');
console.log('\n--- mixed (first 40):');
for (const r of out.filter(r => r.label_corr === 'mixed').slice(0, 40)) console.log(r.id, '|', r.label_orig, '|', byId.get(r.id).tag, '|', byId.get(r.id).text.slice(0, 80), '| cov_out', r.cov_out, 'cov_md', r.cov_md);
