import { loadJsonl, units, corr } from './metrics.mjs';
const v1 = loadJsonl('/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/raw-v1.jsonl'); const A = loadJsonl('raw-A.jsonl');
// Removed blocks in the fixture corpus (corrected labels), excluding the title (code already handles it)
const removed = [...corr.values()].filter(c => c.label_corr === 'removed' && !c.is_title);
const plain = removed.filter(c => !c.policy && !units.get(c.id).extractor);
const role = id => { const r = A.get(id); return r && !r.error ? (r.role_fwd.article_content + r.role_rev.article_content) / 2 : null; };
const oldp = id => { const r = v1.get(id); return r && !r.error ? r.p_keep : null; };
console.log('| question | veto threshold | correctly removed blocks re-inserted, all (n=' + removed.length + ') | same, excluding byline/date and extractor pages (n=' + plain.length + ') |\n|---|---|---|---|');
for (const [name, f] of [['old bundled yes/no', oldp], ['role coproduct', role]]) for (const t of [0.9, 0.8, 0.7]) {
  const a = removed.filter(c => f(c.id) >= t), b = plain.filter(c => f(c.id) >= t);
  console.log(`| ${name} | ${t} | ${a.length} | ${b.length} |`);
}
console.log('\nRe-inserted by role coproduct at 0.9, excluding byline/date and extractor pages:');
for (const c of plain.filter(c => role(c.id) >= 0.9)) console.log(`  P=${role(c.id).toFixed(2)} ${c.words_corr}w ${units.get(c.id).fixture} | ${units.get(c.id).text.slice(0,110)}`);
