// Per-trigger acquittal rates from cached answers (round-0 removals; no cascades). No API calls.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { familyOf, requestsFor } from './questions.mjs';
const DIR = '/home/alexi/git/defuddle/experiments/jev/lab/acquittal';
const MODEL = 'jev-1.14.0';
const ROLEQ = JSON.parse(readFileSync('/home/alexi/git/defuddle/experiments/jev/lab/coproduct/questions.json', 'utf8'));
const roleQ = { role_fwd: ROLEQ.role_fwd, role_rev: ROLEQ.role_rev };
const cache = new Map(); for (const l of readFileSync(DIR + '/jev-cache.jsonl', 'utf8').split('\n')) { if (l.trim()) { const r = JSON.parse(l); cache.set(r.k, r.a); } }
const key = (state, questions) => createHash('sha1').update(JSON.stringify({ MODEL, state, questions })).digest('hex');
function ans(r) { const q = requestsFor(r); if (!q) return null; const m = cache.get(key(q.main.state, q.main.questions)); const ro = cache.get(key(r.html, roleQ)); const po = q.phraseOnly ? cache.get(key(q.phraseOnly.state, q.phraseOnly.questions)) : null; if (!m) return null;
  return { fam: q.fam, inline: q.inline, ex: m.acquit_ex, plain: m.acquit_plain, po: po ? po.acquit_phrase_only : m.acquit_ex, role: ro ? ((ro.role_fwd?.article_content ?? 0) + (ro.role_rev?.article_content ?? 0)) / 2 : null }; }
const load = f => readFileSync(DIR + '/' + f, 'utf8').trim().split('\n').map(JSON.parse);
const uniq = rs => { const m = new Map(); for (const r of rs) if (!m.has(r.page + '|' + r.fp)) m.set(r.page + '|' + r.fp, r); return [...m.values()]; };
const rows = [
  ...uniq(load('removals-fixtures.jsonl').filter(r => r.final)).map(r => ({ set: 'fixtures', label: 'correct', r })),
  ...uniq(load('removals-bugs.jsonl').filter(r => r.final && (r.label === 'wrongful' || r.label === 'correct'))).map(r => ({ set: 'bugs', label: r.label, r })),
  ...load('removals-history.jsonl').filter(r => r.label === 'wrongful' || r.label === 'correct').map(r => ({ set: 'history', label: r.label, r })),
];
const t = {}; let missing = 0;
for (const x of rows) { const a = ans(x.r); if (!a) { if (familyOf(x.r)) missing++; continue; } const k = a.fam + (a.inline ? '/inline' : '/block'); t[k] = t[k] || { W: 0, C: 0, W_ex: 0, C_ex: 0, W_plain: 0, C_plain: 0, W_po: 0, C_po: 0, W_role: 0, C_role: 0 };
  const s = x.label === 'wrongful' ? 'W' : 'C'; t[k][s]++; if (a.ex >= 0.9) t[k][s + '_ex']++; if (a.plain >= 0.9) t[k][s + '_plain']++; if (a.po >= 0.9) t[k][s + '_po']++; if (a.role !== null && a.role >= 0.9) t[k][s + '_role']++; }
console.log(`(rows without cached answers: ${missing})`);
console.log('| trigger | wrongful removals | acquitted @0.9: with examples / without / role question | correct removals | wrongly acquitted @0.9: with examples / without / role question |\n|---|---|---|---|---|');
const tot = { W: 0, C: 0, W_ex: 0, C_ex: 0, W_plain: 0, C_plain: 0, W_role: 0, C_role: 0 };
for (const [k, v] of Object.entries(t).sort((a, b) => (b[1].W - a[1].W) || (b[1].C - a[1].C))) { console.log(`| ${k} | ${v.W} | ${v.W_ex} / ${v.W_plain} / ${v.W_role} | ${v.C} | ${v.C_ex} / ${v.C_plain} / ${v.C_role} |`); for (const z of Object.keys(tot)) tot[z] += v[z]; }
console.log(`| all | ${tot.W} | ${tot.W_ex} / ${tot.W_plain} / ${tot.W_role} | ${tot.C} | ${tot.C_ex} / ${tot.C_plain} / ${tot.C_role} |`);
const inl = Object.entries(t).filter(([k]) => k.endsWith('/inline')).reduce((m, [, v]) => ({ W: m.W + v.W, W_ex: m.W_ex + v.W_ex, W_po: m.W_po + v.W_po, C: m.C + v.C, C_ex: m.C_ex + v.C_ex, C_po: m.C_po + v.C_po }), { W: 0, W_ex: 0, W_po: 0, C: 0, C_ex: 0, C_po: 0 });
console.log(`\nInline phrases, with sentence context vs phrase alone: wrongful acquitted ${inl.W_ex} vs ${inl.W_po} of ${inl.W}; correct wrongly acquitted ${inl.C_ex} vs ${inl.C_po} of ${inl.C}`);
