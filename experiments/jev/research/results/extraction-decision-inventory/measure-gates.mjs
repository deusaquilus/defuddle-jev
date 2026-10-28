// Measures where Defuddle's extraction pipeline is "uncertain" across all fixtures by
// monkey-patching the dist build (no repo modification). Records per fixture:
//  - parseInternal calls (retry cascade triggers) and their wordCounts
//  - findMainContent candidate scores (top-1 vs top-2 margin, chosen == top?)
//  - every scoreNonContentBlock score (first pass only) and isLikelyContent outcomes
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/extraction-decision-inventory';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { Defuddle: DefuddleClass } = require(join(REPO, 'dist/defuddle.js'));
const { ContentScorer } = require(join(REPO, 'dist/removals/scoring.js'));
const { ENTRY_POINT_ELEMENTS } = require(join(REPO, 'dist/constants.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const { countWords } = require(join(REPO, 'dist/utils.js'));

let ctx = null;
const origScoreNon = ContentScorer.scoreNonContentBlock;
ContentScorer.scoreNonContentBlock = function (el) {
	const s = origScoreNon.call(ContentScorer, el);
	if (ctx && ctx.pass === ctx.firstPipelinePass) {
		ctx.scored.push({ score: +s.toFixed(1), words: countWords(el.textContent || ''), tag: el.tagName.toLowerCase(),
			text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90) });
	}
	return s;
};
const origLikely = ContentScorer.isLikelyContent;
ContentScorer.isLikelyContent = function (el) {
	const r = origLikely.call(ContentScorer, el);
	if (ctx && ctx.pass === ctx.firstPipelinePass) { ctx.likely.total++; if (r) ctx.likely.true++; }
	return r;
};
const origParseInternal = DefuddleClass.prototype.parseInternal;
DefuddleClass.prototype.parseInternal = function (overrideOptions = {}) {
	let rec = null;
	if (ctx) {
		rec = { opts: Object.keys(overrideOptions), inExtractor: !!this._inExtractorPipelineRun, wordCount: null };
		ctx.calls.push(rec);
		ctx.pass = ctx.calls.length;
		// the first pass that actually runs the generic pipeline (not the outer extractor dispatch)
		if (ctx.firstPipelinePass === null) ctx.firstPipelinePass = ctx.pass;
	}
	const r = origParseInternal.call(this, overrideOptions);
	if (rec) { rec.wordCount = r?.wordCount ?? null; rec.extractorType = r?.extractorType ?? null; rec.returnedNull = r == null; }
	return r;
};
const origFind = DefuddleClass.prototype.findMainContent;
DefuddleClass.prototype.findMainContent = function (doc) {
	const cands = [];
	ENTRY_POINT_ELEMENTS.forEach((selector, index) => {
		doc.querySelectorAll(selector).forEach(el => {
			cands.push({ tag: el.tagName.toLowerCase(), selector, index, score: (ENTRY_POINT_ELEMENTS.length - index) * 40 + ContentScorer.scoreElement(el), el });
		});
	});
	cands.sort((a, b) => b.score - a.score);
	const result = origFind.call(this, doc);
	if (ctx && !ctx.findMain) {
		const strip = c => c && { tag: c.tag, selector: c.selector, score: +c.score.toFixed(1), words: countWords(c.el.textContent || '') };
		ctx.findMain = {
			nCandidates: cands.length,
			top: strip(cands[0]), second: strip(cands[1]),
			margin: cands.length > 1 ? +(cands[0].score - cands[1].score).toFixed(1) : null,
			secondInsideTop: cands.length > 1 ? cands[0].el.contains(cands[1].el) : null,
			chosenIsTop: result === cands[0]?.el,
			chosenTag: result?.tagName?.toLowerCase() ?? null,
			chosenSelector: cands.find(c => c.el === result)?.selector ?? (result ? '(table/scoring fallback)' : null),
			bodyOnly: cands.length === 1 && cands[0].tag === 'body',
			chosenIsBody: result?.tagName?.toLowerCase() === 'body',
		};
	}
	return result;
};

const fixturesDir = join(REPO, 'tests/fixtures');
const files = readdirSync(fixturesDir).filter(f => f.endsWith('.html')).sort();
const offlineFetch = async () => { throw new Error('network disabled'); };
const results = [];
for (const file of files) {
	const name = basename(file, '.html');
	const html = readFileSync(join(fixturesDir, file), 'utf-8');
	const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/);
	const frontmatter = fm ? JSON.parse(fm[1]) : {};
	const url = frontmatter.url || `https://${name.replace(/^[a-z]+--/, '')}`;
	ctx = { name, calls: [], pass: 0, firstPipelinePass: null, scored: [], likely: { total: 0, true: 0 }, findMain: null };
	let res;
	try {
		const doc = parseLinkedomHTML(html, url);
		res = await Defuddle(doc, url, { debug: true, fetch: offlineFetch });
	} catch (e) { ctx.error = String(e.message || e); }
	const removalsByStep = {};
	for (const r of (res?.debug?.removals || [])) removalsByStep[r.step] = (removalsByStep[r.step] || 0) + 1;
	results.push({ ...ctx, finalWordCount: res?.wordCount ?? null, extractorType: res?.extractorType ?? null, contentSelector: res?.debug?.contentSelector ?? null, removalsByStep });
	ctx = null;
}
writeFileSync(join(OUT, 'gates-per-fixture.json'), JSON.stringify(results, null, 1));

// ---- aggregate ----
const n = results.length;
const generic = results.filter(r => !r.extractorType);
const firstPass = r => r.calls.find(c => !c.inExtractor && c.opts.length === 0) || r.calls[0];
const agg = {
	fixtures: n, extractor_fixtures: n - generic.length, errors: results.filter(r => r.error).length,
	parseInternal_calls_total: results.reduce((s, r) => s + r.calls.length, 0),
	fixtures_with_retry: results.filter(r => r.calls.filter(c => !c.inExtractor).length > 1).length,
	firstpass_wordcount_lt200: generic.filter(r => (firstPass(r)?.wordCount ?? 0) < 200).length,
	firstpass_wordcount_lt50: generic.filter(r => (firstPass(r)?.wordCount ?? 0) < 50).length,
	retry_changed_result: results.filter(r => { const f = firstPass(r); return f && r.finalWordCount !== null && f.wordCount !== null && r.finalWordCount !== f.wordCount; }).length,
	retry_kinds: {},
	findMain: { measured: 0, chosenIsTop: 0, chosenNotTop: 0, bodyOnly: 0, chosenIsBody: 0, margin_lt10: 0, margin_lt40: 0, margin_lt80: 0, secondInsideTop: 0, nCandidates_dist: {} },
	scoring: { blocks_scored: 0, removed_lt0: 0, kept_ge0: 0, exactly0: 0, band_m5_to_5_nonzero: 0, band_m10_to_10_nonzero: 0, band_le_m20: 0, isLikelyContent_calls: 0, isLikelyContent_true: 0 },
	removals_by_step_total: {},
};
for (const r of results) {
	for (const c of r.calls) { if (c.inExtractor) continue; const k = c.opts.length ? c.opts.sort().join('+') : 'initial'; agg.retry_kinds[k] = (agg.retry_kinds[k] || 0) + 1; }
	for (const [k, v] of Object.entries(r.removalsByStep)) agg.removals_by_step_total[k] = (agg.removals_by_step_total[k] || 0) + v;
	const fm = r.findMain;
	if (fm) {
		const F = agg.findMain; F.measured++;
		if (fm.chosenIsTop) F.chosenIsTop++; else F.chosenNotTop++;
		if (fm.bodyOnly) F.bodyOnly++;
		if (fm.chosenIsBody) F.chosenIsBody++;
		if (fm.margin !== null) { if (fm.margin < 10) F.margin_lt10++; if (fm.margin < 40) F.margin_lt40++; if (fm.margin < 80) F.margin_lt80++; }
		if (fm.secondInsideTop) F.secondInsideTop++;
		const b = fm.nCandidates >= 6 ? '6+' : String(fm.nCandidates);
		F.nCandidates_dist[b] = (F.nCandidates_dist[b] || 0) + 1;
	}
	const S = agg.scoring;
	S.isLikelyContent_calls += r.likely.total; S.isLikelyContent_true += r.likely.true;
	for (const b of r.scored) {
		S.blocks_scored++;
		if (b.score < 0) S.removed_lt0++; else S.kept_ge0++;
		if (b.score === 0) S.exactly0++;
		else { if (Math.abs(b.score) <= 5) S.band_m5_to_5_nonzero++; if (Math.abs(b.score) <= 10) S.band_m10_to_10_nonzero++; }
		if (b.score <= -20) S.band_le_m20++;
	}
}
// examples of near-zero scored blocks and of not-top choices
agg.examples_nearzero_nonzero = results.flatMap(r => r.scored.filter(b => b.score !== 0 && Math.abs(b.score) <= 5).map(b => ({ fixture: r.name, ...b }))).slice(0, 25);
agg.examples_chosenNotTop = results.filter(r => r.findMain && !r.findMain.chosenIsTop).map(r => ({ fixture: r.name, top: r.findMain.top, chosen: r.findMain.chosenSelector, margin: r.findMain.margin })).slice(0, 20);
agg.examples_small_margin = results.filter(r => r.findMain && r.findMain.margin !== null && r.findMain.margin < 40 && !r.findMain.secondInsideTop).map(r => ({ fixture: r.name, top: r.findMain.top, second: r.findMain.second, margin: r.findMain.margin, chosenIsTop: r.findMain.chosenIsTop })).slice(0, 20);
agg.examples_retry_changed = results.filter(r => { const f = firstPass(r); return f && r.finalWordCount !== null && f.wordCount !== null && r.finalWordCount !== f.wordCount; }).map(r => ({ fixture: r.name, calls: r.calls.map(c => `${c.inExtractor ? 'X:' : ''}${c.opts.join('+') || 'initial'}=${c.wordCount}`), final: r.finalWordCount }));
writeFileSync(join(OUT, 'gates-summary.json'), JSON.stringify(agg, null, 2));
console.log(JSON.stringify(agg, null, 2));
