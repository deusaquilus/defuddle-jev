// Shared definitions for the block-classification experiment.
// NEVER log process.env.JEV_API_KEY. Run via: bash -ic 'node <script>.mjs'
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';

export const DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/exp-block-classification';
export const DATASET = '/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl';
export const MODEL = 'jev-1.14.0';
export const SEED = 42;
export const KEPT_SUBSAMPLE_N = 400;

export function loadUnits() {
	return readFileSync(DATASET, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

// mulberry32 seeded PRNG
export function rng(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
export function shuffled(arr, seed) {
	const r = rng(seed);
	const a = arr.slice();
	for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
	return a;
}

/** V2/V3 subsample: all removed units + 400 random kept units (seeded). Saved to subsample-ids.json. */
export function subsampleIds(units) {
	const file = `${DIR}/subsample-ids.json`;
	if (existsSync(file)) return new Set(JSON.parse(readFileSync(file, 'utf8')));
	const removed = units.filter(u => u.label === 'removed').map(u => u.id);
	const kept = shuffled(units.filter(u => u.label === 'kept').map(u => u.id), SEED).slice(0, KEPT_SUBSAMPLE_N);
	const ids = [...removed, ...kept];
	writeFileSync(file, JSON.stringify(ids, null, 0));
	return new Set(ids);
}

export const KEEP_INSTRUCTIONS =
	"Should this block be kept in a clean reader-mode view of the page's main article? " +
	"Keep = it is part of the article's own body text, headings, images/figures, code, tables, quotes or footnotes. " +
	"Do not keep = site navigation, ads, promotions, newsletter/subscribe or sign-in prompts, social sharing, " +
	"related/recommended/more-stories links, comment sections, cookie/consent banners, author bylines, dates, " +
	"tags/categories, breadcrumbs, read-time, or other page boilerplate.";

export const KIND_CRITERIA = {
	article_body: "Prose paragraphs, lists or quotes that are part of the article's own text",
	heading: "A heading or title line of the article or one of its sections",
	media_or_figure: "An image, figure, caption, video or audio embed that belongs to the article",
	code_or_table: "A code block, code listing, or data table that belongs to the article",
	footnotes_or_references: "Footnotes, citations, endnotes or a references list belonging to the article",
	navigation_or_menu: "Site navigation, menus, breadcrumbs, skip links, table of contents, pagination or previous/next links",
	promo_or_cta: "Advertisement, promotion, newsletter or subscribe prompt, sign-in prompt, app download or other call to action",
	related_links_or_cards: "Related, recommended, popular, trending or more-stories links and article cards",
	comments: "A comment section, comment thread or individual user comments and their headers",
	byline_or_metadata: "Author byline, author bio, publish date, read time, tags, categories, share counts or similar page metadata",
	cookie_or_consent: "Cookie, privacy or consent banner or notice",
	other: "None of the above, or not enough information to tell",
};

export function questions() {
	return {
		keep: {
			type: 'noul',
			instructions: KEEP_INSTRUCTIONS,
			criteria: {
				true: "Keep: the block is part of the article's own content",
				false: "Do not keep: the block is navigation, promotion, metadata, comments or other page boilerplate",
			},
		},
		kind: {
			type: 'choice',
			instructions: "What kind of block is this, in the context of a web page that contains an article? Judge only from what is literally in the block.",
			criteria: KIND_CRITERIA,
		},
	};
}

export function stateFor(variant, u) {
	if (variant === 'v1' || variant === 'v1r') return u.html;
	if (variant === 'v2') return u.text;
	if (variant === 'v3') return { page_title: u.page_title, page_url: u.url, block_html: u.html };
	throw new Error('unknown variant ' + variant);
}

export function outFile(variant) { return `${DIR}/raw-${variant}.jsonl`; }

export function loadDone(variant) {
	const f = outFile(variant);
	const done = new Map();
	if (!existsSync(f)) return done;
	for (const line of readFileSync(f, 'utf8').split('\n')) {
		if (!line.trim()) continue;
		const r = JSON.parse(line);
		if (!r.error) done.set(r.id, r);
	}
	return done;
}

export function appendResult(variant, rec) { appendFileSync(outFile(variant), JSON.stringify(rec) + '\n'); }

export function loadRaw(variant) {
	const f = outFile(variant);
	if (!existsSync(f)) return [];
	const byId = new Map();
	for (const line of readFileSync(f, 'utf8').split('\n')) {
		if (!line.trim()) continue;
		const r = JSON.parse(line);
		if (r.error && byId.has(r.id)) continue; // keep a successful record over an earlier error
		byId.set(r.id, r);
	}
	return [...byId.values()];
}
