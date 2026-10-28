// Categorize every V1 disagreement by checking the unit text against tests/expected/<fixture>.md (human-reviewed).
// No API calls. Writes v1-disagreement-categories.json.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { DIR } from './common.mjs';
const REPO = '/home/alexi/git/defuddle';
const errs = JSON.parse(readFileSync(`${DIR}/v1-all-disagreements.json`, 'utf8'));
const units = new Map(readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(u => [u.id, u]));
const norm = s => s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const expCache = new Map();
function expected(fixture) {
	if (expCache.has(fixture)) return expCache.get(fixture);
	const f = `${REPO}/tests/expected/${fixture}.md`;
	const raw = existsSync(f) ? readFileSync(f, 'utf8') : '';
	const body = raw.replace(/^\s*```json[\s\S]*?```\s*/m, ''); // drop JSON preamble if fenced
	const n = norm(body);
	const v = { n, words: new Set(n.split(' ')), raw };
	expCache.set(fixture, v);
	return v;
}
const cats = {};
const out = [];
for (const e of errs) {
	const u = units.get(e.id);
	const ex = expected(e.fixture);
	const uw = norm(u.text).split(' ').filter(w => w.length >= 3);
	const bag = uw.length ? uw.filter(w => ex.words.has(w)).length / uw.length : 0;
	const n = norm(u.text).split(' ');
	let ngram = false; const k = Math.min(4, n.length);
	for (let i = 0; i + k <= n.length && !ngram; i++) if (ex.n.includes(n.slice(i, i + k).join(' '))) ngram = true;
	let cat;
	const isTitle = u.hints.is_title || (u.tag === 'h1' && u.label === 'removed');
	if (u.label === 'removed' && isTitle) cat = 'policy: page title (moved to frontmatter)';
	else if (u.label === 'removed' && (u.hints.looks_byline || u.hints.looks_date)) cat = 'policy: byline/date (moved to frontmatter)';
	else if (u.label === 'removed' && (ngram || bag >= 0.6)) cat = 'label artifact: text survives in transformed form (footnote/math/code/heading)';
	else if (u.label === 'kept' && (e.kind === 'comments') && /comments--|ycombinator|reddit|mastodon/.test(e.fixture)) cat = 'page-type: comments page where comments ARE the content';
	else if (u.label === 'kept' && /index|listing|blog-index/.test(e.fixture)) cat = 'page-type: index/listing page kept whole by retry cascade';
	else if (u.label === 'kept' && u.extractor) cat = 'extractor page (gmail/x/github/chatgpt): kept by site extractor';
	else if (u.label === 'removed' && u.hints.removal_step === 'removeHiddenElements') cat = 'hidden element (CSS/Tailwind hidden; invisible to Jev)';
	else cat = 'genuine disagreement (needs judgment)';
	cats[cat] = (cats[cat] || 0) + 1;
	out.push({ ...e, bag_in_expected: +bag.toFixed(2), ngram_in_expected: ngram, category: cat });
}
console.log(JSON.stringify(cats, null, 1));
console.log('total disagreements', errs.length, 'removed-but-jev-keeps', errs.filter(e => e.label === 'removed').length, 'kept-but-jev-removes', errs.filter(e => e.label === 'kept').length);
const byLabel = {}; for (const o of out) { const k = o.label + ' :: ' + o.category; byLabel[k] = (byLabel[k] || 0) + 1; }
console.log(JSON.stringify(byLabel, null, 1));
console.log('\n--- genuine disagreements (all):');
for (const o of out.filter(o => o.category.startsWith('genuine'))) console.log(`[${o.label}] p=${o.p_keep} kind=${o.kind} | ${o.fixture} | ${o.tag} ${o.path.slice(0, 70)} | w=${o.words} | ${o.removal_reason || '-'} | bag=${o.bag_in_expected} | "${o.snippet.slice(0, 120)}"`);
console.log('\n--- top 40 with category:');
for (const [i, o] of out.slice(0, 40).entries()) console.log(`${i + 1}. [${o.label}] p=${o.p_keep} | ${o.fixture} | ${o.category} | bag=${o.bag_in_expected} ngram=${o.ngram_in_expected}`);
writeFileSync(`${DIR}/v1-disagreement-categories.json`, JSON.stringify(out, null, 1));
