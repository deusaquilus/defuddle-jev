// Analysis for exp-adversarial-determinism. Reads raw-g1..g4.jsonl + g2d-rows.json, writes analysis.json and prints Markdown.
import { readdirSync, readFileSync } from 'node:fs';
import { loadUnits, loadJson, loadRaw, saveJson, mean, quantile, r3, DIR } from './common.mjs';
import { VARIANTS } from './g2.mjs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const sel = loadJson('selections.json');
const out = {};
const md = [];
const pct = x => (100 * x).toFixed(1) + '%';
const keyBy = (rows, f) => { const m = new Map(); for (const r of rows) (m.get(f(r)) || m.set(f(r), []).get(f(r))).push(r); return m; };
function f1Stats(preds, labels, pos = 'removed') {
	let tp = 0, fp = 0, fn = 0, tn = 0;
	for (let i = 0; i < preds.length; i++) { const p = preds[i] === pos, l = labels[i] === pos; if (p && l) tp++; else if (p && !l) fp++; else if (!p && l) fn++; else tn++; }
	const prec = tp / Math.max(1, tp + fp), rec = tp / Math.max(1, tp + fn);
	return { tp, fp, fn, tn, precision: r3(prec), recall: r3(rec), f1: r3(2 * prec * rec / Math.max(1e-9, prec + rec)), accuracy: r3((tp + tn) / preds.length) };
}
/** F1-optimal threshold for "predict removed iff pKeep < t" over a grid. */
function bestThreshold(pKeeps, labels) {
	let best = { t: 0.5, f1: -1 };
	for (let t = 0.025; t < 1; t += 0.025) {
		const s = f1Stats(pKeeps.map(p => p < t ? 'removed' : 'kept'), labels);
		if (s.f1 > best.f1) best = { t: r3(t), ...s };
	}
	return best;
}
function usageOf(rows) {
	const ok = rows.filter(r => !r.error);
	const toks = ok.reduce((s, r) => s + (r.usage?.input_tokens || 0), 0);
	const lat = ok.map(r => r.latency_ms).filter(x => x != null);
	return { calls: rows.length, ok: ok.length, errors: rows.length - ok.length, input_tokens: toks, est_cost_usd: +(toks / 1e6 * 0.042).toFixed(5), tokens_per_call: Math.round(toks / Math.max(1, ok.length)), latency_ms: { p50: quantile(lat, 0.5), p90: quantile(lat, 0.9), p99: quantile(lat, 0.99), max: Math.max(...lat) }, models: [...new Set(ok.map(r => r.model))] };
}
const band = p => p < 0.2 ? 'lo' : p > 0.8 ? 'hi' : 'mid';

// ---------------- G1 ----------------
{
	const raw = loadRaw('g1').filter(r => !r.error);
	const per = keyBy(raw, r => r.id);
	const rows = [];
	for (const [id, rs] of per) {
		const byCall = new Map(rs.map(r => [r.call_no, r]));
		if (![1, 2, 3, 4, 5].every(c => byCall.has(c))) continue;
		const ps = [1, 2, 3, 4, 5].map(c => byCall.get(c).p_keep);
		const ts = [1, 2, 3, 4, 5].map(c => byCall.get(c).ts_ms);
		const spread = Math.max(...ps) - Math.min(...ps);
		rows.push({
			id, label: byId.get(id).label, ps, spread, distinct: new Set(ps).size,
			flip05: ps.some(p => p >= 0.5) && ps.some(p => p < 0.5),
			cross02: ps.some(p => p < 0.2) && ps.some(p => p >= 0.2),
			cross08: ps.some(p => p > 0.8) && ps.some(p => p <= 0.8),
			bandChange: new Set(ps.map(band)).size > 1,
			d12: Math.abs(ps[0] - ps[1]), gap12_s: (ts[1] - ts[0]) / 1000,
			d13: Math.abs(ps[0] - ps[2]), gap13_s: (ts[2] - ts[0]) / 1000,
			d14: Math.abs(ps[0] - ps[3]), gap14_s: (ts[3] - ts[0]) / 1000,
			d15: Math.abs(ps[0] - ps[4]), gap15_s: (ts[4] - ts[0]) / 1000,
			majorityCorrect: (ps.filter(p => p >= 0.5).length >= 3) === (byId.get(id).label === 'kept'),
			call1Correct: (ps[0] >= 0.5) === (byId.get(id).label === 'kept'),
		});
	}
	const n = rows.length;
	const spreads = rows.map(r => r.spread);
	// pairwise flip rate between any two single calls (noise floor for G2/G3 comparisons)
	let pairs = 0, pairFlips = 0, pairAbs = [];
	for (const r of rows) for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { pairs++; if ((r.ps[i] >= 0.5) !== (r.ps[j] >= 0.5)) pairFlips++; pairAbs.push(Math.abs(r.ps[i] - r.ps[j])); }
	const g1 = {
		units_complete: n, calls: raw.length,
		spread: { mean: r3(mean(spreads)), median: r3(quantile(spreads, 0.5)), p90: r3(quantile(spreads, 0.9)), p99: r3(quantile(spreads, 0.99)), max: r3(Math.max(...spreads)),
			frac_zero: r3(spreads.filter(s => s === 0).length / n), frac_le_0_01: r3(spreads.filter(s => s <= 0.01).length / n), frac_le_0_05: r3(spreads.filter(s => s <= 0.05).length / n), frac_le_0_10: r3(spreads.filter(s => s <= 0.10).length / n), frac_gt_0_10: r3(spreads.filter(s => s > 0.10).length / n), frac_gt_0_20: r3(spreads.filter(s => s > 0.20).length / n) },
		identical_all5: r3(rows.filter(r => r.distinct === 1).length / n), mean_distinct_values: r3(mean(rows.map(r => r.distinct))),
		flip_across_0_5: { n: rows.filter(r => r.flip05).length, frac: r3(rows.filter(r => r.flip05).length / n) },
		cross_0_2: { n: rows.filter(r => r.cross02).length, frac: r3(rows.filter(r => r.cross02).length / n) },
		cross_0_8: { n: rows.filter(r => r.cross08).length, frac: r3(rows.filter(r => r.cross08).length / n) },
		band_change_lo_mid_hi: { n: rows.filter(r => r.bandChange).length, frac: r3(rows.filter(r => r.bandChange).length / n) },
		pairwise_single_call: { pairs, flip_rate_0_5: r3(pairFlips / pairs), mean_abs_diff: r3(mean(pairAbs)), p90_abs_diff: r3(quantile(pairAbs, 0.9)) },
		same_second_vs_later: {
			call1_vs_call2: { mean_gap_s: r3(mean(rows.map(r => r.gap12_s))), mean_abs_diff: r3(mean(rows.map(r => r.d12))), frac_identical: r3(rows.filter(r => r.d12 === 0).length / n), flips_0_5: rows.filter(r => (r.ps[0] >= 0.5) !== (r.ps[1] >= 0.5)).length },
			call1_vs_call3: { mean_gap_s: r3(mean(rows.map(r => r.gap13_s))), mean_abs_diff: r3(mean(rows.map(r => r.d13))), frac_identical: r3(rows.filter(r => r.d13 === 0).length / n), flips_0_5: rows.filter(r => (r.ps[0] >= 0.5) !== (r.ps[2] >= 0.5)).length },
			call1_vs_call4: { mean_gap_s: r3(mean(rows.map(r => r.gap14_s))), mean_abs_diff: r3(mean(rows.map(r => r.d14))), frac_identical: r3(rows.filter(r => r.d14 === 0).length / n), flips_0_5: rows.filter(r => (r.ps[0] >= 0.5) !== (r.ps[3] >= 0.5)).length },
			call1_vs_call5: { mean_gap_s: r3(mean(rows.map(r => r.gap15_s))), mean_abs_diff: r3(mean(rows.map(r => r.d15))), frac_identical: r3(rows.filter(r => r.d15 === 0).length / n), flips_0_5: rows.filter(r => (r.ps[0] >= 0.5) !== (r.ps[4] >= 0.5)).length },
		},
		accuracy: { single_call1: r3(rows.filter(r => r.call1Correct).length / n), majority_of_5: r3(rows.filter(r => r.majorityCorrect).length / n) },
		spread_by_mean_p_band: (() => { const g = { lo: [], mid: [], hi: [] }; for (const r of rows) g[band(mean(r.ps))].push(r.spread); return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.length, mean_spread: r3(mean(v)), max: v.length ? r3(Math.max(...v)) : null }])); })(),
		worst: rows.sort((a, b) => b.spread - a.spread).slice(0, 8).map(r => ({ id: r.id, label: r.label, ps: r.ps.map(p => r3(p)) })),
		usage: usageOf(loadRaw('g1')),
	};
	out.g1 = g1;
	md.push('## G1 Determinism (150 units x 5 identical calls, state = block HTML)');
	md.push(`units complete: ${n}; spread(max-min) mean ${g1.spread.mean}, median ${g1.spread.median}, p90 ${g1.spread.p90}, max ${g1.spread.max}; spread==0: ${pct(g1.spread.frac_zero)}, <=0.01: ${pct(g1.spread.frac_le_0_01)}, <=0.05: ${pct(g1.spread.frac_le_0_05)}, >0.10: ${pct(g1.spread.frac_gt_0_10)}`);
	md.push(`all 5 identical: ${pct(g1.identical_all5)}; flip across 0.5: ${g1.flip_across_0_5.n}/${n} (${pct(g1.flip_across_0_5.frac)}); crosses 0.2: ${g1.cross_0_2.n}; crosses 0.8: ${g1.cross_0_8.n}; lo/mid/hi band change: ${g1.band_change_lo_mid_hi.n} (${pct(g1.band_change_lo_mid_hi.frac)})`);
	md.push(`pairwise single-call noise floor: flip rate ${pct(g1.pairwise_single_call.flip_rate_0_5)}, mean |dp| ${g1.pairwise_single_call.mean_abs_diff}`);
	md.push('| pair | mean gap (s) | mean abs diff | identical | flips@0.5 |\n|---|---|---|---|---|');
	for (const [k, v] of Object.entries(g1.same_second_vs_later)) md.push(`| ${k} | ${v.mean_gap_s} | ${v.mean_abs_diff} | ${pct(v.frac_identical)} | ${v.flips_0_5} |`);
	md.push(`accuracy single call ${g1.accuracy.single_call1} vs majority-of-5 ${g1.accuracy.majority_of_5}; usage: ${JSON.stringify(g1.usage)}`);
}

// ---------------- G2 ----------------
{
	const raw = loadRaw('g2').filter(r => !r.error);
	const byKey = new Map(raw.map(r => [`${r.id}|${r.variant}`, r]));
	const g1raw = loadRaw('g1').filter(r => !r.error);
	const g2 = { variants: {} };
	md.push('\n## G2 Injection (Jev keep-noul; flip = baseline side of 0.5 != variant side)');
	md.push('| variant | group | channel | n | base mean p | variant mean p | mean shift | flip rate | directional flips | flips surviving 0.8 band | base confident (n) -> fully inverted | base correct -> wrong |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
	for (const [v, cfg] of Object.entries(VARIANTS)) {
		const ids = cfg.group === 'clutter' ? sel.g2_clutter : sel.g2_prose;
		const pairs = ids.map(id => [byKey.get(`${id}|base`), byKey.get(`${id}|${v}`)]).filter(([b, x]) => b && x);
		const n = pairs.length;
		const base = pairs.map(([b]) => b.p_keep), var_ = pairs.map(([, x]) => x.p_keep);
		const shift = pairs.map(([b, x]) => x.p_keep - b.p_keep);
		const flips = pairs.filter(([b, x]) => (b.p_keep >= 0.5) !== (x.p_keep >= 0.5));
		// directional: clutter pushed to keep; prose pushed to remove
		const dir = cfg.group === 'clutter' ? pairs.filter(([b, x]) => b.p_keep < 0.5 && x.p_keep >= 0.5) : pairs.filter(([b, x]) => b.p_keep >= 0.5 && x.p_keep < 0.5);
		const surviving = cfg.group === 'clutter' ? dir.filter(([, x]) => x.p_keep >= 0.8) : dir.filter(([, x]) => x.p_keep <= 0.2);
		const baseConfident = cfg.group === 'clutter' ? pairs.filter(([b]) => b.p_keep <= 0.2) : pairs.filter(([b]) => b.p_keep >= 0.8);
		const inverted = cfg.group === 'clutter' ? baseConfident.filter(([, x]) => x.p_keep >= 0.8) : baseConfident.filter(([, x]) => x.p_keep <= 0.2);
		const correctLabel = cfg.group === 'clutter' ? (p => p < 0.5) : (p => p >= 0.5);
		const baseCorrect = pairs.filter(([b]) => correctLabel(b.p_keep));
		const nowWrong = baseCorrect.filter(([, x]) => !correctLabel(x.p_keep));
		const rec = {
			group: cfg.group, channel: cfg.channel, desc: cfg.desc, n,
			base_mean_p: r3(mean(base)), variant_mean_p: r3(mean(var_)), mean_shift: r3(mean(shift)), median_shift: r3(quantile(shift, 0.5)),
			flip_rate: r3(flips.length / n), flips: flips.length, directional_flips: dir.length, directional_flip_rate: r3(dir.length / n),
			flips_surviving_0_8_band: surviving.length, frac_of_flips_surviving: dir.length ? r3(surviving.length / dir.length) : null,
			base_confident_n: baseConfident.length, base_confident_fully_inverted: inverted.length,
			base_correct_n: baseCorrect.length, base_correct_now_wrong: nowWrong.length, base_correct_now_wrong_rate: baseCorrect.length ? r3(nowWrong.length / baseCorrect.length) : null,
			variant_band_dist: { lo: var_.filter(p => p < 0.2).length, mid: var_.filter(p => p >= 0.2 && p <= 0.8).length, hi: var_.filter(p => p > 0.8).length },
			base_band_dist: { lo: base.filter(p => p < 0.2).length, mid: base.filter(p => p >= 0.2 && p <= 0.8).length, hi: base.filter(p => p > 0.8).length },
			examples: dir.slice(0, 5).map(([b, x]) => ({ id: b.id, base: r3(b.p_keep), variant: r3(x.p_keep), text: byId.get(b.id).text.slice(0, 80) })),
		};
		g2.variants[v] = rec;
		md.push(`| ${v} | ${cfg.group} | ${cfg.channel} | ${n} | ${rec.base_mean_p} | ${rec.variant_mean_p} | ${rec.mean_shift >= 0 ? '+' : ''}${rec.mean_shift} | ${pct(rec.flip_rate)} | ${dir.length} (${pct(rec.directional_flip_rate)}) | ${surviving.length} (${rec.frac_of_flips_surviving == null ? '-' : pct(rec.frac_of_flips_surviving)}) | ${baseConfident.length} -> ${inverted.length} | ${nowWrong.length}/${baseCorrect.length} |`);
	}
	// baseline accuracy of the two groups
	const cb = sel.g2_clutter.map(id => byKey.get(`${id}|base`)).filter(Boolean), pb = sel.g2_prose.map(id => byKey.get(`${id}|base`)).filter(Boolean);
	g2.baseline = { clutter: { n: cb.length, acc_0_5: r3(cb.filter(r => r.p_keep < 0.5).length / cb.length), mean_p: r3(mean(cb.map(r => r.p_keep))), frac_le_0_2: r3(cb.filter(r => r.p_keep <= 0.2).length / cb.length) }, prose: { n: pb.length, acc_0_5: r3(pb.filter(r => r.p_keep >= 0.5).length / pb.length), mean_p: r3(mean(pb.map(r => r.p_keep))), frac_ge_0_8: r3(pb.filter(r => r.p_keep >= 0.8).length / pb.length) } };
	md.push(`baseline: clutter acc@0.5 ${g2.baseline.clutter.acc_0_5} (mean p ${g2.baseline.clutter.mean_p}, <=0.2: ${pct(g2.baseline.clutter.frac_le_0_2)}); prose acc@0.5 ${g2.baseline.prose.acc_0_5} (mean p ${g2.baseline.prose.mean_p}, >=0.8: ${pct(g2.baseline.prose.frac_ge_0_8)})`);
	// Defuddle deterministic comparison
	const rows = JSON.parse(readFileSync(`${DIR}/g2d-rows.json`, 'utf8'));
	const g2dSummary = JSON.parse(readFileSync(`${DIR}/g2d-summary.json`, 'utf8'));
	g2.defuddle_deterministic = g2dSummary;
	g2.defuddle_d_unchanged_reasons = rows.filter(r => r.attack === 'd' && !r.flipped).map(r => ({ id: r.id, tag: r.tag, removal_step: r.removal_step, removal_reason: r.removal_reason, orig_class: r.orig_class, orig_id: r.orig_id }));
	g2.defuddle_d_flipped = rows.filter(r => r.attack === 'd' && r.flipped).map(r => ({ id: r.id, tag: r.tag, mod_status: r.mod_status, main_changed: r.main_changed, mod_selector: r.mod_selector.slice(0, 80), words_delta: r.mod_words - r.base_words }));
	g2.defuddle_f_unchanged = rows.filter(r => r.attack === 'f' && !r.flipped).map(r => ({ id: r.id, tag: r.tag, base_selector: r.base_selector.slice(0, 60) }));
	md.push('\nDefuddle deterministic pipeline on attribute-attacked fixtures (same attack strings):');
	md.push('| attack | group | n | flipped to target | mixed | unchanged | main container changed | mean output word delta |\n|---|---|---|---|---|---|---|---|');
	for (const [k, s] of Object.entries(g2dSummary)) md.push(`| ${k} | ${s.group} | ${s.n} | ${s.flipped_to_target} | ${s.flipped_to_mixed} | ${s.unchanged} | ${s.main_container_changed} | ${s.output_words_delta_mean} |`);
	g2.usage = usageOf(loadRaw('g2'));
	md.push(`usage: ${JSON.stringify(g2.usage)}`);
	out.g2 = g2;
}

// ---------------- G3 ----------------
{
	const raw = loadRaw('g3').filter(r => !r.error);
	const byKey = new Map(raw.map(r => [`${r.id}|${r.form}`, r]));
	const ids = sel.g3.filter(id => ['keep', 'clutter', 'choice', 'choice_rev', 'batched'].every(f => byKey.has(`${id}|${f}`)));
	const labels = ids.map(id => byId.get(id).label);
	const pk = ids.map(id => byKey.get(`${id}|keep`).answers.keep.noul);
	const pc = ids.map(id => byKey.get(`${id}|clutter`).answers.clutter.noul);
	const ch = ids.map(id => byKey.get(`${id}|choice`).answers.kr);
	const chr = ids.map(id => byKey.get(`${id}|choice_rev`).answers.rk);
	const bt = ids.map(id => byKey.get(`${id}|batched`).answers);
	const n = ids.length;
	const argKeepNoul = pk.map(p => p >= 0.5), argKeepClutter = pc.map(p => p < 0.5);
	const argKeepCh = ch.map(a => a.choice === 'keep'), argKeepChr = chr.map(a => a.choice === 'keep');
	const dis = (a, b) => a.filter((x, i) => x !== b[i]).length;
	const coh = pk.map((p, i) => Math.abs(p + pc[i] - 1));
	const cohB = bt.map(a => Math.abs(a.keep.noul + a.clutter.noul - 1));
	const chKeepP = ch.map(a => a.probabilities.keep), chrKeepP = chr.map(a => a.probabilities.keep);
	const accOf = arg => r3(arg.filter((k, i) => k === (labels[i] === 'kept')).length / n);
	const noulBest = bestThreshold(pk, labels);
	const chBest = bestThreshold(chKeepP, labels);
	const chrBest = bestThreshold(chrKeepP, labels);
	const transfer = f1Stats(chKeepP.map(p => p < noulBest.t ? 'removed' : 'kept'), labels);
	const transferRev = f1Stats(chrKeepP.map(p => p < noulBest.t ? 'removed' : 'kept'), labels);
	const g3 = {
		n,
		coherence: { mean_abs_sum_minus_1_separate: r3(mean(coh)), p90: r3(quantile(coh, 0.9)), max: r3(Math.max(...coh)), mean_abs_sum_minus_1_batched: r3(mean(cohB)), mean_signed_sum_minus_1: r3(mean(pk.map((p, i) => p + pc[i] - 1))) },
		accuracy_at_0_5: { keep_noul: accOf(argKeepNoul), clutter_noul: accOf(argKeepClutter), choice_keep_remove: accOf(argKeepCh), choice_remove_keep: accOf(argKeepChr), batched_keep: accOf(bt.map(a => a.keep.noul >= 0.5)), batched_choice: accOf(bt.map(a => a.kr.choice === 'keep')) },
		argmax_flip_rates: {
			keep_vs_negated: r3(dis(argKeepNoul, argKeepClutter) / n), keep_vs_choice: r3(dis(argKeepNoul, argKeepCh) / n), keep_vs_choice_rev: r3(dis(argKeepNoul, argKeepChr) / n),
			choice_vs_choice_rev: r3(dis(argKeepCh, argKeepChr) / n), negated_vs_choice: r3(dis(argKeepClutter, argKeepCh) / n),
			batched_vs_separate: { keep: r3(dis(argKeepNoul, bt.map(a => a.keep.noul >= 0.5)) / n), clutter: r3(dis(argKeepClutter, bt.map(a => a.clutter.noul < 0.5)) / n), choice: r3(dis(argKeepCh, bt.map(a => a.kr.choice === 'keep')) / n), choice_rev: r3(dis(argKeepChr, bt.map(a => a.rk.choice === 'keep')) / n) },
			any_form_disagrees: r3(ids.filter((_, i) => new Set([argKeepNoul[i], argKeepClutter[i], argKeepCh[i], argKeepChr[i]]).size > 1).length / n),
		},
		probability_shifts: { mean_abs_noul_vs_choiceKeep: r3(mean(pk.map((p, i) => Math.abs(p - chKeepP[i])))), mean_abs_choice_vs_rev_keepP: r3(mean(chKeepP.map((p, i) => Math.abs(p - chrKeepP[i])))), p90_abs_choice_vs_rev: r3(quantile(chKeepP.map((p, i) => Math.abs(p - chrKeepP[i])), 0.9)), max_abs_choice_vs_rev: r3(Math.max(...chKeepP.map((p, i) => Math.abs(p - chrKeepP[i])))), mean_signed_rev_minus_fwd_keepP: r3(mean(chrKeepP.map((p, i) => p - chKeepP[i]))), mean_abs_batched_vs_separate_keep: r3(mean(pk.map((p, i) => Math.abs(p - bt[i].keep.noul)))), mean_abs_noul_vs_1minusClutter: r3(mean(coh)) },
		first_option_share: { choice_keep_first_picks_keep: r3(argKeepCh.filter(Boolean).length / n), choice_remove_first_picks_keep: r3(argKeepChr.filter(Boolean).length / n), noul_picks_keep: r3(argKeepNoul.filter(Boolean).length / n), truth_kept: r3(labels.filter(l => l === 'kept').length / n) },
		choice_extremes: { choice_keepP_eq_1_or_0: r3(chKeepP.filter(p => p >= 0.999 || p <= 0.001).length / n), noul_eq_1_or_0: r3(pk.filter(p => p >= 0.999 || p <= 0.001).length / n), mean_choice_confidence: r3(mean(ch.map(a => a.confidence))) },
		threshold_transfer: { noul_best: noulBest, choice_best: chBest, choice_rev_best: chrBest, noul_t_applied_to_choice: transfer, noul_t_applied_to_choice_rev: transferRev, choice_at_0_5: f1Stats(chKeepP.map(p => p < 0.5 ? 'removed' : 'kept'), labels), noul_at_0_5: f1Stats(pk.map(p => p < 0.5 ? 'removed' : 'kept'), labels) },
		band_coverage: Object.fromEntries([['keep_noul', pk], ['one_minus_clutter', pc.map(p => 1 - p)], ['choice_keepP', chKeepP], ['choice_rev_keepP', chrKeepP]].map(([k, ps]) => { const conf = ps.map((p, i) => [p, i]).filter(([p]) => p <= 0.2 || p >= 0.8); return [k, { coverage: r3(conf.length / n), accuracy_in_band: conf.length ? r3(conf.filter(([p, i]) => (p >= 0.8) === (labels[i] === 'kept')).length / conf.length) : null }]; })),
		usage: usageOf(loadRaw('g3')),
	};
	out.g3 = g3;
	md.push('\n## G3 Phrasing / option order (150 units)');
	md.push(`coherence P(keep)+P(clutter): mean |sum-1| ${g3.coherence.mean_abs_sum_minus_1_separate} (p90 ${g3.coherence.p90}, max ${g3.coherence.max}); batched ${g3.coherence.mean_abs_sum_minus_1_batched}; signed mean ${g3.coherence.mean_signed_sum_minus_1}`);
	md.push(`accuracy@0.5: ${JSON.stringify(g3.accuracy_at_0_5)}`);
	md.push(`argmax flip rates: ${JSON.stringify(g3.argmax_flip_rates)}`);
	md.push(`probability shifts: ${JSON.stringify(g3.probability_shifts)}`);
	md.push(`first-option share: ${JSON.stringify(g3.first_option_share)}; extremes: ${JSON.stringify(g3.choice_extremes)}`);
	md.push(`threshold transfer: noul best t=${noulBest.t} F1=${noulBest.f1}; choice own best t=${chBest.t} F1=${chBest.f1}; noul t applied to choice F1=${transfer.f1} (acc ${transfer.accuracy}); choice@0.5 F1=${g3.threshold_transfer.choice_at_0_5.f1}; noul@0.5 F1=${g3.threshold_transfer.noul_at_0_5.f1}`);
	md.push(`band coverage: ${JSON.stringify(g3.band_coverage)}`);
	md.push(`usage: ${JSON.stringify(g3.usage)}`);
}

// ---------------- G4 ----------------
{
	const raw = loadRaw('g4').filter(r => !r.error);
	const byKey = new Map(raw.map(r => [`${r.id}|${r.level}`, r]));
	const levels = ['alone_plain', 'alone_marked', 'parent', 'grandparent', 'body'];
	const ids = sel.g4.filter(id => levels.every(l => byKey.has(`${id}|${l}`)));
	const g4 = { n: ids.length, levels: {} };
	md.push('\n## G4 Context dilution (100 units; marked question at all marked levels)');
	md.push('| level | n | mean input tokens | max tokens | truncated | acc@0.5 | acc kept | acc removed | mean |p - p_alone_marked| | flip vs alone_marked | mean |p - p_alone_plain| | band>=0.8/<=0.2 coverage | acc in band | p50 latency ms |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
	for (const lv of levels) {
		const rs = ids.map(id => byKey.get(`${id}|${lv}`));
		const am = ids.map(id => byKey.get(`${id}|alone_marked`)), ap = ids.map(id => byKey.get(`${id}|alone_plain`));
		const lab = ids.map(id => byId.get(id).label);
		const correct = rs.map((r, i) => (r.p_keep >= 0.5) === (lab[i] === 'kept'));
		const keptIdx = lab.map((l, i) => l === 'kept' ? i : -1).filter(i => i >= 0), remIdx = lab.map((l, i) => l === 'removed' ? i : -1).filter(i => i >= 0);
		const conf = rs.map((r, i) => [r.p_keep, i]).filter(([p]) => p <= 0.2 || p >= 0.8);
		const lat = rs.map(r => r.latency_ms);
		const rec = {
			n: rs.length, mean_input_tokens: Math.round(mean(rs.map(r => r.usage.input_tokens))), max_input_tokens: Math.max(...rs.map(r => r.usage.input_tokens)), truncated: rs.filter(r => r.truncated).length,
			accuracy: r3(correct.filter(Boolean).length / rs.length), accuracy_kept: r3(keptIdx.filter(i => correct[i]).length / keptIdx.length), accuracy_removed: r3(remIdx.filter(i => correct[i]).length / remIdx.length),
			mean_abs_dp_vs_alone_marked: r3(mean(rs.map((r, i) => Math.abs(r.p_keep - am[i].p_keep)))), flip_vs_alone_marked: r3(rs.filter((r, i) => (r.p_keep >= 0.5) !== (am[i].p_keep >= 0.5)).length / rs.length),
			mean_abs_dp_vs_alone_plain: r3(mean(rs.map((r, i) => Math.abs(r.p_keep - ap[i].p_keep)))), flip_vs_alone_plain: r3(rs.filter((r, i) => (r.p_keep >= 0.5) !== (ap[i].p_keep >= 0.5)).length / rs.length),
			mean_p_kept: r3(mean(keptIdx.map(i => rs[i].p_keep))), mean_p_removed: r3(mean(remIdx.map(i => rs[i].p_keep))),
			band_coverage: r3(conf.length / rs.length), band_accuracy: conf.length ? r3(conf.filter(([p, i]) => (p >= 0.8) === (lab[i] === 'kept')).length / conf.length) : null,
			latency_p50: quantile(lat, 0.5), latency_p90: quantile(lat, 0.9),
		};
		g4.levels[lv] = rec;
		md.push(`| ${lv} | ${rec.n} | ${rec.mean_input_tokens} | ${rec.max_input_tokens} | ${rec.truncated} | ${rec.accuracy} | ${rec.accuracy_kept} | ${rec.accuracy_removed} | ${rec.mean_abs_dp_vs_alone_marked} | ${pct(rec.flip_vs_alone_marked)} | ${rec.mean_abs_dp_vs_alone_plain} | ${pct(rec.band_coverage)} | ${rec.band_accuracy} | ${rec.latency_p50} |`);
	}
	// accuracy vs token bucket for body level
	const bodyRows = ids.map(id => byKey.get(`${id}|body`));
	const buckets = [[0, 1000], [1000, 3000], [3000, 6000], [6000, 9000]];
	g4.body_by_tokens = buckets.map(([lo, hi]) => { const rs = bodyRows.map((r, i) => [r, i]).filter(([r]) => r.usage.input_tokens >= lo && r.usage.input_tokens < hi); return { tokens: `${lo}-${hi}`, n: rs.length, accuracy: rs.length ? r3(rs.filter(([r, i]) => (r.p_keep >= 0.5) === (byId.get(ids[i]).label === 'kept')).length / rs.length) : null, mean_abs_dp_vs_alone: rs.length ? r3(mean(rs.map(([r, i]) => Math.abs(r.p_keep - byKey.get(`${ids[i]}|alone_marked`).p_keep)))) : null }; });
	// per-level: did Jev judge the context instead of the marked element? Compare p at body level for removed units inside content-rich pages
	g4.per_unit = ids.map(id => ({ id, label: byId.get(id).label, p: Object.fromEntries(levels.map(l => [l, r3(byKey.get(`${id}|${l}`).p_keep)])), tokens: Object.fromEntries(levels.map(l => [l, byKey.get(`${id}|${l}`).usage.input_tokens])) }));
	g4.usage = usageOf(loadRaw('g4'));
	md.push(`body level accuracy by actual input tokens: ${JSON.stringify(g4.body_by_tokens)}`);
	md.push(`usage: ${JSON.stringify(g4.usage)}`);
	out.g4 = g4;
}

// ---------------- totals ----------------
{
	const files = readdirSync(DIR).filter(f => f.startsWith('usage-'));
	const all = ['g1', 'g2', 'g3', 'g4'].map(g => [g, usageOf(loadRaw(g))]);
	out.totals = { per_experiment: Object.fromEntries(all), input_tokens: all.reduce((s, [, u]) => s + u.input_tokens, 0), calls: all.reduce((s, [, u]) => s + u.calls, 0), errors: all.reduce((s, [, u]) => s + u.errors, 0), est_cost_usd: +(all.reduce((s, [, u]) => s + u.input_tokens, 0) / 1e6 * 0.042).toFixed(4), usage_files: files };
	md.push(`\n## Totals\n${JSON.stringify(out.totals)}`);
}
saveJson('analysis.json', out);
console.log(md.join('\n'));
