// Second-pass analysis: Variant D, adjudicated labels, A+B rotation ensemble, cascade coverage, per-fixture table.
// Run: node /home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container/analyze2.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container';
const load = f => existsSync(`${OUT}/${f}`) ? readFileSync(`${OUT}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const fixtures = Object.fromEntries(load('candidates.jsonl').map(f => [f.name, f]));
const runs = { A: load('jev_A.jsonl'), B: load('jev_B.jsonl'), A2: load('jev_A2.jsonl'), C: load('jev_C.jsonl'), D: load('jev_D.jsonl') };
const R = Object.fromEntries(Object.entries(runs).map(([v, rs]) => [v, Object.fromEntries(rs.map(r => [r.name, r]))]));
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null;
const band = c => c == null ? 'n/a' : c >= 0.9 ? '>=0.9' : c >= 0.7 ? '0.7-0.9' : c >= 0.5 ? '0.5-0.7' : '<0.5';

// Adjudicated labels: the 5 spec "none_of_these" are label artifacts (footnote markers / LaTeX conversion);
// in each, c2 is the only article element and covers 82-87% of output words. Relabel to c2.
// issues--header-with-subtitle-p: accept c2 (article, contains the h1) or c3 (article-body) -- the question's
// literal wording ("all paragraphs, headings") points at article; the shingle label points at article-body.
const ARTIFACT_NONE = ['footnotes--inline-footnote-span', 'footnotes--orgmode-css-sidenotes', 'footnotes--word-ftn-ftnref', 'math--mathjax-tex-scripts', 'math--raw-latex'];
const AMBIGUOUS = { 'issues--header-with-subtitle-p': new Set(['c2', 'c3']) };
function truthSets(name) {
	const fx = fixtures[name];
	const strict = new Set([fx.truth]);
	let adj;
	if (ARTIFACT_NONE.includes(name)) adj = new Set(['c2']);
	else if (AMBIGUOUS[name]) adj = AMBIGUOUS[name];
	else adj = new Set([fx.truth]);
	return { strict, adj };
}
function acc(records, pickFn, which = 'strict', filter = () => true) {
	let n = 0, ok = 0;
	for (const r of records) { const fx = fixtures[r.name]; if (!fx || r.error || !filter(fx, r)) continue; n++; if (truthSets(r.name)[which].has(pickFn(r))) ok++; }
	return { n, correct: ok, accuracy_pct: pct(ok, n) };
}
const choice = r => r.choice;
const real = fx => fx.htmlBytes > 20480;
const multi = fx => fx.n_candidates >= 3;
const two = fx => fx.n_candidates === 2;

const out = { model: [...new Set(Object.values(runs).flat().map(r => r.model).filter(Boolean))] };

// 1. Accuracy table per variant: strict vs adjudicated; all / 2-cand / 3+-cand / real pages
out.accuracy = {};
for (const v of Object.keys(runs)) {
	if (!runs[v].length) continue;
	out.accuracy[v] = {
		strict_all: acc(runs[v], choice, 'strict'), adjudicated_all: acc(runs[v], choice, 'adj'),
		adjudicated_2cand: acc(runs[v], choice, 'adj', two), adjudicated_3plus: acc(runs[v], choice, 'adj', multi),
		adjudicated_real_gt20KB: acc(runs[v], choice, 'adj', real),
		adjudicated_by_band: Object.fromEntries(['>=0.9', '0.7-0.9', '0.5-0.7', '<0.5'].map(b => [b, acc(runs[v], choice, 'adj', (fx, r) => band(r.confidence) === b)])),
		mean_confidence: +(runs[v].filter(r => !r.error).reduce((s, r) => s + (r.confidence ?? 0), 0) / runs[v].filter(r => !r.error).length).toFixed(3),
		none_of_these_picks: runs[v].filter(r => r.choice === 'none_of_these').length,
	};
}
// Defuddle's findMainContent on the same labels
const fxs = Object.values(fixtures);
const dfAcc = (which, filter = () => true) => { let n = 0, ok = 0; for (const f of fxs) { if (!filter(f)) continue; n++; if (truthSets(f.name)[which].has(f.defuddlePick)) ok++; } return { n, correct: ok, accuracy_pct: pct(ok, n) }; };
out.defuddle_findMainContent = { strict_all: dfAcc('strict'), adjudicated_all: dfAcc('adj'), adjudicated_2cand: dfAcc('adj', two), adjudicated_3plus: dfAcc('adj', multi), adjudicated_real_gt20KB: dfAcc('adj', real),
	misses_adjudicated: fxs.filter(f => !truthSets(f.name).adj.has(f.defuddlePick)).map(f => ({ name: f.name, defuddle: f.defuddlePick, truth: f.truth, n: f.n_candidates })) };

// 2. D vs A: flips, and per-fixture where D differs
const pairsAD = runs.D.filter(r => !r.error && R.A[r.name]).map(r => [R.A[r.name], r]);
out.D_vs_A = { n: pairsAD.length, flips: pairsAD.filter(([a, d]) => a.choice !== d.choice).length,
	flips_list: pairsAD.filter(([a, d]) => a.choice !== d.choice).map(([a, d]) => ({ name: a.name, truth: a.truth, A: `${a.choice}@${a.confidence}`, D: `${d.choice}@${d.confidence}` })),
	mean_conf_A: +(pairsAD.reduce((s, [a]) => s + a.confidence, 0) / pairsAD.length).toFixed(3), mean_conf_D: +(pairsAD.reduce((s, [, d]) => s + d.confidence, 0) / pairsAD.length).toFixed(3),
	D_picked_tag: runs.D.reduce((m, r) => { const c = fixtures[r.name].candidates.find(x => x.id === r.choice); const k = r.choice === 'none_of_these' ? 'none' : c?.tag; m[k] = (m[k] || 0) + 1; return m; }, {}) };

// 3. Rotation ensemble: average A and B probabilities (and A+B+A2), argmax
function ensemble(names, vs) {
	const recs = [];
	for (const name of names) {
		const rs = vs.map(v => R[v][name]).filter(r => r && !r.error);
		if (rs.length !== vs.length) continue;
		const keys = Object.keys(rs[0].probabilities);
		const avg = Object.fromEntries(keys.map(k => [k, rs.reduce((s, r) => s + (r.probabilities[k] ?? 0), 0) / rs.length]));
		const best = keys.reduce((a, b) => avg[a] >= avg[b] ? a : b);
		const n = keys.length; const conf = (avg[best] - 1 / n) / (1 - 1 / n);
		recs.push({ name, choice: best, confidence: +conf.toFixed(3), n_candidates: fixtures[name].n_candidates });
	}
	return recs;
}
const names = Object.keys(fixtures);
for (const [label, vs] of [['A+B', ['A', 'B']], ['A+B+A2', ['A', 'B', 'A2']], ['A+B+C', ['A', 'B', 'C']], ['A+D', ['A', 'D']], ['A+B+D', ['A', 'B', 'D']]]) {
	const e = ensemble(names, vs);
	out[`ensemble_${label}`] = { strict_all: acc(e, choice, 'strict'), adjudicated_all: acc(e, choice, 'adj'), adjudicated_3plus: acc(e, choice, 'adj', multi), adjudicated_real: acc(e, choice, 'adj', real),
		adjudicated_by_band: Object.fromEntries(['>=0.9', '0.7-0.9', '0.5-0.7', '<0.5'].map(b => [b, acc(e, choice, 'adj', (fx, r) => band(r.confidence) === b)])) };
}

// 4. Confidence-gated cascade on A (adjudicated): use Jev pick if conf >= t else fall back to defuddle's pick
out.cascade_A = {};
for (const t of [0, 0.3, 0.5, 0.7, 0.9]) {
	let n = 0, jev = 0, ok = 0, okJev = 0, okFallback = 0;
	for (const r of runs.A) { if (r.error) continue; const fx = fixtures[r.name]; n++; const T = truthSets(r.name).adj; const useJev = r.confidence >= t && r.choice !== 'none_of_these'; if (useJev) { jev++; if (T.has(r.choice)) { ok++; okJev++; } } else { if (T.has(fx.defuddlePick)) { ok++; okFallback++; } } }
	out.cascade_A[`conf>=${t}`] = { n, routed_to_jev: jev, coverage_pct: pct(jev, n), jev_correct: okJev, jev_accuracy_on_routed_pct: pct(okJev, jev), fallback_correct: okFallback, overall_correct: ok, overall_accuracy_pct: pct(ok, n) };
}

// 5. Per-fixture table (A, B, A2, C, D picks) for the long table
out.per_fixture = names.sort().map(name => { const fx = fixtures[name]; const g = v => R[v][name] ? (R[v][name].error ? 'ERR' : `${R[v][name].choice}@${R[v][name].confidence}`) : '-'; return { name, bytes: fx.htmlBytes, n: fx.n_candidates, truth: fx.truth, adj: [...truthSets(name).adj].join('|'), defuddle: fx.defuddlePick, A: g('A'), B: g('B'), A2: g('A2'), C: g('C'), D: g('D') }; });

// 6. Noul diagnostics for D (does contains_all still separate without hints?)
function noulAuroc(v) {
	const rows = [];
	for (const r of runs[v].filter(r => !r.error && r.nouls)) { const fx = fixtures[r.name]; const T = truthSets(r.name).adj; if (T.has('none_of_these')) continue; const truth = [...T][0]; const t = fx.candidates.find(c => c.id === truth); for (const c of fx.candidates) { const role = T.has(c.id) ? 'truth' : c.contains_candidates.includes(truth) ? 'ancestor' : t.contains_candidates.includes(c.id) ? 'descendant' : 'other'; rows.push({ role, ...r.nouls[c.id] }); } }
	const au = (pos, neg) => { let w = 0; for (const p of pos) for (const n of neg) w += p > n ? 1 : p === n ? 0.5 : 0; return pos.length && neg.length ? +(w / (pos.length * neg.length)).toFixed(3) : null; };
	const mean = a => a.length ? +(a.reduce((s, x) => s + x, 0) / a.length).toFixed(3) : null;
	const by = role => rows.filter(x => x.role === role);
	return { n_rows: rows.length, auroc_contains_all_truthOrAncestor_vs_rest: au([...by('truth'), ...by('ancestor')].map(x => x.contains_all), [...by('descendant'), ...by('other')].map(x => x.contains_all)), auroc_non_article_ancestor_vs_truth: au(by('ancestor').map(x => x.non_article), by('truth').map(x => x.non_article)),
		mean_contains_all: { truth: mean(by('truth').map(x => x.contains_all)), ancestor: mean(by('ancestor').map(x => x.contains_all)), descendant: mean(by('descendant').map(x => x.contains_all)) }, mean_non_article: { truth: mean(by('truth').map(x => x.non_article)), ancestor: mean(by('ancestor').map(x => x.non_article)) } };
}
out.noul_diagnostics = { A: noulAuroc('A'), D: noulAuroc('D') };
// Noul-derived pick for D and A (spec thresholds) on adjudicated labels
function noulPick(fx, nouls, tc, tn) { const ok = fx.candidates.filter(c => nouls[c.id]?.contains_all >= tc && nouls[c.id]?.non_article <= tn); if (!ok.length) return 'none_of_these'; ok.sort((a, b) => a.word_count - b.word_count || a.contains_candidates.length - b.contains_candidates.length); return ok[0].id; }
out.noul_pick_adjudicated = {};
for (const v of ['A', 'D']) for (const [tc, tn] of [[0.5, 0.5], [0.3, 0.5]]) out.noul_pick_adjudicated[`${v} contains>=${tc} non<=${tn}`] = acc(runs[v], r => noulPick(fixtures[r.name], r.nouls, tc, tn), 'adj');

// 7. Cost / latency summary incl. D
out.cost = {};
for (const v of ['A', 'B', 'A2', 'C', 'D']) { if (!existsSync(`${OUT}/usage_${v}.json`)) continue; const u = JSON.parse(readFileSync(`${OUT}/usage_${v}.json`, 'utf8')); out.cost[v] = { calls: u.usage.calls, errors: u.usage.errors, input_tokens: u.usage.input_tokens, output_tokens: u.usage.output_tokens, est_cost_usd: u.usage.est_cost_usd, usd_per_page: +(u.usage.est_cost_usd / u.fixtures).toFixed(7), tokens_per_page: Math.round(u.usage.input_tokens / u.fixtures), p50_ms: Math.round(u.usage.latency_ms.p50), p90_ms: Math.round(u.usage.latency_ms.p90), p99_ms: Math.round(u.usage.latency_ms.p99), max_ms: Math.round(u.usage.latency_ms.max), wall_s: u.wall_s }; }
const tot = Object.values(out.cost).reduce((s, c) => ({ calls: s.calls + c.calls, input_tokens: s.input_tokens + c.input_tokens, usd: s.usd + c.est_cost_usd }), { calls: 0, input_tokens: 0, usd: 0 });
out.cost.TOTAL = { calls: tot.calls, input_tokens: tot.input_tokens, est_cost_usd: +tot.usd.toFixed(5) };

writeFileSync(`${OUT}/analysis2.json`, JSON.stringify(out, null, 2));
const { per_fixture, ...rest } = out;
console.log(JSON.stringify(rest, null, 1));
