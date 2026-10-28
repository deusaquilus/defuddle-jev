// Addendum analysis: G1b (later repeat + near-identical perturbations), p-value quantization, G2 breakdowns,
// Defuddle text-channel results, G4/G3 examples. Writes analysis-addendum.json and prints Markdown.
import { readFileSync } from 'node:fs';
import { loadUnits, loadJson, loadRaw, saveJson, mean, quantile, r3, DIR } from './common.mjs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const sel = loadJson('selections.json');
const out = {}; const md = [];
const pct = x => (100 * x).toFixed(1) + '%';

// ---- G1b ----
{
	const g1 = loadRaw('g1').filter(r => !r.error);
	const g1b = loadRaw('g1b').filter(r => !r.error);
	const c1 = new Map(g1.filter(r => r.call_no === 1).map(r => [r.id, r]));
	const per = new Map(); for (const r of g1) (per.get(r.id) || per.set(r.id, []).get(r.id)).push(r.p_keep);
	const kinds = {};
	for (const kind of ['identical6', 'ws', 'attr']) {
		const rs = g1b.filter(r => r.kind === kind && c1.has(r.id));
		const d = rs.map(r => Math.abs(r.p_keep - c1.get(r.id).p_keep));
		const gap = rs.map(r => (r.ts_ms - c1.get(r.id).ts_ms) / 1000);
		// compare also against the 5-call envelope: is the perturbed value inside [min,max] of the identical repeats?
		const inside = rs.filter(r => { const ps = per.get(r.id); return r.p_keep >= Math.min(...ps) && r.p_keep <= Math.max(...ps); }).length;
		kinds[kind] = { n: rs.length, mean_gap_s: r3(mean(gap)), mean_abs_diff_vs_call1: r3(mean(d)), p90_abs_diff: r3(quantile(d, 0.9)), max_abs_diff: r3(Math.max(...d)), frac_identical_to_call1: r3(rs.filter(r => r.p_keep === c1.get(r.id).p_keep).length / rs.length), flips_0_5_vs_call1: rs.filter(r => (r.p_keep >= 0.5) !== (c1.get(r.id).p_keep >= 0.5)).length, inside_5call_envelope: r3(inside / rs.length), tokens_per_call: Math.round(mean(rs.map(r => r.usage.input_tokens))) };
	}
	// 6-call spread (5 identical + identical6)
	const six = [...per.entries()].map(([id, ps]) => { const r6 = g1b.find(r => r.kind === 'identical6' && r.id === id); return r6 ? [...ps, r6.p_keep] : null; }).filter(Boolean);
	const spread6 = six.map(ps => Math.max(...ps) - Math.min(...ps));
	// quantization: are all p values multiples of 0.01?
	const allP = [...g1, ...g1b, ...loadRaw('g2'), ...loadRaw('g4')].filter(r => !r.error).map(r => r.p_keep);
	const nonCent = allP.filter(p => Math.abs(p * 100 - Math.round(p * 100)) > 1e-9).length;
	out.g1b = { kinds, six_call_spread: { n: six.length, mean: r3(mean(spread6)), median: r3(quantile(spread6, 0.5)), p90: r3(quantile(spread6, 0.9)), max: r3(Math.max(...spread6)), frac_zero: r3(spread6.filter(s => s === 0).length / six.length), flips_0_5: six.filter(ps => ps.some(p => p >= 0.5) && ps.some(p => p < 0.5)).length }, quantization: { values_checked: allP.length, not_multiple_of_0_01: nonCent, distinct_values: new Set(allP).size } };
	md.push('## G1b later repeat and near-identical perturbations (vs call 1)');
	md.push('| kind | n | mean gap s | mean abs diff | p90 | max | identical to call1 | flips@0.5 | inside 5-call envelope |\n|---|---|---|---|---|---|---|---|---|');
	for (const [k, v] of Object.entries(kinds)) md.push(`| ${k} | ${v.n} | ${v.mean_gap_s} | ${v.mean_abs_diff_vs_call1} | ${v.p90_abs_diff} | ${v.max_abs_diff} | ${pct(v.frac_identical_to_call1)} | ${v.flips_0_5_vs_call1} | ${pct(v.inside_5call_envelope)} |`);
	md.push(`6-call spread: ${JSON.stringify(out.g1b.six_call_spread)}; quantization: ${JSON.stringify(out.g1b.quantization)}`);
}

// ---- G2 breakdowns + Defuddle text channel ----
{
	const raw = loadRaw('g2').filter(r => !r.error); const K = new Map(raw.map(r => [r.id + '|' + r.variant, r]));
	const buckets = [[20, 40], [40, 80], [80, 150], [150, 400]];
	const byWords = {}, byTag = {};
	for (const v of ['e', 'f', 'g']) {
		const rows = sel.g2_prose.map(id => ({ u: byId.get(id), b: K.get(id + '|base'), x: K.get(id + '|' + v) })).filter(r => r.b && r.x);
		byWords[v] = buckets.map(([lo, hi]) => { const rs = rows.filter(r => r.u.words >= lo && r.u.words < hi); return { words: `${lo}-${hi}`, n: rs.length, flip_rate: rs.length ? r3(rs.filter(r => r.b.p_keep >= 0.5 && r.x.p_keep < 0.5).length / rs.length) : null, mean_variant_p: rs.length ? r3(mean(rs.map(r => r.x.p_keep))) : null, variant_p_le_0_2: rs.filter(r => r.x.p_keep <= 0.2).length }; });
		byTag[v] = ['p', 'div'].map(t => { const rs = rows.filter(r => r.u.tag === t); return { tag: t, n: rs.length, flip_rate: rs.length ? r3(rs.filter(r => r.b.p_keep >= 0.5 && r.x.p_keep < 0.5).length / rs.length) : null, mean_variant_p: rs.length ? r3(mean(rs.map(r => r.x.p_keep))) : null }; });
	}
	// a block-level text attack: how much of the block is the injected text?
	const injFrac = sel.g2_prose.map(id => byId.get(id)).map(u => 9 / (u.words + 9));
	out.g2_breakdowns = { prose_by_words: byWords, prose_by_tag: byTag, injected_sentence_share_of_block_words: { mean: r3(mean(injFrac)), min: r3(Math.min(...injFrac)), max: r3(Math.max(...injFrac)) } };
	out.defuddle_text_channel = JSON.parse(readFileSync(`${DIR}/g2d-text-summary.json`, 'utf8'));
	const textRows = JSON.parse(readFileSync(`${DIR}/g2d-text-rows.json`, 'utf8'));
	out.defuddle_text_channel_flips = textRows.filter(r => r.flipped).map(r => ({ attack: r.attack, id: r.id, mod_status: r.mod_status, words: r.words }));
	md.push('\n## G2 prose flip rate by block length (Jev)');
	md.push('| variant | 20-40 words | 40-80 | 80-150 | 150-400 | p | div |\n|---|---|---|---|---|---|---|');
	for (const v of ['e', 'f', 'g']) md.push(`| ${v} | ${byWords[v].map(b => `${pct(b.flip_rate)} (n=${b.n})`).join(' | ')} | ${byTag[v].map(b => `${pct(b.flip_rate)} (n=${b.n})`).join(' | ')} |`);
	md.push(`Defuddle deterministic pipeline, text-channel attacks: ${JSON.stringify(out.defuddle_text_channel)}; flips: ${JSON.stringify(out.defuddle_text_channel_flips)}`);
}

// ---- G4 examples and confident-wrong counts ----
{
	const raw = loadRaw('g4').filter(r => !r.error); const K = new Map(raw.map(r => [r.id + '|' + r.level, r]));
	const levels = ['alone_marked', 'parent', 'grandparent', 'body'];
	const ids = sel.g4.filter(id => levels.every(l => K.has(id + '|' + l)));
	const rem = ids.filter(id => byId.get(id).label === 'removed'), kept = ids.filter(id => byId.get(id).label === 'kept');
	out.g4_extra = {
		removed_units_confidently_wrong_p_ge_0_8: Object.fromEntries(levels.map(l => [l, rem.filter(id => K.get(id + '|' + l).p_keep >= 0.8).length])),
		kept_units_confidently_wrong_p_le_0_2: Object.fromEntries(levels.map(l => [l, kept.filter(id => K.get(id + '|' + l).p_keep <= 0.2).length])),
		mean_p_removed_by_level: Object.fromEntries(levels.map(l => [l, r3(mean(rem.map(id => K.get(id + '|' + l).p_keep)))])),
		mean_p_kept_by_level: Object.fromEntries(levels.map(l => [l, r3(mean(kept.map(id => K.get(id + '|' + l).p_keep)))])),
		removed_flipped_to_keep_at_body: rem.filter(id => K.get(id + '|alone_marked').p_keep < 0.5 && K.get(id + '|body').p_keep >= 0.5).map(id => ({ id, p_alone: K.get(id + '|alone_marked').p_keep, p_parent: K.get(id + '|parent').p_keep, p_body: K.get(id + '|body').p_keep, body_tokens: K.get(id + '|body').usage.input_tokens, step: byId.get(id).hints.removal_step, text: byId.get(id).text.slice(0, 70) })),
		kept_flipped_to_remove_at_body: kept.filter(id => K.get(id + '|alone_marked').p_keep >= 0.5 && K.get(id + '|body').p_keep < 0.5).map(id => ({ id, p_alone: K.get(id + '|alone_marked').p_keep, p_body: K.get(id + '|body').p_keep, text: byId.get(id).text.slice(0, 70) })),
		body_truncated_accuracy: (() => { const t = ids.filter(id => K.get(id + '|body').truncated), nt = ids.filter(id => !K.get(id + '|body').truncated); const acc = s => s.length ? r3(s.filter(id => (K.get(id + '|body').p_keep >= 0.5) === (byId.get(id).label === 'kept')).length / s.length) : null; return { truncated: { n: t.length, acc: acc(t) }, not_truncated: { n: nt.length, acc: acc(nt) } }; })(),
	};
	md.push('\n## G4 extra');
	md.push(JSON.stringify(out.g4_extra, null, 1));
}

// ---- G3 examples: largest order shifts, noul-vs-choice disagreements ----
{
	const raw = loadRaw('g3').filter(r => !r.error); const K = new Map(raw.map(r => [r.id + '|' + r.form, r]));
	const ids = sel.g3.filter(id => ['keep', 'clutter', 'choice', 'choice_rev'].every(f => K.has(id + '|' + f)));
	const rows = ids.map(id => ({ id, label: byId.get(id).label, keep: K.get(id + '|keep').answers.keep.noul, clutter: K.get(id + '|clutter').answers.clutter.noul, ch: K.get(id + '|choice').answers.kr.probabilities.keep, chr: K.get(id + '|choice_rev').answers.rk.probabilities.keep, text: byId.get(id).text.slice(0, 60) }));
	out.g3_examples = {
		largest_order_shift: rows.map(r => ({ ...r, d: r3(Math.abs(r.ch - r.chr)) })).sort((a, b) => b.d - a.d).slice(0, 6),
		worst_coherence: rows.map(r => ({ ...r, d: r3(Math.abs(r.keep + r.clutter - 1)) })).sort((a, b) => b.d - a.d).slice(0, 6),
		noul_mid_band_count: rows.filter(r => r.keep > 0.2 && r.keep < 0.8).length, choice_mid_band_count: rows.filter(r => r.ch > 0.2 && r.ch < 0.8).length,
		choice_prob_at_extremes: { keep_eq_1: rows.filter(r => r.ch >= 0.999).length, keep_eq_0: rows.filter(r => r.ch <= 0.001).length, rev_keep_eq_1: rows.filter(r => r.chr >= 0.999).length, rev_keep_eq_0: rows.filter(r => r.chr <= 0.001).length },
	};
	md.push('\n## G3 examples');
	md.push(JSON.stringify(out.g3_examples, null, 1));
}
saveJson('analysis-addendum.json', out);
console.log(md.join('\n'));
