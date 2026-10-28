// Addendum: gate decomposition, S1c size breakpoints, perf-test vs dist timings. NO API CALLS.
import { readFileSync, writeFileSync } from 'node:fs';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/measure-cost';
const M = JSON.parse(readFileSync(`${OUT}/measurements.json`, 'utf8'));
const metrics = JSON.parse(readFileSync(`${OUT}/metrics.json`, 'utf8'));
const rows = M.rows;
const real = rows.filter(r => r.raw_bytes > 20_000).sort((a, b) => b.raw_bytes - a.raw_bytes);

// (a) gate decomposition
const bodyPick = r => /^html > body$/.test(r.contentSelector) || r.contentSelector === 'body';
const emptyExtractor = r => r.contentSelector === '' && !!r.extractorType;
const emptyNonExtractor = r => r.contentSelector === '' && !r.extractorType;
const strictRetry = r => r.retry_hidden_fired || r.retry_index_fired || r.schema_retry_fired || r.schema_text_used;
const gateStrictNoExtractor = r => strictRetry(r) || bodyPick(r) || emptyNonExtractor(r);
function decomp(g) {
	const n = g.length, c = f => g.filter(f).length;
	return {
		n,
		body_pick_html_body: c(bodyPick),
		empty_selector_extractor: c(emptyExtractor),
		empty_selector_non_extractor: c(emptyNonExtractor),
		strict_retry_any: c(strictRetry),
		partial_retry_only_lt200: c(r => r.retry_partial_fired && !strictRetry(r)),
		gate_strict_excluding_extractor_pages: c(gateStrictNoExtractor),
		gate_strict_excluding_extractor_pages_frac: +(c(gateStrictNoExtractor) / n).toFixed(4),
		retry_accepted_any: c(r => r.retry_partial_accepted || r.retry_hidden_accepted || r.retry_hidden_selector_accepted || r.retry_index_accepted || r.schema_retry_fired),
		retry_accepted_any_frac: +(c(r => r.retry_partial_accepted || r.retry_hidden_accepted || r.retry_hidden_selector_accepted || r.retry_index_accepted || r.schema_retry_fired) / n).toFixed(4),
		body_pick_names: g.filter(bodyPick).map(r => r.name),
	};
}
const GATE = { all: decomp(rows), real: decomp(real), synthetic: decomp(rows.filter(r => r.raw_bytes <= 20_000)) };

// (b) S1c breakpoints: raw bytes at which cleaned-body HTML tokens + 60 > 32,000 (3.5 B/token)
const ratios = metrics.groups.real.ratio_cleaned_body_over_raw;
const bp = ratio => Math.round((32_000 - 60) * 3.5 / ratio);
const BREAKPOINTS = {
	note: 'raw HTML bytes above which S1c state (cleaned body HTML at 3.5 B/token) exceeds the 32k per-question limit, for the real group cleaned/raw ratios',
	at_real_p25_ratio: { ratio: ratios.p25, raw_bytes: bp(ratios.p25) },
	at_real_median_ratio: { ratio: ratios.median, raw_bytes: bp(ratios.median) },
	at_real_p75_ratio: { ratio: ratios.p75, raw_bytes: bp(ratios.p75) },
	at_ratio_0_95: { ratio: 0.95, raw_bytes: bp(0.95) },
	// ASSUMPTION: real-world page sizes log-uniform on 50-500 KB raw; fraction above breakpoint
	assumed_loguniform_50_500kb_fraction_exceeding: Object.fromEntries([['p25', ratios.p25], ['median', ratios.median], ['p75', ratios.p75]].map(([k, ratio]) => {
		const b = bp(ratio) / 1000, lo = 50, hi = 500;
		const frac = b <= lo ? 1 : b >= hi ? 0 : (Math.log(hi) - Math.log(b)) / (Math.log(hi) - Math.log(lo));
		return [k, +frac.toFixed(3)];
	})),
	text_state_variant_breakpoint_raw_bytes_at_real_median_text_ratio: Math.round((32_000 - 60) * 4 / metrics.groups.real.ratio_text_over_raw.median),
};

// (c) perf-test (src via vitest, linkedom) per-fixture times for the real group vs dist timings
const perf = readFileSync(`${OUT}/perf-test-output.txt`, 'utf8');
const perfRows = new Map();
for (const line of perf.split('\n')) {
	const m = line.match(/^\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)KB\s+(\S+)\s*$/);
	if (m) perfRows.set(m[5], { total_ms: +m[1], dom_ms: +m[2], parse_ms: +m[3], size_kb: +m[4] });
}
const perfTotals = perf.match(/Total:\s+(\d+)ms \(DOM: (\d+)ms, Parse: (\d+)ms\)\s+Count: (\d+)/);
const stepTable = [];
let inSteps = false;
for (const line of perf.split('\n')) {
	if (line.includes('Per-Step Totals')) inSteps = true;
	if (!inSteps) continue;
	const m = line.match(/^\s+(\d+)\s+(\d+)%\s+(.+?)\s*$/);
	if (m) stepTable.push({ step: m[3], ms: +m[1], pct: +m[2] });
}
const PERF = {
	vitest_totals: perfTotals ? { total_ms: +perfTotals[1], dom_ms: +perfTotals[2], parse_ms: +perfTotals[3], count: +perfTotals[4] } : null,
	vitest_per_step_totals_ms: stepTable,
	vitest_top_parse_ms: [...perfRows.entries()].sort((a, b) => b[1].parse_ms - a[1].parse_ms).slice(0, 15).map(([name, v]) => ({ name, ...v })),
	dist_totals: { parse_ms: +rows.reduce((s, r) => s + r.parse_ms, 0).toFixed(0), dom_ms: +rows.reduce((s, r) => s + r.dom_ms, 0).toFixed(0) },
	real_group_side_by_side: real.map(r => ({ name: r.name, raw_bytes: r.raw_bytes, dist_parse_ms: r.parse_ms, vitest_parse_ms: perfRows.get(r.name)?.parse_ms ?? null, vitest_total_ms: perfRows.get(r.name)?.total_ms ?? null, units: r.units, s1c_latency_ms: r.s1c_latency_ms, s1_latency_c8_ms: r.s1_latency_c8_ms })),
	vitest_parse_ms_distribution: (() => { const a = [...perfRows.values()].map(v => v.parse_ms).sort((x, y) => x - y); const p = q => a[Math.floor(q * (a.length - 1))]; return { n: a.length, min: a[0], p25: p(.25), median: p(.5), p75: p(.75), p90: p(.9), max: a[a.length - 1] }; })(),
};

// real-group per-fixture gate detail
const REAL_DETAIL = real.map(r => ({ name: r.name, extractor: r.extractorType, selector: r.contentSelector.slice(0, 60), retry_partial: r.retry_partial_fired, retry_hidden: r.retry_hidden_fired, retry_index: r.retry_index_fired, schema_retry: r.schema_retry_fired, body_pick: bodyPick(r), gate_strict_no_extractor: gateStrictNoExtractor(r), wordCount: r.wordCount }));

// block-token means
const BLOCKS = { all_mean_block_tokens: +(rows.reduce((s, r) => s + r.est_tokens_units_sum, 0) / rows.reduce((s, r) => s + r.units, 0)).toFixed(1), real_mean_block_tokens: +(real.reduce((s, r) => s + r.est_tokens_units_sum, 0) / real.reduce((s, r) => s + r.units, 0)).toFixed(1), units_truncated_at_6000_chars: rows.reduce((s, r) => s + r.units_truncated, 0), wordCount_debug_vs_plain_max_abs_diff: Math.max(...rows.map(r => Math.abs((r.wordCount_debug ?? 0) - (r.wordCount ?? 0)))) };

metrics.addendum = { gate_decomposition: GATE, s1c_breakpoints: BREAKPOINTS, perf: PERF, real_group_detail: REAL_DETAIL, blocks: BLOCKS };
writeFileSync(`${OUT}/metrics.json`, JSON.stringify(metrics, null, 1));
const md = ['\n## Addendum', '### Gate decomposition', JSON.stringify(GATE, null, 1), '### S1c breakpoints', JSON.stringify(BREAKPOINTS, null, 1), '### Perf', JSON.stringify(PERF, null, 1), '### Real-group detail', JSON.stringify(REAL_DETAIL, null, 1), '### Blocks', JSON.stringify(BLOCKS, null, 1)].join('\n');
writeFileSync(`${OUT}/model-output.md`, readFileSync(`${OUT}/model-output.md`, 'utf8') + md + '\n');
console.log(md);
