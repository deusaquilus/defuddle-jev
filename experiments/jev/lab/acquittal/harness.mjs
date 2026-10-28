// Capture every element a Defuddle removal step deletes (with reason and local context), and replay
// Defuddle with chosen removals vetoed ("acquitted"). Works with any CommonJS dist directory.
// Capture runs in debug mode (removal records); replay runs in normal mode and detects removal steps from the stack.
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle';
const { parseHTML: linkedomParse } = require(REPO + '/node_modules/linkedom');

export const STEP_NAMES = ['removeBySelector', 'scoreAndRemove', 'removeHiddenElements', 'removeEyebrowLabel', 'removeByContentPattern'];
const BLOCK_TAGS = new Set(['P','LI','TD','TH','DD','DT','BLOCKQUOTE','FIGCAPTION','H1','H2','H3','H4','H5','H6','PRE','DIV','SECTION','ARTICLE','MAIN','ASIDE','HEADER','FOOTER','NAV','BODY','UL','OL','DL','TABLE','TBODY','THEAD','TR','FIGURE','FORM','DETAILS','SUMMARY','ADDRESS','CENTER','HR','IMG','VIDEO','IFRAME','PICTURE','HGROUP','MENU','FIELDSET']);
const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE']);
export const norm = s => (s || '').replace(/[ \s]+/g, ' ').trim();
const h = s => createHash('sha1').update(s).digest('hex');

export function loadApi(distDir) {
  const node = require(distDir + '/node.js');
  const Defuddle = node.Defuddle || node.default?.Defuddle || node.default;
  let parse;
  try { parse = require(distDir + '/utils/linkedom-compat.js').parseLinkedomHTML; } catch { parse = null; }
  if (!parse) parse = (html, url) => linkedomParse(html).document;
  let EXACT = [], PARTIAL = [], TEST_ATTRS = [];
  try { const c = require(distDir + '/constants.js'); EXACT = c.EXACT_SELECTORS || []; PARTIAL = c.PARTIAL_SELECTORS || []; TEST_ATTRS = c.TEST_ATTRIBUTES || []; } catch {}
  let jsdomEra = false; try { const src = require('node:fs').readFileSync(distDir + '/node.js', 'utf8'); jsdomEra = /require\("jsdom"\)/.test(src) && !/linkedom/.test(src); } catch {}
  return { distDir, Defuddle, parse, EXACT, PARTIAL, TEST_ATTRS, jsdomEra };
}

// ---- global hooks (installed once; behaviour switched by `state`) ----
let state = null;
let installed = false;
function install() {
  if (installed) return; installed = true;
  const probe = linkedomParse('<html><body><div></div></body></html>').document.querySelector('div');
  let owner = probe; while (owner && !Object.prototype.hasOwnProperty.call(owner, 'remove')) owner = Object.getPrototypeOf(owner);
  if (!owner) throw new Error('cannot find linkedom remove()');
  const origRemove = owner.remove;
  owner.remove = function () {
    if (state && !state.busy && this && this.nodeType === 1) { state.busy = true; let keep = false; try { keep = state.onRemove(this); } finally { state.busy = false; } if (keep) return; }
    return origRemove.call(this);
  };
  const origPush = Array.prototype.push;
  Array.prototype.push = function (...args) {
    if (state && state.onPush && !state.busy && args.length === 1) { const a = args[0]; if (a && typeof a === 'object' && typeof a.step === 'string' && typeof a.text === 'string' && !Array.isArray(a)) { state.busy = true; try { state.onPush(a, this); } finally { state.busy = false; } } }
    return origPush.apply(this, args);
  };
}

function markedText(block, el, cap = 300) {
  let out = '';
  (function walk(n) {
    if (n === el) { const t = norm(el.textContent); out += ' ⟦' + (t.length > cap ? t.slice(0, cap) + '…' : t) + '⟧ '; return; }
    if (n.nodeType === 3) { out += n.data; return; }
    if (n.nodeType !== 1 || SKIP.has(n.tagName)) return;
    const b = BLOCK_TAGS.has(n.tagName); if (b) out += ' ';
    for (const c of Array.from(n.childNodes)) walk(c);
    if (b) out += ' ';
  })(block);
  return norm(out);
}
function sibText(el, dir) {
  let n = el; for (let up = 0; up < 6 && n; up++) {
    let s = dir < 0 ? n.previousElementSibling : n.nextElementSibling;
    while (s && (SKIP.has(s.tagName) || !norm(s.textContent))) s = dir < 0 ? s.previousElementSibling : s.nextElementSibling;
    if (s) { const t = norm(s.textContent); return dir < 0 ? t.slice(-300) : t.slice(0, 300); }
    n = n.parentElement; if (n && n.tagName === 'BODY') break;
  }
  return '';
}
function precedingHeading(el) {
  let n = el; for (let up = 0; up < 30 && n && n.tagName !== 'BODY'; up++) {
    let s = n.previousElementSibling; let steps = 0;
    while (s && steps++ < 200) {
      if (/^H[1-6]$/.test(s.tagName)) return norm(s.textContent).slice(0, 200);
      const hs = s.querySelectorAll ? s.querySelectorAll('h1,h2,h3,h4,h5,h6') : [];
      if (hs.length) return norm(hs[hs.length - 1].textContent).slice(0, 200);
      s = s.previousElementSibling;
    }
    n = n.parentElement;
  }
  return '';
}
function cleanHtml(el, cap = 4000) {
  const c = el.cloneNode(true);
  for (const x of Array.from(c.querySelectorAll('script,style,noscript,template'))) if (x.parentNode) x.parentNode.removeChild(x);
  for (const s of Array.from(c.querySelectorAll('svg'))) s.innerHTML = '';
  for (const e of [c, ...Array.from(c.querySelectorAll('*'))]) for (const a of Array.from(e.attributes || [])) { let v = a.value; if (/^data:/i.test(v)) v = v.slice(0, 30) + '…'; if (v.length > 120) v = v.slice(0, 120) + '…'; if (v !== a.value) e.setAttribute(a.name, v); }
  let s = norm(c.outerHTML).replace(/> </g, '><'); if (s.length > cap) s = s.slice(0, cap) + '…[truncated]'; return s;
}
export function visibleText(el) { let out = ''; (function walk(n) { if (n.nodeType === 3) { out += n.data; return; } if (n.nodeType !== 1 || SKIP.has(n.tagName)) return; const b = BLOCK_TAGS.has(n.tagName); if (b) out += ' '; for (const c of Array.from(n.childNodes)) walk(c); if (b) out += ' '; })(el); return norm(out); }
export function describe(el) {
  const text = visibleText(el);
  const words = text ? text.split(' ').length : 0;
  let block = el.parentElement; while (block && !BLOCK_TAGS.has(block.tagName)) block = block.parentElement;
  let context = '';
  if (block) { const m = markedText(block, el); const i = m.indexOf('⟦'), j = m.indexOf('⟧'); context = (i > 400 ? '…' : '') + m.slice(Math.max(0, i - 400), Math.min(m.length, j + 401)) + (j + 401 < m.length ? '…' : ''); }
  let linkChars = 0, nLinks = 0; for (const a of Array.from(el.querySelectorAll('a'))) { linkChars += norm(a.textContent).length; nLinks++; } if (el.tagName === 'A') { linkChars = text.length; nLinks = 1; }
  const body = el.ownerDocument?.body; const bodyWords = body ? norm(body.textContent).split(' ').filter(Boolean).length : 0;
  const blockText = block ? norm(block.textContent) : '';
  return {
    tag: el.tagName.toLowerCase(), id: el.getAttribute('id') || '', class: (el.getAttribute('class') || '').slice(0, 200),
    attrs: Array.from(el.attributes || []).map(a => a.name).filter(n => n !== 'class' && n !== 'id').slice(0, 12),
    inline: !BLOCK_TAGS.has(el.tagName), block_tag: block ? block.tagName.toLowerCase() : '',
    words, text: text.slice(0, 8000), html: cleanHtml(el), link_density: text.length ? +(linkChars / text.length).toFixed(2) : 0, links: nLinks,
    has: ['h1,h2,h3,h4,h5,h6', 'p', 'ul,ol', 'img,picture,video,figure', 'pre,code', 'table'].map((s, k) => el.querySelector && el.querySelector(s) ? ['heading','paragraph','list','image','code','table'][k] : null).filter(Boolean),
    context, block_words_outside: block ? Math.max(0, (blockText ? blockText.split(' ').length : 0) - words) : 0,
    prev_text: sibText(el, -1), next_text: sibText(el, 1), heading: precedingHeading(el),
    share_of_body_words: bodyWords ? +(words / bodyWords).toFixed(3) : 0,
    path: (() => { const p = []; for (let n = el; n.parentElement; n = n.parentElement) p.unshift(Array.prototype.indexOf.call(n.parentElement.children, n)); return p.join('/'); })(),
  };
}
// fingerprint: identical in capture (debug) and replay (normal) mode
export function fingerprint(step, el) {
  const text = norm(el.textContent);
  let block = el.parentElement; while (block && !BLOCK_TAGS.has(block.tagName)) block = block.parentElement;
  const ctx = block ? markedText(block, el, 80).slice(0, 2000) : '';
  return `${step}|${el.tagName.toLowerCase()}|${h(text).slice(0, 12)}|${h(ctx).slice(0, 8)}`;
}
function stepFromStack() { const s = new Error().stack || ''; for (const n of STEP_NAMES) if (s.includes(n)) return n; return null; }

const offlineFetch = () => Promise.reject(new Error('network disabled'));

/** Debug-mode capture of every recorded removal, across all retry passes. */
export async function capture(api, html, url, extraOpts = {}, decide = null) {
  install();
  const doc = api.parse(html, url);
  const queue = []; const passes = new Map(); const out = []; let unmatched = 0; const removed = new WeakSet();
  state = {
    onPush(rec, arr) { if (!passes.has(arr)) passes.set(arr, passes.size); queue.push({ rec, pass: passes.get(arr) }); if (queue.length > 8) { queue.shift(); unmatched++; } },
    onRemove(el) {
      if (!queue.length) return false;
      const tp = (el.textContent || '').trim().substring(0, 200);
      const k = queue.findIndex(q => q.rec.text === tp);
      if (k < 0) return false;
      const { rec, pass } = queue.splice(k, 1)[0];
      let exact = [];
      if (rec.step === 'removeBySelector' && rec.selector === 'exact') for (const s of api.EXACT) { try { if (el.matches(s)) exact.push(s); } catch {} }
      let orphan = false; for (let a = el.parentElement; a; a = a.parentElement) if (removed.has(a)) { orphan = true; break; }
      const fp = fingerprint(rec.step, el);
      const acquit = !!(decide && decide(fp, rec.step, el));
      out.push({ step: rec.step, reason: rec.reason || '', selector: rec.selector || '', exact, pass, rec, fp, orphan, acquitted: acquit, ...describe(el) });
      if (acquit) return true;
      removed.add(el);
      return false;
    },
  };
  const prevLimit = Error.stackTraceLimit;
  let result, error = null;
  try { result = await api.Defuddle(doc, url, { debug: true, fetch: offlineFetch, ...extraOpts }); } catch (e) { error = String(e && e.stack || e); }
  finally { state = null; Error.stackTraceLimit = prevLimit; }
  const finalRecs = new Set(result?.debug?.removals || []);
  for (const r of out) { r.final = finalRecs.has(r.rec); delete r.rec; }
  const recorded = (result?.debug?.removals || []).length;
  return { result, removals: out, error, stats: { passes: passes.size, recorded_final: recorded, captured: out.length, captured_final: out.filter(r => r.final).length, dropped_from_queue: unmatched + queue.length } };
}

/** Normal-mode replay. decide(fp, step, el) -> true to acquit (skip the removal). */
export async function replay(api, html, url, decide, extraOpts = {}) {
  install();
  const seen = []; const acquitted = [];
  state = {
    onRemove(el) {
      const step = stepFromStack(); if (!step) return false;
      const fp = fingerprint(step, el); seen.push(fp);
      if (decide && decide(fp, step, el)) { acquitted.push(fp); return true; }
      return false;
    },
  };
  const prevLimit = Error.stackTraceLimit; Error.stackTraceLimit = 60;
  let result, error = null;
  try { result = await runOld(api, html, url, { separateMarkdown: true, fetch: offlineFetch, ...extraOpts }); } catch (e) { error = String(e && e.stack || e); }
  finally { state = null; Error.stackTraceLimit = prevLimit; }
  return { result, seen, acquitted, error };
}

export function comparable(response) {
  const meta = { title: response.title, author: response.author, site: response.site, published: response.published };
  return '```json\n' + JSON.stringify(meta, null, 2) + '\n```\n\n' + response.contentMarkdown;
}
// Port of tests/helpers.ts normalizeMarkdownHtml (SVG attribute order only; code fences byte-for-byte)
export function makeNormalizer(distDir) {
  const { parseLinkedomHTML } = require(distDir + '/utils/linkedom-compat.js');
  const dom = require(distDir + '/utils/dom.js');
  const normAttrs = html => { const doc = parseLinkedomHTML('<html><body></body></html>'); const c = doc.createElement('div'); c.appendChild(dom.parseHTML(doc, html)); for (const el of c.querySelectorAll('*')) { const at = Array.from(el.attributes).map(a => [a.name, a.value]); for (const [n] of at) el.removeAttribute(n); for (const [n, v] of at.sort(([a], [b]) => a.localeCompare(b))) el.setAttribute(n, v); } return dom.serializeHTML(c); };
  return md => { let fence = '', prose = '', res = ''; const flush = () => { res += prose.replace(/<svg\b[\s\S]*?<\/svg>/gi, normAttrs); prose = ''; };
    for (const line of md.match(/[^\n]*\n|[^\n]+$/g) || []) { const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)/); if (fence) { res += line; if (m && m[1][0] === fence[0] && m[1].length >= fence.length && !m[2].trim()) fence = ''; } else if (m) { flush(); fence = m[1]; res += line; } else prose += line; }
    flush(); return res; };
}
export function fixtureUrl(name, html) { const fm = html.match(/<!--\s*(\{"url":.*?\})\s*-->/); const f = fm ? JSON.parse(fm[1]) : {}; return f.url || `https://${name.replace(/^[a-z]+--/, '').replace(/:/g, '/')}`; }

const { JSDOM, VirtualConsole } = require(REPO + '/node_modules/jsdom');
function makeJsdom(html, url) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, includeNodeLocations: true, storageQuota: 10000000, virtualConsole: new VirtualConsole() });
  const proto = dom.window.Element.prototype; const orig = proto.remove;
  proto.remove = function () {
    if (state && !state.busy && this && this.nodeType === 1) { state.busy = true; let keep = false; try { keep = state.onRemove(this); } finally { state.busy = false; } if (keep) return; }
    return orig.call(this);
  };
  return { dom, done: () => { proto.remove = orig; dom.window.close(); } };
}
async function runOld(api, html, url, opts) { // jsdom-era builds take a JSDOM instance; newer ones a Document
  if (api.jsdomEra) { const { dom, done } = makeJsdom(html, url); try { return await api.Defuddle(dom, url, opts); } finally { done(); } }
  return api.Defuddle(api.parse(html, url), url, opts);
}
export { runOld };
/** Capture for builds WITHOUT debug removal records (pre-March 2026): step from the stack, rule recomputed from the build's own selector lists. */
export async function captureNoDebug(api, html, url, decide = null) {
  install();
  const out = []; const removed = new WeakSet();
  const partialRes = api.PARTIAL.map(p => { try { return [p, new RegExp(p, 'i')]; } catch { return null; } }).filter(Boolean);
  state = {
    onRemove(el) {
      const step = stepFromStack(); if (!step) return false;
      let selector = '', exact = [], reason = '';
      if (step === 'removeBySelector') {
        for (const sel of api.EXACT) { try { if (el.matches(sel)) exact.push(sel); } catch {} }
        if (exact.length) selector = 'exact';
        else { outer: for (const a of api.TEST_ATTRS) { const v = el.getAttribute && el.getAttribute(a); if (!v) continue; for (const [p, re] of partialRes) if (re.test(v)) { selector = p; break outer; } } }
        reason = selector === 'exact' ? 'exact selector match' : selector ? 'partial match: ' + selector : 'unknown';
      } else if (step === 'scoreAndRemove') reason = 'score<0';
      let orphan = false; for (let a = el.parentElement; a; a = a.parentElement) if (removed.has(a)) { orphan = true; break; }
      const fp = fingerprint(step, el);
      const acquit = !!(decide && decide(fp, step, el));
      out.push({ step, reason, selector, exact, pass: 0, fp, orphan, acquitted: acquit, final: true, ...describe(el) });
      if (acquit) return true;
      removed.add(el); return false;
    },
  };
  const prevLimit = Error.stackTraceLimit; Error.stackTraceLimit = 60;
  let result, error = null;
  try { result = await runOld(api, html, url, { fetch: offlineFetch }); } catch (e) { error = String(e && e.stack || e); }
  finally { state = null; Error.stackTraceLimit = prevLimit; }
  return { result, removals: out, error, stats: { captured: out.length } };
}
