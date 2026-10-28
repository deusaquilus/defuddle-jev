// G3 Phrasing/order: 150 units x {keep noul, clutter noul, choice(keep,remove), choice(remove,keep), batched all-four}.
// Usage: bash -ic 'node g3.mjs'
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadUnits, loadJson, keepQuestion, clutterQuestion, choiceQuestion, appendRaw, loadDone, saveJson, MODEL, CONCURRENCY } from './common.mjs';

const FORMS = {
	keep: () => ({ keep: keepQuestion() }),
	clutter: () => ({ clutter: clutterQuestion() }),
	choice: () => ({ kr: choiceQuestion(false) }),
	choice_rev: () => ({ rk: choiceQuestion(true) }),
	batched: () => ({ keep: keepQuestion(), clutter: clutterQuestion(), kr: choiceQuestion(false), rk: choiceQuestion(true) }),
};
const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const ids = loadJson('selections.json').g3;
const jobs = [];
for (const id of ids) for (const form of Object.keys(FORMS)) jobs.push({ id, form });
const done = loadDone('g3', r => `${r.id}|${r.form}`);
const todo = jobs.filter(j => !done.has(`${j.id}|${j.form}`));
console.log(`[g3] jobs=${jobs.length} todo=${todo.length} model=${MODEL}`);
const t0 = Date.now();
let n = 0, errs = 0;
await mapConcurrent(todo, async (j) => {
	const u = byId.get(j.id);
	const rec = { exp: 'g3', ...j, label: u.label, state_chars: u.html.length, ts_ms: Date.now() };
	try {
		const r = await systemOne({ state: u.html, questions: FORMS[j.form](), model: MODEL });
		rec.model = r.model; rec.usage = r.usage; rec.latency_ms = r.latency_ms;
		rec.answers = r.answers;
	} catch (e) { rec.error = String(e.message || e).slice(0, 300); errs++; }
	appendRaw('g3', rec);
	n++;
	if (n % 100 === 0) console.log(`[g3] ${n}/${todo.length} errors=${errs} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}, CONCURRENCY);
const totals = usageTotals();
console.log(`[g3] done n=${n} errors=${errs} wall=${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(totals));
saveJson(`usage-g3-${Date.now()}.json`, { exp: 'g3', jobs_run: n, errors: errs, wall_s: (Date.now() - t0) / 1000, ...totals });
