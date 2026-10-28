// Jev as a secondary XSS detector: ask jev-1.14.0 about each fragment in several states.
// Run: bash -ic 'node /home/alexi/git/defuddle/experiments/jev/research/results/exp-security-detector/jev-run.mjs [smoke]'
import { readFileSync, writeFileSync, appendFileSync, existsSync, unlinkSync } from 'node:fs';
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';

const OUT_DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-security-detector';
const MODEL = 'jev-1.14.0';
const SMOKE = process.argv.includes('smoke');
const audit = JSON.parse(readFileSync(`${OUT_DIR}/det-audit.json`, 'utf8'));
const items = SMOKE ? [audit[0], audit[9], audit[83 + 10]] : audit;

const NOUL_MAIN = 'Does this HTML fragment contain markup that would execute script or load a non-image document when rendered in a browser (script elements, event-handler attributes, javascript:/vbscript:/data:text URLs, srcdoc, SMIL href animation, meta refresh, object/embed/applet, base)? Escaped text that merely displays code (e.g. &lt;script&gt;) does not count.';
const QUESTIONS = {
	unsafe: { type: 'noul', instructions: NOUL_MAIN },
	attack_type: {
		type: 'choice',
		instructions: 'Which kind of executable or document-loading markup does this HTML fragment contain? Escaped text that only displays code (for example &lt;script&gt; inside <pre> or <code>) and prose that merely talks about attacks do not count. Choose "none" if nothing would execute script or load a non-image document.',
		criteria: {
			script_element: 'A real <script> element that would run (type is not math/*)',
			event_handler_attribute: 'An element with an on* attribute such as onerror, onload, onclick, onfocus, ontoggle, onmouseover',
			javascript_or_vbscript_url: 'An href, src, action, formaction or xlink:href whose value is a javascript: or vbscript: URL, possibly obfuscated with entities, whitespace, control characters or mixed case',
			data_or_blob_url_document: 'An iframe, object, embed or link whose URL is data:text/html, a data: SVG document, or blob:',
			srcdoc_base_or_meta_refresh: 'An iframe srcdoc attribute, a <base href> element, or a <meta http-equiv="refresh"> element',
			object_embed_or_applet: 'An <object>, <embed> or <applet> element',
			svg_smil_animation: 'An SVG <animate>, <set>, <animateMotion> or <animateTransform> element',
			css_javascript_or_expression: 'A style attribute or <style> element using url(javascript:...) or expression(...)',
			none: 'No markup that would execute script or load a non-image document',
		},
	},
	has_script_element: { type: 'noul', instructions: 'Does this HTML contain an actual <script> element (a real element, not escaped text such as &lt;script&gt; and not text inside an HTML comment) whose type attribute does not start with "math/"?' },
	has_event_handler_attribute: { type: 'noul', instructions: 'Does any element in this HTML carry an attribute whose name starts with "on" (onerror, onload, onclick, onfocus, ontoggle, onmouseover, onbegin, ...) so that JavaScript would run? Attribute VALUES, visible text or code samples that merely mention such names do not count.' },
	has_javascript_url: { type: 'noul', instructions: 'Does any href, src, action, formaction or xlink:href attribute in this HTML have a javascript: or vbscript: URL as its value, including obfuscated forms (entity-encoded letters such as &#106; or &colon;, inserted tabs or newlines, mixed case, leading whitespace or control characters)? The words "javascript:" appearing in visible text, in a query string, or in escaped code do not count.' },
	has_data_or_blob_document_url: { type: 'noul', instructions: 'Does this HTML load a document (not a plain raster image) from a data: or blob: URL, for example an iframe, object or embed with data:text/html or data:image/svg+xml, or an iframe with blob:? An <img> with data:image/png does not count.' },
	has_srcdoc_base_or_meta_refresh: { type: 'noul', instructions: 'Does this HTML contain, as real elements or attributes (not escaped text), an iframe with a srcdoc attribute, a <base> element, or a <meta http-equiv="refresh"> element?' },
	has_object_embed_applet: { type: 'noul', instructions: 'Does this HTML contain a real <object>, <embed> or <applet> element (not escaped text such as &lt;object&gt; and not prose mentioning them)?' },
	has_smil_animation: { type: 'noul', instructions: 'Does this HTML contain a real SVG SMIL animation element: <animate>, <set>, <animateMotion>, <animateTransform> or <animateColor> (not escaped text)?' },
	is_only_escaped_code_or_prose: { type: 'noul', instructions: 'Is every piece of HTML-looking or attack-looking content in this fragment only displayed as escaped text inside <pre>, <code> or ordinary prose (for example &lt;script&gt; or the words "onerror" and "javascript:" in a sentence), rather than being real markup that the browser would execute?' },
};

// Realistic article context (~1,100 tokens) for the "embedded" variant.
const PARAS = [
	'When we started the rewrite, the only hard requirement was that existing callers keep working. Everything else, including performance, was negotiable, and that ordering shaped most of the decisions described below.',
	'The first month went into reading the old code. It had grown by accretion for six years, and nobody on the current team had written the parts that mattered most. We wrote down every behaviour we could observe, including the ones that looked like bugs, because callers might depend on them.',
	'Two of those behaviours turned out to be load-bearing. One was the way empty inputs produced an empty document instead of an error; the other was a quirk in how whitespace around tags was preserved. Both are now covered by tests that fail loudly if anyone changes them.',
	'<h2>Choosing the parsing strategy</h2>',
	'We evaluated three approaches: a hand-written recursive descent parser, a generated parser from a grammar file, and a streaming tokenizer with a small state machine on top. The generated parser was the fastest to prototype but the hardest to debug when inputs were malformed, which in practice they always are.',
	'The streaming tokenizer won. It handles malformed input gracefully because every state has an explicit recovery path, and it keeps memory flat even on very large documents. The cost is that the code is longer and some of the recovery rules are subtle.',
	'<h2>Measuring the result</h2>',
	'Benchmarks were run on the same machine before and after each change. We report the median of eleven runs and publish the raw numbers next to the article so that anyone can check them. Throughput improved by a factor of three on typical pages and by more on pathological ones.',
	'Memory use dropped as well, mostly because the new design never materialises the whole token stream. Peak resident size on the largest page in our corpus went from 1.4 GB to 180 MB.',
	'<h2>What we would do differently</h2>',
	'We should have written the compatibility tests first. Several weeks were lost to regressions that a test written on day one would have caught immediately. We also underestimated how much time reviewing the recovery rules would take; that work is not glamorous but it is where most of the correctness lives.',
	'If you are planning a similar project, budget twice as long as you think for the compatibility layer and half as long for the new code. The new code is the easy part.',
	'Thanks to everyone who reviewed drafts of this post and to the users who reported the early regressions with patient, detailed bug reports.',
];
const wrapP = s => s.startsWith('<h2>') ? s : `<p>${s}</p>`;
const embed = frag => `<article><h1>Notes from a parser rewrite</h1>${PARAS.slice(0, 6).map(wrapP).join('')}${frag}${PARAS.slice(6).map(wrapP).join('')}</article>`;

const variants = {
	raw_r1: it => it.html,
	raw_r2: it => it.html,
	raw_r3: it => it.html,
	stripped: it => it.strip_linkedom.out,
	embedded: it => embed(it.html),
	pipeline: it => it.pipeline_default.out,
};

const jsonlPath = `${OUT_DIR}/${SMOKE ? 'smoke' : 'jev-raw'}.jsonl`;
if (existsSync(jsonlPath)) unlinkSync(jsonlPath);
let done = 0;
const t0 = Date.now();
await mapConcurrent(items, async it => {
	for (const [variant, mk] of Object.entries(variants)) {
		const state = mk(it);
		const rec = { variant, id: it.id, label: it.label, category: it.category, exec: it.exec, state_chars: state.length };
		if (!state.trim()) { rec.skipped_empty = true; appendFileSync(jsonlPath, JSON.stringify(rec) + '\n'); continue; }
		try {
			const r = await systemOne({ state, questions: QUESTIONS, model: MODEL });
			rec.model = r.model; rec.answers = r.answers; rec.usage = r.usage; rec.latency_ms = r.latency_ms;
		} catch (e) {
			rec.error = String(e.message || e).slice(0, 300);
		}
		appendFileSync(jsonlPath, JSON.stringify(rec) + '\n');
	}
	done++;
	if (done % 20 === 0) console.log(`items done ${done}/${items.length} elapsed ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}, SMOKE ? 1 : 6);
const usage = usageTotals();
console.log('usage', JSON.stringify(usage));
writeFileSync(`${OUT_DIR}/usage-${SMOKE ? 'smoke' : 'full'}-${Date.now()}.json`, JSON.stringify({ model: MODEL, items: items.length, variants: Object.keys(variants), usage }, null, 1));
if (SMOKE) console.log(readFileSync(jsonlPath, 'utf8'));
