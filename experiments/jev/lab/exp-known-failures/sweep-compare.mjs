import fs from 'node:fs';
const load = f => fs.readFileSync(f,'utf8').trim().split('\n').map(JSON.parse).filter(r => r.type === 'noul' && !r.error);
const old = load('results.jsonl'), neu = load('results-role.jsonl');
function sweep(rows, variant, name){
  const bl = rows.filter(r => r.variant === variant);
  const W = bl.filter(r => r.kind === 'W'), C = bl.filter(r => r.kind === 'C');
  const issues = [...new Set(W.map(r => r.issue))]; const totalW = W.reduce((s,r)=>s+r.words,0);
  const out = [];
  for (const t of [0.9, 0.8, 0.7, 0.6, 0.5]) {
    const fixed = issues.filter(i => W.filter(r=>r.issue===i).every(r => r.p_keep >= t));
    const kept = W.filter(r => r.p_keep >= t);
    out.push(`| ${name} | ${t} | ${fixed.length}/${issues.length} | ${kept.length}/${W.length} | ${kept.reduce((s,r)=>s+r.words,0)}/${totalW} | ${C.filter(r=>r.p_keep>=t).length}/${C.length} | ${fixed.sort((a,b)=>a-b).map(i=>'#'+i).join(' ')} |`);
  }
  return out.join('\n');
}
console.log('| question | veto threshold | issues fully fixed | wrongly removed blocks kept | words recovered | clutter re-inserted | issues fixed |\n|---|---|---|---|---|---|---|');
console.log(sweep(old,'html','old bundled yes/no, HTML'));
console.log(sweep(neu,'html','role coproduct, HTML'));
console.log(sweep(neu,'text','role coproduct, text'));
// which re-inserted clutter blocks at 0.7 for the role question
for (const r of neu.filter(r=>r.variant==='html'&&r.kind==='C'&&r.p_keep>=0.5)) console.log(`  clutter kept by role@>=0.5: #${r.issue} ${r.id} p=${r.p_keep.toFixed(2)} ${r.words}w "${r.preview.slice(0,80)}"`);
