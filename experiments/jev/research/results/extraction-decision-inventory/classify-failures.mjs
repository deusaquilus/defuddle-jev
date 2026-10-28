// Failure-class history for Defuddle extraction (meaning B).
// Inputs: gh_issues.json (244 issues, titles only), gitlog_all.txt (781 commit subjects).
// Output: failure-classes.json + stdout tables.
// Classification is by hand (issue number -> class) from the issue titles, plus keyword rules
// for commit subjects. "judgeability" says what evidence a classifier would need.
import { readFileSync, writeFileSync } from 'node:fs';
const DIR = '/home/alexi/git/defuddle/experiments/jev/research/results/extraction-decision-inventory';
const issues = JSON.parse(readFileSync(`${DIR}/gh_issues.json`, 'utf8'));
const commits = readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/gitlog_all.txt', 'utf8').trim().split('\n');

// ---- Issue classes (hand-assigned from titles) ----
// judgeability: text = block's own text/content suffices; attr = evidence is a class/id/attr token on the
// block (block content is prose; a per-block "is this content?" judgment repairs it); struct = needs DOM
// position/neighbours/page-level view; site = site-specific DOM/extractor/API; fmt = formatting conversion
// (no classifier involved); meta = metadata field extraction; infra = build/CLI/perf/security/feature.
const CLASSES = {
	'clutter-FP-text-heuristic': { judge: 'text', nums: [112, 428, 445, 460, 284, 148, 233, 371, 45, 182, 136, 114] },
	'clutter-FP-attribute-rule': { judge: 'attr', nums: [444, 441, 321, 279, 252, 131, 132, 106, 167, 346, 303, 134, 228, 107, 77, 366, 263, 15, 44, 80, 229] },
	'clutter-FP-structural-rule': { judge: 'struct', nums: [372, 343, 214, 360, 258, 240, 408, 218, 280, 57, 60, 395, 369, 287, 296] },
	'clutter-FN-kept-clutter': { judge: 'text', nums: [210, 241, 68, 160, 235, 222] },
	'clutter-FN-structural': { judge: 'struct', nums: [232, 254, 242, 253, 59, 286, 35] },
	'main-container-or-page-structure': { judge: 'struct', nums: [162, 352, 361, 358, 115, 13, 97, 175, 31, 65, 78, 79, 64, 98, 156, 52, 116, 283, 300, 11, 58, 382, 288, 384, 383, 375, 365, 257, 324, 386, 256] },
	'images-lazy-dedupe': { judge: 'struct', nums: [227, 221, 374, 406, 72, 30, 213, 129] },
	'formatting-markdown-code-math-footnotes': { judge: 'fmt', nums: [436, 433, 431, 427, 423, 422, 421, 418, 417, 415, 377, 367, 353, 250, 244, 239, 237, 224, 209, 197, 188, 168, 159, 146, 144, 143, 142, 141, 138, 125, 120, 88, 86, 84, 53, 48, 46, 27, 24, 16, 245, 275, 325, 207, 285, 217, 159] },
	'site-extractor': { judge: 'site', nums: [410, 381, 329, 310, 309, 293, 266, 176, 174, 126, 117, 108, 96, 336, 314, 272, 208, 161, 127, 123, 122, 380, 323, 203, 69, 87, 83, 70, 407, 268, 347, 298, 414, 94, 199, 273, 277, 338, 320, 200, 230, 274, 349] },
	'metadata-fields': { judge: 'meta', nums: [335, 295, 196, 183, 135, 21] },
	'infra-cli-perf-security-feature': { judge: 'infra', nums: [447, 439, 393, 385, 368, 344, 341, 340, 312, 297, 282, 265, 262, 249, 231, 194, 181, 179, 178, 169, 165, 164, 155, 154, 139, 137, 128, 113, 110, 105, 104, 101, 100, 99, 93, 92, 91, 74, 73, 71, 61, 56, 50, 38, 34, 29, 12, 4, 348, 220] },
};
const byNum = new Map();
for (const [cls, { judge, nums }] of Object.entries(CLASSES)) for (const n of nums) if (!byNum.has(n)) byNum.set(n, { cls, judge });
const issueRows = issues.map(i => ({ number: i.number, state: i.state, title: i.title, ...(byNum.get(i.number) || { cls: 'UNCLASSIFIED', judge: '?' }) }));
const unclassified = issueRows.filter(r => r.cls === 'UNCLASSIFIED');
const countBy = (rows, key) => { const m = {}; for (const r of rows) m[r[key]] = (m[r[key]] || 0) + 1; return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1])); };
const issueByClass = countBy(issueRows, 'cls');
const issueByJudge = countBy(issueRows, 'judge');
const openByClass = countBy(issueRows.filter(r => r.state === 'OPEN'), 'cls');
const openByJudge = countBy(issueRows.filter(r => r.state === 'OPEN'), 'judge');

// ---- Commit sub-classification (extraction-relevant subjects only) ----
const rules = [
	['security', /sanitiz|xss|escap(e|ing)\b|ghsa|unsafe|security|smil|url scheme|reject data|innerhtml|javascript-links|harden/i],
	['main-container-retry', /whole-body|fallback|retry|entry point|entry-point|post-body for ghost|table layout|table-based|table layouts|detect table|peripheral tables|index page|multiple article|nested articles|main content|selected as the primary|aria-hidden|hidden content|shadow dom|streaming|ssr|suspense|embedded into figure|semantic entry|pages without semantic|content selection|content detection|schema/i],
	['FP-repair-keep-content', /overly aggressive|over-aggressive|accidental|retain|\bkeep\b|don'?t (strip|remove|treat)|legitimate|false positive|fix #(107|77|256|229|241|207|208|137|390|112)\b|screen-reader|inside code|delimiter-less|pascalcase|content grids with lots|if p contains content|header cell|table cell|#284|#286|data tables|protect/i],
	['scoring', /scor|bios|list items to content|tweak scoring|#112|#147|#152/i],
	['hidden', /hidden/i],
	['content-pattern-text+structure', /newsletter|related post|breadcrumb|crumbs|boilerplate|eyebrow|boundary|table of contents|tocs?\b|likes|ticker|trailing|checkbox|skip link|sitemap|subhead|widont|spacer|no js|header detection|content pattern|pattern|dismiss|thin section|cta|social counter|author contact|read ?time|byline|metadata removals|date and reading time/i],
	['selector-list-addition', /^removals?\b|removals?:|more removals|^removal$|\bremovals\b|small removals?|menu removals|combine selectors|less brittle selector|^(nyt|nature\.com|techcrunch|nybooks\.com|9to5mac)$|fix for 9to5mac|fixes for |improvements for |removals for |for wikipedia|verge and substack|medium and others|removal fixes|removal$/i],
];
const extractionCommits = commits.filter(l => {
	const s = l.replace(/^[0-9a-f]{7,}\s+/, '');
	return rules.slice(1).some(([, re]) => re.test(s)) || /remov|strip|clutter|selector/i.test(s);
});
const commitRows = extractionCommits.map(l => {
	const s = l.replace(/^[0-9a-f]{7,}\s+/, '');
	let cls = 'other-extraction';
	for (const [name, re] of rules) if (re.test(s)) { cls = name; break; }
	return { line: l, cls };
});
// Exclude formatting/extractor noise that slipped in via 'remov' (e.g. "Remove empty <video>") only if clearly formatting.
const commitByClass = countBy(commitRows, 'cls');

const out = { issue_total: issues.length, issue_open: issueRows.filter(r => r.state === 'OPEN').length, issueByClass, issueByJudge, openByClass, openByJudge,
	unclassified: unclassified.map(r => `${r.number} ${r.title}`), extraction_commits_considered: extractionCommits.length, commitByClass,
	commitsByClassList: Object.fromEntries(Object.keys(commitByClass).map(k => [k, commitRows.filter(r => r.cls === k).map(r => r.line)])),
	issueRows };
writeFileSync(`${DIR}/failure-classes.json`, JSON.stringify(out, null, 1));
console.log('issues', out.issue_total, 'open', out.issue_open);
console.log('issueByClass', JSON.stringify(issueByClass, null, 1));
console.log('issueByJudge', JSON.stringify(issueByJudge));
console.log('openByClass', JSON.stringify(openByClass, null, 1));
console.log('openByJudge', JSON.stringify(openByJudge));
console.log('UNCLASSIFIED', unclassified.length, unclassified.map(r => r.number).join(','));
console.log('extraction commits considered', extractionCommits.length);
console.log('commitByClass', JSON.stringify(commitByClass, null, 1));
for (const k of ['FP-repair-keep-content', 'scoring', 'hidden', 'main-container-retry', 'other-extraction']) {
	console.log(`--- ${k}`); for (const r of commitRows.filter(r => r.cls === k)) console.log('   ' + r.line.slice(0, 130));
}
