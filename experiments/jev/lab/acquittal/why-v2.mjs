import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { requestsFor, familyOf } from './questions.mjs';
import { requestsForV2 } from './questions-v2.mjs';
const MODEL = 'jev-1.14.0';
const cache = new Map(); for (const l of readFileSync('jev-cache.jsonl', 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); cache.set(r.k, r.a); }
const key = (s, q) => createHash('sha1').update(JSON.stringify({ MODEL, state: s, questions: q })).digest('hex');
const rem = readFileSync('removals-bugs.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const pol = JSON.parse(readFileSync('policy-bugs-v2_90_or_role90.json', 'utf8')).bugs;
for (const iss of process.argv.slice(2).map(Number)) {
  console.log(`#${iss}: ${JSON.stringify(pol.per_issue[iss]?.blocks)}`);
  const seen = new Set();
  for (const r of rem.filter(r => r.issue === iss && r.label === 'wrongful' && r.final)) {
    if (seen.has(r.fp)) continue; seen.add(r.fp);
    const q1 = requestsFor(r), q2 = requestsForV2(r); if (!q1) continue;
    const v1 = cache.get(key(q1.main.state, q1.main.questions)), v2 = cache.get(key(q2.main.state, q2.main.questions));
    console.log(`   ${r.page} ${familyOf(r)}${q1.inline ? '/i' : '/b'} ${r.words}w v1=${v1?.acquit_ex ?? '?'} v2=${v2?.acquit_v2 ?? '?'} | "${r.text.slice(0, 60)}"`);
  }
}
