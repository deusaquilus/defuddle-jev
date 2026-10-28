// End-to-end: if findMainContent were replaced by Jev's container pick (passed as contentSelector),
// how many fixture tests would still pass byte-for-byte against tests/expected? Offline, no API.
// Run: node /home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container/e2e-swap.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const { parseHTML, serializeHTML } = require(join(REPO, 'dist/utils/dom.js'));
const { ENTRY_POINT_ELEMENTS, BLOCK_LEVEL_ELEMENTS } = require(join(REPO, 'dist/constants.js'));
const { ContentScorer } = require(join(REPO, 'dist/removals/scoring.js'));
const offlineFetch = () => Promise.reject(new Error('network disabled'));

// --- harness port (tests/helpers.ts) ---
function normalizeHtmlAttributes(html) {
	const doc = parseLinkedomHTML('<html><body></body></html>');
	const container = doc.createElement('div');
	container.appendChild(parseHTML(doc, html));
	for (const el of container.querySelectorAll('*')) {
		const attributes = Array.from(el.attributes).map(a => [a.name, a.value]);
		for (const [name] of attributes) el.removeAttribute(name);
		for (const [name, value] of attributes.sort(([a], [b]) => a.localeCompare(b))) el.setAttribute(name, value);
	}
	return serializeHTML(container);
}
function normalizeMarkdownHtml(markdown) {
	let fence = '', prose = '', result = '';
	const flush = () => { result += prose.replace(/<svg\b[\s\S]*?<\/svg>/gi, normalizeHtmlAttributes); prose = ''; };
	for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) || []) {
		const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)/);
		if (fence) { result += line; if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = ''; }
		else if (marker) { flush(); fence = marker[1]; result += line; }
		else prose += line;
	}
	flush();
	return result;
}
function comparable(response) {
	const meta = { title: response.title, author: response.author, site: response.site, published: response.published };
	return '```json\n' + JSON.stringify(meta, null, 2) + '\n```\n\n' + response.contentMarkdown;
}

// --- candidate collection (identical to build-candidates.mjs) ---
const MIN_WORDS = 30, MAX_CANDS = 12;
const BLOCK_TAGS = new Set([...BLOCK_LEVEL_ELEMENTS, 'br', 'tr', 'td', 'th', 'li', 'option', 'img', 'hr', 'caption', 'label', 'button']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template']);
function visibleText(el) { const parts = []; (function walk(n) { if (n.nodeType === 3) { parts.push(n.data); return; } if (n.nodeType !== 1) return; const t = n.tagName.toLowerCase(); if (SKIP_TAGS.has(t)) return; const b = BLOCK_TAGS.has(t); if (b) parts.push(' '); for (const c of n.childNodes) walk(c); if (b) parts.push(' '); })(el); return parts.join(''); }
const normalize = t => (t || '').normalize('NFKC').replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const words = t => normalize(t).split(' ').filter(Boolean);
function collectCandidates(doc) {
	const allEls = Array.from(doc.querySelectorAll('*'));
	const docIndex = new Map(allEls.map((el, i) => [el, i]));
	const seen = new Map();
	ENTRY_POINT_ELEMENTS.forEach((sel, i) => { let m = []; try { m = Array.from(doc.querySelectorAll(sel)); } catch {} for (const el of m) if (!seen.has(el)) seen.set(el, i); });
	let cands = [];
	for (const [el, selectorIndex] of seen) { const ws = words(visibleText(el)); if (ws.length < MIN_WORDS) continue; let s = (ENTRY_POINT_ELEMENTS.length - selectorIndex) * 40; try { s += ContentScorer.scoreElement(el); } catch {} cands.push({ el, ws, defuddleScore: s, docIndex: docIndex.get(el) ?? 1e9 }); }
	if (cands.length > MAX_CANDS) { cands.sort((a, b) => b.defuddleScore - a.defuddleScore); cands = cands.slice(0, MAX_CANDS); }
	cands.sort((a, b) => a.docIndex - b.docIndex);
	cands.forEach((c, i) => c.id = `c${i + 1}`);
	return cands;
}

const fixtures = readFileSync(`${OUT}/candidates.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
const load = f => Object.fromEntries(readFileSync(`${OUT}/${f}`, 'utf8').trim().split('\n').map(JSON.parse).map(r => [r.name, r]));
const R = { A: load('jev_A.jsonl'), A2: load('jev_A2.jsonl'), B: load('jev_B.jsonl'), C: load('jev_C.jsonl'), D: load('jev_D.jsonl') };
const ATTR = 'data-zq';

async function runWithPick(html, url, pickId, cands) {
	// pickId: 'cK' | null (baseline, no contentSelector)
	const doc = parseLinkedomHTML(html, url);
	let opts = { separateMarkdown: true, fetch: offlineFetch };
	if (pickId) {
		const fresh = collectCandidates(doc);
		if (fresh.length !== cands.length) throw new Error(`candidate count mismatch ${fresh.length} vs ${cands.length}`);
		const target = fresh.find(c => c.id === pickId);
		if (!target) throw new Error(`pick ${pickId} not found`);
		const d = cands.find(c => c.id === pickId);
		if (target.el.tagName.toLowerCase() !== d.tag || target.ws.length !== d.word_count) throw new Error(`candidate mismatch for ${pickId}: ${target.el.tagName}/${target.ws.length} vs ${d.tag}/${d.word_count}`);
		target.el.setAttribute(ATTR, '1');
		opts.contentSelector = `[${ATTR}="1"]`;
	}
	const res = await Defuddle(doc, url, opts);
	return comparable(res);
}

const policies = {
	baseline: () => null,
	oracle_truth: (fx) => fx.truth === 'none_of_these' ? null : fx.truth,
	jev_A: (fx) => R.A[fx.name]?.choice && R.A[fx.name].choice !== 'none_of_these' ? R.A[fx.name].choice : null,
	jev_A_conf_ge_0_5_else_default: (fx) => { const r = R.A[fx.name]; return r && r.choice !== 'none_of_these' && r.confidence >= 0.5 ? r.choice : null; },
	jev_A_conf_ge_0_9_else_default: (fx) => { const r = R.A[fx.name]; return r && r.choice !== 'none_of_these' && r.confidence >= 0.9 ? r.choice : null; },
	jev_A2: (fx) => R.A2[fx.name]?.choice && R.A2[fx.name].choice !== 'none_of_these' ? R.A2[fx.name].choice : null,
	jev_B: (fx) => R.B[fx.name]?.choice && R.B[fx.name].choice !== 'none_of_these' ? R.B[fx.name].choice : null,
	jev_C: (fx) => R.C[fx.name]?.choice && R.C[fx.name].choice !== 'none_of_these' ? R.C[fx.name].choice : null,
	jev_D: (fx) => R.D[fx.name]?.choice && R.D[fx.name].choice !== 'none_of_these' ? R.D[fx.name].choice : null,
};
const results = {}; const perFixture = [];
for (const name of Object.keys(policies)) results[name] = { pass: 0, fail: 0, error: 0, fails: [], errors: [], used_default: 0 };
for (const fx of fixtures) {
	const html = readFileSync(join(REPO, 'tests/fixtures', fx.name + '.html'), 'utf8');
	const expected = normalizeMarkdownHtml(readFileSync(join(REPO, 'tests/expected', fx.name + '.md'), 'utf8').trim());
	const row = { name: fx.name, n: fx.n_candidates, truth: fx.truth };
	const cache = new Map();
	for (const [pname, pf] of Object.entries(policies)) {
		const pick = pf(fx);
		if (pick === null) results[pname].used_default++;
		try {
			let got = cache.get(pick ?? '__default__');
			if (got === undefined) { got = normalizeMarkdownHtml((await runWithPick(html, fx.url, pick, fx.candidates)).trim()); cache.set(pick ?? '__default__', got); }
			const ok = got === expected;
			row[pname] = `${pick ?? 'default'}:${ok ? 'PASS' : 'FAIL'}`;
			if (ok) results[pname].pass++; else { results[pname].fail++; results[pname].fails.push({ name: fx.name, pick, truth: fx.truth, n: fx.n_candidates, gotWords: got.split(/\s+/).length, expWords: expected.split(/\s+/).length }); }
		} catch (e) { results[pname].error++; results[pname].errors.push({ name: fx.name, pick, error: String(e.message || e).slice(0, 200) }); row[pname] = `${pick}:ERROR`; }
	}
	perFixture.push(row);
}
for (const p of Object.values(results)) p.pass_rate_pct = +(100 * p.pass / fixtures.length).toFixed(1);
writeFileSync(`${OUT}/e2e_swap_results.json`, JSON.stringify({ n_fixtures: fixtures.length, results, perFixture }, null, 2));
const { perFixture: _pf, ...summary } = { results };
console.log(JSON.stringify(summary, null, 1));
