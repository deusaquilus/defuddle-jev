// Deterministic audit: run defuddle's stripUnsafeElements on every corpus fragment under two parsers
// (linkedom = CLI/Worker/Node path; JSDOM/parse5 = closest to the browser extension path),
// plus the full pipeline (default options and with all optional removals disabled), then check the
// serialized output with an independent detector (JSDOM re-parse DOM walk + raw-string regex).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { CORPUS } from './corpus.mjs';
const require = createRequire('/home/alexi/git/defuddle/package.json');
const { JSDOM } = require('jsdom');
const { stripUnsafeElements, isDangerousUrl } = require('/home/alexi/git/defuddle/dist/utils/dom.js');
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const { Defuddle } = require('/home/alexi/git/defuddle/dist/node.js');

const OUT_DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-security-detector';
const URL_ = 'https://example.com/page';
const wrap = frag => `<!DOCTYPE html><html><head><title>T</title></head><body>${frag}</body></html>`;
const FILLER = ['<p>The migration guide below walks through each configuration change in the order the team applied it, with the reasoning behind every step so that other teams can adapt it.</p>',
	'<p>Most of the effort went into the compatibility layer. Keeping the old API working while the new one matured let callers upgrade on their own schedule instead of all at once.</p>',
	'<p>Benchmarks were run on the same hardware before and after each change, and the raw numbers are published alongside this article for anyone who wants to reproduce them.</p>'];
const page = frag => `<!DOCTYPE html><html><head><title>T</title></head><body><article><h1>T</h1>${FILLER[0]}${FILLER[1]}${frag}${FILLER[2]}</article></body></html>`;

// ---------- independent detector ----------
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'xlink:href'];
const EXT_URL_ATTRS = ['srcset', 'poster', 'data-src', 'data', 'ping', 'background', 'codebase', 'classid', 'cite', 'longdesc'];
const SMIL = new Set(['animate', 'set', 'animatemotion', 'animatetransform', 'animatecolor', 'discard']);
const PLUGIN = new Set(['object', 'embed', 'applet']);
const CSS_RE = /url\s*\(\s*["']?\s*(?:javascript|vbscript)\s*:|expression\s*\(|@import|url\s*\(/i;
const CSS_EXEC_RE = /url\s*\(\s*["']?\s*(?:javascript|vbscript)\s*:|expression\s*\(/i;
function normUrl(v) {
	// Browser URL parser: strip leading/trailing C0 controls + space, remove tab/LF/CR anywhere.
	return v.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '').replace(/[\t\n\r]/g, '').toLowerCase();
}
function schemeFlag(tag, attrName, value) {
	const n = normUrl(value);
	if (n.startsWith('javascript:')) return 'js_url';
	if (n.startsWith('vbscript:')) return 'vbscript_url';
	if (n.startsWith('blob:')) return 'blob_url';
	if (n.startsWith('data:')) {
		const docCtx = (tag === 'iframe' && attrName === 'src') || (tag === 'object' && attrName === 'data') || (tag === 'embed' && attrName === 'src');
		if (docCtx) return 'iframe_or_plugin_data_url';
		if (!n.startsWith('data:image/')) return 'data_nonimage_url';
	}
	return null;
}
export function detect(html) {
	const spec = [];   // flags named in the task spec
	const ext = [];    // extended flags (not required by the spec; reported separately)
	if (!html) return { spec, ext, regex: [] };
	const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, { url: URL_ });
	const doc = dom.window.document;
	const els = [doc.documentElement, doc.head, doc.body, ...doc.querySelectorAll('*')];
	const seen = new Set();
	for (const el of els) {
		if (!el || seen.has(el)) continue; seen.add(el);
		const tag = el.localName.toLowerCase();
		if (tag === 'script' && !(el.getAttribute('type') || '').toLowerCase().startsWith('math/')) spec.push(`script${el.getAttribute('type') ? '[type=' + el.getAttribute('type') + ']' : ''}`);
		if (tag === 'base') spec.push('base');
		if (tag === 'meta' && (el.getAttribute('http-equiv') || '').toLowerCase() === 'refresh') spec.push('meta_refresh');
		if (PLUGIN.has(tag)) spec.push(`plugin:${tag}`);
		if (SMIL.has(tag)) spec.push(`smil:${tag}`);
		if (tag === 'style' && CSS_EXEC_RE.test(el.textContent || '')) spec.push('style_element_css_exec');
		if (tag === 'style') ext.push('style_element');
		if (tag === 'link') ext.push(`link[rel=${el.getAttribute('rel')}]`);
		if (tag === 'iframe' && el.hasAttribute('allow')) ext.push(`iframe_allow=${el.getAttribute('allow')}`);
		for (const a of Array.from(el.attributes)) {
			const n = a.name.toLowerCase();
			if (n.startsWith('on')) spec.push(`handler:${tag}@${n}`);
			if (n === 'srcdoc') spec.push(`srcdoc:${tag}`);
			if (URL_ATTRS.includes(n)) { const f = schemeFlag(tag, n, a.value); if (f) spec.push(`${f}:${tag}@${n}=${a.value.slice(0, 50)}`); }
			if (EXT_URL_ATTRS.includes(n)) { const f = schemeFlag(tag, n, a.value); if (f) ext.push(`${f}:${tag}@${n}=${a.value.slice(0, 50)}`); }
			if (n === 'style') { if (CSS_EXEC_RE.test(a.value)) spec.push(`style_attr_css_exec:${tag}`); else ext.push(`style_attr:${tag}`); }
		}
	}
	const regex = [];
	if (/<script[\s>\/]/i.test(html)) regex.push('re:script_tag');
	if (/<[a-zA-Z][^>]*?[\s\/]on[a-zA-Z]+\s*=/.test(html)) regex.push('re:on_attr');
	if (/(?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*(?:javascript|vbscript)\s*:/i.test(html)) regex.push('re:js_url');
	if (/srcdoc\s*=/i.test(html)) regex.push('re:srcdoc');
	if (/<(?:base|object|embed|applet|animate|set|animatemotion|animatetransform|animatecolor)[\s>\/]/i.test(html)) regex.push('re:unsafe_tag');
	if (/http-equiv\s*=\s*["']?\s*refresh/i.test(html)) regex.push('re:meta_refresh');
	return { spec, ext, regex };
}
const norm = s => (s || '').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const intact = (item, out) => item.label === 'benign' ? item.keep.every(k => norm(out).includes(norm(k))) : null;

// ---------- paths under test ----------
function stripLinkedom(frag) {
	const doc = parseLinkedomHTML(wrap(frag), URL_);
	const before = doc.body.innerHTML;
	const unsafeRoot = stripUnsafeElements(doc.body);
	return { before, out: unsafeRoot ? '' : doc.body.innerHTML, unsafeRoot, bodyAttrs: Array.from(doc.body.attributes).map(a => a.name) };
}
function stripJsdom(frag) {
	const dom = new JSDOM(wrap(frag), { url: URL_ });
	const body = dom.window.document.body;
	const before = body.innerHTML;
	const unsafeRoot = stripUnsafeElements(body);
	return { before, out: unsafeRoot ? '' : body.innerHTML, unsafeRoot, bodyAttrs: Array.from(body.attributes).map(a => a.name) };
}
const NOREMOVE = { standardize: false, removeExactSelectors: false, removePartialSelectors: false, removeLowScoring: false, removeContentPatterns: false, removeHiddenElements: false };
async function pipeline(frag, options) {
	const res = await Defuddle(parseLinkedomHTML(page(frag), URL_), URL_, options);
	return res.content || '';
}

const results = [];
for (const item of CORPUS) {
	const rawDet = detect(item.html);
	const l = stripLinkedom(item.html);
	const j = stripJsdom(item.html);
	const pd = await pipeline(item.html, {});
	const pn = await pipeline(item.html, NOREMOVE);
	const r = {
		id: item.id, label: item.label, category: item.category, exec: item.exec, note: item.note, html: item.html,
		raw_detect: rawDet,
		strip_linkedom: { ...l, detect: detect(l.out), intact: intact(item, l.out), changed: l.before !== l.out },
		strip_jsdom: { ...j, detect: detect(j.out), intact: intact(item, j.out), changed: j.before !== j.out },
		pipeline_default: { out: pd, detect: detect(pd), intact: intact(item, pd) },
		pipeline_noremove: { out: pn, detect: detect(pn), intact: intact(item, pn) },
	};
	results.push(r);
}
writeFileSync(`${OUT_DIR}/det-audit.json`, JSON.stringify(results, null, 1));

// ---------- summary ----------
const mal = results.filter(r => r.label === 'malicious'), ben = results.filter(r => r.label === 'benign');
const surv = (r, path, kind = 'spec') => r[path].detect[kind].length > 0;
console.log(`corpus: ${results.length} (malicious ${mal.length}, benign ${ben.length})`);
console.log(`raw detector on malicious inputs: spec flags ${mal.filter(r => r.raw_detect.spec.length).length}/${mal.length}; regex flags ${mal.filter(r => r.raw_detect.regex.length).length}/${mal.length}`);
console.log(`raw detector on benign inputs:    spec flags ${ben.filter(r => r.raw_detect.spec.length).length}/${ben.length}; regex flags ${ben.filter(r => r.raw_detect.regex.length).length}/${ben.length}`);
for (const path of ['strip_linkedom', 'strip_jsdom', 'pipeline_default', 'pipeline_noremove']) {
	const s = mal.filter(r => surv(r, path));
	const sx = mal.filter(r => surv(r, path, 'ext'));
	const bi = ben.filter(r => r[path].intact);
	console.log(`\n[${path}] malicious with SPEC survivor: ${s.length}/${mal.length}; with EXT-only flags: ${sx.length}; benign intact: ${bi.length}/${ben.length}`);
	for (const r of s) console.log(`   SURVIVOR ${r.id} (${r.category}, exec=${r.exec}) flags=${JSON.stringify(r[path].detect.spec)} out=${JSON.stringify(r[path].out.slice(0, 200))}`);
	for (const r of sx) if (!s.includes(r)) console.log(`   ext-only ${r.id} (${r.category}, exec=${r.exec}) flags=${JSON.stringify(r[path].detect.ext)}`);
	for (const r of ben) if (!r[path].intact) console.log(`   NOT-INTACT ${r.id} (${r.category}) out=${JSON.stringify(r[path].out.slice(0, 160))}`);
	for (const r of ben) if (r[path].detect.spec.length) console.log(`   BENIGN-FLAGGED ${r.id} flags=${JSON.stringify(r[path].detect.spec)}`);
}
console.log('\nraw-detector misses on malicious (spec):', mal.filter(r => !r.raw_detect.spec.length).map(r => `${r.id}(${r.category})`).join(' '));
console.log('raw-detector false flags on benign (spec):', ben.filter(r => r.raw_detect.spec.length).map(r => `${r.id}:${r.raw_detect.spec.join('|')}`).join(' '));
console.log('regex false flags on benign:', ben.filter(r => r.raw_detect.regex.length).map(r => `${r.id}:${r.raw_detect.regex.join('|')}`).join(' '));
console.log('linkedom vs jsdom strip output differs for:', results.filter(r => r.strip_linkedom.out !== r.strip_jsdom.out).map(r => r.id).join(' '));
