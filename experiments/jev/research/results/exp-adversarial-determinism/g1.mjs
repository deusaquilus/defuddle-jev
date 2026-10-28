// G1 Determinism: 150 units x 5 identical calls. Pass A makes calls 1 and 2 back-to-back (same second);
// passes B, C, D make calls 3, 4, 5 later. Usage: bash -ic 'node g1.mjs [A|B|C|D]'
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadUnits, loadJson, keepQuestion, appendRaw, loadDone, saveJson, MODEL, CONCURRENCY } from './common.mjs';

const pass = process.argv[2] || 'A';
const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const ids = loadJson('selections.json').g1;
const done = loadDone('g1', r => `${r.id}|${r.call_no}`);
const q = { keep: keepQuestion() };
const callNos = pass === 'A' ? [1, 2] : pass === 'B' ? [3] : pass === 'C' ? [4] : [5];
const todo = ids.filter(id => callNos.some(c => !done.has(`${id}|${c}`)));
console.log(`[g1 pass ${pass}] units=${ids.length} todo=${todo.length} calls=${callNos.join(',')} model=${MODEL}`);
const t0 = Date.now();
let n = 0, errs = 0;
await mapConcurrent(todo, async (id) => {
	const u = byId.get(id);
	for (const callNo of callNos) {
		if (done.has(`${id}|${callNo}`)) continue;
		const rec = { exp: 'g1', pass, call_no: callNo, id, label: u.label, state_chars: u.html.length, ts_ms: Date.now() };
		try {
			const r = await systemOne({ state: u.html, questions: q, model: MODEL });
			rec.model = r.model; rec.p_keep = r.answers.keep.noul; rec.usage = r.usage; rec.latency_ms = r.latency_ms;
		} catch (e) { rec.error = String(e.message || e).slice(0, 300); errs++; }
		appendRaw('g1', rec);
	}
	n++;
	if (n % 50 === 0) console.log(`[g1 ${pass}] ${n}/${todo.length} errors=${errs} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}, CONCURRENCY);
const totals = usageTotals();
console.log(`[g1 ${pass}] done n=${n} errors=${errs} wall=${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(totals));
saveJson(`usage-g1-${pass}-${Date.now()}.json`, { exp: 'g1', pass, units_run: n, errors: errs, wall_s: (Date.now() - t0) / 1000, ...totals });
