// Historical wrongful removals: for every commit since debug records exist (43ee268) that changed expected outputs,
// build its parent, run the parent on the commit's fixtures, and find removals whose text the commit's expected output now keeps.
import { execFileSync, execFile } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { loadApi, capture, fixtureUrl, visibleText } from './harness.mjs';
const run = promisify(execFile); const require = createRequire(import.meta.url);
const REPO = '/home/alexi/git/defuddle', DIR = '/home/alexi/git/defuddle/experiments/jev/lab/acquittal', H = DIR + '/hist';
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 });
const { parseHTML } = require(REPO + '/node_modules/linkedom');
const commits = git('log', '--no-merges', '--format=%h', '43ee268^..HEAD', '--', 'tests/expected/*.md').trim().split('\n');
const jobs = [];
for (const C of commits) {
  const P = git('rev-parse', '--short', C + '^').trim();
  const names = git('diff', '--name-status', P, C, '--', 'tests/expected/').trim().split('\n').map(l => l.match(/^[AM]\s+tests\/expected\/(.+)\.md$/)).filter(Boolean).map(m => m[1]);
  for (const X of names) jobs.push({ C, P, X, subject: git('log', '-1', '--format=%s', C).trim() });
}
const parents = [...new Set(jobs.map(j => j.P))];
console.log(`commits ${commits.length}, fixture jobs ${jobs.length}, parent builds ${parents.length}`);
async function build(P) {
  const d = `${H}/b-${P}`; if (existsSync(d + '/dist/node.js')) return true;
  mkdirSync(d, { recursive: true });
  try { await run('bash', ['-c', `cd ${REPO} && git archive ${P} src tsconfig.json tsconfig.node.json package.json | tar -x -C ${d}`]); } catch (e) { return false; }
  if (!existsSync(d + '/node_modules')) symlinkSync(REPO + '/node_modules', d + '/node_modules');
  try { await run('npx', ['tsc', '-p', 'tsconfig.node.json'], { cwd: d }); } catch (e) { /* type errors still emit */ }
  return existsSync(d + '/dist/node.js');
}
let next = 0; const built = new Map();
await Promise.all(Array.from({ length: 6 }, async () => { while (next < parents.length) { const P = parents[next++]; built.set(P, await build(P)); } }));
console.log(`built ${[...built.values()].filter(Boolean).length}/${parents.length}`);
// text helpers: letters/digits tokens
const toks = t => (t || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
const mdText = md => md.replace(/^```json[\s\S]*?```\s*/, '').replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ').replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ').replace(/<[^>]+>/g, ' ');
const sh = (ws, n) => { const o = new Set(); for (let i = 0; i + n <= ws.length; i++) o.add(ws.slice(i, i + n).join(' ')); return o; };
const cov = (a, B, n = 3) => { const A = sh(a, n); if (!A.size) return 0; let k = 0; for (const x of A) if (B.has(x)) k++; return k / A.size; };
const has = (T, seq) => seq.length > 0 && T.includes(' ' + seq.join(' ') + ' ');
const out = []; const apis = new Map(); let errors = 0;
for (const j of jobs) {
  if (!built.get(j.P)) continue;
  let html, expected; try { html = git('show', `${j.C}:tests/fixtures/${j.X}.html`); expected = git('show', `${j.C}:tests/expected/${j.X}.md`); } catch { continue; }
  if (!apis.has(j.P)) { try { apis.set(j.P, loadApi(`${H}/b-${j.P}/dist`)); } catch (e) { apis.set(j.P, null); } }
  const api = apis.get(j.P); if (!api) continue;
  const url = fixtureUrl(j.X, html);
  let cap; try { cap = await capture(api, html, url); } catch (e) { errors++; continue; }
  if (cap.error || !cap.result) { errors++; continue; }
  const E = toks(mdText(expected)), Es = ' ' + E.join(' ') + ' ', EB = sh(E, 3);
  const pdoc = parseHTML('<html><body>' + (cap.result.content || '') + '</body></html>').document; const Pt = toks(visibleText(pdoc.body)), Ps = ' ' + Pt.join(' ') + ' ', PB = sh(Pt, 3);
  for (const r of cap.removals.filter(r => r.final && r.words > 0)) {
    const R = toks(r.text); if (!R.length) continue;
    let label;
    if (R.length >= 8) { const ce = cov(R, EB), cp = cov(R, PB); label = ce >= 0.7 && cp <= 0.3 ? 'wrongful' : ce <= 0.15 ? 'correct' : 'ambiguous'; }
    else {
      const ctx = r.context || ''; const i = ctx.indexOf('⟦'), k = ctx.indexOf('⟧');
      const left = i >= 0 ? toks(ctx.slice(0, i)).slice(-4) : [], right = k >= 0 ? toks(ctx.slice(k + 1)).slice(0, 4) : [];
      const inE = (left.length && has(Es, [...left, ...R])) || (right.length && has(Es, [...R, ...right]));
      const inP = (left.length && has(Ps, [...left, ...R])) || (right.length && has(Ps, [...R, ...right]));
      label = inE && !inP ? 'wrongful' : !has(Es, R) ? 'correct' : 'ambiguous';
    }
    out.push({ source: 'history', commit: j.C, parent: j.P, subject: j.subject, page: j.X, url, title: cap.result.title || '', label, ...r });
  }
}
// de-duplicate the same removed element across commits that touched the same fixture
const seen = new Map(); for (const r of out) { const key = `${r.page}|${r.step}|${r.reason}|${r.text.slice(0, 200)}`; const prev = seen.get(key); if (!prev || (prev.label !== 'wrongful' && r.label === 'wrongful')) seen.set(key, r); }
const dedup = [...seen.values()];
writeFileSync(DIR + '/removals-history.jsonl', dedup.map(r => JSON.stringify(r)).join('\n') + '\n');
const W = dedup.filter(r => r.label === 'wrongful');
console.log(`captures done, errors ${errors}; removals ${dedup.length}:`, JSON.stringify(dedup.reduce((m, r) => (m[r.label] = (m[r.label] || 0) + 1, m), {})));
console.log(`wrongful by commit: ${[...new Set(W.map(r => r.commit))].length} commits, ${[...new Set(W.map(r => r.page))].length} fixtures`);
