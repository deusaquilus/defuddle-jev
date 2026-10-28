import { loadJsonl, units, corr } from './metrics.mjs';
const v1 = loadJsonl('/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/raw-v1.jsonl');
const FORM = new Set(['article_body','heading','media_or_figure','code_or_table','footnotes_or_references']);
const ROLE = new Set(['navigation_or_menu','promo_or_cta','related_links_or_cards','comments','byline_or_metadata','cookie_or_consent']);
let n=0, split=0, splitWrong=0, cleanWrong=0, clean=0; const pairs={}; const ex=[];
for (const [id,r] of v1){ if(r.error) continue; const c=corr.get(id); if(!c||c.label_corr==='mixed') continue; n++;
  const p=Object.entries(r.kind_probabilities).sort((a,b)=>b[1]-a[1]); const [k1,p1]=p[0], [k2,p2]=p[1];
  const y=c.label_corr==='removed'; const pred = !FORM.has(r.kind); const wrong = pred!==y;
  const cross = p2>=0.2 && ((FORM.has(k1)&&ROLE.has(k2))||(ROLE.has(k1)&&FORM.has(k2)));
  if(cross){ split++; if(wrong) splitWrong++; const key=[k1,k2].sort().join(' / '); pairs[key]=(pairs[key]||0)+1; if(ex.length<12 && wrong) ex.push(`${k1} ${p1} vs ${k2} ${p2} | label=${c.label_corr} | ${units.get(id).text.slice(0,90)}`); }
  else { clean++; if(wrong) cleanWrong++; } }
console.log(`blocks=${n}; second choice is on the other axis with p>=0.2: ${split} (${(100*split/n).toFixed(1)}%)`);
console.log(`error rate when split across axes: ${(100*splitWrong/split).toFixed(1)}% (${splitWrong}/${split}); otherwise: ${(100*cleanWrong/clean).toFixed(1)}% (${cleanWrong}/${clean})`);
console.log('most common cross-axis pairs:', Object.entries(pairs).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`${k}: ${v}`).join('; '));
console.log('wrong examples:\n  '+ex.join('\n  '));
