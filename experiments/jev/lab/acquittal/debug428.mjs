import { readFileSync } from 'node:fs';
import { loadApi, capture, replay, visibleText } from './harness.mjs';
const REPO = '/home/alexi/git/defuddle', EXP = '/home/alexi/git/defuddle/experiments/jev/lab/exp-known-failures';
const pol = JSON.parse(readFileSync('policy-bugs-ex90_or_role90.json', 'utf8')).bugs;
const acq = pol.restored_list.filter(a => a.page === '428.html'); console.log('acquitted on 428:', acq.map(a => `${a.words}w "${a.text.slice(0, 40)}"`).join(' | '));
const api = loadApi(REPO + '/dist'); const html = readFileSync(EXP + '/pages/428.html', 'utf8');
const fps = new Set(acq.map(a => a.fp));
const rep = await replay(api, html, 'https://example.org/428', fp => fps.has(fp));
const md = rep.result.contentMarkdown || ""; for (const w of ["output register", "cash register", "now contains"]) { const i = md.indexOf(w); console.log("markdown around " + JSON.stringify(w) + ":", JSON.stringify(i < 0 ? "(absent)" : md.slice(Math.max(0, i - 60), i + 50))); }
console.log('contains "output register"?', md.includes('output register'));
