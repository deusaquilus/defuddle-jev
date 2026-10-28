// Tiny live probe: can per-block Nouls read the canonical Defuddle failure classes from the block alone,
// and which ones need neighbouring context? Hand-written anonymized blocks modelled on real issues.
// Run: bash -ic 'node /home/alexi/git/defuddle/experiments/jev/research/results/extraction-decision-inventory/probe-failure-classes.mjs'
import { writeFileSync } from 'node:fs';
import { systemOne, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
const OUT = '/home/alexi/git/defuddle/experiments/jev/research/results/extraction-decision-inventory';
const MODEL = 'jev-1.14.0';
const Q = {
	is_article_body: { type: 'noul', instructions: 'Is this HTML block part of the main body of the article or document on the page: prose, a list, a table row, a code sample, a definition, or a caption that a reader came to the page to read? Answer true even if it is short. Answer false for navigation, notices, widgets, bylines, and links to other pages.',
		criteria: { true: 'Reader-facing article/document content', false: 'Not article content (chrome, widget, metadata, links elsewhere)' } },
	is_site_chrome: { type: 'noul', instructions: 'Is this block site chrome: a navigation menu, breadcrumb trail, cookie or consent notice, site footer, copyright line, share or follow widget, login prompt, or advertisement?' },
	is_promo_cta: { type: 'noul', instructions: 'Is this block a call to action asking the reader to subscribe, sign up, follow, join, donate, or read other articles?' },
	is_metadata_only: { type: 'noul', instructions: 'Does this block consist only of publication metadata such as an author name, a date, a reading time, a category label, or a like/comment count, with no sentence of article text?' },
	is_link_list_elsewhere: { type: 'noul', instructions: 'Is this block a list or group of links whose purpose is to send the reader to other pages or sections (related posts, table of contents, breadcrumbs, tag list), rather than text to read here?' },
};
const BLOCKS = [
	{ id: 'p112-prose-with-nav-words', issue: '#112', truth: 'keep', kind: 'text', html: '<div><p>We talked about privacy for an hour. He said people share far too much on social media, and the most popular apps are the worst offenders.</p></div>' },
	{ id: 'p428-register-instruction', issue: '#428', truth: 'keep', kind: 'text', html: '<div>Store the result in register R1</div>' },
	{ id: 'p284-header-cell', issue: '#284', truth: 'keep', kind: 'text', html: '<tr><td>Defined in header &lt;cstddef&gt;</td></tr>' },
	{ id: 'p444-defined-term', issue: '#444', truth: 'keep', kind: 'attr', html: '<div id="term-related-claim"><p>"related claim" means a claim arising from the same facts as the original claim.</p></div>' },
	{ id: 'p441-data-date-wrapper', issue: '#441', truth: 'keep', kind: 'attr', html: '<div class="post-body" data-date="2026-03-04"><p>The committee met on Tuesday to review the proposal, which had been circulated the week before.</p><p>Members raised three objections, each of which is addressed below.</p></div>' },
	{ id: 'p0699-content-list-internal-links', issue: 'commit 0699bb0', truth: 'keep', kind: 'text', html: '<ul><li><a href="/docs/intro">Read the introduction first, which covers the basics of installation and setup</a></li><li><a href="/docs/config">Then configure the tool for your environment before running it</a></li></ul>' },
	{ id: 'p371-custom-callout', issue: '#371', truth: 'keep', kind: 'attr', html: '<div class="card card-warning"><p>Warning: running this command deletes the cache directory and cannot be undone.</p></div>' },
	{ id: 'n-cookie-banner', issue: 'baseline', truth: 'remove', kind: 'text', html: '<div>We use cookies to improve your experience. By continuing you agree to our privacy policy. Accept Decline</div>' },
	{ id: 'n-related-posts', issue: 'scoring fixture', truth: 'remove', kind: 'text', html: '<section><h3>Related Posts</h3><div><a href="/blog/post-1">How to scale database queries efficiently</a> <span>3 min</span></div><div><a href="/blog/post-2">Building resilient distributed systems</a> <span>4 min</span></div></section>' },
	{ id: 'n-byline', issue: 'content-pattern', truth: 'remove', kind: 'text', html: '<div>By Jane Reporter · March 4, 2026 · 8 min read</div>' },
	{ id: 'n-newsletter-cta', issue: 'content-pattern', truth: 'remove', kind: 'text', html: '<div><h3>Stay updated</h3><p>Subscribe to our newsletter and never miss the latest.</p></div>' },
	{ id: 'n-toc', issue: 'content-pattern', truth: 'remove', kind: 'text', html: '<ul><li><a href="#intro">Introduction</a></li><li><a href="#setup">Setup</a></li><li><a href="#usage">Usage</a></li></ul>' },
	{ id: 'n-footer', issue: 'baseline', truth: 'remove', kind: 'text', html: '<footer>© 2026 Example Corp. All rights reserved. Privacy · Terms</footer>' },
	{ id: 'n-author-bio-social', issue: 'scoring social rule (policy)', truth: 'remove', kind: 'policy', html: '<div><p>Jane Smith is a staff writer covering science. Follow her on <a href="https://twitter.com/janesmith">Twitter</a>.</p></div>' },
	{ id: 'p445-comment-label-alone', issue: '#445', truth: 'keep', kind: 'struct', html: '<p>Comment</p>' },
	{ id: 'p445-comment-label-with-next', issue: '#445', truth: 'keep', kind: 'struct+context', html: { block: '<p>Comment</p>', next_sibling: '<p>The reviewer noted that the second experiment lacked a control group, which the authors concede in the revised manuscript.</p>' } },
	{ id: 'n-comments-label-with-next', issue: 'baseline', truth: 'remove', kind: 'struct+context', html: { block: '<p>Comments</p>', next_sibling: '<div><div><b>user123</b> 2 hours ago</div><p>Great post, thanks!</p><a href="#">Reply</a></div>' } },
	{ id: 'p460-comments-heading-wrapper', issue: '#460', truth: 'keep', kind: 'struct', html: '<div><h2>Comments</h2><p>This short note explains why the parser rejects trailing commas in strict mode and how to enable the lenient flag.</p></div>' },
];
const results = [];
for (const b of BLOCKS) {
	const r = await systemOne({ state: b.html, questions: Q, model: MODEL });
	const a = r.answers;
	const p = Object.fromEntries(Object.keys(Q).map(k => [k, +a[k].noul.toFixed(3)]));
	const clutterMax = Math.max(p.is_site_chrome, p.is_promo_cta, p.is_metadata_only, p.is_link_list_elsewhere);
	const decision = (p.is_article_body >= 0.5 && clutterMax < 0.7) ? 'keep' : 'remove';
	results.push({ id: b.id, issue: b.issue, kind: b.kind, truth: b.truth, decision, correct: decision === b.truth, model: r.model, ...p, input_tokens: r.usage?.input_tokens, latency_ms: r.latency_ms });
	console.log(`${decision === b.truth ? 'OK ' : 'ERR'} ${b.id.padEnd(36)} truth=${b.truth.padEnd(6)} dec=${decision.padEnd(6)} body=${p.is_article_body} chrome=${p.is_site_chrome} cta=${p.is_promo_cta} meta=${p.is_metadata_only} links=${p.is_link_list_elsewhere}`);
}
const usage = usageTotals();
writeFileSync(`${OUT}/probe-results.json`, JSON.stringify({ model: MODEL, questions: Q, results, usage }, null, 1));
console.log('correct', results.filter(r => r.correct).length, '/', results.length);
console.log('by kind', JSON.stringify(Object.fromEntries(['text', 'attr', 'struct', 'struct+context', 'policy'].map(k => [k, `${results.filter(r => r.kind === k && r.correct).length}/${results.filter(r => r.kind === k).length}`]))));
console.log('model', results[0]?.model, 'usage', JSON.stringify(usage));
