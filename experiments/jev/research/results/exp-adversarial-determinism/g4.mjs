// G4 Context dilution: 100 units x {alone_plain, alone_marked, parent, grandparent, body(~8k tokens)}.
// The unit is marked data-judge="1"; the marked question names that element. Usage: bash -ic 'node g4.mjs [--dry]'
import { systemOne, mapConcurrent, usageTotals, estimateTokens } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadUnits, loadJson, keepQuestion, keepMarkedQuestion, appendRaw, loadDone, saveJson, MODEL, CONCURRENCY,
	dupRankOf, locateUnit, parseLinkedomHTML, fixtureHtml, fixtureUrl, cleanHtml } from './common.mjs';

const dry = process.argv.includes('--dry');
const BODY_CHAR_CAP = 28000;   // ~8k tokens of HTML at ~3.5 chars/token
const MARK = 'data-judge="1"';

/** Clean + cap an HTML string, keeping a window around the data-judge marker. */
function capAround(html, cap) {
	const h = cleanHtml(html, Number.MAX_SAFE_INTEGER);
	if (h.length <= cap) return { html: h, truncated: false };
	const i = h.indexOf(MARK);
	let start = Math.max(0, i - Math.floor(cap / 2));
	let end = Math.min(h.length, start + cap);
	start = Math.max(0, end - cap);
	return { html: (start > 0 ? '<!-- ...truncated... -->' : '') + h.slice(start, end) + (end < h.length ? '<!-- ...truncated... -->' : ''), truncated: true };
}

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const ids = loadJson('selections.json').g4;

// Build all states first (pure DOM work), so the API phase is simple and resumable.
const states = [];
for (const id of ids) {
	const u = byId.get(id);
	const html = fixtureHtml(u.fixture);
	const url = fixtureUrl(u.fixture, html);
	const doc = parseLinkedomHTML(html, url);
	const el = locateUnit(doc, u, dupRankOf(units, u));
	if (!el) { console.error('locate failed', id); continue; }
	el.setAttribute('data-judge', '1');
	const parent = el.parentElement, grand = parent?.parentElement;
	const body = doc.body;
	const lv = {
		alone_plain: { html: u.html, marked: false },
		alone_marked: { html: cleanHtml(el.outerHTML), marked: true },
		parent: { ...capAround(parent.outerHTML, BODY_CHAR_CAP), marked: true, is_body: parent === body, tag: parent.tagName.toLowerCase() },
		grandparent: grand ? { ...capAround(grand.outerHTML, BODY_CHAR_CAP), marked: true, is_body: grand === body, tag: grand.tagName.toLowerCase() } : null,
		body: { ...capAround(body.outerHTML, BODY_CHAR_CAP), marked: true, is_body: true, tag: 'body' },
	};
	for (const [level, s] of Object.entries(lv)) {
		if (!s) continue;
		if (s.marked && !s.html.includes(MARK)) { console.error('marker lost', id, level); continue; }
		states.push({ id, level, label: u.label, depth: u.depth, html: s.html, marked: s.marked, truncated: !!s.truncated, is_body: !!s.is_body, ctx_tag: s.tag || u.tag, est_tokens: estimateTokens(s.html, true) });
	}
}
const byLevel = {};
for (const s of states) { (byLevel[s.level] ||= []).push(s.est_tokens); }
console.log('[g4] states built:', states.length, Object.fromEntries(Object.entries(byLevel).map(([k, v]) => [k, { n: v.length, est_tokens_mean: Math.round(v.reduce((a, b) => a + b, 0) / v.length), max: Math.max(...v) }])));
console.log('[g4] truncated:', states.filter(s => s.truncated).length, 'parent==body:', states.filter(s => s.level === 'parent' && s.is_body).length, 'grandparent==body:', states.filter(s => s.level === 'grandparent' && s.is_body).length);
console.log('[g4] est total tokens:', states.reduce((a, s) => a + s.est_tokens, 0));
if (dry) process.exit(0);

const done = loadDone('g4', r => `${r.id}|${r.level}`);
const todo = states.filter(s => !done.has(`${s.id}|${s.level}`));
console.log(`[g4] todo=${todo.length} model=${MODEL}`);
const t0 = Date.now();
let n = 0, errs = 0;
await mapConcurrent(todo, async (s) => {
	const q = { keep: s.marked ? keepMarkedQuestion() : keepQuestion() };
	const rec = { exp: 'g4', id: s.id, level: s.level, label: s.label, depth: s.depth, marked: s.marked, truncated: s.truncated, is_body: s.is_body, ctx_tag: s.ctx_tag, state_chars: s.html.length, ts_ms: Date.now() };
	try {
		const r = await systemOne({ state: s.html, questions: q, model: MODEL });
		rec.model = r.model; rec.p_keep = r.answers.keep.noul; rec.usage = r.usage; rec.latency_ms = r.latency_ms;
	} catch (e) { rec.error = String(e.message || e).slice(0, 300); errs++; }
	appendRaw('g4', rec);
	n++;
	if (n % 100 === 0) console.log(`[g4] ${n}/${todo.length} errors=${errs} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}, CONCURRENCY);
const totals = usageTotals();
console.log(`[g4] done n=${n} errors=${errs} wall=${((Date.now() - t0) / 1000).toFixed(1)}s`, JSON.stringify(totals));
saveJson(`usage-g4-${Date.now()}.json`, { exp: 'g4', jobs_run: n, errors: errs, wall_s: (Date.now() - t0) / 1000, ...totals });
