// Variant D (live): same as A (document order, Choice + per-candidate Nouls) but the candidate
// descriptions carry NO structural hints: no tag, no id attribute, no classes; option labels are
// just "cK, N words[, contains ...]". Tests whether Jev's A-variant accuracy depends on reading
// the words "article"/"main"/"entry-content" rather than the content excerpts.
// Run: bash -ic 'node /home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container/run-variant-D.mjs'
import { readFileSync, writeFileSync, appendFileSync, existsSync, unlinkSync } from 'node:fs';
import { systemOne, mapConcurrent, usageTotals, estimateTokens } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';

const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container';
const MODEL = 'jev-1.14.0';
const CONC = 6;
const QUESTION = 'Which candidate is the main article container, meaning the smallest element that contains the whole article body (all paragraphs, headings, figures, code and footnotes of the single main article) and as little non-article material as possible?';

const fixtures = readFileSync(`${OUT}/candidates.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);

function contentOnly(c) {
	const { _meta, tag, id_attr, classes, ...rest } = c; // drop structural hints
	return rest;
}
function buildRequest(fx) {
	const cands = fx.candidates;
	const state = { page_title: fx.title, url: fx.url, candidates: cands.map(contentOnly) };
	const criteria = {};
	for (const c of cands) criteria[c.id] = `candidate ${c.id}, ${c.word_count} words` + (c.contains_candidates.length ? `, contains ${c.contains_candidates.join(', ')}` : '');
	criteria.none_of_these = 'No listed candidate is the smallest element containing the whole main article body';
	const questions = { main_container: { type: 'choice', instructions: `${QUESTION} The candidates are the entries of state.candidates; option names are their ids. Choose none_of_these if no candidate fits.`, criteria } };
	for (const c of cands) {
		questions[`contains_all_${c.id}`] = { type: 'noul', instructions: `Does candidate ${c.id} contain the whole main article body (every paragraph, heading, figure, code block and footnote of the single main article)?` };
		questions[`non_article_${c.id}`] = { type: 'noul', instructions: `Does candidate ${c.id} contain substantial non-article material (navigation, sidebars, related links, comments, footers)?` };
	}
	return { state, questions };
}

const outFile = `${OUT}/jev_D.jsonl`;
if (existsSync(outFile)) unlinkSync(outFile);
const t0 = Date.now();
let done = 0;
await mapConcurrent(fixtures, async (fx) => {
	const req = buildRequest(fx);
	const record = { name: fx.name, variant: 'D', model: null, n_candidates: fx.n_candidates, truth: fx.truth, defuddlePick: fx.defuddlePick, htmlBytes: fx.htmlBytes, est_state_tokens: estimateTokens(JSON.stringify(req.state)), n_questions: Object.keys(req.questions).length };
	try {
		const res = await systemOne({ model: MODEL, ...req });
		record.model = res.model; record.usage = res.usage; record.latency_ms = res.latency_ms;
		const mc = res.answers.main_container;
		record.choice = mc?.choice ?? null; record.confidence = mc?.confidence ?? null; record.probabilities = mc?.probabilities ?? null;
		record.nouls = {};
		for (const c of fx.candidates) record.nouls[c.id] = { contains_all: res.answers[`contains_all_${c.id}`]?.noul ?? null, non_article: res.answers[`non_article_${c.id}`]?.noul ?? null };
	} catch (e) {
		record.error = { status: e.status ?? null, message: String(e.message || e).slice(0, 300) };
	}
	appendFileSync(outFile, JSON.stringify(record) + '\n');
	if (++done % 50 === 0) console.error(`[D] ${done}/${fixtures.length}`);
}, CONC);
const totals = usageTotals();
const summary = { variant: 'D', fixtures: fixtures.length, model: MODEL, usage: totals, wall_s: Math.round((Date.now() - t0) / 1000) };
writeFileSync(`${OUT}/usage_D.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
