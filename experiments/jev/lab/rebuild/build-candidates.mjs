// Phase 1 (offline, no API): build candidate container lists + ground truth for every fixture.
// Run: node /home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container/build-candidates.mjs
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const { ENTRY_POINT_ELEMENTS } = require(join(REPO, 'dist/constants.js'));
const { ContentScorer } = require(join(REPO, 'dist/removals/scoring.js'));
const OUT = '/home/alexi/git/defuddle/experiments/jev/lab/rebuild';

const MIN_WORDS = 30;
const MAX_CANDS = 12;
const TRUTH_COVERAGE = 0.9;
const VARIANT_C_MAX_TOKENS = 25000;

function normalize(text) {
	return (text || '').normalize('NFKC').replace(/[​‌‍﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}
function words(text) { return normalize(text).split(' ').filter(Boolean); }
function shingles(ws, n = 5) {
	const out = [];
	for (let i = 0; i + n <= ws.length; i++) out.push(ws.slice(i, i + n).join(' '));
	return out;
}
function className(el) {
	const c = typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '';
	return c.split(/[\t\n\f\r ]+/).filter(Boolean);
}
// Text of an element: skips script/style/noscript/template subtrees, inserts whitespace at block
// boundaries and <br> (linkedom textContent neither skips scripts nor separates blocks).
const BLOCK_TAGS = new Set([...require(join(REPO, 'dist/constants.js')).BLOCK_LEVEL_ELEMENTS, 'br', 'tr', 'td', 'th', 'li', 'option', 'img', 'hr', 'caption', 'label', 'button']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template']);
function visibleText(el, opts = {}) {
	const parts = [];
	(function walk(node) {
		if (node.nodeType === 3) { parts.push(node.data); return; }
		if (node.nodeType !== 1) return;
		const tag = node.tagName.toLowerCase();
		if (SKIP_TAGS.has(tag)) return;
		if (opts.skipCode && (tag === 'pre' || tag === 'code')) { parts.push(' '); return; }
		const block = BLOCK_TAGS.has(tag);
		if (block) parts.push(' ');
		for (const child of node.childNodes) walk(child);
		if (block) parts.push(' ');
	})(el);
	return parts.join('');
}
function cleanPageHtml(html) {
	return html
		.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, '<svg></svg>')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s(src|href|srcset|data-src|data-srcset|poster|content)="data:[^"]{40,}"/gi, ' $1="data:..."')
		.replace(/="([^"]{150})[^"]*"/g, '="$1..."')
		.replace(/\s+/g, ' ')
		.replace(/> </g, '><');
}
// Order-insensitive containment: fraction of output words (multiset) present in the candidate's words.
function multisetCoverage(outWs, candWs) {
	const counts = new Map();
	for (const w of candWs) counts.set(w, (counts.get(w) || 0) + 1);
	let hit = 0;
	for (const w of outWs) { const c = counts.get(w) || 0; if (c > 0) { hit++; counts.set(w, c - 1); } }
	return outWs.length ? hit / outWs.length : 0;
}
const estimateTokens = (text, isHtml = false) => Math.ceil(text.length / (isHtml ? 3.5 : 4));

const fixturesDir = join(REPO, 'tests/fixtures');
const files = readdirSync(fixturesDir).filter(f => f.endsWith('.html')).sort();
const offlineFetch = () => Promise.reject(new Error('network disabled in experiment'));

const kept = [];
const log = [];
for (const file of files) {
	const name = basename(file, '.html');
	const html = readFileSync(join(fixturesDir, file), 'utf-8');
	const htmlBytes = statSync(join(fixturesDir, file)).size;
	const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/);
	const frontmatter = fm ? JSON.parse(fm[1]) : {};
	const url = frontmatter.url || `https://${name.replace(/^[a-z]+--/, '')}`;
	const entry = { name, url, htmlBytes, status: 'kept' };

	let result;
	try {
		result = await Defuddle(parseLinkedomHTML(html, url), url, { debug: true, fetch: offlineFetch });
	} catch (e) {
		entry.status = 'defuddle_error'; entry.error = String(e.message || e); log.push(entry); continue;
	}
	entry.extractorType = result.extractorType || null;
	entry.contentSelector = result.debug?.contentSelector || '';
	entry.title = result.title || '';
	if (result.extractorType) { entry.status = 'skipped_extractor'; log.push(entry); continue; }

	// Output text (what defuddle kept) -> shingles
	const outDoc = parseLinkedomHTML(`<html><body>${result.content}</body></html>`);
	const outWords = words(visibleText(outDoc.body));
	const outShingles = shingles(outWords);
	entry.outputWords = outWords.length;
	if (outShingles.length === 0) { entry.status = 'skipped_tiny_output'; log.push(entry); continue; }
	const outShingleSet = new Set(outShingles);
	const outWordsNoCode = words(visibleText(outDoc.body, { skipCode: true }));
	const outShinglesNoCode = shingles(outWordsNoCode);

	// Fresh parse: candidate containers
	const doc = parseLinkedomHTML(html, url);
	const allEls = Array.from(doc.querySelectorAll('*'));
	const docIndex = new Map(allEls.map((el, i) => [el, i]));
	const seen = new Map(); // el -> selectorIndex (first/highest-priority match)
	ENTRY_POINT_ELEMENTS.forEach((selector, index) => {
		let matches = [];
		try { matches = Array.from(doc.querySelectorAll(selector)); } catch { /* ignore */ }
		for (const el of matches) if (!seen.has(el)) seen.set(el, index);
	});
	let cands = [];
	for (const [el, selectorIndex] of seen) {
		const text = visibleText(el);
		const ws = words(text);
		if (ws.length < MIN_WORDS) continue;
		let defuddleScore = (ENTRY_POINT_ELEMENTS.length - selectorIndex) * 40;
		try { defuddleScore += ContentScorer.scoreElement(el); } catch { /* ignore */ }
		cands.push({ el, selectorIndex, selector: ENTRY_POINT_ELEMENTS[selectorIndex], text, ws, defuddleScore, docIndex: docIndex.get(el) ?? 1e9 });
	}
	entry.candidatesBeforeCap = cands.length;
	if (cands.length > MAX_CANDS) {
		cands.sort((a, b) => b.defuddleScore - a.defuddleScore);
		cands = cands.slice(0, MAX_CANDS);
		entry.capped = true;
	}
	cands.sort((a, b) => a.docIndex - b.docIndex); // present in document order
	if (cands.length < 2) { entry.status = 'skipped_lt2_candidates'; entry.candidates = cands.length; log.push(entry); continue; }

	// Ground truth: smallest candidate covering >= 90% of output shingles
	cands.forEach((c, i) => {
		c.id = `c${i + 1}`;
		const sset = new Set(shingles(c.ws));
		let hit = 0;
		const missing = [];
		for (const s of outShingles) { if (sset.has(s)) hit++; else if (missing.length < 5) missing.push(s); }
		c.coverage = hit / outShingles.length;
		c.missing = missing;
		c.coverageWords = multisetCoverage(outWords, c.ws);
		if (outShinglesNoCode.length >= 5) {
			const sset2 = new Set(shingles(words(visibleText(c.el, { skipCode: true }))));
			let hit2 = 0;
			for (const s of outShinglesNoCode) if (sset2.has(s)) hit2++;
			c.coverageNoCode = hit2 / outShinglesNoCode.length;
		} else c.coverageNoCode = null;
	});
	cands.forEach(c => {
		c.measures = [];
		if (c.coverage >= TRUTH_COVERAGE) c.measures.push('shingle');
		if (c.coverageNoCode !== null && c.coverageNoCode >= TRUTH_COVERAGE) c.measures.push('shingle_nocode');
		if (c.coverageWords >= TRUTH_COVERAGE) c.measures.push('words');
	});
	const covering = cands.filter(c => c.measures.length > 0).sort((a, b) => (a.ws.length - b.ws.length) || (a.el.outerHTML.length - b.el.outerHTML.length));
	const truth = covering.length ? covering[0].id : 'none_of_these';
	const truthMeasures = covering.length ? covering[0].measures : [];
	const truthStrictShingle = covering.length ? covering[0].measures.includes('shingle') : false;

	// Defuddle's pick mapped onto the candidate list
	let defuddleEl = null, defuddlePick = 'selector_not_found';
	try { defuddleEl = entry.contentSelector ? doc.querySelector(entry.contentSelector) : null; } catch { defuddleEl = null; }
	if (defuddleEl) {
		const match = cands.find(c => c.el === defuddleEl);
		if (match) defuddlePick = match.id;
		else {
			const containing = cands.filter(c => c.el.contains(defuddleEl)).sort((a, b) => (a.ws.length - b.ws.length) || (a.el.outerHTML.length - b.el.outerHTML.length));
			defuddlePick = containing.length ? `not_a_candidate(inside ${containing[0].id})` : 'not_a_candidate';
		}
	}

	// Candidate descriptions for the Jev state
	const described = cands.map(c => {
		const el = c.el;
		const text = normalize(c.text);
		let linkChars = 0;
		for (const a of Array.from(el.querySelectorAll('a'))) linkChars += normalize(visibleText(a)).length;
		const contains = cands.filter(o => o !== c && el.contains(o.el)).map(o => o.id);
		return {
			id: c.id,
			tag: el.tagName.toLowerCase(),
			id_attr: el.id || '',
			classes: className(el).slice(0, 8).join(' '),
			word_count: c.ws.length,
			paragraph_count: el.querySelectorAll('p').length,
			link_text_ratio: +(linkChars / Math.max(1, text.length)).toFixed(2),
			contains_candidates: contains,
			text_start: text.slice(0, 300),
			text_end: text.length > 450 ? text.slice(-150) : text.slice(300),
			// bookkeeping (not sent to Jev)
			_meta: { selector: c.selector, selectorIndex: c.selectorIndex, defuddleScore: Math.round(c.defuddleScore), coverage: +c.coverage.toFixed(3), coverageNoCode: c.coverageNoCode === null ? null : +c.coverageNoCode.toFixed(3), coverageWords: +c.coverageWords.toFixed(3), measures: c.measures, missing: c.missing, docIndex: c.docIndex }
		};
	});

	// Variant C: whole-page cleaned HTML with data-cand annotations
	cands.forEach(c => c.el.setAttribute('data-cand', c.id));
	const pageHtml = cleanPageHtml(doc.documentElement.outerHTML);
	const pageTokens = estimateTokens(pageHtml, true);

	kept.push({
		name, url, htmlBytes, title: entry.title, contentSelector: entry.contentSelector,
		outputWords: outWords.length, n_candidates: cands.length, candidatesBeforeCap: entry.candidatesBeforeCap, capped: !!entry.capped,
		truth, truthMeasures, truthStrictShingle, defuddlePick, candidates: described,
		pageHtml, pageTokens, pageEligibleC: pageTokens <= VARIANT_C_MAX_TOKENS,
	});
	entry.n_candidates = cands.length; entry.truth = truth; entry.truthMeasures = truthMeasures; entry.defuddlePick = defuddlePick; entry.pageTokens = pageTokens;
	log.push(entry);
}

writeFileSync(join(OUT, 'candidates.jsonl'), kept.map(k => JSON.stringify(k)).join('\n') + '\n');
writeFileSync(join(OUT, 'fixture_log.json'), JSON.stringify(log, null, 2));
const count = (arr, f) => arr.filter(f).length;
const summary = {
	fixtures_total: files.length,
	defuddle_errors: count(log, e => e.status === 'defuddle_error'),
	skipped_extractor: count(log, e => e.status === 'skipped_extractor'),
	skipped_tiny_output: count(log, e => e.status === 'skipped_tiny_output'),
	skipped_lt2_candidates: count(log, e => e.status === 'skipped_lt2_candidates'),
	kept: kept.length,
	kept_real_pages_gt20KB: count(kept, k => k.htmlBytes > 20480),
	kept_gt8KB: count(kept, k => k.htmlBytes > 8192),
	kept_capped_at_12: count(kept, k => k.capped),
	kept_truth_none_of_these: count(kept, k => k.truth === 'none_of_these'),
	kept_truth_by_strict_shingle: count(kept, k => k.truthStrictShingle),
	kept_truth_by_nocode_or_words_only: count(kept, k => k.truth !== 'none_of_these' && !k.truthStrictShingle),
	kept_truth_measure_hist: kept.reduce((m, k) => { const key = k.truthMeasures.join('+') || 'none'; m[key] = (m[key] || 0) + 1; return m; }, {}),
	kept_defuddle_pick_equals_truth: count(kept, k => k.defuddlePick === k.truth),
	kept_defuddle_pick_not_in_candidates: count(kept, k => !/^c\d+$/.test(k.defuddlePick)),
	n_candidates_hist: kept.reduce((m, k) => { m[k.n_candidates] = (m[k.n_candidates] || 0) + 1; return m; }, {}),
	variant_c_eligible: count(kept, k => k.pageEligibleC),
	variant_c_too_large: count(kept, k => !k.pageEligibleC),
	variant_c_total_est_tokens: kept.filter(k => k.pageEligibleC).reduce((s, k) => s + k.pageTokens, 0),
	variant_a_total_est_state_tokens: kept.reduce((s, k) => s + estimateTokens(JSON.stringify(k.candidates.map(({ _meta, ...c }) => c))), 0),
};
writeFileSync(join(OUT, 'build_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
