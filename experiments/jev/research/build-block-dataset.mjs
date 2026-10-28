// Build a labeled block dataset from Defuddle fixtures.
// Label = what Defuddle's current (test-verified) pipeline keeps vs removes, which equals the
// human-reviewed expected output in tests/expected. Run: node /home/alexi/git/defuddle/experiments/jev/research/build-block-dataset.mjs
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));

const OUT_DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/dataset';
mkdirSync(OUT_DIR, { recursive: true });

const BLOCK_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 'HEADER', 'FOOTER', 'NAV', 'P', 'UL', 'OL', 'LI',
	'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'FIGURE', 'FIGCAPTION', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
	'DL', 'DD', 'DT', 'FORM', 'DETAILS', 'SUMMARY', 'BODY', 'ADDRESS', 'FIELDSET', 'CENTER', 'FONT', 'SPAN', 'A', 'LABEL', 'BUTTON']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'IFRAME']);
const MAX_UNIT_WORDS = 300;
const MIN_UNIT_WORDS = 3;

function normalize(text) {
	return (text || '').normalize('NFKC').replace(/[ \s]+/g, ' ').replace(/[​‌‍﻿]/g, '').trim().toLowerCase();
}
function words(text) { return normalize(text).split(' ').filter(Boolean); }
function shingles(ws, n = 5) {
	const out = [];
	for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(' '));
	return out;
}

function cleanHtml(html, max = 6000) {
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

function pathOf(el) {
	const parts = [];
	let node = el;
	while (node && node.tagName && node.tagName !== 'BODY' && parts.length < 6) {
		let s = node.tagName.toLowerCase();
		if (node.id) s += '#' + node.id;
		const cls = (typeof node.className === 'string' ? node.className : node.getAttribute?.('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
		if (cls.length) s += '.' + cls.join('.');
		parts.unshift(s);
		node = node.parentElement;
	}
	return parts.join(' > ');
}

const DATE_RE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:, \d{4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2} (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d{4}\b/i;
const BYLINE_RE = /^(?:by|written by|posted by|author:?)\s+\S/i;

function statusOf(unitText, outputWords, outputShingleSet, outputText) {
	const ws = words(unitText);
	if (ws.length < MIN_UNIT_WORDS) return { status: 'tiny', coverage: null };
	if (ws.length < 5) {
		const present = outputText.includes(ws.join(' '));
		return { status: present ? 'kept' : 'removed', coverage: present ? 1 : 0 };
	}
	const sh = shingles(ws);
	let hit = 0;
	for (const s of sh) if (outputShingleSet.has(s)) hit++;
	const coverage = hit / sh.length;
	if (coverage >= 0.9) return { status: 'kept', coverage };
	if (coverage <= 0.1) return { status: 'removed', coverage };
	return { status: 'mixed', coverage };
}

const fixturesDir = join(REPO, 'tests/fixtures');
const files = readdirSync(fixturesDir).filter(f => f.endsWith('.html')).sort();
const offlineFetch = async () => { throw new Error('network disabled'); };

const units = [];
const perFixture = [];
let fixtureIndex = 0;
for (const file of files) {
	const name = basename(file, '.html');
	const html = readFileSync(join(fixturesDir, file), 'utf-8');
	const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/);
	const frontmatter = fm ? JSON.parse(fm[1]) : {};
	const urlName = name.replace(/^[a-z]+--/, '');
	const url = frontmatter.url || `https://${urlName}`;

	let result;
	try {
		const docA = parseLinkedomHTML(html, url);
		result = await Defuddle(docA, url, { debug: true, fetch: offlineFetch });
	} catch (e) {
		perFixture.push({ name, url, error: String(e.message || e) });
		continue;
	}
	// Text of the final output
	const outDoc = parseLinkedomHTML(`<html><body>${result.content}</body></html>`);
	const outputText = normalize(outDoc.body?.textContent || '');
	const outputWords = outputText.split(' ').filter(Boolean);
	const outputShingleSet = new Set(shingles(outputWords));
	const title = normalize(result.title || '');

	// Independent parse for unit extraction (Defuddle mutates the live doc slightly)
	const docB = parseLinkedomHTML(html, url);
	const body = docB.body;
	const fx = { name, url, title: result.title, extractorType: result.extractorType || null, outputWords: outputWords.length,
		contentSelector: result.debug?.contentSelector || '', removals: (result.debug?.removals || []).length, units: 0, kept: 0, removed: 0, mixedDescended: 0 };
	const removalPreviews = (result.debug?.removals || []).map(r => ({ step: r.step, reason: r.reason, selector: r.selector, text: normalize(r.text).slice(0, 120) }));

	function emit(el, st, depth) {
		const text = (el.textContent || '').trim();
		const ws = words(text);
		const ntext = normalize(text);
		const prev = ntext.slice(0, 120);
		const removal = removalPreviews.find(r => r.text && (prev.startsWith(r.text.slice(0, 60)) || r.text.startsWith(prev.slice(0, 60))));
		const cls = (typeof el.className === 'string' ? el.className : el.getAttribute('class') || '');
		units.push({
			id: `${name}#${fx.units}`,
			fixture: name,
			url,
			page_title: result.title || '',
			extractor: result.extractorType || null,
			label: st.status,
			coverage: st.coverage,
			tag: el.tagName.toLowerCase(),
			class: cls.slice(0, 200),
			elid: el.id || '',
			path: pathOf(el),
			depth,
			words: ws.length,
			hints: {
				is_title: !!title && (ntext === title || (ws.length <= 20 && title.includes(ntext) && ntext.length > 10)),
				looks_byline: BYLINE_RE.test(text) && ws.length < 15,
				looks_date: DATE_RE.test(text) && ws.length < 20,
				in_landmark: !!el.closest('nav, header, footer, aside'),
				has_link_density: (() => { let l = 0; for (const a of el.querySelectorAll('a')) l += (a.textContent || '').length; return +(l / Math.max(1, text.length)).toFixed(2); })(),
				removal_step: removal?.step || null,
				removal_reason: removal?.reason || null,
				removal_selector: removal?.selector || null,
			},
			html: cleanHtml(el.outerHTML),
			text: text.replace(/\s+/g, ' ').slice(0, 3000),
		});
		fx.units++;
		if (st.status === 'kept') fx.kept++; else fx.removed++;
	}

	function walk(el, depth) {
		if (!el || !el.tagName) return;
		const tag = el.tagName.toUpperCase();
		if (SKIP_TAGS.has(tag)) return;
		const isBlock = BLOCK_TAGS.has(tag);
		const text = el.textContent || '';
		const ws = words(text);
		if (ws.length < MIN_UNIT_WORDS) return;
		if (isBlock && tag !== 'BODY') {
			const st = statusOf(text, outputWords, outputShingleSet, outputText);
			if ((st.status === 'kept' || st.status === 'removed') && ws.length <= MAX_UNIT_WORDS) {
				emit(el, st, depth);
				return;
			}
			if (st.status === 'mixed') fx.mixedDescended++;
			// homogeneous but too large, or mixed: descend; if nothing below qualifies, emit truncated
			const before = units.length;
			for (const child of Array.from(el.children)) walk(child, depth + 1);
			if (units.length === before && st.status !== 'mixed' && st.status !== 'tiny') emit(el, st, depth);
			return;
		}
		for (const child of Array.from(el.children)) walk(child, depth + 1);
	}
	walk(body, 0);
	perFixture.push(fx);
	fixtureIndex++;
}

writeFileSync(join(OUT_DIR, 'blocks.jsonl'), units.map(u => JSON.stringify(u)).join('\n') + '\n');
writeFileSync(join(OUT_DIR, 'fixtures.json'), JSON.stringify(perFixture, null, 2));
const kept = units.filter(u => u.label === 'kept').length;
const removed = units.filter(u => u.label === 'removed').length;
const byExtractor = units.filter(u => u.extractor).length;
const totalChars = units.reduce((s, u) => s + u.html.length, 0);
const summary = {
	fixtures: perFixture.length,
	fixtures_with_error: perFixture.filter(f => f.error).length,
	units: units.length, kept, removed,
	units_from_extractor_fixtures: byExtractor,
	units_title_hint: units.filter(u => u.hints.is_title).length,
	units_byline_or_date_hint: units.filter(u => u.hints.looks_byline || u.hints.looks_date).length,
	total_html_chars: totalChars,
	est_input_tokens_html_state: Math.round(totalChars / 3.5),
	words_distribution: (() => { const w = units.map(u => u.words).sort((a, b) => a - b); const p = q => w[Math.floor(q * (w.length - 1))]; return { min: w[0], p25: p(0.25), p50: p(0.5), p75: p(0.75), p90: p(0.9), max: w[w.length - 1] }; })(),
	removed_by_step: units.filter(u => u.label === 'removed').reduce((m, u) => { const k = u.hints.removal_step || 'unmatched'; m[k] = (m[k] || 0) + 1; return m; }, {}),
};
writeFileSync(join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
