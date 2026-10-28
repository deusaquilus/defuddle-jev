// Phase 2 (live): ask Jev to pick the main article container. Variants:
//   A  = JSON candidate list (document order) + Choice + per-candidate Nouls
//   B  = same as A with candidate order reversed (state array and option order)
//   A2 = exact repeat of A (non-determinism baseline)
//   C  = whole-page cleaned HTML with data-cand annotations, Choice only
// Run: bash -ic 'node /home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container/run-jev.mjs --variant A [--limit N] [--names a,b] [--concurrency 6]'
import { readFileSync, writeFileSync, appendFileSync, existsSync, unlinkSync } from 'node:fs';
import { systemOne, mapConcurrent, usageTotals, estimateTokens } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';

const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container';
const MODEL = 'jev-1.14.0';
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(Boolean));
const VARIANT = String(args.variant || 'A');
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const NAMES = args.names ? new Set(String(args.names).split(',')) : null;
const CONC = args.concurrency ? Number(args.concurrency) : 6;
const VERBOSE = !!args.verbose;

const QUESTION = 'Which candidate is the main article container, meaning the smallest element that contains the whole article body (all paragraphs, headings, figures, code and footnotes of the single main article) and as little non-article material as possible?';

let fixtures = readFileSync(`${OUT}/candidates.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
if (NAMES) fixtures = fixtures.filter(f => NAMES.has(f.name));
if (VARIANT === 'C') fixtures = fixtures.filter(f => f.pageEligibleC);
fixtures = fixtures.slice(0, LIMIT);

function publicCandidate(c) { const { _meta, ...rest } = c; return rest; }
function optionLabel(c) {
	let label = c.tag + (c.id_attr ? `#${c.id_attr}` : '') + (c.classes ? '.' + c.classes.split(' ').slice(0, 3).join('.') : '');
	label += `, ${c.word_count} words`;
	if (c.contains_candidates.length) label += `, contains ${c.contains_candidates.join(', ')}`;
	return label;
}
function buildListRequest(fx, reversed) {
	const cands = reversed ? [...fx.candidates].reverse() : fx.candidates;
	const state = { page_title: fx.title, url: fx.url, candidates: cands.map(publicCandidate) };
	const criteria = {};
	for (const c of cands) criteria[c.id] = optionLabel(c);
	criteria.none_of_these = 'No listed candidate is the smallest element containing the whole main article body';
	const questions = {
		main_container: {
			type: 'choice',
			instructions: `${QUESTION} The candidates are the entries of state.candidates; option names are their ids. Choose none_of_these if no candidate fits.`,
			criteria,
		},
	};
	for (const c of cands) {
		questions[`contains_all_${c.id}`] = { type: 'noul', instructions: `Does candidate ${c.id} contain the whole main article body (every paragraph, heading, figure, code block and footnote of the single main article)?` };
		questions[`non_article_${c.id}`] = { type: 'noul', instructions: `Does candidate ${c.id} contain substantial non-article material (navigation, sidebars, related links, comments, footers)?` };
	}
	return { state, questions };
}
function buildPageRequest(fx) {
	const criteria = {};
	for (const c of fx.candidates) criteria[c.id] = `the element whose opening tag carries data-cand="${c.id}" (<${c.tag}${c.id_attr ? ' id="' + c.id_attr + '"' : ''}>, ${c.word_count} words)`;
	criteria.none_of_these = 'No annotated element is the smallest element containing the whole main article body';
	return {
		state: fx.pageHtml,
		questions: {
			main_container: {
				type: 'choice',
				instructions: `${QUESTION} The state is the page HTML; the candidates are the elements annotated with a data-cand attribute. Choose none_of_these if no candidate fits.`,
				criteria,
			},
		},
	};
}

async function ask(req) {
	try {
		return { res: await systemOne({ model: MODEL, ...req }) };
	} catch (e) {
		return { error: { status: e.status ?? null, message: String(e.message || e).slice(0, 300) } };
	}
}

const outFile = `${OUT}/jev_${VARIANT}${LIMIT !== Infinity || NAMES ? '_smoke' : ''}.jsonl`;
if (existsSync(outFile)) unlinkSync(outFile);
let done = 0;
const t0 = Date.now();
await mapConcurrent(fixtures, async (fx) => {
	const req = VARIANT === 'C' ? buildPageRequest(fx) : buildListRequest(fx, VARIANT === 'B');
	const record = { name: fx.name, variant: VARIANT, model: null, n_candidates: fx.n_candidates, truth: fx.truth, defuddlePick: fx.defuddlePick, htmlBytes: fx.htmlBytes,
		est_state_tokens: VARIANT === 'C' ? fx.pageTokens : estimateTokens(JSON.stringify(req.state)), n_questions: Object.keys(req.questions).length };
	let { res, error } = await ask(req);
	if (error && error.status === 400 && /max_tokens_exceeded/.test(error.message) && VARIANT !== 'C') {
		// Split: Choice alone, then the Nouls (two requests, same state)
		record.split_on_400 = true;
		const q1 = { main_container: req.questions.main_container };
		const q2 = Object.fromEntries(Object.entries(req.questions).filter(([k]) => k !== 'main_container'));
		const r1 = await ask({ state: req.state, questions: q1 });
		const r2 = await ask({ state: req.state, questions: q2 });
		if (r1.res && r2.res) {
			res = { model: r1.res.model, answers: { ...r1.res.answers, ...r2.res.answers }, usage: { input_tokens: r1.res.usage.input_tokens + r2.res.usage.input_tokens, output_tokens: (r1.res.usage.output_tokens || 0) + (r2.res.usage.output_tokens || 0) }, latency_ms: r1.res.latency_ms + r2.res.latency_ms };
			error = null;
		} else error = r1.error || r2.error;
	}
	if (error) { record.error = error; }
	else {
		record.model = res.model;
		record.usage = res.usage;
		record.latency_ms = res.latency_ms;
		const mc = res.answers.main_container;
		record.choice = mc?.choice ?? null;
		record.confidence = mc?.confidence ?? null;
		record.probabilities = mc?.probabilities ?? null;
		if (VARIANT !== 'C') {
			record.nouls = {};
			for (const c of fx.candidates) record.nouls[c.id] = { contains_all: res.answers[`contains_all_${c.id}`]?.noul ?? null, non_article: res.answers[`non_article_${c.id}`]?.noul ?? null };
		}
		if (VERBOSE) console.log(JSON.stringify(res, null, 1).slice(0, 3000));
	}
	appendFileSync(outFile, JSON.stringify(record) + '\n');
	done++;
	if (done % 25 === 0) console.error(`[${VARIANT}] ${done}/${fixtures.length} done, ${Math.round((Date.now() - t0) / 1000)}s`);
}, CONC);

const totals = usageTotals();
console.log(JSON.stringify({ variant: VARIANT, fixtures: fixtures.length, model: MODEL, outFile, usage: totals }, null, 2));
if (LIMIT === Infinity && !NAMES) writeFileSync(`${OUT}/usage_${VARIANT}.json`, JSON.stringify({ variant: VARIANT, fixtures: fixtures.length, model: MODEL, usage: totals, wall_s: Math.round((Date.now() - t0) / 1000) }, null, 2));
