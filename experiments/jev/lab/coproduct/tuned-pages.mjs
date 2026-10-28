import { loadJsonl, rowsFrom, withTitleRule, SUBSETS, units } from './metrics.mjs';
const DIR='/home/alexi/git/defuddle/experiments/jev/lab/coproduct';
const v1 = loadJsonl('/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/raw-v1.jsonl'); const A = loadJsonl(`${DIR}/raw-A.jsonl`);
const CONTENT=['article_body','heading','media_or_figure','code_or_table','footnotes_or_references'];
const wrongAt=(r,t)=>((r.s<t)?1:0)!==r.y;
function split(rs){ const fx=[...new Set(rs.map(r=>r.fx))].sort(); let a=7>>>0; const rnd=()=>{a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;}; for(let i=fx.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1)); [fx[i],fx[j]]=[fx[j],fx[i]];} const h=new Set(fx.slice(0,fx.length>>1)); return [rs.filter(r=>h.has(r.fx)), rs.filter(r=>!h.has(r.fx))]; }
// threshold chosen to maximise pages with zero disagreements on one half, applied to the other half
function bestPageT(rs){ const c=[...new Set(rs.map(r=>r.s))].sort((a,b)=>a-b); let best={t:0.5,z:-1}; for(let i=1;i<c.length;i++){ const t=(c[i-1]+c[i])/2; const by=new Map(); for(const r of rs){ by.set(r.fx,(by.get(r.fx)||0)+(wrongAt(r,t)?1:0)); } const z=[...by.values()].filter(v=>!v).length; if(z>best.z) best={t,z}; } return best.t; }
function tunedPages(rs){ const [P,Q]=split(rs); const tP=bestPageT(P), tQ=bestPageT(Q); const by=new Map(); for(const r of Q) by.set(r.fx,(by.get(r.fx)||0)+(wrongAt(r,tP)?1:0)); for(const r of P) by.set(r.fx,(by.get(r.fx)||0)+(wrongAt(r,tQ)?1:0)); const z=[...by.values()].filter(v=>!v).length; return `${z}/${by.size} (${(100*z/by.size).toFixed(1)}%) t=${tP.toFixed(2)}/${tQ.toFixed(2)}`; }
const S = { 'old bundled keep yes/no': withTitleRule(rowsFrom(v1,r=>r.p_keep)), 'old 12-way kind P(content)': withTitleRule(rowsFrom(v1,r=>CONTENT.reduce((s,k)=>s+(r.kind_probabilities?.[k]||0),0))), 'new role coproduct P(article_content)': withTitleRule(rowsFrom(A,r=>(r.role_fwd.article_content+r.role_rev.article_content)/2)) };
console.log('| scorer (all with code title rule) | subset | pages fully agreeing, threshold tuned on other half of pages |\n|---|---|---|');
for (const [n,rs] of Object.entries(S)) for (const [k,f] of Object.entries(SUBSETS)) console.log(`| ${n} | ${k} | ${tunedPages(rs.filter(f))} |`);
// Remaining errors of the role coproduct at 0.5 on the fair subset
const fair = S['new role coproduct P(article_content)'].filter(SUBSETS['also no extractor pages']).filter(r=>wrongAt(r,0.5));
const b={}; for(const r of fair){ const w=r.words<5?'<5 words':r.words<16?'5-15':r.words<50?'16-49':'50+'; const d=r.s<0.5?'Jev removes kept block':'Jev keeps removed block'; const k=`${d}, ${w}`; b[k]=(b[k]||0)+1; }
console.log(`\nRole coproduct errors on fair subset: ${fair.length}`); console.log(Object.entries(b).sort().map(([k,v])=>`  ${k}: ${v}`).join('\n'));
console.log('\nLargest wrongly removed blocks:'); for (const r of fair.filter(r=>r.s<0.5).sort((a,b)=>b.words-a.words).slice(0,8)) { const x=A.get(r.id); const top=Object.entries(x.role_fwd).sort((a,b)=>b[1]-a[1])[0]; console.log(`  ${r.words}w P=${r.s.toFixed(2)} top=${top[0]} ${top[1]} | ${units.get(r.id).fixture} | ${units.get(r.id).text.slice(0,100)}`); }
