// Usage: bash -ic 'node run-variant.mjs v1|v2|v3 [--limit N] [--ids id1,id2]'
// Resumable: skips ids already present in raw-<variant>.jsonl. Appends one JSON line per unit.
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadUnits, subsampleIds, questions, stateFor, loadDone, appendResult, MODEL, DIR } from './common.mjs';
import { writeFileSync } from 'node:fs';

const variant = process.argv[2];
if (!['v1', 'v2', 'v3', 'v1r'].includes(variant)) throw new Error('variant required: v1|v2|v3');
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx > 0 ? +process.argv[limitIdx + 1] : Infinity;
const idsIdx = process.argv.indexOf('--ids');
const onlyIds = idsIdx > 0 ? new Set(process.argv[idsIdx + 1].split(',')) : null;
const concurrency = 8;

const all = loadUnits();
let units = all;
if (variant !== 'v1') { const ids = subsampleIds(all); units = all.filter(u => ids.has(u.id)); }
if (onlyIds) units = units.filter(u => onlyIds.has(u.id));
const done = loadDone(variant);
const todo = units.filter(u => !done.has(u.id)).slice(0, limit);
console.log(`[${variant}] units=${units.length} done=${done.size} todo=${todo.length} model=${MODEL}`);

const q = questions();
let n = 0, errs = 0;
const t0 = Date.now();
await mapConcurrent(todo, async (u) => {
	const state = stateFor(variant, u);
	const stateChars = typeof state === 'string' ? state.length : JSON.stringify(state).length;
	const rec = { variant, id: u.id, fixture: u.fixture, label: u.label, state_chars: stateChars, ts: new Date().toISOString() };
	try {
		const r = await systemOne({ state, questions: q, model: MODEL });
		rec.model = r.model;
		rec.p_keep = r.answers.keep.noul;
		rec.kind = r.answers.kind.choice;
		rec.kind_confidence = r.answers.kind.confidence;
		rec.kind_probabilities = r.answers.kind.probabilities;
		rec.usage = r.usage;
		rec.latency_ms = r.latency_ms;
	} catch (e) {
		rec.error = String(e.message || e).slice(0, 300);
		errs++;
	}
	appendResult(variant, rec);
	n++;
	if (n % 100 === 0) console.log(`[${variant}] ${n}/${todo.length} errors=${errs} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}, concurrency);

const totals = usageTotals();
console.log(`[${variant}] finished ${n} units, errors=${errs}, wall=${((Date.now() - t0) / 1000).toFixed(1)}s`);
console.log(JSON.stringify(totals));
writeFileSync(`${DIR}/usage-${variant}-${Date.now()}.json`, JSON.stringify({ variant, units_run: n, errors: errs, wall_s: (Date.now() - t0) / 1000, ...totals }, null, 2));
