import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
const require = createRequire('/home/alexi/git/defuddle/package.json');
const { Defuddle } = require('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const dir='/home/alexi/git/defuddle/experiments/jev/lab/exp-known-failures/pages/';
const checks=[['441','https://felixrieseberg.com/'],['257','https://www.biorxiv.org/'],['360','https://puck.news/'],['375','https://projectorjunkies.com/']];
const { readdirSync } = await import('node:fs');
const files=readdirSync(dir);
for(const [id,url] of checks){
  const f=files.find(x=>x.includes(id)); if(!f){console.log(id,'no page file');continue;}
  const html=readFileSync(dir+f,'utf8');
  const doc=parseLinkedomHTML(html,url);
  const r=await Defuddle(doc,url,{debug:true,fetch:async()=>{throw new Error('offline')}});
  const steps={}; for(const x of r.debug?.removals||[]) steps[x.step]=(steps[x.step]||0)+1;
  const bodyWords=(doc.body?.textContent||'').split(/\s+/).filter(Boolean).length;
  console.log(`#${id} file=${f} bodyWords≈${bodyWords} -> output wordCount=${r.wordCount} selector=${r.debug?.contentSelector} removals=${JSON.stringify(steps)}`);
}
