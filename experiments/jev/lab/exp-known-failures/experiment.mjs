// Experiment: would Jev (TypeSafe System One, jev-1.14.0) have kept the blocks defuddle wrongly removes
// on its open GitHub issues? Run:  bash -ic 'node experiment.mjs [--dry]'
// Never prints the API key. Writes results.jsonl + blocks-resolved.json in this directory.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
const require = createRequire(import.meta.url);
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');

const DIR = path.dirname(new URL(import.meta.url).pathname);
const DRY = process.argv.includes('--dry');
const MODEL = 'jev-1.14.0';
const CAP = 6000;

const NOUL_INSTRUCTIONS = "Should this block be kept in a clean reader-mode view of the page's main article? Keep = it is part of the article's own body text, headings, images/figures, code, tables, quotes or footnotes. Do not keep = site navigation, ads, promotions, newsletter/subscribe or sign-in prompts, social sharing, related/recommended/more-stories links, comment sections, cookie/consent banners, author bylines, dates, tags/categories, breadcrumbs, read-time, or other page boilerplate.";
const CHOICE_INSTRUCTIONS = 'Which candidate is the main article container (the smallest element containing the whole article body and as little non-article material as possible)?';

// kind: W = wrongly removed (issue says it is content); C = correctly removed clutter (control);
//       A = ambiguous (author bio / title header); K = clutter that defuddle KEPT (not a removal).
const PAGES = [
	{ issue: 460, file: '460-synth.html', url: 'https://example.org/p', note: 'synthetic from issue; scoreAndRemove -10 on div.page (heading "Comments")',
		blocks: [
			{ id: '460-body', kind: 'W', sel: 'main > div.page', step: 'scoreAndRemove score:-10' },
			{ id: '460-comments-section', kind: 'C', sel: 'div.page > section', step: '(inside removed div.page)' },
			{ id: '460-hidden-toc', kind: 'K', sel: 'aside.hidden', step: 'not removed; became the output via hidden-content retry' },
		],
		containers: { correct: ['main > div.page', 'main'], cands: ['main', 'main > div.page', 'aside.hidden', 'div.page > section', 'body'] } },
	{ issue: 445, file: '445-synth.html', url: 'https://example.org/comment', note: 'synthetic from issue; "Comment" paragraph truncates the rest',
		blocks: [
			{ id: '445s-comment-label', kind: 'W', sel: 'p', exact: 'Comment', step: 'removeByContentPattern boilerplate text' },
			{ id: '445s-p1', kind: 'W', sel: 'p', contains: 'little difficulty', step: 'removeByContentPattern trailing non-content' },
			{ id: '445s-p2', kind: 'W', sel: 'p', contains: 'There are benefits', step: 'removeByContentPattern trailing non-content' },
		],
		containers: { correct: ['article'], cands: ['article', 'main', 'body'] } },
	{ issue: 445, file: '445.html', url: 'https://ukhumanrightsblog.com/2024/01/25/financial-sanction-and-free-speech-in-the-high-court/', note: 'live page; same bug',
		blocks: [
			{ id: '445-comment-label', kind: 'W', sel: 'p.wp-block-paragraph', exact: 'Comment', step: 'removeByContentPattern boilerplate text' },
			{ id: '445-p1', kind: 'W', sel: 'p.wp-block-paragraph', contains: 'The Court appeared to have little difficulty', step: 'removeByContentPattern trailing non-content' },
			{ id: '445-p2', kind: 'W', sel: 'p.wp-block-paragraph', contains: 'Returning to the conflict in issue', step: 'removeByContentPattern trailing non-content' },
			{ id: '445-author-line', kind: 'A', sel: 'p.wp-block-paragraph', contains: 'Marina Wheeler KC is a barrister', step: 'removeByContentPattern trailing non-content' },
			{ id: '445-comments', kind: 'C', sel: '#comments' },
			{ id: '445-share', kind: 'C', sel: 'div.sharedaddy' },
			{ id: '445-categories-widget', kind: 'C', sel: '#categories-2' },
			{ id: '445-footer', kind: 'C', sel: 'footer.footer' },
			{ id: '445-recent-comments', kind: 'C', sel: '#recent-comments-2' },
			{ id: '445-header', kind: 'C', sel: 'header#header' },
			{ id: '445-email-updates', kind: 'C', sel: '#custom_html-2' },
			{ id: '445-cookie', kind: 'C', sel: 'p.cookie-box-text' },
		],
		containers: { correct: ['article.article'], cands: ['article.article', 'div.content', 'div.contant-container', 'div.page', '#comments', '#secondary', 'body'] } },
	{ issue: 444, file: '444-synth.html', url: 'https://example.org/related', note: 'synthetic from issue; partial selector "related" hits inline defined term',
		blocks: [ { id: '444s-term', kind: 'W', sel: 'span#term-related-claim', step: 'removeBySelector partial (?<!h[1-6]-)related' } ] },
	{ issue: 444, file: '444.html', url: 'https://www.legislation.gov.uk/ukpga/2015/2/section/57', note: 'live page; same bug (output shows empty quotes)',
		blocks: [
			{ id: '444-term', kind: 'W', sel: 'span#term-related-claim', step: 'removeBySelector partial (?<!h[1-6]-)related' },
			{ id: '444-term-parent-p', kind: 'A', sel: 'p', contains: 'means a claim for damages in respect of personal injury', step: '(parent paragraph, kept; context only)' },
			{ id: '444-timeline-help', kind: 'C', sel: 'p#Revised_toc_1' },
			{ id: '444-breadcrumb', kind: 'C', sel: '#breadCrumb' },
			{ id: '444-header', kind: 'C', sel: '#header' },
			{ id: '444-footer', kind: 'C', sel: '#footer' },
			{ id: '444-subnav', kind: 'C', sel: '#legSubNav' },
			{ id: '444-help', kind: 'C', sel: '#layout2 .help' },
		] },
	{ issue: 441, file: '441.html', url: 'https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/', note: 'live page; [data-date] exact selector removes content wrapper; output empty',
		blocks: [
			{ id: '441-body', kind: 'W', sel: 'div.content.gh-content', step: 'removeBySelector exact [data-date]' },
			{ id: '441-footer-bio', kind: 'C', sel: 'footer.pend' },
			{ id: '441-site-header', kind: 'C', sel: 'header.site' },
			{ id: '441-player', kind: 'C', sel: 'aside.toc' },
			{ id: '441-more-posts', kind: 'C', sel: '*', containsAll: ['MORE POSTS', 'Newer'], deepest: true, maxWords: 80 },
			{ id: '441-post-header', kind: 'A', sel: 'header.phead' },
		],
		containers: { correct: ['article.post', 'div.content.gh-content'], cands: ['article.post', 'div.content.gh-content', 'main#app', 'footer.pend', 'body'] } },
	{ issue: 428, file: '428.html', url: 'https://example.org/algo', note: 'fixture from issue author; scoring removes short blocks containing "register"',
		blocks: [
			{ id: '428-algo-1', kind: 'W', sel: 'ol ol li div', idx: 0, step: 'scoreAndRemove score:-10' },
			{ id: '428-algo-2', kind: 'W', sel: 'ol ol li div', idx: 1, step: 'scoreAndRemove score:-10' },
			{ id: '428-heading', kind: 'W', sel: 'div', contains: 'Quantum register operations', step: 'scoreAndRemove score:-10' },
			{ id: '428-init', kind: 'W', sel: 'div', contains: 'Initialize the register before decoding', step: 'scoreAndRemove score:-10' },
			{ id: '428-cash', kind: 'W', sel: 'div', contains: 'Use the cash register carefully', step: 'scoreAndRemove score:-10' },
			{ id: '428-output', kind: 'W', sel: 'div', contains: 'The register now contains output', step: 'scoreAndRemove score:-10' },
			{ id: '428-signup-1', kind: 'C', sel: 'div', contains: 'Register now for free access' },
			{ id: '428-signup-2', kind: 'C', sel: 'div', contains: 'Please register to continue' },
			{ id: '428-signup-3', kind: 'C', sel: 'div', contains: 'Register an account to proceed' },
			{ id: '428-signup-4', kind: 'C', sel: 'div', contains: 'Sign up for updates' },
			{ id: '428-nav-register', kind: 'C', sel: 'nav' },
		] },
	{ issue: 428, file: '428b.html', url: 'https://example.org/reg', note: 'regression fixture: real signup heading must still go',
		blocks: [ { id: '428b-register-updates', kind: 'C', sel: 'div', contains: 'Register for updates' } ] },
	{ issue: 346, file: '346-synth.html', url: 'https://example.org/steps', note: 'synthetic from issue; role=list + data-component-part dropped (no removal record; standardization)',
		blocks: [ { id: '346-steps', kind: 'W', sel: 'div[role="list"]', step: 'no removal record (lost in standardizeContent)' } ] },
	{ issue: 433, file: '433-synth.html', url: 'https://example.org/paper', note: 'synthetic from issue; LaTeXML footnote body dropped (no removal record; footnote standardization)',
		blocks: [ { id: '433-footnote', kind: 'W', sel: 'span.ltx_note_outer', step: 'no removal record (footnote standardization)' } ] },
	{ issue: 372, file: '372-synth.html', url: 'https://pages.example.com/acmelabs/posts/12345', note: 'synthetic from issue; "section breadcrumb" rule removes in-prose links',
		blocks: [
			{ id: '372-span-offsite', kind: 'W', sel: 'span', contains: 'our profile', step: 'removeByContentPattern section breadcrumb' },
			{ id: '372-span-samesite', kind: 'W', sel: 'span', contains: 'our other posts', step: 'removeByContentPattern section breadcrumb' },
		] },
	{ issue: 321, file: '321.html', url: 'https://mpcjazz.github.io/', note: 'live page (is the minimal repro); exact selector #tags',
		blocks: [ { id: '321-tags-section', kind: 'W', sel: 'section#tags', step: 'removeBySelector exact #tags' } ] },
	{ issue: 408, file: '408-synth.html', url: 'https://example.org/news', note: 'synthetic from issue; nested list after colon paragraph removed as "blog metadata list"',
		blocks: [ { id: '408s-nested-list', kind: 'W', sel: 'ul ul', idx: 0, step: 'removeByContentPattern blog metadata list' } ] },
	{ issue: 408, file: '408.html', url: 'https://hypr.land/news/update56/', note: 'live page; same bug',
		blocks: [
			{ id: '408-nested-list', kind: 'W', sel: 'ul ul', contains: 'fit_into_view', step: 'removeByContentPattern blog metadata list' },
			{ id: '408-footer', kind: 'C', sel: 'footer' },
			{ id: '408-header', kind: 'C', sel: 'header' },
			{ id: '408-more-news', kind: 'C', sel: 'section', contains: 'Ricing Competition' },
		],
		containers: { correct: ['article', 'div.prose'], cands: ['article', 'div.prose', 'main', 'section', 'body'] } },
	{ issue: 252, file: '252-synth.html', url: 'https://example.org/talk', note: 'synthetic from issue; exact selector [href*="/author/"] removes content links',
		blocks: [
			{ id: '252s-link-1', kind: 'W', sel: 'a[href*="/author/"]', idx: 0, step: 'removeBySelector exact [href*="/author/"]' },
			{ id: '252s-link-2', kind: 'W', sel: 'a[href*="/author/"]', idx: 1, step: 'removeBySelector exact [href*="/author/"]' },
		] },
	{ issue: 252, file: '252.html', url: 'https://www.infoq.com/presentations/Simple-Made-Easy/', note: 'live page; same bug',
		blocks: [
			{ id: '252-link-1', kind: 'W', sel: 'a[href*="/author/"]', contains: 'Grady Booch', step: 'removeBySelector exact [href*="/author/"]' },
			{ id: '252-link-2', kind: 'W', sel: 'a[href*="/author/"]', contains: 'Erik Meijer', step: 'removeBySelector exact [href*="/author/"]' },
			{ id: '252-footer', kind: 'C', sel: 'footer.footer' },
			{ id: '252-topnav', kind: 'C', sel: 'nav.nav.header__nav.topics' },
			{ id: '252-related', kind: 'C', sel: 'ul.related__group' },
			{ id: '252-from-topic', kind: 'C', sel: 'div.article__fromTopic' },
			{ id: '252-subscribe', kind: 'C', sel: 'section.subscribe-box' },
			{ id: '252-login-modal', kind: 'C', sel: 'div.modal_auth_required' },
			{ id: '252-related-vendor', kind: 'C', sel: 'div.relatedVendor' },
			{ id: '252-promo', kind: 'C', sel: 'section.promo' },
		],
		containers: { correct: ['article.article'], cands: ['article.article', 'main', 'section.container.section.white', 'div.transcript', 'body'] } },
	{ issue: 279, file: '279.html', url: 'https://www.crosslabs.org/blog/artificial-life', note: 'live page; partial selector hero[_-a-z] strips hero image + caption',
		blocks: [
			{ id: '279-hero', kind: 'W', sel: 'div.blog-hero-image-wrap', step: 'removeBySelector partial hero[_\\-a-z]' },
			{ id: '279-authorbio', kind: 'C', sel: 'div.authorbio' },
			{ id: '279-site-notice', kind: 'C', sel: 'aside.nooma-transition-notice' },
			{ id: '279-footer', kind: 'C', sel: 'div.footer-2023' },
			{ id: '279-byline', kind: 'C', sel: 'div.authorwrap' },
			{ id: '279-navbar', kind: 'C', sel: 'div.navbar-light' },
		],
		containers: { correct: ['div.blog-post-wrap'], cands: ['div.blog-post-wrap', 'div.rich-text-element.w-richtext', 'div.my-contain', 'div.authorbio', 'body'] } },
	{ issue: 360, file: '360a.html', url: 'https://puck.news/is-disney-relying-too-much-on-ryan-murphy/', note: 'HTML attached to issue; exact [class$="-ad"] removes div.with-ad wrappers holding the article body',
		blocks: [
			{ id: '360-withad-1', kind: 'W', sel: 'div.with-ad', idx: 0, step: 'removeBySelector exact [class$="-ad" i]' },
			{ id: '360-withad-2', kind: 'W', sel: 'div.with-ad', idx: 1, step: 'removeBySelector exact [class$="-ad" i]' },
			{ id: '360-withad-3', kind: 'W', sel: 'div.with-ad', idx: 2, step: 'removeBySelector exact [class$="-ad" i]' },
			{ id: '360-bq-1', kind: 'W', sel: 'div.with-ad blockquote', idx: 0, step: '(inner article text of withad-1)' },
			{ id: '360-main-nav', kind: 'C', sel: 'header.main-nav' },
			{ id: '360-related', kind: 'C', sel: 'div.related-posts' },
			{ id: '360-paywall', kind: 'C', sel: 'div#paywall-modal' },
			{ id: '360-subscribe', kind: 'C', sel: 'div#subscribe-modal' },
			{ id: '360-share', kind: 'C', sel: 'div.share-article' },
			{ id: '360-footer', kind: 'C', sel: 'footer.content-info' },
			{ id: '360-login', kind: 'C', sel: 'div#login-modal' },
			{ id: '360-upsell', kind: 'C', sel: 'div#onboarding-upsell-modal' },
		],
		containers: { correct: ['article.post', 'div.entry-content'], cands: ['article.post', 'div.entry-content', 'main.main', 'header.main-nav', 'body'] } },
	{ issue: 365, file: '365.html', url: 'https://freedium-mirror.cfd/https://blog.ydb.tech/making-coroutines-routine-building-a-scalable-tpc-c-client-in-c-b14f55a09471', note: 'live page; Tailwind dark:hidden light-theme code copies removed as hidden (dark copies removed by .hidden) -> all code blocks lost',
		blocks: [
			{ id: '365-code-1', kind: 'W', sel: '[class~="dark:hidden"]', idx: 0, step: 'removeHiddenElements class:dark:hidden' },
			{ id: '365-code-2', kind: 'W', sel: '[class~="dark:hidden"]', idx: 1, step: 'removeHiddenElements class:dark:hidden' },
			{ id: '365-code-3', kind: 'W', sel: '[class~="dark:hidden"]', idx: 2, step: 'removeHiddenElements class:dark:hidden' },
			{ id: '365-toc', kind: 'C', sel: 'ul#toc-list' },
			{ id: '365-footer', kind: 'C', sel: 'footer' },
			{ id: '365-nav', kind: 'C', sel: 'nav#header' },
			{ id: '365-title-header', kind: 'A', sel: 'article > header' },
		],
		containers: { correct: ['div.prose', 'article'], cands: ['article', 'div.prose', 'main', 'ul#toc-list', 'body'] } },
	{ issue: 375, file: '375.html', url: 'https://www.projectorjunkies.com/xgimi-titan-noir-max-in-depth-review/', note: 'live page; Tailwind empty:hidden wrappers (pasted chat-style markup) removed as hidden -> 3.4k words lost',
		blocks: [
			{ id: '375-specs', kind: 'W', sel: '[class~="empty:hidden"]', idx: 0, step: 'removeHiddenElements class:empty:hidden' },
			{ id: '375-section-2', kind: 'W', sel: '[class~="empty:hidden"]', idx: 1, step: 'removeHiddenElements class:empty:hidden' },
			{ id: '375-comment', kind: 'C', sel: 'li#comment-1362' },
			{ id: '375-respond', kind: 'C', sel: 'div#respond' },
			{ id: '375-footer', kind: 'C', sel: 'footer.pj-site-footer' },
			{ id: '375-header', kind: 'C', sel: 'header#header' },
			{ id: '375-mobile-menu', kind: 'C', sel: 'nav.mobile-menu' },
			{ id: '375-entry-header', kind: 'A', sel: 'header.entry-header' },
		],
		containers: { correct: ['article#post-11847', 'div.entry-content'], cands: ['article#post-11847', 'div.entry-content', 'main#main', 'ol.comment-list', 'body'] } },
	{ issue: 257, file: '257.html', url: 'https://www.biorxiv.org/content/10.64898/2026.04.02.716166v1.full', note: 'live page; partial selector "tabs-" removes the full-text tabs container (13k words)',
		blocks: [
			{ id: '257-tabs-container', kind: 'W', sel: 'div.pane-highwire-panel-tabs-container', step: 'removeBySelector partial tabs-' },
			{ id: '257-sidebar', kind: 'C', sel: 'div.sidebar-right-wrapper' },
			{ id: '257-site-header', kind: 'C', sel: 'header#section-header' },
			{ id: '257-author-tooltip-0', kind: 'C', sel: 'div.author-tooltip-0' },
			{ id: '257-author-tooltip-13', kind: 'C', sel: 'div.author-tooltip-13' },
			{ id: '257-citation-top', kind: 'A', sel: 'div.highwire-citation-biorxiv-article-top' },
		],
		containers: { correct: ['div.article.fulltext-view'], cands: ['div.article.fulltext-view', 'div.pane-highwire-panel-tabs-container', 'div.sidebar-right-wrapper', 'div#region-content', 'body'] } },
	{ issue: 134, file: '134.html', url: 'https://engine.needle.tools/docs', note: 'live docs landing page; scoring removes link-card grid that IS the page content (ambiguous ground truth)',
		blocks: [
			{ id: '134-path-cards', kind: 'W', sel: 'div.path-cards', step: 'scoreAndRemove score:-10 (card grid)' },
			{ id: '134-whats-new-card', kind: 'W', sel: 'a.whats-new-card', step: 'removeBySelector partial card-content' },
			{ id: '134-mobile-sidebar', kind: 'C', sel: 'aside.mobile-sidebar' },
			{ id: '134-footer', kind: 'C', sel: 'div.footer' },
			{ id: '134-page-nav', kind: 'C', sel: 'nav.vp-page-nav' },
			{ id: '134-testimonial-footer', kind: 'C', sel: 'div.testimonial-footer', idx: 0 },
		],
		containers: { correct: ['div#content'], cands: ['div#content', 'main.vp-page', 'aside.mobile-sidebar', 'body'] } },
	{ issue: 395, file: '395.html', url: 'https://learningstatisticswithr.com/05-descriptives.html', note: 'live Quarto page; exact .header:not(.banner) removes <tr class="header"> table header rows',
		blocks: [
			{ id: '395-thead-row-1', kind: 'W', sel: 'tr.header', idx: 0, step: 'removeBySelector exact .header:not(.banner)' },
			{ id: '395-thead-row-2', kind: 'W', sel: 'tr.header', idx: 1, step: 'removeBySelector exact .header:not(.banner)' },
			{ id: '395-table-1', kind: 'A', sel: 'table.caption-top', idx: 0, step: '(whole table, context)' },
			{ id: '395-sidebar', kind: 'C', sel: 'nav#quarto-sidebar' },
			{ id: '395-margin-toc', kind: 'C', sel: 'div#quarto-margin-sidebar' },
			{ id: '395-header', kind: 'C', sel: 'header#quarto-header' },
			{ id: '395-page-nav', kind: 'C', sel: 'nav.page-navigation' },
		],
		containers: { correct: ['main#quarto-document-content'], cands: ['main#quarto-document-content', 'div#quarto-content', 'nav#quarto-sidebar', 'body'] } },
	{ issue: 380, file: '380-synth.html', url: 'https://www.reddit.com/', note: 'synthetic from issue; reddit extractor returns only first post of a listing (container test only)',
		blocks: [],
		containers: { correct: ['main'], noMin: true, cands: ['main', 'shreddit-post:nth-of-type(1)', 'shreddit-post:nth-of-type(2)', 'body'] } },
];

// ---------- DOM helpers ----------
const norm = s => (s || '').replace(/\s+/g, ' ').trim();
function loadDoc(page) {
	const html = fs.readFileSync(path.join(DIR, 'pages', page.file), 'utf8');
	const doc = parseLinkedomHTML(html, page.url);
	for (const el of Array.from(doc.querySelectorAll('script,style,noscript,template,svg,iframe,link,meta'))) el.remove();
	return doc;
}
function resolve(doc, spec) {
	let els = Array.from(doc.querySelectorAll(spec.sel));
	if (spec.contains) els = els.filter(e => norm(e.textContent).includes(spec.contains));
	if (spec.containsAll) els = els.filter(e => spec.containsAll.every(c => norm(e.textContent).includes(c)));
	if (spec.exact) els = els.filter(e => norm(e.textContent) === spec.exact);
	if (spec.maxWords) els = els.filter(e => norm(e.textContent).split(' ').length <= spec.maxWords);
	if (spec.deepest) els = els.filter(e => !els.some(o => o !== e && e.contains(o)));
	return els[spec.idx || 0] || null;
}
function cleanHtml(el) {
	const clone = el.cloneNode(true);
	const all = [clone, ...Array.from(clone.querySelectorAll('*'))];
	for (const e of all) {
		for (const a of Array.from(e.attributes || [])) {
			const n = a.name.toLowerCase();
			if (n.startsWith('on') || n === 'style' || n === 'srcset' || n === 'sizes') { e.removeAttribute(a.name); continue; }
			let v = a.value;
			if (/^data:/i.test(v)) v = v.slice(0, 40) + '...';
			if (v.length > 160) v = v.slice(0, 160) + '...';
			if (v !== a.value) e.setAttribute(a.name, v);
		}
	}
	let html = clone.outerHTML.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
	const truncated = html.length > CAP;
	if (truncated) html = html.slice(0, CAP) + ' …[truncated]';
	return { html, truncated };
}
function blockState(el) {
	const { html, truncated } = cleanHtml(el);
	let text = norm(el.textContent);
	const textTruncated = text.length > CAP;
	if (textTruncated) text = text.slice(0, CAP) + ' …[truncated]';
	const words = norm(el.textContent).split(' ').filter(Boolean).length;
	return { html, truncated, text, textTruncated, words };
}
function candSummary(el, sel) {
	const cls = el.getAttribute('class') || '', id = el.getAttribute('id') || '';
	const text = norm(el.textContent);
	return {
		selector: sel,
		tag: el.tagName.toLowerCase(), id: id || undefined, classes: cls ? cls.trim().split(/\s+/).slice(0, 6).join(' ') : undefined,
		words: text.split(' ').filter(Boolean).length,
		starts_with: text.slice(0, 300),
	};
}
const slug = s => s.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 40);

// ---------- build work items ----------
const items = [];
const resolved = [];
for (const page of PAGES) {
	const doc = loadDoc(page);
	for (const b of page.blocks) {
		const el = resolve(doc, b);
		if (!el) { resolved.push({ issue: page.issue, file: page.file, id: b.id, kind: b.kind, resolved: false }); continue; }
		const st = blockState(el);
		resolved.push({ issue: page.issue, file: page.file, id: b.id, kind: b.kind, step: b.step, resolved: true, words: st.words, htmlChars: st.html.length, truncated: st.truncated, preview: st.text.slice(0, 100) });
		items.push({ type: 'noul', issue: page.issue, file: page.file, id: b.id, kind: b.kind, step: b.step || '', variant: 'html', state: st.html, truncated: st.truncated, words: st.words, preview: st.text.slice(0, 120) });
		items.push({ type: 'noul', issue: page.issue, file: page.file, id: b.id, kind: b.kind, step: b.step || '', variant: 'text', state: st.text, truncated: st.textTruncated, words: st.words, preview: st.text.slice(0, 120) });
	}
	if (page.containers) {
		const cands = [];
		for (const sel of page.containers.cands) {
			const el = doc.querySelector(sel);
			if (!el) continue;
			const s = candSummary(el, sel);
			if (s.words < 30 && !page.containers.noMin) continue;
			cands.push(s);
		}
		const criteria = {};
		const names = [];
		for (const c of cands) {
			const name = slug(`${c.tag}_${c.id || ''}_${(c.classes || '').split(' ').slice(0, 2).join('_')}`) || c.tag;
			let n = name, k = 2; while (names.includes(n)) n = `${name}_${k++}`;
			names.push(n);
			c.option = n;
			criteria[n] = `${c.tag}${c.id ? '#' + c.id : ''}${c.classes ? ' class="' + c.classes + '"' : ''} — ${c.words} words — starts with: "${c.starts_with.slice(0, 200)}"`;
		}
		criteria.none_of_these = 'None of the candidates is the main article container, or it cannot be determined from this list.';
		items.push({ type: 'choice', issue: page.issue, file: page.file, id: `${page.issue}-${page.file.replace('.html', '')}-container`, correct: page.containers.correct, cands, criteria,
			state: { page_url: page.url, candidates: cands.map(c => ({ option: c.option, tag: c.tag, id: c.id, classes: c.classes, words: c.words, starts_with: c.starts_with })) } });
	}
}
fs.writeFileSync(path.join(DIR, 'blocks-resolved.json'), JSON.stringify(resolved, null, 1));
const unresolved = resolved.filter(r => !r.resolved);
console.log(`blocks resolved: ${resolved.length - unresolved.length}/${resolved.length}; unresolved: ${unresolved.map(u => u.id).join(', ') || 'none'}`);
console.log(`requests planned: ${items.length} (${items.filter(i => i.type === 'noul').length} noul, ${items.filter(i => i.type === 'choice').length} choice)`);
if (DRY) {
	for (const r of resolved) if (r.resolved) console.log(`  ${String(r.issue).padEnd(4)} ${r.kind} ${r.id.padEnd(24)} ${String(r.words).padStart(6)}w ${r.truncated ? 'TRUNC' : '     '} ${r.preview.slice(0, 70)}`);
	for (const it of items.filter(i => i.type === 'choice')) console.log(`  CHOICE ${it.id}: ${it.cands.map(c => `${c.option}(${c.words}w)`).join(', ')} | correct=${it.correct.join(' | ')}`);
	process.exit(0);
}

// ---------- run ----------
const outPath = path.join(DIR, 'results.jsonl');
fs.writeFileSync(outPath, '');
const results = await mapConcurrent(items, async (it) => {
	const questions = it.type === 'noul'
		? { keep: { type: 'noul', instructions: NOUL_INSTRUCTIONS } }
		: { container: { type: 'choice', instructions: CHOICE_INSTRUCTIONS, criteria: it.criteria } };
	const t0 = performance.now();
	let res, error = null;
	try { res = await systemOne({ state: it.state, questions, model: MODEL }); } catch (e) { error = String(e.message || e); }
	const row = {
		type: it.type, issue: it.issue, file: it.file, id: it.id, kind: it.kind, step: it.step, variant: it.variant, words: it.words, truncated: it.truncated, preview: it.preview,
		model: res?.model, latency_ms: res?.latency_ms ?? Math.round(performance.now() - t0), input_tokens: res?.usage?.input_tokens, error,
	};
	if (it.type === 'noul') row.p_keep = res?.answers?.keep?.noul;
	else { row.choice = res?.answers?.container?.choice; row.confidence = res?.answers?.container?.confidence; row.probabilities = res?.answers?.container?.probabilities; row.correct = it.correct; row.cands = it.cands.map(c => ({ option: c.option, selector: c.selector, words: c.words })); }
	fs.appendFileSync(outPath, JSON.stringify(row) + '\n');
	return row;
}, 6);
console.log(`done: ${results.length} requests, errors: ${results.filter(r => r.error).length}`);
console.log('usageTotals:', JSON.stringify(usageTotals()));
