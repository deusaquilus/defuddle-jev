import { loadJsonl, units, corr } from './metrics.mjs';
const v1 = loadJsonl('/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification/raw-v1.jsonl'); const A = loadJsonl('raw-A.jsonl');
const step = [...corr.values()].filter(c => c.label_corr === 'removed' && !c.is_title && units.get(c.id).hints.removal_step);
const role = id => { const r = A.get(id); return r && !r.error ? (r.role_fwd.article_content + r.role_rev.article_content) / 2 : null; };
const oldp = id => { const r = v1.get(id); return r && !r.error ? r.p_keep : null; };
console.log(`Blocks deleted by a Defuddle removal step (title excluded): ${step.length}`);
console.log('| question | veto threshold | step-removed blocks the veto would restore |\n|---|---|---|');
for (const [n, f] of [['old bundled yes/no', oldp], ['role coproduct', role]]) for (const t of [0.9, 0.8, 0.7]) console.log(`| ${n} | ${t} | ${step.filter(c => f(c.id) >= t).length} |`);
for (const [n, f] of [['old bundled yes/no @0.7', c=>oldp(c.id)>=0.7], ['role coproduct @0.9', c=>role(c.id)>=0.9]]) {
  console.log(`\nRestored by ${n}:`);
  for (const c of step.filter(f)) { const u = units.get(c.id); console.log(`  ${u.hints.removal_step}/${(u.hints.removal_reason||'').slice(0,30)} ${c.words_corr}w policy=${c.policy} ${u.fixture.slice(0,40)} | ${u.text.slice(0,90)}`); }
}
