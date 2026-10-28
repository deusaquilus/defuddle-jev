// G1b: (call 6) identical repeat minutes after call 1; plus near-identical perturbations of the same state:
//   ws  = state + one trailing space;  attr = root element gets data-x="1".
// Usage: bash -ic 'node g1b.mjs'
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadUnits, loadJson, keepQuestion, appendRaw, loadDone, saveJson, MODEL, CONCURRENCY, insertAfterOpen, splitOpenTag } from './common.mjs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const ids = loadJson('selections.json').g1;
const kinds = {
	identical6: h => h,
	ws: h => h + ' ',
	attr: h => { const { tag, attrs, rest } = splitOpenTag(h); return `<${tag} data-x="1"${attrs}>${rest}`; },
};
const done = loadDone('g1b', r => `${r.id}|${r.kind}`);
const jobs = [];
for (const id of ids) for (const kind of Object.keys(kinds)) if (!done.has(`${id}|${kind}`)) jobs.push({ id, kind });
console.log(`[g1b] todo=${jobs.length} model=${MODEL}`);
const q = { keep: keepQuestion() };
const t0 = Date.now();
let n = 0, errs = 0;
await mapConcurrent(jobs, async (j) => {
	const u = byId.get(j.id);
	const state = kinds[j.kind](u.html);
	const rec = { exp: 'g1b', ...j, label: u.label, state_chars: state.length, ts_ms: Date.now() };
	try {
		const r = await systemOne({ state, questions: q, model: MODEL });
		rec.model = r.model; rec.p_keep = r.answers.keep.noul; rec.usage = r.usage; rec.latency_ms = r.latency_ms;
	} catch (e) { rec.error = String(e.message || e).slice(0, 300); errs++; }
	appendRaw('g1b', rec);
	n++;
}, CONCURRENCY);
const totals = usageTotals();
console.log(`[g1b] done n=${n} errors=${errs} wall=${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(totals));
saveJson(`usage-g1b-${Date.now()}.json`, { exp: 'g1b', jobs_run: n, errors: errs, wall_s: (Date.now() - t0) / 1000, ...totals });
