import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { loadApi, capture, replay, comparable, makeNormalizer, fixtureUrl } from './harness.mjs';
const REPO = '/home/alexi/git/defuddle', DIR = '/home/alexi/git/defuddle/experiments/jev/lab/acquittal';
const api = loadApi(REPO + '/dist'); const normalize = makeNormalizer(REPO + '/dist');
const files = readdirSync(REPO + '/tests/fixtures').filter(f => f.endsWith('.html')).sort();
let recorded = 0, captured = 0, same = 0, diff = [], fpHit = 0, fpTot = 0, errs = [];
const out = [];
for (const f of files) {
  const name = f.replace(/\.html$/, ''); const html = readFileSync(`${REPO}/tests/fixtures/${f}`, 'utf8'); const url = fixtureUrl(name, html);
  const cap = await capture(api, html, url); if (cap.error) errs.push(name + ': ' + cap.error.slice(0, 120));
  recorded += cap.stats.recorded_final; captured += cap.stats.captured_final;
  for (const r of cap.removals) out.push({ page: name, url, title: cap.result?.title || '', ...r });
  const rep = await replay(api, html, url, null); if (rep.error) { errs.push(name + ' replay: ' + rep.error.slice(0, 120)); continue; }
  const expected = readFileSync(`${REPO}/tests/expected/${name}.md`, 'utf8');
  if (normalize(comparable(rep.result).trim()) === normalize(expected.trim())) same++; else diff.push(name);
  const seen = new Set(rep.seen); for (const r of cap.removals) { fpTot++; if (seen.has(r.fp)) fpHit++; }
}
writeFileSync(`${DIR}/removals-fixtures.jsonl`, out.map(o => JSON.stringify(o)).join('\n') + '\n');
console.log(JSON.stringify({ fixtures: files.length, errors: errs.length, final_recorded: recorded, final_captured: captured, replay_matches_expected: same, replay_differs: diff.length, differs: diff.slice(0, 10), fingerprint_seen_in_replay: `${fpHit}/${fpTot}`, captured_all_passes: out.length }, null, 1));
if (errs.length) console.log(errs.slice(0, 5).join('\n'));
