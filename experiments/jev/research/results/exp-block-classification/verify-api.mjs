// Liveness/integrity check: re-query 12 units from raw-v1.jsonl (same state, same questions, pinned model)
// and compare with the stored answers. ~12 calls, ~12k input tokens. NEVER logs the key.
// Run: bash -ic 'node /home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/verify-api.mjs'
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadUnits, loadRaw, questions, stateFor, MODEL, DIR, shuffled } from './common.mjs';
import { writeFileSync } from 'node:fs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const prev = new Map(loadRaw('v1').map(r => [r.id, r]));
const pick = shuffled([...prev.keys()], 2026).slice(0, 12);
const q = questions();
const rows = await mapConcurrent(pick, async id => {
	const u = byId.get(id);
	const r = await systemOne({ state: stateFor('v1', u), questions: q, model: MODEL });
	const p = prev.get(id);
	return { id, model: r.model, p_keep_prev: p.p_keep, p_keep_now: r.answers.keep.noul, kind_prev: p.kind, kind_now: r.answers.kind.choice, latency_ms: r.latency_ms, input_tokens: r.usage?.input_tokens, prev_input_tokens: p.usage?.input_tokens };
}, 4);
const ok = rows.filter(r => !r.error);
const dp = ok.map(r => Math.abs(r.p_keep_prev - r.p_keep_now));
const res = { n: ok.length, errors: rows.length - ok.length, models: [...new Set(ok.map(r => r.model))], mean_abs_dp: +(dp.reduce((a, b) => a + b, 0) / Math.max(1, dp.length)).toFixed(4), max_abs_dp: Math.max(...dp), decision_flips_05: ok.filter(r => (r.p_keep_prev >= 0.5) !== (r.p_keep_now >= 0.5)).length, kind_flips: ok.filter(r => r.kind_prev !== r.kind_now).length, token_match: ok.filter(r => r.input_tokens === r.prev_input_tokens).length, rows, usage: usageTotals() };
console.log(JSON.stringify(res, null, 1));
writeFileSync(`${DIR}/verify-api-${Date.now()}.json`, JSON.stringify(res, null, 1));
