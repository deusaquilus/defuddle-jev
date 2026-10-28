import { loadJsonl, rowsFrom, report, HEADER, withTitleRule, units, corr } from './metrics.mjs';
const DIR = '/home/alexi/git/defuddle/experiments/jev/lab/coproduct';
const v1 = loadJsonl('/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/raw-v1.jsonl');
const CONTENT = ['article_body','heading','media_or_figure','code_or_table','footnotes_or_references'];
const ROLES = ['article_content','site_navigation','promotion_or_call_to_action','links_to_other_articles','reader_comments','author_or_publication_metadata','site_footer_or_legal_notice','other'];
const CUES = ['has_article_prose','asks_reader_to_act','metadata_only','mostly_links_elsewhere','written_by_reader'];
const role = (r,k) => ((r.role_fwd?.[k]??0) + (r.role_rev?.[k]??0)) / 2;
const R1 = r => role(r,'article_content');
const R2 = r => 1 - Math.max(r.asks_reader_to_act, r.metadata_only, r.mostly_links_elsewhere, r.written_by_reader);
const R3 = r => (R1(r) + R2(r)) / 2;
// R4: logistic regression over the 8 role probabilities and 5 cues, cross-fit by page (trained on half the pages, scored on the other half)
function lrScores(map){
  const ids=[...map.keys()].filter(id=>{const c=corr.get(id); return c && c.label_corr!=='mixed' && !map.get(id).error;});
  const X=id=>{const r=map.get(id); return [1, ...ROLES.map(k=>role(r,k)), ...CUES.map(k=>r[k])];};
  const fx=[...new Set(ids.map(id=>units.get(id).fixture))].sort(); let a=7>>>0; const rnd=()=>{a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;}; for(let i=fx.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1)); [fx[i],fx[j]]=[fx[j],fx[i]];}
  const half=new Set(fx.slice(0,fx.length>>1)); const folds=[ids.filter(id=>half.has(units.get(id).fixture)), ids.filter(id=>!half.has(units.get(id).fixture))];
  const out=new Map(); const sig=z=>1/(1+Math.exp(-z));
  for(const [tr,te] of [[folds[0],folds[1]],[folds[1],folds[0]]]){ let w=new Array(X(tr[0]).length).fill(0); const data=tr.map(id=>[X(id), corr.get(id).label_corr==='kept'?1:0]);
    for(let it=0;it<3000;it++){ const g=new Array(w.length).fill(0); for(const [x,y] of data){ const p=sig(x.reduce((s,v,i)=>s+v*w[i],0)); for(let i=0;i<w.length;i++) g[i]+=(p-y)*x[i]; } for(let i=0;i<w.length;i++) w[i]-=0.5*(g[i]/data.length + (i?0.001*w[i]:0)); }
    for(const id of te) out.set(id, sig(X(id).reduce((s,v,i)=>s+v*w[i],0))); }
  return out; }
const lines=[HEADER];
const old = { 'old: bundled keep yes/no': rowsFrom(v1, r=>r.p_keep), 'old: 12-way kind, P(content)': rowsFrom(v1, r=>CONTENT.reduce((s,k)=>s+(r.kind_probabilities?.[k]||0),0)) };
const add=(name, rs)=>{ lines.push(report(name, rs)); lines.push(report(name+' + title rule', withTitleRule(rs))); };
for (const [n,rs] of Object.entries(old)) add(n, rs);
for (const arm of ['A','B']) {
  const m = loadJsonl(`${DIR}/raw-${arm}.jsonl`); const lr = lrScores(m);
  add(`${arm}: R1 role P(article_content)`, rowsFrom(m, R1));
  add(`${arm}: R2 cues only`, rowsFrom(m, R2));
  add(`${arm}: R3 mean of R1 and R2`, rowsFrom(m, R3));
  add(`${arm}: R4 cross-fit regression`, rowsFrom(m, r=>lr.get(r.id)));
  // option-order stability of the role coproduct
  let n=0, flip=0, dsum=0, dmax=0; for (const r of m.values()) { if (r.error) continue; n++; const af=Object.entries(r.role_fwd).sort((a,b)=>b[1]-a[1])[0][0], ar=Object.entries(r.role_rev).sort((a,b)=>b[1]-a[1])[0][0]; if (af!==ar) flip++; const d=Math.abs(r.role_fwd.article_content-r.role_rev.article_content); dsum+=d; dmax=Math.max(dmax,d); }
  lines.push(`\n[${arm}] role argmax differs between option orders: ${flip}/${n} (${(100*flip/n).toFixed(1)}%); mean |dP(article_content)| ${(dsum/n).toFixed(3)}, max ${dmax.toFixed(2)}\n`);
  lines.push(HEADER);
}
console.log(lines.join('\n'));
