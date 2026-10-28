// Cost / latency / limits model for four Jev integration shapes, driven by measurements.json.
// NO API CALLS. Writes model-output.md and metrics.json next to this file.
// Run: node /home/alexi/git/defuddle/experiments/jev/research/results/measure-cost/model.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/measure-cost';
const M = JSON.parse(readFileSync(`${OUT}/measurements.json`, 'utf8'));
const rows = M.rows;

// ---------------- assumptions (all stated in the report) ----------------
const A = {
	price_per_token_usd: 0.042 / 1e6,          // $0.042 per 1M input tokens, output free
	per_question_limit: 32_000,                // state + that question
	per_request_limit: 64_000,                 // interpretation A: state once + all questions (see note)
	s1_question_overhead_tokens: 300,          // per per-block request: criteria/instructions + framing
	s1c_tokens_per_question: 60,               // one Noul naming a block id
	s1c_annotation_tokens_per_block: 6,        // data-b="123" attribute added to every block in the state
	s2_tokens_nominal: 2_000,                  // container Choice request, range 1.5-3k
	s2_tokens_range: [1_500, 3_000],
	s2_tokens_per_candidate: 150,              // alt estimate: candidate summary (tag, selector, words, 300-char excerpt)
	latency_small_ms: 250,                     // per request, small state (<~4k tokens), well-connected client
	latency_large_ms: 500,                     // per request, multi-thousand-token state or gateway hop
	concurrency: 8,
	rate_rpm: 1_200,                           // community-cited org limit
	rate_tps: 250_000,                         // community-cited org limit
	defuddle_md_price_usd: [0.003, 0.005],     // per request (SCOUT_NOTES)
	real_threshold_bytes: 20_000,              // "real full page" = raw HTML > 20 KB (decimal)
	typical_real_page: { raw_kb: 120, html_tokens: [15_000, 25_000, 40_000], text_tokens: [1_500, 2_500, 4_000] }, // task-stated assumption
};

// ---------------- helpers ----------------
const sum = a => a.reduce((s, x) => s + x, 0);
const mean = a => a.length ? sum(a) / a.length : 0;
function pct(arr, p) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; }
function dist(arr, digits = 0) {
	const f = x => x == null ? null : +x.toFixed(digits);
	return { n: arr.length, min: f(Math.min(...arr)), p25: f(pct(arr, .25)), median: f(pct(arr, .5)), mean: f(mean(arr)), p75: f(pct(arr, .75)), p90: f(pct(arr, .9)), max: f(Math.max(...arr)) };
}
const usd = x => x < 0.001 ? `$${x.toFixed(6)}` : `$${x.toFixed(4)}`;
const fmt = x => typeof x === 'number' ? (Number.isInteger(x) ? x.toLocaleString('en-US') : x.toFixed(2)) : String(x);
function mdTable(headers, lines) {
	return ['| ' + headers.join(' | ') + ' |', '|' + headers.map(() => '---').join('|') + '|', ...lines.map(l => '| ' + l.map(fmt).join(' | ') + ' |')].join('\n');
}

// ---------------- per-fixture shape computations ----------------
for (const r of rows) {
	// S1: one request per block
	r.s1_requests = r.units;
	r.s1_tokens = r.est_tokens_units_sum + r.units * A.s1_question_overhead_tokens;
	r.s1_cost = r.s1_tokens * A.price_per_token_usd;
	r.s1_latency_seq_ms = r.units * A.latency_small_ms;
	r.s1_latency_c8_ms = Math.ceil(r.units / A.concurrency) * A.latency_small_ms;
	r.s1_max_block_tokens = Math.round(r.units_max_chars / M.assumptions.HTML_BYTES_PER_TOKEN) + A.s1_question_overhead_tokens;
	r.s1_exceeds_q_limit = r.s1_max_block_tokens > A.per_question_limit;

	// S1c: one request per page; state = annotated cleaned body HTML; N Nouls naming block ids
	r.s1c_state_tokens = r.est_tokens_html_body + r.units * A.s1c_annotation_tokens_per_block;
	r.s1c_question_tokens = r.units * A.s1c_tokens_per_question;
	r.s1c_tokens = r.s1c_state_tokens + r.s1c_question_tokens;
	r.s1c_cost = r.s1c_tokens * A.price_per_token_usd;
	r.s1c_exceeds_q_limit = (r.s1c_state_tokens + A.s1c_tokens_per_question) > A.per_question_limit;
	r.s1c_exceeds_req_limit = r.s1c_tokens > A.per_request_limit;
	r.s1c_exceeds_any = r.s1c_exceeds_q_limit || r.s1c_exceeds_req_limit;
	// chunked fallback: split the state into <=(32k-60)-token chunks, each carrying its own blocks' questions
	r.s1c_chunks = Math.max(1, Math.ceil(r.s1c_state_tokens / (A.per_question_limit - A.s1c_tokens_per_question)));
	r.s1c_latency_ms = r.s1c_state_tokens > 4_000 ? A.latency_large_ms : A.latency_small_ms;
	r.s1c_latency_chunked_c8_ms = Math.ceil(r.s1c_chunks / A.concurrency) * A.latency_large_ms;

	// S2: container Choice, one request
	r.s2_tokens = A.s2_tokens_nominal;
	r.s2_tokens_from_candidates = Math.min(A.s2_tokens_range[1], Math.max(A.s2_tokens_range[0], 300 + r.entry_candidates_unique * A.s2_tokens_per_candidate));
	r.s2_cost = r.s2_tokens * A.price_per_token_usd;
	r.s2_latency_ms = A.latency_small_ms;
	r.s2_choice_options = r.entry_candidates_unique + 1; // + escape option
	r.s2_exceeds_options = r.s2_choice_options > 255;

	// gates
	r.gate_loose = r.gate_fires; // any retry branch (incl. <200-word partial retry) OR body/empty pick
	r.gate_strict = r.retry_hidden_fired || r.retry_index_fired || r.schema_retry_fired || r.schema_text_used || r.selector_is_body_or_empty; // <50-word branches + schema + body

	// S4: S1 + S2 every page
	r.s4_requests = r.s1_requests + 1;
	r.s4_tokens = r.s1_tokens + r.s2_tokens;
	r.s4_cost = r.s4_tokens * A.price_per_token_usd;
	r.s4_latency_c8_ms = r.s1_latency_c8_ms + A.latency_small_ms; // S2 after S1 (container choice needs no block answers; could run in parallel = max())
	r.s4_latency_par_ms = Math.max(r.s1_latency_c8_ms, A.latency_small_ms);
}

const real = rows.filter(r => r.raw_bytes > A.real_threshold_bytes).sort((a, b) => b.raw_bytes - a.raw_bytes);
const synth = rows.filter(r => r.raw_bytes <= A.real_threshold_bytes);
const extractorRows = rows.filter(r => r.extractorType);
const nonExtractor = rows.filter(r => !r.extractorType);

function groupStats(g) {
	const k = key => g.map(r => r[key]);
	const frac = key => +(g.filter(r => r[key]).length / g.length).toFixed(4);
	return {
		n: g.length,
		raw_bytes: dist(k('raw_bytes')), cleaned_full_bytes: dist(k('cleaned_full_bytes')), cleaned_body_bytes: dist(k('cleaned_body_bytes')), text_bytes: dist(k('text_bytes')),
		est_tokens_html_body: dist(k('est_tokens_html_body')), est_tokens_html_full: dist(k('est_tokens_html_full')), est_tokens_text: dist(k('est_tokens_text')),
		units: dist(k('units')), units_html_chars: dist(k('units_html_chars')), est_tokens_units_sum: dist(k('est_tokens_units_sum')),
		entry_candidates_total: dist(k('entry_candidates_total')), entry_candidates_unique: dist(k('entry_candidates_unique')),
		parse_ms_dist: dist(k('parse_ms'), 1), dom_ms_dist: dist(k('dom_ms'), 1),
		ratio_cleaned_body_over_raw: dist(g.map(r => r.cleaned_body_bytes / r.raw_bytes), 3),
		ratio_text_over_raw: dist(g.map(r => r.text_bytes / r.raw_bytes), 3),
		units_per_1k_html_tokens: dist(g.map(r => r.units / Math.max(1, r.est_tokens_html_body) * 1000), 2),
		block_tokens_mean: +(sum(k('est_tokens_units_sum')) / Math.max(1, sum(k('units')))).toFixed(1),
		flags: Object.fromEntries(['retry_partial_fired', 'retry_partial_accepted', 'retry_hidden_fired', 'retry_hidden_accepted', 'retry_hidden_selector_fired', 'retry_hidden_selector_accepted', 'retry_index_fired', 'retry_index_accepted', 'schema_retry_fired', 'schema_text_used', 'any_retry_fired', 'selector_is_body_or_empty', 'gate_loose', 'gate_strict', 's1c_exceeds_q_limit', 's1c_exceeds_req_limit', 's1c_exceeds_any', 's1_exceeds_q_limit', 's2_exceeds_options'].map(f => [f, { count: g.filter(r => r[f]).length, frac: frac(f) }])),
		shapes: {
			S1: { requests: dist(k('s1_requests')), tokens: dist(k('s1_tokens')), cost_usd: dist(k('s1_cost'), 7), latency_seq_ms: dist(k('s1_latency_seq_ms')), latency_c8_ms: dist(k('s1_latency_c8_ms')), total_cost_usd: +sum(k('s1_cost')).toFixed(5), total_tokens: sum(k('s1_tokens')), total_requests: sum(k('s1_requests')) },
			S1c: { requests: 1, state_tokens: dist(k('s1c_state_tokens')), tokens: dist(k('s1c_tokens')), cost_usd: dist(k('s1c_cost'), 7), latency_ms: dist(k('s1c_latency_ms')), chunks: dist(k('s1c_chunks')), latency_chunked_c8_ms: dist(k('s1c_latency_chunked_c8_ms')), total_cost_usd: +sum(k('s1c_cost')).toFixed(5), total_tokens: sum(k('s1c_tokens')) },
			S2: { requests: 1, tokens: A.s2_tokens_nominal, tokens_from_candidates: dist(k('s2_tokens_from_candidates')), cost_usd: +(A.s2_tokens_nominal * A.price_per_token_usd).toFixed(7), latency_ms: A.latency_small_ms, choice_options: dist(k('s2_choice_options')) },
			S4: { requests: dist(k('s4_requests')), tokens: dist(k('s4_tokens')), cost_usd: dist(k('s4_cost'), 7), latency_c8_ms: dist(k('s4_latency_c8_ms')), latency_par_ms: dist(k('s4_latency_par_ms')), total_cost_usd: +sum(k('s4_cost')).toFixed(5) },
		},
	};
}
const G = { all: groupStats(rows), real: groupStats(real), synthetic: groupStats(synth), non_extractor: groupStats(nonExtractor) };

// ---------------- gated shape S3 ----------------
function gated(g, gateKey, under) {
	const f = g.filter(r => r[gateKey]).length / g.length;
	const costKey = under + '_cost';
	const expected = mean(g.map(r => r[gateKey] ? r[costKey] : 0));
	const latKey = under === 's1c' ? 's1c_latency_ms' : 's2_latency_ms';
	const expectedLat = mean(g.map(r => r[gateKey] ? r[latKey] : 0));
	return { gate_fraction: +f.toFixed(4), expected_cost_per_page_usd: +expected.toFixed(7), expected_cost_per_1000_usd: +(expected * 1000).toFixed(4), expected_added_latency_ms: +expectedLat.toFixed(0), worst_case_latency_ms: Math.max(...g.map(r => r[latKey])) };
}
const S3 = {};
for (const [gname, g] of Object.entries({ all: rows, real, synthetic: synth })) {
	S3[gname] = {};
	for (const gate of ['gate_loose', 'gate_strict']) for (const under of ['s2', 's1c']) S3[gname][`${gate}__under_${under.toUpperCase()}`] = gated(g, gate, under);
}

// ---------------- extrapolation to a typical real page ----------------
// Derived from the real group's measured ratios; the task's stated assumption is carried alongside.
const realUnitsPer1kTok = G.real.units_per_1k_html_tokens.median;
const realBlockTok = G.real.block_tokens_mean;
function shapesFor(htmlTokens, textTokens, unitsOverride) {
	const units = unitsOverride ?? Math.round(htmlTokens * realUnitsPer1kTok / 1000);
	const s1_tokens = Math.round(units * (realBlockTok + A.s1_question_overhead_tokens));
	const s1c_state = htmlTokens + units * A.s1c_annotation_tokens_per_block;
	const s1c_tokens = s1c_state + units * A.s1c_tokens_per_question;
	const s1c_chunks = Math.max(1, Math.ceil(s1c_state / (A.per_question_limit - A.s1c_tokens_per_question)));
	const o = {
		html_tokens: htmlTokens, text_tokens: textTokens, units,
		S1: { requests: units, tokens: s1_tokens, cost_per_page: s1_tokens * A.price_per_token_usd, cost_per_1000: s1_tokens * A.price_per_token_usd * 1000, latency_seq_ms: units * A.latency_small_ms, latency_c8_ms: Math.ceil(units / A.concurrency) * A.latency_small_ms, exceeds: false },
		S1c: { requests: s1c_chunks, state_tokens: s1c_state, tokens: s1c_tokens, cost_per_page: s1c_tokens * A.price_per_token_usd, cost_per_1000: s1c_tokens * A.price_per_token_usd * 1000, latency_ms: A.latency_large_ms * Math.ceil(s1c_chunks / A.concurrency), exceeds_q_limit: s1c_state + A.s1c_tokens_per_question > A.per_question_limit, exceeds_req_limit: s1c_tokens > A.per_request_limit, chunks_needed: s1c_chunks },
		S2: { requests: 1, tokens: A.s2_tokens_nominal, cost_per_page: A.s2_tokens_nominal * A.price_per_token_usd, cost_per_1000: A.s2_tokens_nominal * A.price_per_token_usd * 1000, latency_ms: A.latency_small_ms },
		S1c_text_state: { note: 'variant: state = body TEXT not HTML (loses markup cues)', state_tokens: textTokens, tokens: textTokens + units * A.s1c_tokens_per_question, cost_per_page: (textTokens + units * A.s1c_tokens_per_question) * A.price_per_token_usd, exceeds_q_limit: textTokens + 60 > A.per_question_limit },
	};
	o.S4 = { requests: units + 1, tokens: s1_tokens + A.s2_tokens_nominal, cost_per_page: (s1_tokens + A.s2_tokens_nominal) * A.price_per_token_usd, cost_per_1000: (s1_tokens + A.s2_tokens_nominal) * A.price_per_token_usd * 1000, latency_c8_ms: o.S1.latency_c8_ms + A.latency_small_ms };
	// rate limits
	const rps = A.rate_rpm / 60;
	o.throughput = {
		S1_pages_per_s_request_bound: +(rps / units).toFixed(3), S1_pages_per_s_token_bound: +(A.rate_tps / s1_tokens).toFixed(2), S1_pages_per_s: +Math.min(rps / units, A.rate_tps / s1_tokens).toFixed(3),
		S1c_pages_per_s_request_bound: +(rps / s1c_chunks).toFixed(2), S1c_pages_per_s_token_bound: +(A.rate_tps / s1c_tokens).toFixed(2), S1c_pages_per_s: +Math.min(rps / s1c_chunks, A.rate_tps / s1c_tokens).toFixed(2),
		S2_pages_per_s: +Math.min(rps, A.rate_tps / A.s2_tokens_nominal).toFixed(2),
		S4_pages_per_s: +Math.min(rps / (units + 1), A.rate_tps / (s1_tokens + A.s2_tokens_nominal)).toFixed(3),
	};
	for (const sh of ['S1', 'S1c', 'S2', 'S4']) { o.throughput[sh + '_pages_per_hour'] = Math.round(o.throughput[sh + '_pages_per_s'] * 3600); }
	return o;
}
const [lo, mid, hi] = A.typical_real_page.html_tokens;
const [tlo, tmid, thi] = A.typical_real_page.text_tokens;
const EXTRAP = {
	basis: { real_group_units_per_1k_html_tokens_median: realUnitsPer1kTok, real_group_block_tokens_mean: realBlockTok, real_group_cleaned_body_over_raw_median: G.real.ratio_cleaned_body_over_raw.median, real_group_text_over_raw_median: G.real.ratio_text_over_raw.median },
	measured_ratio_120kb: (() => { const cb = 120_000 * G.real.ratio_cleaned_body_over_raw.median; const tb = 120_000 * G.real.ratio_text_over_raw.median; return { cleaned_body_bytes: Math.round(cb), html_tokens: Math.round(cb / 3.5), text_bytes: Math.round(tb), text_tokens: Math.round(tb / 4) }; })(),
	low_15k: shapesFor(lo, tlo), mid_25k: shapesFor(mid, tmid), high_40k: shapesFor(hi, thi),
	heavy_80k: shapesFor(80_000, 6_000),
};
// fixture-measured throughput for the real group (median page)
const realMed = { units: G.real.units.median, s1_tokens: G.real.shapes.S1.tokens.median, s1c_tokens: G.real.shapes.S1c.tokens.median, s1c_chunks: G.real.shapes.S1c.chunks.median };
const THROUGHPUT_REAL_FIXTURE_MEDIAN = {
	S1_pages_per_s: +Math.min(20 / realMed.units, A.rate_tps / realMed.s1_tokens).toFixed(3),
	S1c_pages_per_s: +Math.min(20 / realMed.s1c_chunks, A.rate_tps / realMed.s1c_tokens).toFixed(2),
};

// ---------------- comparison with defuddle.md price and parse time ----------------
function compare(shapeCostPerPage, label) {
	return { shape: label, cost_per_page_usd: +shapeCostPerPage.toFixed(7), pct_of_defuddle_md_price_low: +(shapeCostPerPage / A.defuddle_md_price_usd[0] * 100).toFixed(2), pct_of_defuddle_md_price_high: +(shapeCostPerPage / A.defuddle_md_price_usd[1] * 100).toFixed(2) };
}
const COMPARE = {
	fixtures_real_median: ['S1', 'S1c', 'S2', 'S4'].map(s => compare(G.real.shapes[s].cost_usd?.median ?? G.real.shapes[s].cost_usd, s)),
	typical_real_page_mid_25k: ['S1', 'S1c', 'S2', 'S4'].map(s => compare(EXTRAP.mid_25k[s].cost_per_page, s)),
	typical_real_page_high_40k: ['S1', 'S1c', 'S2', 'S4'].map(s => compare(EXTRAP.high_40k[s].cost_per_page, s)),
	current_parse_ms: { all_median: G.all.parse_ms_dist.median, all_p90: G.all.parse_ms_dist.p90, real_median: G.real.parse_ms_dist.median, real_p90: G.real.parse_ms_dist.p90, real_max: G.real.parse_ms_dist.max },
};

// ---------------- markdown ----------------
const md = [];
md.push('# Cost / latency / limits model (measured on 226 fixtures, dist build, linkedom)');
md.push(`Generated ${new Date().toISOString()}; node ${M.node}; linkedom ${M.linkedom}. Assumptions: ${JSON.stringify(A)}`);
md.push('\n## Ten largest fixtures (raw HTML > 20,000 bytes = "real full pages"; the group has ' + real.length + ' fixtures)');
md.push(mdTable(['fixture', 'raw B', 'cleaned body B', 'text B', 'HTML tok', 'text tok', 'units', 'unit tok sum', 'cands(total/uniq)', 'selector', 'retry', 'parse ms'],
	real.slice(0, 10).map(r => [r.name, r.raw_bytes, r.cleaned_body_bytes, r.text_bytes, r.est_tokens_html_body, r.est_tokens_text, r.units, r.est_tokens_units_sum, `${r.entry_candidates_total}/${r.entry_candidates_unique}`, r.contentSelector.slice(0, 40) || '(extractor)', r.any_retry_fired ? 'yes' : 'no', r.parse_ms])));
md.push('\n## All real-group fixtures (' + real.length + ')');
md.push(mdTable(['fixture', 'raw B', 'HTML tok', 'text tok', 'units', 'S1 req', 'S1 tok', 'S1c tok', 'S1c >32k?', 'gate loose', 'gate strict', 'parse ms'],
	real.map(r => [r.name.slice(0, 55), r.raw_bytes, r.est_tokens_html_body, r.est_tokens_text, r.units, r.s1_requests, r.s1_tokens, r.s1c_tokens, r.s1c_exceeds_any ? 'YES' : 'no', r.gate_loose ? 'y' : 'n', r.gate_strict ? 'y' : 'n', r.parse_ms])));
function distTable(title, groups, keys) {
	md.push(`\n## ${title}`);
	md.push(mdTable(['metric', 'group', 'n', 'min', 'p25', 'median', 'mean', 'p75', 'p90', 'max'],
		keys.flatMap(k => groups.map(([gn, g]) => { const d = g[k]; return [k, gn, d.n, d.min, d.p25, d.median, d.mean, d.p75, d.p90, d.max]; }))));
}
distTable('Size distributions', [['all', G.all], ['real(>20KB)', G.real], ['synthetic', G.synthetic]], ['raw_bytes', 'cleaned_body_bytes', 'cleaned_full_bytes', 'text_bytes', 'est_tokens_html_body', 'est_tokens_text', 'units', 'est_tokens_units_sum', 'entry_candidates_total', 'entry_candidates_unique', 'parse_ms_dist', 'dom_ms_dist', 'ratio_cleaned_body_over_raw', 'ratio_text_over_raw', 'units_per_1k_html_tokens']);
md.push('\n## Retry-branch / gate firing (count, fraction)');
md.push(mdTable(['flag', 'all (n=' + G.all.n + ')', 'real (n=' + G.real.n + ')', 'synthetic (n=' + G.synthetic.n + ')', 'non-extractor (n=' + G.non_extractor.n + ')'],
	Object.keys(G.all.flags).map(f => [f, `${G.all.flags[f].count} (${(G.all.flags[f].frac * 100).toFixed(1)}%)`, `${G.real.flags[f].count} (${(G.real.flags[f].frac * 100).toFixed(1)}%)`, `${G.synthetic.flags[f].count} (${(G.synthetic.flags[f].frac * 100).toFixed(1)}%)`, `${G.non_extractor.flags[f].count} (${(G.non_extractor.flags[f].frac * 100).toFixed(1)}%)`])));
md.push('\n## Shapes on fixtures (per page; $ at $0.042/M input tokens)');
for (const [gn, g] of [['all', G.all], ['real(>20KB)', G.real], ['synthetic', G.synthetic]]) {
	md.push(`\n### group: ${gn}`);
	const s = g.shapes;
	md.push(mdTable(['shape', 'requests/page (med/p90/max)', 'tokens/page (med/p90/max)', '$/page (med/p90/max)', '$/1000 pages (median page)', '$/1000 pages (mean page)', 'added latency (med/max)', 'exceeds limits'], [
		['S1 per-block, 1 req/block', `${s.S1.requests.median}/${s.S1.requests.p90}/${s.S1.requests.max}`, `${s.S1.tokens.median}/${s.S1.tokens.p90}/${s.S1.tokens.max}`, `${usd(s.S1.cost_usd.median)}/${usd(s.S1.cost_usd.p90)}/${usd(s.S1.cost_usd.max)}`, usd(s.S1.cost_usd.median * 1000), usd(s.S1.cost_usd.mean * 1000), `seq ${s.S1.latency_seq_ms.median}/${s.S1.latency_seq_ms.max} ms; c8 ${s.S1.latency_c8_ms.median}/${s.S1.latency_c8_ms.max} ms`, `${g.flags.s1_exceeds_q_limit.count} (${(g.flags.s1_exceeds_q_limit.frac * 100).toFixed(1)}%)`],
		['S1c one req/page, N Nouls over annotated page', `1 (chunks med/max ${s.S1c.chunks.median}/${s.S1c.chunks.max})`, `${s.S1c.tokens.median}/${s.S1c.tokens.p90}/${s.S1c.tokens.max}`, `${usd(s.S1c.cost_usd.median)}/${usd(s.S1c.cost_usd.p90)}/${usd(s.S1c.cost_usd.max)}`, usd(s.S1c.cost_usd.median * 1000), usd(s.S1c.cost_usd.mean * 1000), `${s.S1c.latency_ms.median}/${s.S1c.latency_ms.max} ms (chunked c8 max ${s.S1c.latency_chunked_c8_ms.max})`, `q-limit ${g.flags.s1c_exceeds_q_limit.count} (${(g.flags.s1c_exceeds_q_limit.frac * 100).toFixed(1)}%), req-limit ${g.flags.s1c_exceeds_req_limit.count}`],
		['S2 container Choice', '1', `${A.s2_tokens_nominal} (range 1500-3000)`, usd(s.S2.cost_usd), usd(s.S2.cost_usd * 1000), usd(s.S2.cost_usd * 1000), `${A.latency_small_ms} ms`, `options>255: ${g.flags.s2_exceeds_options.count}`],
		['S4 = S1 + S2 every page', `${s.S4.requests.median}/${s.S4.requests.p90}/${s.S4.requests.max}`, `${s.S4.tokens.median}/${s.S4.tokens.p90}/${s.S4.tokens.max}`, `${usd(s.S4.cost_usd.median)}/${usd(s.S4.cost_usd.p90)}/${usd(s.S4.cost_usd.max)}`, usd(s.S4.cost_usd.median * 1000), usd(s.S4.cost_usd.mean * 1000), `c8 serial ${s.S4.latency_c8_ms.median}/${s.S4.latency_c8_ms.max} ms; parallel ${s.S4.latency_par_ms.median}/${s.S4.latency_par_ms.max} ms`, 'as S1'],
	]));
}
md.push('\n## S3 confidence-gated (expected cost = gate fraction x underlying shape cost)');
md.push(mdTable(['group', 'gate', 'underlying', 'gate fraction', '$/page expected', '$/1000 expected', 'expected added latency ms', 'worst-case latency ms'],
	Object.entries(S3).flatMap(([gn, o]) => Object.entries(o).map(([k, v]) => { const [gate, under] = k.split('__under_'); return [gn, gate, under, (v.gate_fraction * 100).toFixed(1) + '%', usd(v.expected_cost_per_page_usd), usd(v.expected_cost_per_1000_usd), v.expected_added_latency_ms, v.worst_case_latency_ms]; }))));
md.push('\n## Extrapolation to typical real pages (ASSUMPTION: median real article ~120 KB raw; HTML tokens 15k/25k/40k; text tokens 1.5k/2.5k/4k; units derived from real-group median ' + realUnitsPer1kTok + ' units per 1k HTML tokens; mean block ' + realBlockTok + ' tokens)');
md.push(`Measured-ratio cross-check for a 120 KB page: cleaned body ${EXTRAP.measured_ratio_120kb.cleaned_body_bytes} B -> ${EXTRAP.measured_ratio_120kb.html_tokens} HTML tokens; text ${EXTRAP.measured_ratio_120kb.text_bytes} B -> ${EXTRAP.measured_ratio_120kb.text_tokens} text tokens.`);
md.push(mdTable(['page profile', 'units', 'shape', 'requests', 'tokens', '$/page', '$/1000', 'added latency', 'limit status', 'pages/s @1200rpm,250k tps', 'pages/hour'],
	['low_15k', 'mid_25k', 'high_40k', 'heavy_80k'].flatMap(p => { const e = EXTRAP[p]; return [
		[p, e.units, 'S1', e.S1.requests, e.S1.tokens, usd(e.S1.cost_per_page), usd(e.S1.cost_per_1000), `seq ${e.S1.latency_seq_ms} ms; c8 ${e.S1.latency_c8_ms} ms`, 'ok (blocks <= 6k chars)', e.throughput.S1_pages_per_s, e.throughput.S1_pages_per_hour],
		[p, e.units, 'S1c', e.S1c.requests, e.S1c.tokens, usd(e.S1c.cost_per_page), usd(e.S1c.cost_per_1000), `${e.S1c.latency_ms} ms`, e.S1c.exceeds_q_limit ? `EXCEEDS 32k/question -> ${e.S1c.chunks_needed} chunks` : (e.S1c.exceeds_req_limit ? 'EXCEEDS 64k/request' : 'ok'), e.throughput.S1c_pages_per_s, e.throughput.S1c_pages_per_hour],
		[p, e.units, 'S2', 1, e.S2.tokens, usd(e.S2.cost_per_page), usd(e.S2.cost_per_1000), `${e.S2.latency_ms} ms`, 'ok', e.throughput.S2_pages_per_s, e.throughput.S2_pages_per_hour],
		[p, e.units, 'S4', e.S4.requests, e.S4.tokens, usd(e.S4.cost_per_page), usd(e.S4.cost_per_1000), `c8 ${e.S4.latency_c8_ms} ms`, 'as S1', e.throughput.S4_pages_per_s, e.throughput.S4_pages_per_hour],
	]; })));
md.push('\n## Comparison with defuddle.md price ($0.003-0.005 per request) and current parse time');
md.push(mdTable(['basis', 'shape', '$/page', '% of $0.003', '% of $0.005'], Object.entries(COMPARE).filter(([k]) => k !== 'current_parse_ms').flatMap(([b, arr]) => arr.map(c => [b, c.shape, usd(c.cost_per_page_usd), c.pct_of_defuddle_md_price_low, c.pct_of_defuddle_md_price_high]))));
md.push(`Current Defuddle parse time (dist build, linkedom, this machine, excl. DOM parse): all fixtures median ${COMPARE.current_parse_ms.all_median} ms, p90 ${COMPARE.current_parse_ms.all_p90} ms; real group median ${COMPARE.current_parse_ms.real_median} ms, p90 ${COMPARE.current_parse_ms.real_p90} ms, max ${COMPARE.current_parse_ms.real_max} ms.`);
md.push(`\nReal-group fixture-median throughput at community-cited limits: S1 ${THROUGHPUT_REAL_FIXTURE_MEDIAN.S1_pages_per_s} pages/s, S1c ${THROUGHPUT_REAL_FIXTURE_MEDIAN.S1c_pages_per_s} pages/s.`);

writeFileSync(`${OUT}/model-output.md`, md.join('\n') + '\n');
writeFileSync(`${OUT}/metrics.json`, JSON.stringify({ assumptions: A, groups: G, S3, extrapolation: EXTRAP, throughput_real_fixture_median: THROUGHPUT_REAL_FIXTURE_MEDIAN, comparison: COMPARE, ten_largest: real.slice(0, 10).map(r => ({ name: r.name, raw_bytes: r.raw_bytes, cleaned_body_bytes: r.cleaned_body_bytes, text_bytes: r.text_bytes, est_tokens_html_body: r.est_tokens_html_body, est_tokens_text: r.est_tokens_text, units: r.units, est_tokens_units_sum: r.est_tokens_units_sum, entry_candidates_total: r.entry_candidates_total, entry_candidates_unique: r.entry_candidates_unique, contentSelector: r.contentSelector, extractorType: r.extractorType, any_retry_fired: r.any_retry_fired, gate_strict: r.gate_strict, parse_ms: r.parse_ms, s1_tokens: r.s1_tokens, s1c_tokens: r.s1c_tokens, s1c_exceeds_any: r.s1c_exceeds_any })) }, null, 1));
writeFileSync(`${OUT}/per-fixture.csv`, ['name,raw_bytes,cleaned_body_bytes,text_bytes,est_tokens_html_body,est_tokens_text,units,units_html_chars,est_tokens_units_sum,entry_candidates_total,entry_candidates_unique,extractorType,contentSelector,retry_partial_fired,retry_hidden_fired,retry_hidden_selector_fired,retry_index_fired,schema_retry_fired,schema_text_used,selector_is_body_or_empty,gate_loose,gate_strict,wordCount,parse_ms,dom_ms,s1_tokens,s1_cost,s1c_tokens,s1c_cost,s1c_exceeds_any,s4_cost',
	...rows.map(r => ['name', 'raw_bytes', 'cleaned_body_bytes', 'text_bytes', 'est_tokens_html_body', 'est_tokens_text', 'units', 'units_html_chars', 'est_tokens_units_sum', 'entry_candidates_total', 'entry_candidates_unique', 'extractorType', 'contentSelector', 'retry_partial_fired', 'retry_hidden_fired', 'retry_hidden_selector_fired', 'retry_index_fired', 'schema_retry_fired', 'schema_text_used', 'selector_is_body_or_empty', 'gate_loose', 'gate_strict', 'wordCount', 'parse_ms', 'dom_ms', 's1_tokens', 's1_cost', 's1c_tokens', 's1c_cost', 's1c_exceeds_any', 's4_cost'].map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n') + '\n');
console.log(md.join('\n'));
