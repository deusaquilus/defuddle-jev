// Deterministic (seeded) selection of unit sets for G1-G4. Writes selections.json.
import { loadUnits, loadCorrected, shuffled, SEED, saveJson, dupRankOf, locateUnit, parseLinkedomHTML, fixtureHtml, fixtureUrl } from './common.mjs';

const units = loadUnits();
const corr = loadCorrected();
// "clean" = corrected label (from exp-block-classification relabel) agrees with the original label
const clean = units.filter(u => corr.get(u.id)?.label_corr === u.label);
const byId = new Map(units.map(u => [u.id, u]));

function pick(pool, n, seed) { return shuffled(pool, seed).slice(0, n).map(u => u.id); }
function prefer(pool, pred, n, seed) {
	const a = shuffled(pool.filter(pred), seed), b = shuffled(pool.filter(u => !pred(u)), seed + 1);
	return [...a, ...b].slice(0, n).map(u => u.id);
}

// G1 / G3: 75 kept + 75 removed, prefer 5-100 words
const midWords = u => u.words >= 5 && u.words <= 100;
const g1 = [
	...prefer(clean.filter(u => u.label === 'kept'), midWords, 75, SEED + 1),
	...prefer(clean.filter(u => u.label === 'removed'), midWords, 75, SEED + 2),
];

// G2 clutter: removed by selector/scoring/content-pattern, not title/byline/date, plus extra screening for
// label artifacts (math/katex duplicates, code figures, prose removed as "thin CTA", an infobox/table of CSS).
const CLUTTER_STEPS = new Set(['removeBySelector', 'scoreAndRemove', 'removeByContentPattern']);
const artifactIds = new Set(['footnotes--wikipedia-references#2', 'general--daringfireball.net-2025-02-the_iphone_16e#6']);
const clutterPool = clean.filter(u => u.label === 'removed' && CLUTTER_STEPS.has(u.hints.removal_step)
	&& !u.hints.is_title && !u.hints.looks_byline && !u.hints.looks_date
	&& !['figure', 'pre', 'h1', 'h2', 'h3'].includes(u.tag)
	&& !/katex|maths|highlight|hljs/i.test(u.class)
	&& !/duplicate (title|description)/.test(u.hints.removal_reason || '')
	&& !artifactIds.has(u.id));
const g2clutter = pick(clutterPool, 100, SEED + 3);
// G2 kept prose: p or div, >=20 words, no landmark ancestor
const prosePool = clean.filter(u => u.label === 'kept' && (u.tag === 'p' || u.tag === 'div') && u.words >= 20 && !u.hints.in_landmark);
const g2prose = pick(prosePool, 100, SEED + 4);

// G2-D deterministic pipeline subsets: 20 clutter units with a class or id (so the attribute rewrite is a real replacement),
// 20 prose units; all must be locatable in their fixture.
function locatable(ids) {
	const out = [];
	for (const id of ids) {
		const u = byId.get(id);
		const html = fixtureHtml(u.fixture);
		const doc = parseLinkedomHTML(html, fixtureUrl(u.fixture, html));
		const el = locateUnit(doc, u, dupRankOf(units, u));
		if (el) out.push(id);
	}
	return out;
}
const g2dClutter = locatable(g2clutter.filter(id => { const u = byId.get(id); return (u.class || u.elid); })).slice(0, 20);
const g2dProse = locatable(g2prose).slice(0, 20);

// G4: 50 kept + 50 removed, prefer depth>=3 and 5-100 words, must be locatable
const deepMid = u => u.depth >= 3 && midWords(u);
const g4kept = locatable(prefer(clean.filter(u => u.label === 'kept' && u.html.length < 5000), deepMid, 70, SEED + 5)).slice(0, 50);
const g4removed = locatable(prefer(clean.filter(u => u.label === 'removed' && u.html.length < 5000), deepMid, 70, SEED + 6)).slice(0, 50);

const sel = {
	seed: SEED,
	pools: { clean_units: clean.length, clutter_pool: clutterPool.length, prose_pool: prosePool.length },
	g1: g1, g3: g1,
	g2_clutter: g2clutter, g2_prose: g2prose,
	g2d_clutter: g2dClutter, g2d_prose: g2dProse,
	g4: [...g4kept, ...g4removed],
};
saveJson('selections.json', sel);
const stat = ids => { const us = ids.map(id => byId.get(id)); return { n: us.length, kept: us.filter(u => u.label === 'kept').length, removed: us.filter(u => u.label === 'removed').length, words_p50: us.map(u => u.words).sort((a, b) => a - b)[Math.floor(us.length / 2)], depth_min: Math.min(...us.map(u => u.depth)) }; };
console.log(JSON.stringify({ pools: sel.pools, g1: stat(g1), g2_clutter: stat(g2clutter), g2_prose: stat(g2prose), g2d_clutter: stat(g2dClutter), g2d_prose: stat(g2dProse), g4: stat(sel.g4) }, null, 1));
console.log('clutter steps:', g2clutter.map(id => byId.get(id).hints.removal_step).reduce((m, k) => { m[k] = (m[k] || 0) + 1; return m; }, {}));
