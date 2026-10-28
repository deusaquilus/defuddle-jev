import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { requestsFor, familyOf } from './questions.mjs';
const MODEL = 'jev-1.14.0';
const ROLEQ = JSON.parse(readFileSync('/home/alexi/git/defuddle/experiments/jev/lab/coproduct/questions.json', 'utf8')); const roleQ = { role_fwd: ROLEQ.role_fwd, role_rev: ROLEQ.role_rev };
const cache = new Map(); for (const l of readFileSync('jev-cache.jsonl', 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); cache.set(r.k, r.a); }
const key = (s, q) => createHash('sha1').update(JSON.stringify({ MODEL, state: s, questions: q })).digest('hex');
const rem = readFileSync('removals-bugs.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const pol = JSON.parse(readFileSync('policy-bugs-ex90_or_role90.json', 'utf8')).bugs;
for (const iss of process.argv.slice(2).map(Number)) {
  console.log(`#${iss}: ${JSON.stringify(pol.per_issue[iss]?.blocks)}`);
  const seen = new Set();
  for (const r of rem.filter(r => r.issue === iss && r.label === 'wrongful' && r.final)) {
    if (seen.has(r.fp)) continue; seen.add(r.fp);
    const q = requestsFor(r); const m = q && cache.get(key(q.main.state, q.main.questions)); const ro = cache.get(key(r.html, roleQ));
    const role = ro ? ((ro.role_fwd?.article_content ?? 0) + (ro.role_rev?.article_content ?? 0)) / 2 : null;
    console.log(`   ${r.page} ${familyOf(r)}${q?.inline ? '/i' : '/b'} ${r.tag} ${r.words}w ex=${m?.acquit_ex ?? '-'} plain=${m?.acquit_plain ?? '-'} role=${role?.toFixed(2) ?? '-'} | "${r.text.slice(0, 50)}" | ctx: ${(r.context || '').slice(0, 90)} | before: ${(r.prev_text || '').slice(-50)} | after: ${(r.next_text || '').slice(0, 50)}`);
  }
}
