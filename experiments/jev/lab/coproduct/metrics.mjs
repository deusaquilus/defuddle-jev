// Shared scoring against corrected fixture labels. No API calls.
import { readFileSync, existsSync } from 'node:fs';
export const BLOCKS = '/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl';
export const CORR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/labels-corrected.jsonl';
export const units = new Map(readFileSync(BLOCKS,'utf8').trim().split('\n').map(l=>JSON.parse(l)).map(u=>[u.id,u]));
export const corr = new Map(readFileSync(CORR,'utf8').trim().split('\n').map(l=>JSON.parse(l)).map(r=>[r.id,r]));
export function loadJsonl(f){ const m=new Map(); if(!existsSync(f)) return m; for(const l of readFileSync(f,'utf8').split('\n')){ if(!l.trim()) continue; const r=JSON.parse(l); if(r.error && m.has(r.id)) continue; m.set(r.id,r);} return m; }
// rows: [{id, fx, y (1=removed), policy, title, extractor, words, s (score = P(keep))}]
export function rowsFrom(map, scoreFn){
  const out=[]; for(const [id,r] of map){ if(r.error) continue; const c=corr.get(id), u=units.get(id); if(!c||c.label_corr==='mixed') continue; const s=scoreFn(r,u,c); if(typeof s!=='number'||Number.isNaN(s)) continue;
    out.push({id, fx:u.fixture, y:c.label_corr==='removed'?1:0, policy:c.policy, title:c.is_title, extractor:!!u.extractor, words:c.words_corr ?? u.words, s}); }
  return out; }
const r3=v=>+v.toFixed(3);
export function auroc(rs){ const s=rs.map(r=>({s:1-r.s,y:r.y})).sort((a,b)=>a.s-b.s); const rk=new Array(s.length); let i=0; while(i<s.length){let j=i; while(j+1<s.length&&s[j+1].s===s[i].s) j++; const a=(i+j+2)/2; for(let k=i;k<=j;k++) rk[k]=a; i=j+1;} let n1=0,n0=0,R=0; s.forEach((x,k)=>{ if(x.y){n1++;R+=rk[k];} else n0++; }); return (n1&&n0)? r3((R-n1*(n1+1)/2)/(n1*n0)) : null; }
const wrongAt=(r,t)=>((r.s<t)?1:0)!==r.y;
export function acc(rs,t=0.5){ return r3(1-rs.filter(r=>wrongAt(r,t)).length/rs.length); }
function bestT(rs){ const c=[...new Set(rs.map(r=>r.s))].sort((a,b)=>a-b); let best={t:0.5,a:-1}; for(let i=0;i<=c.length;i++){ const t=i===0?c[0]-1e-6:i===c.length?c[i-1]+1e-6:(c[i-1]+c[i])/2; const a=acc(rs,t); if(a>best.a) best={t,a}; } return best.t; }
// two-fold cross-fit by fixture: threshold tuned on half the pages, tested on the other half
export function crossFitAcc(rs, seed=7){ const fx=[...new Set(rs.map(r=>r.fx))].sort(); let a=seed>>>0; const rnd=()=>{a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296;}; for(let i=fx.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1)); [fx[i],fx[j]]=[fx[j],fx[i]];} const h=new Set(fx.slice(0,fx.length>>1)); const A=rs.filter(r=>h.has(r.fx)), B=rs.filter(r=>!h.has(r.fx)); const tA=bestT(A), tB=bestT(B); const wrong=B.filter(r=>wrongAt(r,tA)).length + A.filter(r=>wrongAt(r,tB)).length; return { acc:r3(1-wrong/rs.length), tA:r3(tA), tB:r3(tB) }; }
export function pagesZero(rs,t=0.5){ const by=new Map(); for(const r of rs){ if(!by.has(r.fx)) by.set(r.fx,0); if(wrongAt(r,t)) by.set(r.fx, by.get(r.fx)+1); } const n=by.size, z=[...by.values()].filter(v=>v===0).length; return { pages:n, zero:z, frac:r3(z/n) }; }
export const SUBSETS = { 'all': r=>true, 'no title/byline/date': r=>!r.policy, 'also no extractor pages': r=>!r.policy&&!r.extractor, 'also 16+ words': r=>!r.policy&&!r.extractor&&r.words>=16 };
// code-side title rule: Defuddle already knows the title, so a block equal to it is removed by code, not by Jev
export const withTitleRule = rs => rs.map(r => r.title ? { ...r, s: 0 } : r);
export function report(name, rs){ const lines=[]; for(const [k,f] of Object.entries(SUBSETS)){ const ss=rs.filter(f); const cf=crossFitAcc(ss); const p=pagesZero(ss); lines.push(`| ${name} | ${k} | ${ss.length} | ${(100*acc(ss)).toFixed(1)}% | ${(100*cf.acc).toFixed(1)}% | ${auroc(ss)} | ${p.zero}/${p.pages} (${(100*p.frac).toFixed(1)}%) |`); } return lines.join('\n'); }
export const HEADER = '| scorer | subset | blocks | acc@0.5 | acc tuned (cross-fit by page) | AUROC | pages fully agreeing @0.5 |\n|---|---|---|---|---|---|---|';
