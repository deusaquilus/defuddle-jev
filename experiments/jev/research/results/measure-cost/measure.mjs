// Measure per-fixture sizes, token estimates, entry-point candidates, retry-branch firing and
// parse time using the compiled Defuddle Node build (dist/node.js) under linkedom.
// NO API CALLS. Writes /home/alexi/git/defuddle/experiments/jev/research/results/measure-cost/measurements.json
// Run: node /home/alexi/git/defuddle/experiments/jev/research/results/measure-cost/measure.mjs
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/measure-cost';
const { Defuddle } = require(join(REPO, 'dist/node.js'));
const { parseLinkedomHTML } = require(join(REPO, 'dist/utils/linkedom-compat.js'));
const { ENTRY_POINT_ELEMENTS } = require(join(REPO, 'dist/constants.js'));

// Token estimate assumptions (stated in the report):
//   HTML-ish state: bytes / 3.5 tokens (markup tokenizes densely: angle brackets, quotes, attrs)
//   Plain text:     bytes / 4   tokens (OpenAI/Anthropic English rule of thumb)
const HTML_BYTES_PER_TOKEN = 3.5;
const TEXT_BYTES_PER_TOKEN = 4;

// --- cleaned-HTML definition (what a sane client would send as Jev state) ---
// strip script/style/noscript/template elements, comments, svg path data, base64 / long data: URIs,
// long attribute values, then collapse whitespace.
function cleanHtml(html) {
	return html
		.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/<path\b[^>]*\sd="[^"]*"/gi, '<path d="..."')
		.replace(/<path\b[^>]*\sd='[^']*'/gi, "<path d='...'")
		.replace(/data:[a-z/+.-]+;base64,[A-Za-z0-9+/=]{20,}/gi, 'data:...')
		.replace(/="([^"]{200})[^"]*"/g, '="$1..."')
		.replace(/\s+/g, ' ')
		.trim();
}
function bodySlice(html) {
	const m = html.match(/<body\b[\s\S]*?<\/body>/i);
	return m ? m[0] : html;
}
function utf8(s) { return Buffer.byteLength(s, 'utf8'); }

// --- labeled units from the block dataset ---
const unitsByFixture = new Map();
for (const line of readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl', 'utf8').split('\n')) {
	if (!line.trim()) continue;
	const u = JSON.parse(line);
	const e = unitsByFixture.get(u.fixture) || { units: 0, html_chars: 0, html_bytes: 0, kept: 0, removed: 0, max_unit_chars: 0, truncated_units: 0 };
	e.units++;
	e.html_chars += u.html.length;
	e.html_bytes += utf8(u.html);
	e.max_unit_chars = Math.max(e.max_unit_chars, u.html.length);
	if (u.html.endsWith('<!-- truncated -->')) e.truncated_units++;
	if (u.label === 'kept') e.kept++; else e.removed++;
	unitsByFixture.set(u.fixture, e);
}

// --- retry-branch markers (exact substrings of src/defuddle.ts _log calls, lines 103-203) ---
const MARKERS = {
	retry_partial_fired: 'trying again',                                   // L103, wordCount < 200
	retry_partial_accepted: 'Retry produced more content',                 // L111
	retry_hidden_fired: 'retrying without hidden-element removal',         // L122, wordCount < 50
	retry_hidden_accepted: 'Hidden-element retry produced more content',   // L127
	retry_hidden_selector_fired: 'Retrying with hidden content selector',  // L140
	retry_hidden_selector_accepted: 'Hidden-selector retry produced better focused content', // L156
	retry_index_fired: 'retrying without scoring/partial selectors',       // L164, wordCount < 50
	retry_index_accepted: 'Index page retry produced more content',        // L171
	schema_retry_fired: 'Schema.org suggests a better content element',    // L197
	schema_text_used: 'Using schema.org text as content',                  // L203
	extractor_content_selector: 'Using contentSelector:',                  // L941 (extractor / option path)
};

const fixturesDir = join(REPO, 'tests/fixtures');
const files = readdirSync(fixturesDir).filter(f => f.endsWith('.html')).sort();
const offlineFetch = async () => { throw new Error('network disabled'); };

const rows = [];
const origLog = console.log;
for (const file of files) {
	const name = basename(file, '.html');
	const html = readFileSync(join(fixturesDir, file), 'utf-8');
	const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/);
	const frontmatter = fm ? JSON.parse(fm[1]) : {};
	const urlName = name.replace(/^[a-z]+--/, '');
	const url = frontmatter.url || `https://${urlName}`;

	// sizes
	const raw_bytes = utf8(html);
	const cleaned_full = cleanHtml(html);
	const cleaned_body = cleanHtml(bodySlice(html));
	const cleaned_full_bytes = utf8(cleaned_full);
	const cleaned_body_bytes = utf8(cleaned_body);

	// body text (script/style/etc removed first; linkedom textContent otherwise includes script text)
	const tdoc = parseLinkedomHTML(html, url);
	for (const el of Array.from(tdoc.querySelectorAll('script,style,noscript,template,svg'))) el.remove();
	const text = (tdoc.body?.textContent || '').replace(/\s+/g, ' ').trim();
	const text_bytes = utf8(text);
	const text_words = text ? text.split(' ').length : 0;

	// ENTRY_POINT_ELEMENTS candidates, counted exactly as findMainContent does (src/defuddle.ts L1247-1256):
	// one candidate per (selector, matching element) pair, so an element matching 2 selectors counts twice.
	const cdoc = parseLinkedomHTML(html, url);
	let candidates_total = 0;
	const uniq = new Set();
	const perSelector = {};
	ENTRY_POINT_ELEMENTS.forEach(sel => {
		let els = [];
		try { els = Array.from(cdoc.querySelectorAll(sel)); } catch { els = []; }
		if (els.length) perSelector[sel] = els.length;
		candidates_total += els.length;
		els.forEach(e => uniq.add(e));
	});

	// debug run: capture Defuddle: log lines
	const logs = [];
	console.log = (...args) => { if (args[0] === 'Defuddle:') logs.push(args.slice(1).map(a => typeof a === 'string' ? a : '').join(' ')); };
	let dbgResult, dbgErr = null;
	try {
		const d1 = parseLinkedomHTML(html, url);
		dbgResult = await Defuddle(d1, url, { debug: true, fetch: offlineFetch });
	} catch (e) { dbgErr = String(e.message || e); }
	console.log = origLog;
	const flags = {};
	for (const [k, needle] of Object.entries(MARKERS)) flags[k] = logs.some(l => l.includes(needle));
	const anyRetryFired = flags.retry_partial_fired || flags.retry_hidden_fired || flags.retry_hidden_selector_fired || flags.retry_index_fired || flags.schema_retry_fired || flags.schema_text_used;
	const contentSelector = dbgResult?.debug?.contentSelector ?? '';
	const selIsBodyOrEmpty = contentSelector === '' || /^html > body$/.test(contentSelector) || contentSelector === 'body';

	// timed non-debug run (debug mode preserves attributes and skips div flattening, so time it separately)
	const t0 = performance.now();
	const d2 = parseLinkedomHTML(html, url);
	const domMs = performance.now() - t0;
	const t1 = performance.now();
	let res = null, timedErr = null;
	try { res = await Defuddle(d2, url, { fetch: offlineFetch, profile: true }); } catch (e) { timedErr = String(e.message || e); }
	const parseMs = performance.now() - t1;

	const u = unitsByFixture.get(name) || { units: 0, html_chars: 0, html_bytes: 0, kept: 0, removed: 0, max_unit_chars: 0, truncated_units: 0 };
	rows.push({
		name, url,
		raw_bytes, raw_chars: html.length,
		cleaned_full_bytes, cleaned_body_bytes, text_bytes, text_words,
		est_tokens_html_full: Math.round(cleaned_full_bytes / HTML_BYTES_PER_TOKEN),
		est_tokens_html_body: Math.round(cleaned_body_bytes / HTML_BYTES_PER_TOKEN),
		est_tokens_text: Math.round(text_bytes / TEXT_BYTES_PER_TOKEN),
		units: u.units, units_kept: u.kept, units_removed: u.removed, units_html_chars: u.html_chars, units_html_bytes: u.html_bytes,
		units_max_chars: u.max_unit_chars, units_truncated: u.truncated_units,
		est_tokens_units_sum: Math.round(u.html_bytes / HTML_BYTES_PER_TOKEN),
		entry_candidates_total: candidates_total, entry_candidates_unique: uniq.size, entry_candidates_per_selector: perSelector,
		extractorType: dbgResult?.extractorType || res?.extractorType || null,
		contentSelector, selector_is_body_or_empty: selIsBodyOrEmpty,
		...flags, any_retry_fired: anyRetryFired,
		gate_fires: anyRetryFired || selIsBodyOrEmpty,
		wordCount_debug: dbgResult?.wordCount ?? null, wordCount: res?.wordCount ?? null,
		output_html_bytes: res ? utf8(res.content || '') : null,
		dom_ms: +domMs.toFixed(2), parse_ms: +parseMs.toFixed(2), profile: res?.profile || null,
		debug_log_lines: logs.length, errors: [dbgErr, timedErr].filter(Boolean),
	});
	process.stderr.write(`${name} raw=${raw_bytes} cleaned=${cleaned_body_bytes} units=${u.units} cands=${candidates_total} retry=${anyRetryFired} sel=${contentSelector}\n`);
}

writeFileSync(join(OUT, 'measurements.json'), JSON.stringify({
	generated: new Date().toISOString(),
	assumptions: { HTML_BYTES_PER_TOKEN, TEXT_BYTES_PER_TOKEN, cleaned_html: 'strip script/style/noscript/template, comments, svg path d=, base64 data URIs, attr values >200 chars; collapse whitespace', body_text: 'linkedom body.textContent after removing script/style/noscript/template/svg; whitespace collapsed', candidates: 'per (selector, element) pair exactly as findMainContent counts; unique count also given', units: 'from /home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl (unit html capped at 6000 chars by the dataset builder)' },
	entry_point_elements: ENTRY_POINT_ELEMENTS,
	node: process.version, linkedom: require(join(REPO, 'node_modules/linkedom/package.json')).version,
	rows,
}, null, 1));
origLog(`wrote ${rows.length} rows to ${join(OUT, 'measurements.json')}`);
