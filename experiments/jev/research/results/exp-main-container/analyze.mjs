// Phase 3: analysis of Jev picks vs ground truth. Run: node /home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container/analyze.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-main-container';
const load = f => existsSync(`${OUT}/${f}`) ? readFileSync(`${OUT}/${f}`, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const fixtures = Object.fromEntries(load('candidates.jsonl').map(f => [f.name, f]));
const runs = { A: load('jev_A.jsonl'), B: load('jev_B.jsonl'), A2: load('jev_A2.jsonl'), C: load('jev_C.jsonl') };
const byName = v => Object.fromEntries(runs[v].map(r => [r.name, r]));
const R = { A: byName('A'), B: byName('B'), A2: byName('A2'), C: byName('C') };

const band = c => c == null ? 'n/a' : c >= 0.9 ? '>=0.9' : c >= 0.7 ? '0.7-0.9' : c >= 0.5 ? '0.5-0.7' : '<0.5';
const pct = (a, b) => b ? +(100 * a / b).toFixed(1) : null;
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
function relation(fx, pick, truth) {
	if (pick === truth) return 'correct';
	if (pick === 'none_of_these') return 'none_of_these';
	if (truth === 'none_of_these') return 'picked_when_label_none';
	const c = fx.candidates.find(x => x.id === pick);
	const t = fx.candidates.find(x => x.id === truth);
	if (!c || !t) return 'invalid';
	if (c.contains_candidates.includes(truth)) return 'ancestor_of_truth(over-inclusive)';
	if (t.contains_candidates.includes(pick)) return 'descendant_of_truth(under-inclusive)';
	return 'unrelated_branch';
}
function evalVariant(v, filter = () => true) {
	const recs = runs[v].filter(r => fixtures[r.name] && filter(fixtures[r.name], r));
	const ok = recs.filter(r => !r.error);
	const correct = ok.filter(r => r.choice === r.truth);
	const bands = {};
	for (const r of ok) { const b = band(r.confidence); bands[b] = bands[b] || { n: 0, correct: 0 }; bands[b].n++; if (r.choice === r.truth) bands[b].correct++; }
	for (const b of Object.keys(bands)) bands[b].accuracy_pct = pct(bands[b].correct, bands[b].n);
	const byN = {};
	for (const r of ok) { const k = r.n_candidates >= 4 ? '4+' : String(r.n_candidates); byN[k] = byN[k] || { n: 0, correct: 0 }; byN[k].n++; if (r.choice === r.truth) byN[k].correct++; }
	for (const k of Object.keys(byN)) byN[k].accuracy_pct = pct(byN[k].correct, byN[k].n);
	const rel = {};
	for (const r of ok) { const k = relation(fixtures[r.name], r.choice, r.truth); rel[k] = (rel[k] || 0) + 1; }
	const picks = {};
	for (const r of ok) { const fx = fixtures[r.name]; const c = fx.candidates.find(x => x.id === r.choice); const k = r.choice === 'none_of_these' ? 'none_of_these' : (c?.tag === 'body' ? 'body' : c?.tag || 'other'); picks[k] = (picks[k] || 0) + 1; }
	const lat = ok.map(r => r.latency_ms);
	return {
		n_fixtures: recs.length, n_errors: recs.length - ok.length, errors: recs.filter(r => r.error).map(r => ({ name: r.name, ...r.error })),
		correct: correct.length, accuracy_pct: pct(correct.length, ok.length),
		mean_confidence: ok.length ? +(ok.reduce((s, r) => s + (r.confidence ?? 0), 0) / ok.length).toFixed(3) : null,
		by_confidence_band: bands, by_n_candidates: byN, miss_relation: rel, picked_tag: picks,
		input_tokens: ok.reduce((s, r) => s + (r.usage?.input_tokens || 0), 0),
		latency_ms: { p50: q(lat, 0.5), p90: q(lat, 0.9), max: Math.max(...lat, 0), n: lat.length },
	};
}

const labeled = (fx) => fx.truth !== 'none_of_these';
const real = (fx) => fx.htmlBytes > 20480;
const analysis = { model: [...new Set(Object.values(runs).flat().map(r => r.model).filter(Boolean))], n_kept_fixtures: Object.keys(fixtures).length };
for (const v of ['A', 'B', 'A2', 'C']) {
	if (!runs[v].length) continue;
	analysis[`variant_${v}`] = { all_167_spec_labels: evalVariant(v), labeled_only: evalVariant(v, labeled), real_pages_gt20KB: evalVariant(v, real), pages_gt8KB: evalVariant(v, fx => fx.htmlBytes > 8192) };
}

// Defuddle agreement
const fxs = Object.values(fixtures);
analysis.defuddle_vs_truth = {
	pick_equals_truth: fxs.filter(f => f.defuddlePick === f.truth).length,
	pick_is_ancestor_of_truth: fxs.filter(f => f.defuddlePick !== f.truth && /^c\d+$/.test(f.defuddlePick) && f.candidates.find(c => c.id === f.defuddlePick)?.contains_candidates.includes(f.truth)).length,
	pick_not_a_candidate: fxs.filter(f => !/^c\d+$/.test(f.defuddlePick)).length,
	truth_none_of_these: fxs.filter(f => f.truth === 'none_of_these').length,
	truth_by_strict_shingle: fxs.filter(f => f.truthStrictShingle).length,
	truth_by_fallback_measure: fxs.filter(f => f.truth !== 'none_of_these' && !f.truthStrictShingle).length,
	n_candidates_hist: fxs.reduce((m, f) => { m[f.n_candidates] = (m[f.n_candidates] || 0) + 1; return m; }, {}),
	real_pages_gt20KB: fxs.filter(real).length, pages_gt8KB: fxs.filter(f => f.htmlBytes > 8192).length,
};
// Jev vs defuddle agreement (A)
if (runs.A.length) {
	const ok = runs.A.filter(r => !r.error);
	analysis.jev_A_vs_defuddle = {
		agree_with_defuddle_pick: ok.filter(r => r.choice === r.defuddlePick).length,
		jev_correct_defuddle_wrong: ok.filter(r => r.choice === r.truth && r.defuddlePick !== r.truth).map(r => r.name),
		defuddle_correct_jev_wrong: ok.filter(r => r.choice !== r.truth && r.defuddlePick === r.truth).length,
		both_wrong: ok.filter(r => r.choice !== r.truth && r.defuddlePick !== r.truth).map(r => r.name),
	};
}

// Order sensitivity and repeat stability
function compare(v1, v2) {
	const pairs = runs[v1].filter(r => !r.error && R[v2][r.name] && !R[v2][r.name].error).map(r => [r, R[v2][r.name]]);
	const flips = pairs.filter(([a, b]) => a.choice !== b.choice);
	const dp = pairs.map(([a, b]) => Math.abs((a.probabilities?.[a.choice] ?? 0) - (b.probabilities?.[a.choice] ?? 0)));
	const dpAll = pairs.flatMap(([a, b]) => Object.keys(a.probabilities || {}).map(k => Math.abs((a.probabilities[k] ?? 0) - (b.probabilities?.[k] ?? 0))));
	return {
		n_pairs: pairs.length, choice_flips: flips.length, flip_rate_pct: pct(flips.length, pairs.length),
		flips: flips.map(([a, b]) => ({ name: a.name, truth: a.truth, [v1]: `${a.choice}@${a.confidence}`, [v2]: `${b.choice}@${b.confidence}` })),
		both_correct: pairs.filter(([a, b]) => a.choice === a.truth && b.choice === b.truth).length,
		either_correct: pairs.filter(([a, b]) => a.choice === a.truth || b.choice === b.truth).length,
		mean_abs_dp_chosen: +(dp.reduce((s, x) => s + x, 0) / Math.max(1, dp.length)).toFixed(3),
		max_abs_dp_any_option: +Math.max(...dpAll, 0).toFixed(2),
		mean_abs_dp_any_option: +(dpAll.reduce((s, x) => s + x, 0) / Math.max(1, dpAll.length)).toFixed(3),
	};
}
if (runs.B.length) analysis.order_sensitivity_A_vs_B = compare('A', 'B');
if (runs.A2.length) analysis.repeat_stability_A_vs_A2 = compare('A', 'A2');
if (runs.C.length) analysis.list_vs_page_A_vs_C = compare('A', 'C');

// Noul-derived pick
function noulPick(fx, nouls, thrContains, thrNon, useNon = true) {
	const ok = fx.candidates.filter(c => nouls[c.id] && nouls[c.id].contains_all != null && nouls[c.id].contains_all >= thrContains && (!useNon || nouls[c.id].non_article <= thrNon));
	if (!ok.length) return 'none_of_these';
	ok.sort((a, b) => (a.word_count - b.word_count) || (a.contains_candidates.length - b.contains_candidates.length));
	return ok[0].id;
}
function evalNoul(v, thrContains, thrNon, useNon) {
	const ok = runs[v].filter(r => !r.error && r.nouls);
	let correct = 0, agreeChoice = 0, none = 0, lab = 0, correctLab = 0;
	for (const r of ok) {
		const fx = fixtures[r.name];
		const p = noulPick(fx, r.nouls, thrContains, thrNon, useNon);
		if (p === r.truth) correct++;
		if (p === r.choice) agreeChoice++;
		if (p === 'none_of_these') none++;
		if (fx.truth !== 'none_of_these') { lab++; if (p === r.truth) correctLab++; }
	}
	return { n: ok.length, correct, accuracy_pct: pct(correct, ok.length), labeled_n: lab, labeled_correct: correctLab, labeled_accuracy_pct: pct(correctLab, lab), agrees_with_choice: agreeChoice, agree_pct: pct(agreeChoice, ok.length), picked_none: none };
}
if (runs.A.length) {
	analysis.noul_derived_pick_A = {
		'contains>=0.5 & non_article<=0.5 (spec)': evalNoul('A', 0.5, 0.5, true),
		'contains>=0.7 & non_article<=0.3': evalNoul('A', 0.7, 0.3, true),
		'contains>=0.5 only': evalNoul('A', 0.5, 1, false),
		'contains>=0.3 & non_article<=0.5': evalNoul('A', 0.3, 0.5, true),
	};
	// Noul diagnostics: contains_all for truth vs ancestors vs descendants/others; AUROC of contains_all for "contains the whole article" (truth or ancestor of truth)
	const rows = [];
	for (const r of runs.A.filter(r => !r.error && r.nouls)) {
		const fx = fixtures[r.name]; if (fx.truth === 'none_of_these') continue;
		const t = fx.candidates.find(c => c.id === fx.truth);
		for (const c of fx.candidates) {
			const role = c.id === fx.truth ? 'truth' : c.contains_candidates.includes(fx.truth) ? 'ancestor' : t.contains_candidates.includes(c.id) ? 'descendant' : 'other';
			rows.push({ role, contains_all: r.nouls[c.id].contains_all, non_article: r.nouls[c.id].non_article, body: c.tag === 'body' });
		}
	}
	const stats = (arr) => arr.length ? { n: arr.length, mean: +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(3), p25: q(arr, 0.25), p50: q(arr, 0.5), p75: q(arr, 0.75), frac_ge_0_5: pct(arr.filter(x => x >= 0.5).length, arr.length) } : null;
	const byRole = {};
	for (const role of ['truth', 'ancestor', 'descendant', 'other']) {
		const rs = rows.filter(x => x.role === role);
		byRole[role] = { contains_all: stats(rs.map(x => x.contains_all)), non_article: stats(rs.map(x => x.non_article)) };
	}
	// AUROC
	const pos = rows.filter(x => x.role === 'truth' || x.role === 'ancestor').map(x => x.contains_all);
	const neg = rows.filter(x => x.role === 'descendant' || x.role === 'other').map(x => x.contains_all);
	let wins = 0; for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
	const posN = rows.filter(x => x.role === 'ancestor').map(x => x.non_article);
	const negN = rows.filter(x => x.role === 'truth').map(x => x.non_article);
	let winsN = 0; for (const p of posN) for (const n of negN) winsN += p > n ? 1 : p === n ? 0.5 : 0;
	analysis.noul_diagnostics_A = { by_role: byRole, auroc_contains_all_for_contains_whole_article: pos.length && neg.length ? +(wins / (pos.length * neg.length)).toFixed(3) : null, auroc_non_article_ancestor_vs_truth: posN.length && negN.length ? +(winsN / (posN.length * negN.length)).toFixed(3) : null };
}

// Cost summary
analysis.cost = {};
for (const v of ['A', 'B', 'A2', 'C']) {
	if (!existsSync(`${OUT}/usage_${v}.json`)) continue;
	const u = JSON.parse(readFileSync(`${OUT}/usage_${v}.json`, 'utf8'));
	analysis.cost[v] = { calls: u.usage.calls, errors: u.usage.errors, input_tokens: u.usage.input_tokens, est_cost_usd: u.usage.est_cost_usd, usd_per_fixture: +(u.usage.est_cost_usd / Math.max(1, u.fixtures)).toFixed(7), latency_ms: { p50: Math.round(u.usage.latency_ms.p50), p90: Math.round(u.usage.latency_ms.p90), p99: Math.round(u.usage.latency_ms.p99), max: Math.round(u.usage.latency_ms.max) }, wall_s: u.wall_s };
}
analysis.variant_C_too_large = fxs.filter(f => !f.pageEligibleC).map(f => ({ name: f.name, pageTokens: f.pageTokens }));

writeFileSync(`${OUT}/analysis.json`, JSON.stringify(analysis, null, 2));

// Miss lists
function missReport(v) {
	const lines = [];
	for (const r of runs[v].filter(r => !r.error && r.choice !== r.truth)) {
		const fx = fixtures[r.name];
		lines.push(`### ${r.name}  [${v}] htmlBytes=${fx.htmlBytes} n=${fx.n_candidates} truth=${r.truth} (${fx.truthMeasures.join('+') || 'none'}) jev=${r.choice}@conf${r.confidence} probs=${JSON.stringify(r.probabilities)} defuddle=${r.defuddlePick} relation=${relation(fx, r.choice, r.truth)}`);
		lines.push(`  title: ${fx.title} | url: ${fx.url} | contentSelector: ${fx.contentSelector.slice(0, 120)}`);
		for (const c of fx.candidates) {
			const n = r.nouls?.[c.id];
			lines.push(`  ${c.id}: <${c.tag}${c.id_attr ? ' id=' + c.id_attr : ''}${c.classes ? ' class="' + c.classes + '"' : ''}> words=${c.word_count} p=${c.paragraph_count} linkratio=${c.link_text_ratio} contains=[${c.contains_candidates}] cov=${c._meta.coverage}/${c._meta.coverageWords}${n ? ` nouls: contains_all=${n.contains_all} non_article=${n.non_article}` : ''}`);
			lines.push(`      start: ${c.text_start.slice(0, 200)}`);
			lines.push(`      end:   ${c.text_end.slice(-120)}`);
		}
		lines.push('');
	}
	writeFileSync(`${OUT}/misses_${v}.txt`, lines.join('\n'));
	return lines.length;
}
for (const v of ['A', 'B', 'C']) if (runs[v].length) missReport(v);
console.log(JSON.stringify(analysis, null, 2));
