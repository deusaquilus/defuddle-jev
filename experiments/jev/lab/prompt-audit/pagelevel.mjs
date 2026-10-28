// Offline recompute of the page-level figure from saved Jev responses. No API calls.
import { readFileSync } from 'node:fs';
const D = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification';
const units = new Map(readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l)).map(u=>[u.id,u]));
const corr = new Map(readFileSync(`${D}/labels-corrected.jsonl`,'utf8').trim().split('\n').map(l=>JSON.parse(l)).map(r=>[r.id,r]));
const judg = JSON.parse(readFileSync(`${D}/judgments.json`,'utf8'));
const raw = new Map();
for (const l of readFileSync(`${D}/raw-v1.jsonl`,'utf8').split('\n')) { if(!l.trim()) continue; const r=JSON.parse(l); if (r.error && raw.has(r.id)) continue; raw.set(r.id,r); }
const rows = [...raw.values()].filter(r=>!r.error && typeof r.p_keep==='number').map(r=>{const u=units.get(r.id), c=corr.get(r.id); return {id:r.id, fx:r.fixture, p:r.p_keep, label:c.label_corr, policy:c.policy, title:c.is_title, extractor:u.extractor, words:c.words_corr ?? u.words, tag:u.tag, text:u.text.slice(0,110)};}).filter(r=>r.label!=='mixed');
const wrong = r => (r.p < 0.5) !== (r.label==='removed');
function pages(rs, name){
  const by=new Map(); for(const r of rs){ if(!by.has(r.fx)) by.set(r.fx,[]); by.get(r.fx).push(r); }
  let zero=0, le1=0; for(const v of by.values()){ const d=v.filter(wrong).length; if(!d) zero++; if(d<=1) le1++; }
  const e=rs.filter(wrong);
  console.log(`${name.padEnd(48)} pages=${by.size} zero-disagreement=${zero} (${(100*zero/by.size).toFixed(1)}%) <=1=${(100*le1/by.size).toFixed(1)}% | blocks=${rs.length} wrong=${e.length} (acc ${(100*(1-e.length/rs.length)).toFixed(1)}%) jev-removes-kept=${e.filter(r=>r.p<0.5).length} jev-keeps-removed=${e.filter(r=>r.p>=0.5).length}`);
  return by;
}
// Policy and extractor fixtures stay in the page count; only their blocks are dropped, so a page whose
// only disagreements are policy blocks counts as fully agreeing.
const allFx = new Set(rows.map(r=>r.fx));
pages(rows,'A. as reported (all blocks)');
pages(rows.filter(r=>!r.policy),'B. drop title/byline/date blocks');
pages(rows.filter(r=>!r.policy && !r.extractor),'C. B + drop extractor pages (X, Reddit, ...)');
pages(rows.filter(r=>!r.policy && !r.extractor && r.words>=16),'D. C + drop blocks under 16 words');
// Disagreements remaining in C, with adjudications from judgments.json where present
const C = rows.filter(r=>!r.policy && !r.extractor && wrong(r));
console.log(`\nRemaining disagreements in C: ${C.length}`);
const bucket = {}; for (const r of C){ const w=r.words<5?'<5':r.words<16?'5-15':r.words<50?'16-49':'50+'; bucket[w]=(bucket[w]||0)+1; }
console.log('by block size (words):', JSON.stringify(bucket));
const adj = {}; for (const r of C){ const j=judg[r.id]; const k=j? j.split(/[:(\[]/)[0].trim() : 'not adjudicated'; adj[k]=(adj[k]||0)+1; }
console.log('adjudications:', JSON.stringify(adj,null,1));
