// End-to-end evaluation of acquittal policies. Usage: bash -ic 'node run-policies.mjs <set:fixtures|bugs|history|all> <policy,...>'
import { readFileSync, readdirSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { loadApi, capture, captureNoDebug, replay, comparable, makeNormalizer, fixtureUrl, visibleText } from './harness.mjs';
import { requestsForV2 } from './questions-v2.mjs';
import { familyOf, requestsFor, isInline } from './questions.mjs';
const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle', DIR = '/home/alexi/git/defuddle/experiments/jev/lab/acquittal';
const EXP = '/home/alexi/git/defuddle/experiments/jev/lab/exp-known-failures';
const MODEL = 'jev-1.14.0';
const ROLEQ = JSON.parse(readFileSync('/home/alexi/git/defuddle/experiments/jev/lab/coproduct/questions.json', 'utf8'));
const roleQ = { role_fwd: ROLEQ.role_fwd, role_rev: ROLEQ.role_rev };
const { parseHTML } = require(REPO + '/node_modules/linkedom');
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });

// ---- cached Jev ----
const CACHE = DIR + '/jev-cache.jsonl'; const cache = new Map();
if (existsSync(CACHE)) for (const l of readFileSync(CACHE, 'utf8').split('\n')) { if (!l.trim()) continue; const r = JSON.parse(l); cache.set(r.k, r.a); }
let calls = 0;
async function ask(state, questions) {
  const k = createHash('sha1').update(JSON.stringify({ MODEL, state, questions })).digest('hex');
  if (cache.has(k)) return cache.get(k);
  const res = await systemOne({ state, questions, model: MODEL }); calls++;
  const a = {}; for (const [q, v] of Object.entries(res.answers)) a[q] = v.type === 'choice' || v.probabilities ? v.probabilities : v.noul;
  cache.set(k, a); appendFileSync(CACHE, JSON.stringify({ k, a }) + '\n'); return a;
}
async function answersFor(r) {
  const req = requestsFor(r); if (!req) return null;
  const main = await ask(req.main.state, req.main.questions);
  const po = req.phraseOnly ? await ask(req.phraseOnly.state, req.phraseOnly.questions) : null;
  const role = await ask(r.html, roleQ);
  const q2 = requestsForV2(r); const v2 = q2 ? (await ask(q2.main.state, q2.main.questions)).acquit_v2 : null;
  return { fam: req.fam, inline: req.inline, acquit_ex: main.acquit_ex, acquit_plain: main.acquit_plain, acquit_phrase_only: po ? po.acquit_phrase_only : main.acquit_ex,
    role: ((role.role_fwd?.article_content ?? 0) + (role.role_rev?.article_content ?? 0)) / 2, v2 };
}

// ---- policies ----
const POLICIES = {
  none: () => false,
  role90: (r, a) => a.role >= 0.9,
  ex90: (r, a) => a.acquit_ex >= 0.9,
  ex80: (r, a) => a.acquit_ex >= 0.8,
  ex95: (r, a) => a.acquit_ex >= 0.95,
  plain90: (r, a) => a.acquit_plain >= 0.9,
  phraseonly90: (r, a) => a.acquit_phrase_only >= 0.9,
  ex90_or_role90: (r, a) => a.acquit_ex >= 0.9 || a.role >= 0.9,
  ex90_and_role50: (r, a) => a.acquit_ex >= 0.9 && a.role >= 0.5,
};
// Post-hoc variants: same Jev rule plus the code-side title rule (never restore the page's own title; Defuddle moves it to metadata)
for (const base of ['role90', 'ex90', 'ex80', 'ex90_or_role90']) POLICIES[base + '_t'] = POLICIES[base];
POLICIES.ex80_or_role90_t = (r, a) => a.acquit_ex >= 0.8 || a.role >= 0.9;
// v2 (McpMessages style) questions
POLICIES.v2_90 = (r, a) => a.v2 >= 0.9;
POLICIES.v2_80 = (r, a) => a.v2 >= 0.8;
POLICIES.v2_90_or_role90 = (r, a) => a.v2 >= 0.9 || a.role >= 0.9;
POLICIES.v2_80_or_role90 = (r, a) => a.v2 >= 0.8 || a.role >= 0.9;
for (const base of ['v2_90', 'v2_80', 'v2_90_or_role90', 'v2_80_or_role90']) POLICIES[base + '_t'] = POLICIES[base];
// Post-hoc routing candidate (chosen after seeing results): v2 for every reason; role only as a backstop for blocks of 20+ words
POLICIES.v2_90_or_role90big_t = (r, a) => a.v2 >= 0.9 || (a.role >= 0.9 && r.words >= 20);

// ---- text helpers ----
const toks = t => (t || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
const sh = (ws, n) => { const o = new Set(); for (let i = 0; i + n <= ws.length; i++) o.add(ws.slice(i, i + n).join(' ')); return o; };
const cov = (a, B, n = 3) => { const A = sh(a, n); if (!A.size) return 0; let k = 0; for (const x of A) if (B.has(x)) k++; return k / A.size; };
const htmlText = html => visibleText(parseHTML('<html><body>' + (html || '') + '</body></html>').document.body);
const countSeq = (T, seq) => { if (!seq.length) return 0; const s = ' ' + T.join(' ') + ' ', q = ' ' + seq.join(' ') + ' '; let n = 0, i = 0; while ((i = s.indexOf(q, i)) >= 0) { n++; i += 1; } return n; };
function present(text, out, ctx) { // is this removed text present in the output (in context for short texts)?
  const R = toks(text); if (!R.length) return false;
  if (R.length >= 8) return cov(R, sh(out, 3)) >= 0.7;
  const i = ctx ? ctx.indexOf('⟦') : -1, k = ctx ? ctx.indexOf('⟧') : -1;
  const left = i >= 0 ? toks(ctx.slice(0, i)).slice(-4) : [], right = k >= 0 ? toks(ctx.slice(k + 1)).slice(0, 4) : [];
  if (!left.length && !right.length) return null;
  return (left.length && countSeq(out, [...left, ...R]) > 0) || (right.length && countSeq(out, [...R, ...right]) > 0);
}

// ---- per-page loop ----
async function runPage(api, html, url, policy, noDebug = false) {
  const decisions = new Map(); const acquittedRecs = []; let rounds = 0;
  for (; rounds < 5; rounds++) {
    const cap = noDebug ? await captureNoDebug(api, html, url, fp => decisions.get(fp) === true) : await capture(api, html, url, {}, fp => decisions.get(fp) === true);
    const freshMap = new Map(); for (const r of cap.removals) if (!decisions.has(r.fp) && !r.orphan && !freshMap.has(r.fp)) freshMap.set(r.fp, r);
    const fresh = [...freshMap.values()];
    if (!fresh.length) break;
    const outT = toks(htmlText(cap.result?.content)); const outB = sh(outT, 3);
    const titleT = toks(cap.result?.title || ''), T = titleT.join(' ');
    const titleLike = r => { const R = toks(r.text), S = R.join(' '); if (!titleT.length || !R.length) return false; return S === T || (titleT.length >= 2 && S.startsWith(T + ' ')) || (/^h[1-6]$/.test(r.tag) && R.length >= 2 && T.includes(S)); };
    const answers = await mapConcurrent(fresh, async r => (familyOf(r) ? answersFor(r) : null), 8);
    const keptTexts = new Map(); // text -> paths of copies already restored this round
    const nested = (a, b) => a === b || a.startsWith(b + '/') || b.startsWith(a + '/');
    fresh.forEach((r, i) => {
      const a = answers[i]; if (!a || a.error) { decisions.set(r.fp, false); return; }
      let acquit = !!POLICIES[policy](r, a);
      if (acquit && policy.endsWith('_t') && titleLike(r)) acquit = false;
      if (acquit && r.words >= 8) { // code rules: never restore text that already survives, and restore one copy at most
        const R = toks(r.text); const key = R.join(' ');
        const paths = keptTexts.get(key) || [];
        if (cov(R, outB) >= 0.8 || paths.some(q => !nested(q, r.path || ''))) acquit = false; else keptTexts.set(key, [...paths, r.path || '']);
      }
      decisions.set(r.fp, acquit);
      if (acquit) acquittedRecs.push({ fp: r.fp, step: r.step, reason: r.reason, selector: r.selector, exact: r.exact, fam: a.fam, inline: a.inline, words: r.words, tag: r.tag, text: r.text.slice(0, 300), ans: { ex: a.acquit_ex, plain: a.acquit_plain, po: a.acquit_phrase_only, role: +a.role.toFixed(3), v2: a.v2 } });
    });
  }
  const rep = await replay(api, html, url, fp => decisions.get(fp) === true);
  return { rep, acquittedRecs, rounds, decisions };
}

// ---- sets ----
const setName = process.argv[2] || 'fixtures'; const policies = (process.argv[3] || 'none').split(',');
const current = loadApi(REPO + '/dist'); const normalize = makeNormalizer(REPO + '/dist');
const results = {};
for (const policy of policies) {
  const t0 = Date.now(); const res = { policy, fixtures: null, bugs: null, history: null };
  if (setName === 'fixtures' || setName === 'all') {
    const changed = [], restored = [];
    for (const f of readdirSync(REPO + '/tests/fixtures').filter(f => f.endsWith('.html')).sort()) {
      const name = f.replace(/\.html$/, ''); const html = readFileSync(`${REPO}/tests/fixtures/${f}`, 'utf8'); const url = fixtureUrl(name, html);
      const { rep, acquittedRecs } = await runPage(current, html, url, policy);
      const exp = readFileSync(`${REPO}/tests/expected/${name}.md`, 'utf8');
      const same = rep.result && normalize(comparable(rep.result).trim()) === normalize(exp.trim());
      if (!same) changed.push(name);
      for (const a of acquittedRecs) restored.push({ page: name, ...a });
    }
    res.fixtures = { changed: changed.length, changed_list: changed, restored: restored.length, restored_list: restored };
  }
  if (setName === 'bugs' || setName === 'all') {
    const src = readFileSync(EXP + '/experiment.mjs', 'utf8');
    const PAGES = eval('(' + src.slice(src.indexOf('const PAGES = [') + 'const PAGES = '.length, src.indexOf('\n];', src.indexOf('const PAGES = [')) + 2) + ')');
    const bp = JSON.parse(readFileSync(DIR + '/bug-pages.json', 'utf8'));
    const issues = {}; const restored = []; const leaks = [];
    for (const p of bp) {
      const html = readFileSync(`${EXP}/pages/${p.file}`, 'utf8');
      const { rep, acquittedRecs } = await runPage(current, html, p.url, policy);
      const outT = toks(htmlText(rep.result?.content)), baseT = toks(p.base_text); const outB = sh(outT, 3), baseB = sh(baseT, 3);
      for (const a of acquittedRecs) restored.push({ page: p.file, issue: p.issue, ...a });
      for (const b of p.blocks) {
        const B = toks(b.text); let ok;
        if (B.length >= 8) ok = cov(B, outB) >= 0.8 && cov(B, baseB) < 0.5; else ok = countSeq(outT, B) > countSeq(baseT, B);
        if (b.kind === 'W') { issues[p.issue] = issues[p.issue] || { W: 0, recovered: 0, blocks: [] }; issues[p.issue].W++; if (ok) issues[p.issue].recovered++; issues[p.issue].blocks.push(`${b.id}:${ok ? 'recovered' : 'lost'}`); }
        if (b.kind === 'C') { const leaked = B.length >= 8 ? cov(B, outB) >= 0.5 && cov(B, baseB) < 0.2 : countSeq(outT, B) > countSeq(baseT, B); if (leaked) leaks.push(`${p.file}:${b.id}`); }
      }
    }
    const fixed = Object.entries(issues).filter(([, v]) => v.recovered === v.W).map(([k]) => +k).sort((a, b) => a - b);
    res.bugs = { issues: Object.keys(issues).length, fixed: fixed.length, fixed_list: fixed, W_blocks: Object.values(issues).reduce((s, v) => s + v.W, 0), W_recovered: Object.values(issues).reduce((s, v) => s + v.recovered, 0), C_blocks: bp.reduce((s, p) => s + p.blocks.filter(b => b.kind === 'C').length, 0), C_leaked: leaks.length, leaks, restored: restored.length, restored_list: restored, per_issue: issues };
  }
  for (const hs of ['history', 'historypre']) {
    if (!(setName === hs || setName === 'all')) continue;
    const noDebug = hs === 'historypre';
    const hist = readFileSync(DIR + (noDebug ? '/removals-history-pre.jsonl' : '/removals-history.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    const pages = new Map(); for (const r of hist) { const k = r.commit + '|' + r.page; if (!pages.has(k)) pages.set(k, { commit: r.commit, parent: r.parent, page: r.page, url: r.url, recs: [] }); pages.get(k).recs.push(r); }
    const apis = new Map(); let W = 0, Wrec = 0, C = 0, Cleak = 0; const restored = []; const wrongList = [];
    for (const pg of pages.values()) {
      if (!pg.recs.some(r => r.label === 'wrongful' || r.label === 'correct')) continue;
      if (!apis.has(pg.parent)) apis.set(pg.parent, loadApi(`${DIR}/hist/b-${pg.parent}/dist`));
      const html = git('show', `${pg.commit}:tests/fixtures/${pg.page}.html`);
      const base = await replay(apis.get(pg.parent), html, pg.url, null);
      const baseT = toks(htmlText(base.result?.content));
      const { rep, acquittedRecs } = await runPage(apis.get(pg.parent), html, pg.url, policy, noDebug);
      const outT = toks(htmlText(rep.result?.content));
      for (const a of acquittedRecs) restored.push({ commit: pg.commit, page: pg.page, ...a });
      for (const r of pg.recs) {
        const now = present(r.text, outT, r.context), before = present(r.text, baseT, r.context);
        if (r.label === 'wrongful') { W++; const ok = !!now && !before; if (ok) Wrec++; wrongList.push({ commit: pg.commit, subject: r.subject, page: pg.page, step: r.step, reason: r.reason, sel: r.selector === 'exact' ? r.exact[0] : r.selector, words: r.words, text: r.text.slice(0, 120), recovered: ok }); }
        else if (r.label === 'correct' && r.words > 0) { C++; if (now && !before) Cleak++; }
      }
    }
    res[hs] = { wrongful: W, recovered: Wrec, controls: C, controls_leaked: Cleak, restored: restored.length, restored_list: restored, wrong_list: wrongList };
  }
  res.seconds = Math.round((Date.now() - t0) / 1000); results[policy] = res;
  writeFileSync(`${DIR}/policy-${setName}-${policy}.json`, JSON.stringify(res, null, 1));
  const f = res.fixtures, b = res.bugs, h = res.history || res.historypre;
  console.log(`[${policy}] ${f ? `fixtures changed ${f.changed}/226, restored ${f.restored}` : ''} ${b ? `| bugs fixed ${b.fixed}/${b.issues} (${b.fixed_list.join(' ')}), W ${b.W_recovered}/${b.W_blocks}, C leaked ${b.C_leaked}/${b.C_blocks}, restored ${b.restored}` : ''} ${h ? `| history recovered ${h.recovered}/${h.wrongful}, controls leaked ${h.controls_leaked}/${h.controls}` : ''} | new Jev calls so far ${calls} | ${res.seconds}s`);
}
console.log(JSON.stringify(usageTotals()));
