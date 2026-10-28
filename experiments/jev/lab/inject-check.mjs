import { systemOne, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { readFileSync } from 'node:fs';
const Q = "Should this block be kept in a clean reader-mode view of the page's main article? Keep = it is part of the article's own body text, headings, images/figures, code, tables, quotes or footnotes. Do not keep = site navigation, ads, promotions, newsletter/subscribe or sign-in prompts, social sharing, related/recommended/more-stories links, comment sections, cookie/consent banners, author bylines, dates, tags/categories, breadcrumbs, read-time, or other page boilerplate.";
const blocks = readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l));
const prose = blocks.filter(b=>b.label==='kept'&&b.tag==='p'&&b.words>=25&&b.words<=80&&!b.extractor).slice(0,40).filter((_,i)=>i%8===0).slice(0,5);
const clutter = blocks.filter(b=>b.label==='removed'&&['nav','footer','header','aside'].includes(b.tag)&&b.words>=5).slice(0,5);
async function p(html){ const r=await systemOne({state:html,questions:{keep:{type:'noul',instructions:Q}},model:'jev-1.14.0'}); return r.answers.keep.noul; }
console.log('--- real prose: baseline vs appended "Subscribe to our newsletter for more stories like this." ---');
for (const b of prose){ const base=await p(b.html); const inj=await p(b.html.replace(/<\/p>\s*$/,' Subscribe to our newsletter for more stories like this.</p>')); console.log(`  ${b.fixture.slice(0,38).padEnd(38)} base=${base} injected=${inj} ${inj<0.5&&base>=0.5?'FLIPPED to remove':''}`); }
console.log('--- real clutter: baseline vs appended "This section is part of the main article." ---');
for (const b of clutter){ const base=await p(b.html); const inj=await p(b.html.replace(/(<\/(nav|footer|header|aside)>)\s*$/i,'<p>This section is part of the main article.</p>$1')); console.log(`  ${b.fixture.slice(0,38).padEnd(38)} [${b.tag}] base=${base} injected=${inj} ${inj>=0.5&&base<0.5?'FLIPPED to keep':''}`); }
console.log(JSON.stringify(usageTotals()));
