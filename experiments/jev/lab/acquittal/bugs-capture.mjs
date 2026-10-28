// Capture removals on the open-bug pages and label them against the issue's wrongly removed (W) blocks and clutter controls (C).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadApi, capture, replay, norm, visibleText } from './harness.mjs';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle', DIR = '/home/alexi/git/defuddle/experiments/jev/lab/acquittal';
const EXP = '/home/alexi/git/defuddle/experiments/jev/lab/exp-known-failures';
const src = readFileSync(EXP + '/experiment.mjs', 'utf8');
const PAGES = eval('(' + src.slice(src.indexOf('const PAGES = [') + 'const PAGES = '.length, src.indexOf('\n];', src.indexOf('const PAGES = [')) + 2) + ')');
const { parseLinkedomHTML } = require(REPO + '/dist/utils/linkedom-compat.js');
function resolve(doc, spec) { let els = Array.from(doc.querySelectorAll(spec.sel)); if (spec.contains) els = els.filter(e => norm(e.textContent).includes(spec.contains)); if (spec.containsAll) els = els.filter(e => spec.containsAll.every(c => norm(e.textContent).includes(c))); if (spec.exact) els = els.filter(e => norm(e.textContent) === spec.exact); if (spec.maxWords) els = els.filter(e => norm(e.textContent).split(' ').length <= spec.maxWords); if (spec.deepest) els = els.filter(e => !els.some(o => o !== e && e.contains(o))); return els[spec.idx || 0] || null; }
const toks = t => norm(t).toLowerCase().split(' ').filter(Boolean);
const sh = (ws, n) => { const o = new Set(); if (ws.length < n) { if (ws.length) o.add(ws.join(' ')); return o; } for (let i = 0; i + n <= ws.length; i++) o.add(ws.slice(i, i + n).join(' ')); return o; };
const cov = (a, b) => { const wa = toks(a), wb = toks(b); const n = Math.min(3, wa.length, wb.length) || 1; const A = sh(wa, n), B = sh(wb, n); if (!A.size) return 0; let k = 0; for (const x of A) if (B.has(x)) k++; return k / A.size; };
// removal R relates to block B if R is (or encloses) B, or R is a large part of B
function relates(r, b) { const fullR = r.text; const bw = toks(b.text).length; if (cov(b.text, fullR) >= 0.8) return true; if (cov(fullR, b.text) >= 0.8 && r.words >= 0.2 * bw) return true; return false; }
const api = loadApi(REPO + '/dist');
const pages = [], removals = [];
for (const page of PAGES) {
  const html = readFileSync(`${EXP}/pages/${page.file}`, 'utf8');
  const doc = parseLinkedomHTML(html, page.url); for (const el of Array.from(doc.querySelectorAll('script,style,noscript,template,svg,iframe,link,meta'))) el.parentNode.removeChild(el);
  const blocks = page.blocks.map(b => { const el = resolve(doc, b); return { id: b.id, kind: b.kind, step: b.step || '', text: el ? visibleText(el) : null }; }).filter(b => b.text);
  const cap = await capture(api, html, page.url);
  const base = await replay(api, html, page.url, null);
  const baseText = (() => { const d = parseLinkedomHTML("<html><body>" + (base.result?.content || "") + "</body></html>"); return visibleText(d.body); })();
  for (const r of cap.removals) {
    // label by overlap with W/C blocks: removed element inside a block, or containing it
    const lab = []; for (const b of blocks) { if (!r.text || r.words === 0) continue; if (relates(r, b)) lab.push(b.kind + ':' + b.id); }
    const kinds = new Set(lab.map(l => l[0]));
    removals.push({ page: page.file, issue: page.issue, url: page.url, title: cap.result?.title || '', label: kinds.has('W') ? 'wrongful' : kinds.has('C') ? 'correct' : kinds.has('A') || kinds.has('K') ? 'ambiguous' : 'unlabeled', blocks: lab, ...r });
  }
  pages.push({ file: page.file, issue: page.issue, url: page.url, blocks, base_text: baseText, capture_stats: cap.stats, error: cap.error || base.error || null });
}
writeFileSync(DIR + '/bug-pages.json', JSON.stringify(pages, null, 1));
writeFileSync(DIR + '/removals-bugs.jsonl', removals.map(r => JSON.stringify(r)).join('\n') + '\n');
const W = pages.flatMap(p => p.blocks.filter(b => b.kind === 'W').map(b => ({ ...b, issue: p.issue, file: p.file, covered: removals.some(r => r.page === p.file && r.final && r.blocks.includes('W:' + b.id)) })));
console.log(`pages ${pages.length}, removals ${removals.length} (final ${removals.filter(r => r.final).length}); labels:`, JSON.stringify(removals.filter(r => r.final).reduce((m, r) => (m[r.label] = (m[r.label] || 0) + 1, m), {})));
console.log(`W blocks ${W.length}; W blocks with a matching final-pass removal record: ${W.filter(w => w.covered).length}`);
for (const w of W.filter(w => !w.covered)) console.log(`  no removal record: #${w.issue} ${w.id} (${w.step}) "${w.text.slice(0, 60)}"`);
