// Shared helpers for exp-adversarial-determinism. NEVER log process.env.JEV_API_KEY.
// Run scripts via: bash -ic 'node <script>.mjs'
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

export const DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-adversarial-determinism';
export const DATASET = '/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl';
export const CORRECTED = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/labels-corrected.jsonl';
export const REPO = '/home/alexi/git/defuddle';
export const MODEL = 'jev-1.14.0';
export const SEED = 20261027;
export const CONCURRENCY = 6;

const require = createRequire(import.meta.url);
export const { Defuddle } = require(`${REPO}/dist/node.js`);
export const { parseLinkedomHTML } = require(`${REPO}/dist/utils/linkedom-compat.js`);
export const offlineFetch = async () => { throw new Error('network disabled'); };

export function loadUnits() {
	return readFileSync(DATASET, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}
export function loadCorrected() {
	const m = new Map();
	for (const line of readFileSync(CORRECTED, 'utf8').trim().split('\n')) { const r = JSON.parse(line); m.set(r.id, r); }
	return m;
}

// mulberry32 seeded PRNG
export function rng(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function shuffled(arr, seed) {
	const r = rng(seed);
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
	return a;
}

export const KEEP_INSTRUCTIONS =
	"Should this block be kept in a clean reader-mode view of the page's main article? " +
	"Keep = it is part of the article's own body text, headings, images/figures, code, tables, quotes or footnotes. " +
	"Do not keep = site navigation, ads, promotions, newsletter/subscribe or sign-in prompts, social sharing, " +
	"related/recommended/more-stories links, comment sections, cookie/consent banners, author bylines, dates, " +
	"tags/categories, breadcrumbs, read-time, or other page boilerplate.";

export const KEEP_CRITERIA = {
	true: "Keep: the block is part of the article's own content",
	false: "Do not keep: the block is navigation, promotion, metadata, comments or other page boilerplate",
};

export const CLUTTER_INSTRUCTIONS =
	"Is this block page clutter that should be removed from a reader-mode view (navigation, ads, promos, related links, comments, banners, bylines/metadata, boilerplate)?";
export const CLUTTER_CRITERIA = {
	true: "Clutter: remove the block from the reader view",
	false: "Not clutter: the block is part of the article's own content",
};

export const CHOICE_INSTRUCTIONS =
	"In a clean reader-mode view of the page's main article, should this block be kept or removed?";
export const CHOICE_KEEP_DESC = "Keep: the block is part of the article's own body text, headings, images/figures, code, tables, quotes or footnotes";
export const CHOICE_REMOVE_DESC = "Remove: the block is site navigation, ads, promotions, newsletter/subscribe or sign-in prompts, social sharing, related/recommended links, comments, cookie/consent banners, author bylines, dates, tags/categories, breadcrumbs, read-time or other page boilerplate";

export function keepQuestion() { return { type: 'noul', instructions: KEEP_INSTRUCTIONS, criteria: KEEP_CRITERIA }; }
export function clutterQuestion() { return { type: 'noul', instructions: CLUTTER_INSTRUCTIONS, criteria: CLUTTER_CRITERIA }; }
export function choiceQuestion(reversed = false) {
	const criteria = reversed
		? { remove: CHOICE_REMOVE_DESC, keep: CHOICE_KEEP_DESC }
		: { keep: CHOICE_KEEP_DESC, remove: CHOICE_REMOVE_DESC };
	return { type: 'choice', instructions: CHOICE_INSTRUCTIONS, criteria };
}
// Context-dilution form: same keep instructions, but names the marked element.
export const KEEP_MARKED_INSTRUCTIONS =
	"Consider only the element marked data-judge=\"1\" in this HTML. " + KEEP_INSTRUCTIONS.replace('Should this block be kept', 'Should that element be kept');
export function keepMarkedQuestion() { return { type: 'noul', instructions: KEEP_MARKED_INSTRUCTIONS, criteria: KEEP_CRITERIA }; }

// ---- raw JSONL IO (resumable) ----
export function rawPath(name) { return `${DIR}/raw-${name}.jsonl`; }
export function appendRaw(name, rec) { appendFileSync(rawPath(name), JSON.stringify(rec) + '\n'); }
export function loadRaw(name) {
	const f = rawPath(name);
	if (!existsSync(f)) return [];
	return readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}
/** key(rec) -> latest successful record */
export function loadDone(name, keyFn) {
	const m = new Map();
	for (const r of loadRaw(name)) if (!r.error) m.set(keyFn(r), r);
	return m;
}
export function saveJson(name, obj) { writeFileSync(`${DIR}/${name}`, JSON.stringify(obj, null, 2)); }
export function loadJson(name) { return JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8')); }

// ---- HTML manipulation on the dataset's cleaned block HTML ----
const OPEN_TAG_RE = /^<([a-zA-Z0-9]+)([^>]*)>/;
export function splitOpenTag(html) {
	const m = html.match(OPEN_TAG_RE);
	if (!m) throw new Error('no opening tag: ' + html.slice(0, 80));
	return { tag: m[1], attrs: m[2], rest: html.slice(m[0].length) };
}
function stripAttr(attrs, name) {
	return attrs.replace(new RegExp(`\\s${name}=("[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'), '');
}
/** Replace (or add) root class; optionally drop root id. Attribute-only change. */
export function setRootClass(html, cls, { dropId = false } = {}) {
	const { tag, attrs, rest } = splitOpenTag(html);
	let a = stripAttr(attrs, 'class');
	if (dropId) a = stripAttr(a, 'id');
	return `<${tag} class="${cls}"${a}>${rest}`;
}
/** Insert a string right after the root opening tag. */
export function insertAfterOpen(html, s) {
	const { tag, attrs, rest } = splitOpenTag(html);
	return `<${tag}${attrs}>${s}${rest}`;
}
/** Insert a string right before the root closing tag (or at the end if truncated). */
export function insertBeforeClose(html, s) {
	const { tag } = splitOpenTag(html);
	const close = `</${tag}>`;
	const idx = html.lastIndexOf(close);
	if (idx < 0 || html.includes('<!-- truncated -->')) return html + s;
	return html.slice(0, idx) + s + html.slice(idx);
}

// ---- text normalization identical to build-block-dataset.mjs ----
export function normalize(text) {
	return (text || '').normalize('NFKC').replace(/[ \s]+/g, ' ').replace(/[​‌‍﻿]/g, '').trim().toLowerCase();
}
export function words(text) { return normalize(text).split(' ').filter(Boolean); }
export function shingles(ws, n = 5) {
	const out = [];
	for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(' '));
	return out;
}
/** Same presence test as the dataset builder: kept / removed / mixed / tiny */
export function presenceIn(unitText, outputText) {
	const ws = words(unitText);
	const outputWords = outputText.split(' ').filter(Boolean);
	if (ws.length < 3) return { status: 'tiny', coverage: null };
	if (ws.length < 5) { const present = outputText.includes(ws.join(' ')); return { status: present ? 'kept' : 'removed', coverage: present ? 1 : 0 }; }
	const set = new Set(shingles(outputWords));
	const sh = shingles(ws);
	let hit = 0; for (const s of sh) if (set.has(s)) hit++;
	const coverage = hit / sh.length;
	if (coverage >= 0.9) return { status: 'kept', coverage };
	if (coverage <= 0.1) return { status: 'removed', coverage };
	return { status: 'mixed', coverage };
}

export function cleanHtml(html, max = 6000) {
	let h = html
		.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, '<svg></svg>')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s(src|href|srcset|data-src)="data:[^"]{40,}"/gi, ' $1="data:..."')
		.replace(/="([^"]{200})[^"]*"/g, '="$1..."')
		.replace(/\s+/g, ' ');
	if (h.length > max) h = h.slice(0, max) + ' <!-- truncated -->';
	return h;
}

// ---- locating a dataset unit inside a freshly parsed fixture document ----
export function fixtureHtml(fixture) { return readFileSync(`${REPO}/tests/fixtures/${fixture}.html`, 'utf8'); }
export function fixtureUrl(fixture, html) {
	const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/);
	const frontmatter = fm ? JSON.parse(fm[1]) : {};
	return frontmatter.url || `https://${fixture.replace(/^[a-z]+--/, '')}`;
}
/**
 * Find the element for unit u in doc. Matches on tag + class + normalized text; for duplicate
 * matches, `dupRank` (rank of this unit among identical units in the same fixture, document order) picks one.
 */
export function locateUnit(doc, u, dupRank = 0) {
	const want = normalize(u.text);
	const wantCls = (u.class || '').slice(0, 200);
	const cands = [];
	for (const el of doc.querySelectorAll(u.tag)) {
		const cls = (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '').slice(0, 200);
		if (cls !== wantCls) continue;
		const t = normalize((el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 3000));
		if (t === want) cands.push(el);
	}
	// prefer the outermost matching element among nested identical-text elements (e.g. div > div)
	const outer = cands.filter(el => !cands.some(o => o !== el && o.contains(el)));
	const list = outer.length ? outer : cands;
	return list[Math.min(dupRank, list.length - 1)] || null;
}
export function dupRankOf(units, u) {
	const same = units.filter(x => x.fixture === u.fixture && x.tag === u.tag && x.class === u.class && normalize(x.text) === normalize(u.text));
	same.sort((a, b) => +a.id.split('#')[1] - +b.id.split('#')[1]);
	return same.findIndex(x => x.id === u.id);
}

/** Run Defuddle on an HTML string exactly as the dataset builder did; returns {result, outputText}. */
export async function runDefuddle(html, url) {
	const doc = parseLinkedomHTML(html, url);
	const result = await Defuddle(doc, url, { debug: true, fetch: offlineFetch });
	const outDoc = parseLinkedomHTML(`<html><body>${result.content}</body></html>`);
	const outputText = normalize(outDoc.body?.textContent || '');
	return { result, outputText };
}

export function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
export function quantile(a, q) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; }
export function r3(x) { return Math.round(x * 1000) / 1000; }
