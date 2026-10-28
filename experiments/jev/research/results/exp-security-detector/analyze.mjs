// Analysis of jev-raw.jsonl against det-audit.json labels.
import { readFileSync, writeFileSync } from 'node:fs';
const OUT_DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-security-detector';
const audit = JSON.parse(readFileSync(`${OUT_DIR}/det-audit.json`, 'utf8'));
const byId = Object.fromEntries(audit.map(a => [a.id, a]));
const recs = readFileSync(`${OUT_DIR}/jev-raw.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const V = v => recs.filter(r => r.variant === v);
const ok = r => r.answers && !r.error;
const pct = (n, d) => d ? +(100 * n / d).toFixed(1) : null;
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const r3 = x => x == null ? null : +x.toFixed(3);

const EXPECTED = {
	script: ['script_element'], handler: ['event_handler_attribute'], js_url: ['javascript_or_vbscript_url'], js_url_obf: ['javascript_or_vbscript_url'],
	data_url: ['data_or_blob_url_document'], blob_url: ['data_or_blob_url_document'], srcdoc: ['srcdoc_base_or_meta_refresh'], base: ['srcdoc_base_or_meta_refresh'],
	meta_refresh: ['srcdoc_base_or_meta_refresh'], plugin: ['object_embed_or_applet', 'data_or_blob_url_document'], smil: ['svg_smil_animation', 'event_handler_attribute'],
	svg_foreign: ['script_element', 'event_handler_attribute'], mathml: ['javascript_or_vbscript_url'], svg_use_data: ['data_or_blob_url_document'],
	style_import: ['css_javascript_or_expression'], css: ['css_javascript_or_expression'], template: ['script_element'], noscript: ['script_element'], mxss: ['event_handler_attribute'], link_import: [],
};
const CAT_NOUL = { script: 'has_script_element', handler: 'has_event_handler_attribute', js_url: 'has_javascript_url', js_url_obf: 'has_javascript_url', data_url: 'has_data_or_blob_document_url', blob_url: 'has_data_or_blob_document_url', srcdoc: 'has_srcdoc_base_or_meta_refresh', base: 'has_srcdoc_base_or_meta_refresh', meta_refresh: 'has_srcdoc_base_or_meta_refresh', plugin: 'has_object_embed_applet', smil: 'has_smil_animation', mathml: 'has_javascript_url', svg_foreign: null, svg_use_data: 'has_data_or_blob_document_url', style_import: null, css: null, template: 'has_script_element', noscript: 'has_script_element', mxss: 'has_event_handler_attribute', link_import: null };
const CAT_NOULS = ['has_script_element', 'has_event_handler_attribute', 'has_javascript_url', 'has_data_or_blob_document_url', 'has_srcdoc_base_or_meta_refresh', 'has_object_embed_applet', 'has_smil_animation'];
const orScore = r => Math.max(...CAT_NOULS.map(k => r.answers[k].noul));
const choicePos = r => r.answers.attack_type.choice !== 'none';

function auc(pos, neg) {
	let s = 0; for (const p of pos) for (const n of neg) s += p > n ? 1 : p === n ? 0.5 : 0;
	return pos.length && neg.length ? s / (pos.length * neg.length) : null;
}
function classify(rs, scoreFn, label = 'unsafe-noul') {
	const mal = rs.filter(r => r.label === 'malicious'), ben = rs.filter(r => r.label === 'benign');
	const out = { label, n_mal: mal.length, n_ben: ben.length, auc: r3(auc(mal.map(scoreFn), ben.map(scoreFn))), thresholds: {} };
	for (const t of [0.3, 0.5, 0.7, 0.9]) {
		out.thresholds[t] = { TPR: pct(mal.filter(r => scoreFn(r) >= t).length, mal.length), FPR: pct(ben.filter(r => scoreFn(r) >= t).length, ben.length),
			TPR_modern: pct(mal.filter(r => r.exec === 'modern' && scoreFn(r) >= t).length, mal.filter(r => r.exec === 'modern').length),
			missed_modern: mal.filter(r => r.exec === 'modern' && scoreFn(r) < t).map(r => `${r.id}=${scoreFn(r).toFixed(2)}`),
			false_pos: ben.filter(r => scoreFn(r) >= t).map(r => `${r.id}(${r.category})=${scoreFn(r).toFixed(2)}`) };
	}
	out.bands = { mal_ge_0_9: pct(mal.filter(r => scoreFn(r) >= 0.9).length, mal.length), mal_0_1_to_0_9: pct(mal.filter(r => scoreFn(r) > 0.1 && scoreFn(r) < 0.9).length, mal.length), mal_le_0_1: pct(mal.filter(r => scoreFn(r) <= 0.1).length, mal.length),
		ben_ge_0_9: pct(ben.filter(r => scoreFn(r) >= 0.9).length, ben.length), ben_0_1_to_0_9: pct(ben.filter(r => scoreFn(r) > 0.1 && scoreFn(r) < 0.9).length, ben.length), ben_le_0_1: pct(ben.filter(r => scoreFn(r) <= 0.1).length, ben.length) };
	out.by_exec = {}; for (const e of ['modern', 'legacy', 'inert']) { const xs = mal.filter(r => r.exec === e); out.by_exec[e] = { n: xs.length, mean: r3(mean(xs.map(scoreFn))), ge_0_5: xs.filter(r => scoreFn(r) >= 0.5).length, ge_0_9: xs.filter(r => scoreFn(r) >= 0.9).length }; }
	return out;
}
function perCategory(rs, scoreFn) {
	const cats = {};
	for (const r of rs) { const k = `${r.label}:${r.category}`; (cats[k] ||= []).push(r); }
	const out = {};
	for (const [k, xs] of Object.entries(cats).sort()) out[k] = { n: xs.length, mean: r3(mean(xs.map(scoreFn))), min: r3(Math.min(...xs.map(scoreFn))), max: r3(Math.max(...xs.map(scoreFn))), ge_0_5: xs.filter(r => scoreFn(r) >= 0.5).length, ge_0_9: xs.filter(r => scoreFn(r) >= 0.9).length, items: xs.map(r => `${r.id}=${scoreFn(r).toFixed(2)}`).join(' ') };
	return out;
}

const A = {};
const raw = V('raw_r1').filter(ok);
A.counts = { records: recs.length, ok: recs.filter(ok).length, errors: recs.filter(r => r.error).length, skipped_empty: recs.filter(r => r.skipped_empty).length, by_variant: Object.fromEntries(['raw_r1', 'raw_r2', 'raw_r3', 'stripped', 'embedded', 'pipeline'].map(v => [v, { ok: V(v).filter(ok).length, err: V(v).filter(r => r.error).length, skipped: V(v).filter(r => r.skipped_empty).length }])), models: [...new Set(recs.filter(ok).map(r => r.model))] };

// 1. raw: main noul
A.raw_unsafe_noul = classify(raw, r => r.answers.unsafe.noul);
A.raw_unsafe_noul_per_category = perCategory(raw, r => r.answers.unsafe.noul);
// 2. raw: OR of category nouls
A.raw_or_category_nouls = classify(raw, orScore, 'max(category nouls)');
// 3. raw: choice
{
	const mal = raw.filter(r => r.label === 'malicious'), ben = raw.filter(r => r.label === 'benign');
	const correctCat = r => { const exp = EXPECTED[r.category] || []; return exp.length ? exp.includes(r.answers.attack_type.choice) : choicePos(r); };
	const bands = { '>=0.9': x => x >= 0.9, '0.7-0.9': x => x >= 0.7 && x < 0.9, '0.5-0.7': x => x >= 0.5 && x < 0.7, '<0.5': x => x < 0.5 };
	A.raw_choice = {
		mal_flagged_non_none: pct(mal.filter(choicePos).length, mal.length), mal_correct_category: pct(mal.filter(correctCat).length, mal.length),
		ben_flagged_non_none: pct(ben.filter(choicePos).length, ben.length), ben_false_pos: ben.filter(choicePos).map(r => `${r.id}(${r.category})->${r.answers.attack_type.choice}@${r.answers.attack_type.confidence}`),
		mal_missed_none: mal.filter(r => !choicePos(r)).map(r => `${r.id}(${r.category},${r.exec}) p_none=${r.answers.attack_type.probabilities.none}`),
		mal_wrong_category: mal.filter(r => choicePos(r) && !correctCat(r)).map(r => `${r.id}(${r.category})->${r.answers.attack_type.choice}`),
		p_none_as_score: classify(raw, r => 1 - r.answers.attack_type.probabilities.none, '1-P(none)'),
		confidence_bands: Object.fromEntries(Object.entries(bands).map(([b, f]) => { const xs = raw.filter(r => f(r.answers.attack_type.confidence)); const acc = xs.filter(r => (r.label === 'malicious') === choicePos(r)).length; return [b, { n: xs.length, share: pct(xs.length, raw.length), accuracy_mal_vs_none: pct(acc, xs.length) }]; })),
		prob_sum_dev: r3(mean(raw.map(r => Math.abs(Object.values(r.answers.attack_type.probabilities).reduce((a, b) => a + b, 0) - 1)))),
	};
}
// 4. category nouls: did the right one fire?
{
	const mal = raw.filter(r => r.label === 'malicious' && CAT_NOUL[r.category]);
	A.raw_category_noul_targeting = { n: mal.length, right_noul_ge_0_5: pct(mal.filter(r => r.answers[CAT_NOUL[r.category]].noul >= 0.5).length, mal.length), right_noul_ge_0_9: pct(mal.filter(r => r.answers[CAT_NOUL[r.category]].noul >= 0.9).length, mal.length),
		wrong_noul_fired_ge_0_5: mal.filter(r => CAT_NOULS.some(k => k !== CAT_NOUL[r.category] && r.answers[k].noul >= 0.5)).map(r => `${r.id}:${CAT_NOULS.filter(k => k !== CAT_NOUL[r.category] && r.answers[k].noul >= 0.5).join(',')}`),
		right_noul_missed: mal.filter(r => r.answers[CAT_NOUL[r.category]].noul < 0.5).map(r => `${r.id}(${r.category},${r.exec}) ${CAT_NOUL[r.category]}=${r.answers[CAT_NOUL[r.category]].noul}`) };
	const ben = raw.filter(r => r.label === 'benign');
	A.raw_category_nouls_benign_fp = Object.fromEntries(CAT_NOULS.map(k => [k, { ge_0_5: ben.filter(r => r.answers[k].noul >= 0.5).map(r => `${r.id}=${r.answers[k].noul}`), ge_0_3: ben.filter(r => r.answers[k].noul >= 0.3).length, max: Math.max(...ben.map(r => r.answers[k].noul)) }]));
	A.raw_escaped_flag_noul = { benign_escaped_code_mean: r3(mean(ben.filter(r => r.category === 'escaped_code').map(r => r.answers.is_only_escaped_code_or_prose.noul))), benign_xss_prose_mean: r3(mean(ben.filter(r => r.category === 'xss_prose').map(r => r.answers.is_only_escaped_code_or_prose.noul))), malicious_mean: r3(mean(raw.filter(r => r.label === 'malicious').map(r => r.answers.is_only_escaped_code_or_prose.noul))), malicious_ge_0_5: raw.filter(r => r.label === 'malicious' && r.answers.is_only_escaped_code_or_prose.noul >= 0.5).map(r => `${r.id}=${r.answers.is_only_escaped_code_or_prose.noul}`) };
}
// 5. hard benign subsets
{
	const ben = raw.filter(r => r.label === 'benign');
	A.raw_hard_benign = {};
	for (const c of ['escaped_code', 'xss_prose', 'embed', 'media', 'link', 'misc']) { const xs = ben.filter(r => r.category === c); A.raw_hard_benign[c] = { n: xs.length, unsafe_mean: r3(mean(xs.map(r => r.answers.unsafe.noul))), unsafe_max: Math.max(...xs.map(r => r.answers.unsafe.noul)), ge_0_3: xs.filter(r => r.answers.unsafe.noul >= 0.3).map(r => `${r.id}=${r.answers.unsafe.noul}`), ge_0_5: xs.filter(r => r.answers.unsafe.noul >= 0.5).length, choice_non_none: xs.filter(choicePos).length }; }
}
// 6. obfuscated payloads
{
	const obf = raw.filter(r => ['M15', 'M16', 'M17', 'M18', 'M19', 'M27', 'M28', 'M29', 'M30', 'M31', 'M32', 'M33', 'M41', 'M43', 'M44', 'M45', 'M46', 'M47', 'M48', 'M52'].includes(r.id));
	A.raw_obfuscated = obf.map(r => ({ id: r.id, cat: r.category, exec: r.exec, note: byId[r.id].note, unsafe: r.answers.unsafe.noul, choice: r.answers.attack_type.choice, conf: r.answers.attack_type.confidence, cat_noul: CAT_NOUL[r.category] ? r.answers[CAT_NOUL[r.category]].noul : null }));
	A.raw_obfuscated_summary = { n: obf.length, unsafe_ge_0_5: obf.filter(r => r.answers.unsafe.noul >= 0.5).length, unsafe_ge_0_9: obf.filter(r => r.answers.unsafe.noul >= 0.9).length, choice_non_none: obf.filter(choicePos).length, modern_only: { n: obf.filter(r => r.exec === 'modern').length, unsafe_ge_0_5: obf.filter(r => r.exec === 'modern' && r.answers.unsafe.noul >= 0.5).length, unsafe_ge_0_9: obf.filter(r => r.exec === 'modern' && r.answers.unsafe.noul >= 0.9).length } };
}
// 7. stability across raw repeats
{
	const ids = raw.map(r => r.id);
	const trip = ids.map(id => ['raw_r1', 'raw_r2', 'raw_r3'].map(v => V(v).find(r => r.id === id))).filter(t => t.every(ok));
	const diffs = trip.map(t => Math.max(...t.map(r => r.answers.unsafe.noul)) - Math.min(...t.map(r => r.answers.unsafe.noul)));
	A.stability = { n_triples: trip.length, unsafe_range_mean: r3(mean(diffs)), unsafe_range_max: r3(Math.max(...diffs)), unsafe_range_ge_0_1: diffs.filter(d => d >= 0.1).length,
		flips_at_0_5: trip.filter(t => new Set(t.map(r => r.answers.unsafe.noul >= 0.5)).size > 1).map(t => `${t[0].id}:${t.map(r => r.answers.unsafe.noul).join('/')}`),
		flips_at_0_9: trip.filter(t => new Set(t.map(r => r.answers.unsafe.noul >= 0.9)).size > 1).length,
		choice_argmax_changes: trip.filter(t => new Set(t.map(r => r.answers.attack_type.choice)).size > 1).map(t => `${t[0].id}:${t.map(r => r.answers.attack_type.choice).join('/')}`),
		identical_responses: trip.filter(t => JSON.stringify(t[0].answers) === JSON.stringify(t[1].answers) && JSON.stringify(t[1].answers) === JSON.stringify(t[2].answers)).length };
	// pooled over 3 repeats
	const pooled = ['raw_r1', 'raw_r2', 'raw_r3'].flatMap(v => V(v).filter(ok));
	A.raw_pooled_3_repeats_unsafe = classify(pooled, r => r.answers.unsafe.noul, 'unsafe-noul pooled 3 repeats');
}
// 8. stripped output (false alarms on sanitized output + fuzz-oracle value)
{
	const st = V('stripped');
	const okst = st.filter(ok);
	const survivors = new Set(audit.filter(a => a.strip_linkedom.detect.spec.length).map(a => a.id));
	const safeOut = okst.filter(r => !survivors.has(r.id));
	A.stripped = { n_called: okst.length, n_skipped_empty: st.filter(r => r.skipped_empty).length, skipped_ids: st.filter(r => r.skipped_empty).map(r => r.id),
		deterministic_survivors: [...survivors].map(id => ({ id, cat: byId[id].category, exec: byId[id].exec, flags: byId[id].strip_linkedom.detect.spec, jev_unsafe: okst.find(r => r.id === id)?.answers.unsafe.noul ?? 'n/a', jev_choice: okst.find(r => r.id === id)?.answers.attack_type.choice ?? 'n/a', jev_cat_noul_srcdoc_base_meta: okst.find(r => r.id === id)?.answers.has_srcdoc_base_or_meta_refresh.noul ?? 'n/a' })),
		safe_output_false_alarm: { n: safeOut.length, unsafe_ge_0_5: safeOut.filter(r => r.answers.unsafe.noul >= 0.5).map(r => `${r.id}(${r.label}/${r.category})=${r.answers.unsafe.noul} out=${JSON.stringify(byId[r.id].strip_linkedom.out.slice(0, 120))}`), unsafe_ge_0_3: safeOut.filter(r => r.answers.unsafe.noul >= 0.3).map(r => `${r.id}=${r.answers.unsafe.noul}`), unsafe_ge_0_9: safeOut.filter(r => r.answers.unsafe.noul >= 0.9).length, choice_non_none: safeOut.filter(choicePos).map(r => `${r.id}->${r.answers.attack_type.choice}@${r.answers.attack_type.confidence}`), or_nouls_ge_0_5: safeOut.filter(r => orScore(r) >= 0.5).map(r => `${r.id}=${orScore(r).toFixed(2)}`), unsafe_mean: r3(mean(safeOut.map(r => r.answers.unsafe.noul))) },
		safe_output_false_alarm_by_label: { malicious_sanitized: (() => { const xs = safeOut.filter(r => r.label === 'malicious'); return { n: xs.length, ge_0_5: xs.filter(r => r.answers.unsafe.noul >= 0.5).length, ge_0_3: xs.filter(r => r.answers.unsafe.noul >= 0.3).length, mean: r3(mean(xs.map(r => r.answers.unsafe.noul))) }; })(), benign: (() => { const xs = safeOut.filter(r => r.label === 'benign'); return { n: xs.length, ge_0_5: xs.filter(r => r.answers.unsafe.noul >= 0.5).length, ge_0_3: xs.filter(r => r.answers.unsafe.noul >= 0.3).length, mean: r3(mean(xs.map(r => r.answers.unsafe.noul))) }; })() },
		drop_raw_to_stripped_malicious: r3(mean(okst.filter(r => r.label === 'malicious' && !survivors.has(r.id)).map(r => raw.find(x => x.id === r.id).answers.unsafe.noul - r.answers.unsafe.noul))) };
}
// 9. embedded in article
A.embedded_unsafe_noul = classify(V('embedded').filter(ok), r => r.answers.unsafe.noul, 'unsafe-noul embedded in ~1.1k-token article');
A.embedded_or_category_nouls = classify(V('embedded').filter(ok), orScore, 'max(category nouls) embedded');
A.embedded_choice = { mal_flagged_non_none: pct(V('embedded').filter(ok).filter(r => r.label === 'malicious' && choicePos(r)).length, V('embedded').filter(ok).filter(r => r.label === 'malicious').length), ben_flagged_non_none: V('embedded').filter(ok).filter(r => r.label === 'benign' && choicePos(r)).map(r => `${r.id}->${r.answers.attack_type.choice}`) };
A.embedded_vs_raw_delta_unsafe_malicious = r3(mean(V('embedded').filter(ok).filter(r => r.label === 'malicious').map(r => r.answers.unsafe.noul - raw.find(x => x.id === r.id).answers.unsafe.noul)));
// 10. pipeline output
{
	const pl = V('pipeline').filter(ok);
	const surv = new Set(audit.filter(a => a.pipeline_default.detect.spec.length).map(a => a.id));
	const safe = pl.filter(r => !surv.has(r.id));
	A.pipeline = { n: pl.length, deterministic_survivors: [...surv].map(id => ({ id, flags: byId[id].pipeline_default.detect.spec, jev_unsafe: pl.find(r => r.id === id)?.answers.unsafe.noul, jev_choice: pl.find(r => r.id === id)?.answers.attack_type.choice })), safe_output_unsafe_ge_0_5: safe.filter(r => r.answers.unsafe.noul >= 0.5).map(r => `${r.id}=${r.answers.unsafe.noul}`), safe_output_unsafe_ge_0_3: safe.filter(r => r.answers.unsafe.noul >= 0.3).map(r => `${r.id}=${r.answers.unsafe.noul}`), safe_output_choice_non_none: safe.filter(choicePos).map(r => `${r.id}->${r.answers.attack_type.choice}`), unsafe_mean: r3(mean(safe.map(r => r.answers.unsafe.noul))), unsafe_max: Math.max(...safe.map(r => r.answers.unsafe.noul)) };
}
// 11. deterministic detector vs Jev on raw inputs
{
	const mal = audit.filter(a => a.label === 'malicious'), ben = audit.filter(a => a.label === 'benign');
	A.deterministic_detector_on_raw = { spec_TPR: pct(mal.filter(a => a.raw_detect.spec.length).length, mal.length), spec_TPR_modern: pct(mal.filter(a => a.exec === 'modern' && a.raw_detect.spec.length).length, mal.filter(a => a.exec === 'modern').length), spec_FPR: pct(ben.filter(a => a.raw_detect.spec.length).length, ben.length), spec_misses: mal.filter(a => !a.raw_detect.spec.length).map(a => `${a.id}(${a.category},${a.exec})`), regex_TPR: pct(mal.filter(a => a.raw_detect.regex.length).length, mal.length), regex_FPR: pct(ben.filter(a => a.raw_detect.regex.length).length, ben.length), regex_fp: ben.filter(a => a.raw_detect.regex.length).map(a => `${a.id}:${a.raw_detect.regex.join('|')}`),
		strip_changed_as_signal: { TPR: pct(mal.filter(a => a.strip_linkedom.changed).length, mal.length), FPR: pct(ben.filter(a => a.strip_linkedom.changed).length, ben.length), benign_changed: ben.filter(a => a.strip_linkedom.changed).map(a => a.id), malicious_unchanged: mal.filter(a => !a.strip_linkedom.changed).map(a => `${a.id}(${a.category},${a.exec})`) } };
	// Jev's unique catches: raw_detect misses but Jev >=0.5
	A.jev_catches_detector_misses = mal.filter(a => !a.raw_detect.spec.length).map(a => { const r = raw.find(x => x.id === a.id); return { id: a.id, cat: a.category, exec: a.exec, jev_unsafe: r?.answers.unsafe.noul, jev_choice: r?.answers.attack_type.choice }; });
}
// 12. cost / latency
{
	const okr = recs.filter(ok);
	const lat = okr.map(r => r.latency_ms).sort((a, b) => a - b), q = p => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))];
	const toks = okr.map(r => r.usage.input_tokens);
	A.cost_latency = { calls: okr.length, input_tokens_total: toks.reduce((a, b) => a + b, 0), input_tokens_mean: Math.round(mean(toks)), input_tokens_by_variant: Object.fromEntries(['raw_r1', 'stripped', 'embedded', 'pipeline'].map(v => [v, Math.round(mean(V(v).filter(ok).map(r => r.usage.input_tokens)))])), est_cost_usd_total: +(toks.reduce((a, b) => a + b, 0) / 1e6 * 0.042).toFixed(4), est_cost_per_call_usd: +(mean(toks) / 1e6 * 0.042).toFixed(6), latency_ms: { p50: q(0.5), p90: q(0.9), p99: q(0.99), max: lat[lat.length - 1] }, questions_per_call: 10, note: 'questions dominate tokens (~1,250 of ~1,300 tokens for a 40-char fragment); a 10-question request on a 1.1k-token article is ~1,870 tokens' };
}
writeFileSync(`${OUT_DIR}/analysis.json`, JSON.stringify(A, null, 1));
console.log(JSON.stringify(A, null, 1));
