// Factored question design: role = one coproduct (asked in both option orders in the same request),
// plus five literal yes/no cues. Form (heading, code, table, image, list) is computed in code, never asked.
// Arm A: state = same block HTML as the original run. Arm B: state = text plus code-computed form facts.
// Run: bash -ic 'node factored.mjs A|B [--limit N]'   (never prints the key)
import { systemOne, mapConcurrent, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
const DIR = '/home/alexi/git/defuddle/experiments/jev/lab/coproduct';
const MODEL = 'jev-1.14.0';
const arm = process.argv[2]; if (!['A','B'].includes(arm)) throw new Error('arm A|B');
const li = process.argv.indexOf('--limit'); const limit = li > 0 ? +process.argv[li+1] : Infinity;

export const ROLE = {
  article_content: "Part of the article itself: body text, a section heading, a figure or caption, code, a table, a quote, a footnote or a reference",
  site_navigation: "A site menu, breadcrumb trail, skip link, pagination, previous/next link, or table of contents",
  promotion_or_call_to_action: "An advertisement, sponsored content, or a request to subscribe, sign up, sign in, follow, share, donate or download an app",
  links_to_other_articles: "Related, recommended, popular, trending or more-stories links or cards that point to other articles",
  reader_comments: "Comments or replies written by readers, or the heading and controls of a comment section",
  author_or_publication_metadata: "An author byline or bio, publish date, read time, tags, categories, or like and share counts",
  site_footer_or_legal_notice: "A copyright line, site footer, cookie or consent banner, or privacy or terms notice",
  other: "None of these, or not enough information to tell",
};
const reversed = Object.fromEntries(Object.entries(ROLE).filter(([k]) => k !== 'other').reverse().concat([['other', ROLE.other]]));
const ROLE_INSTR = "What is the main purpose of this block on its web page? Pick the one role that covers most of the block's text. A heading takes the role of the section it introduces. Judge only from what is in the block.";
export const QUESTIONS = {
  role_fwd: { type: 'choice', instructions: ROLE_INSTR, criteria: ROLE },
  role_rev: { type: 'choice', instructions: ROLE_INSTR, criteria: reversed },
  has_article_prose: { type: 'noul', instructions: "Does this block contain at least one complete sentence that explains, narrates or argues something, as an article would? Menu items, button labels, link titles, bylines, dates and headings on their own do not count." },
  asks_reader_to_act: { type: 'noul', instructions: "Does this block ask the reader to subscribe, sign up, sign in, follow, share, donate, download an app, or accept cookies?" },
  metadata_only: { type: 'noul', instructions: "Does this block consist only of publication metadata, such as an author name, a date, a reading time, a category, tags, or like and comment counts, with no sentence of article text?" },
  mostly_links_elsewhere: { type: 'noul', instructions: "Is this block mainly a list or group of links that send the reader to other pages or sections, such as menus, related posts, tag lists or pagination, rather than text to read here?" },
  written_by_reader: { type: 'noul', instructions: "Was this block written by a reader of the page, such as a comment or reply, rather than by the page's author or publisher?" },
};
function formFacts(u) {
  const h = u.html; const contains = [];
  if (/<h[1-6]\b/i.test(h)) contains.push('heading'); if (/<(img|picture|video|figure|svg)\b/i.test(h)) contains.push('image or figure');
  if (/<(pre|code)\b/i.test(h)) contains.push('code'); if (/<table\b/i.test(h)) contains.push('table'); if (/<(ul|ol|dl)\b/i.test(h)) contains.push('list');
  return { element: u.tag, words: u.words, share_of_text_in_links: u.hints.has_link_density, contains, text: u.text };
}
const state = u => arm === 'A' ? u.html : formFacts(u);
if (process.argv.includes('--show')) { const u = JSON.parse(readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl','utf8').split('\n')[2]); console.log(JSON.stringify({ model: MODEL, state: state(u), questions: QUESTIONS }, null, 2)); process.exit(0); }

const units = readFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/dataset/blocks.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l));
const out = `${DIR}/raw-${arm}.jsonl`;
const done = new Set(); if (existsSync(out)) for (const l of readFileSync(out,'utf8').split('\n')) { if (!l.trim()) continue; const r = JSON.parse(l); if (!r.error) done.add(r.id); }
const todo = units.filter(u => !done.has(u.id)).slice(0, limit);
console.log(`[${arm}] total=${units.length} done=${done.size} todo=${todo.length}`);
let n = 0, errs = 0;
await mapConcurrent(todo, async u => {
  const rec = { arm, id: u.id };
  try {
    const r = await systemOne({ state: state(u), questions: QUESTIONS, model: MODEL });
    const a = r.answers; rec.model = r.model; rec.usage = r.usage; rec.latency_ms = r.latency_ms;
    rec.role_fwd = a.role_fwd.probabilities; rec.role_rev = a.role_rev.probabilities;
    for (const k of ['has_article_prose','asks_reader_to_act','metadata_only','mostly_links_elsewhere','written_by_reader']) rec[k] = a[k].noul;
  } catch (e) { rec.error = String(e.message || e).slice(0, 300); errs++; }
  appendFileSync(out, JSON.stringify(rec) + '\n'); if (++n % 200 === 0) console.log(`[${arm}] ${n}/${todo.length} errors=${errs}`);
}, 8);
const t = usageTotals(); console.log(`[${arm}] finished ${n}, errors=${errs}`, JSON.stringify(t));
writeFileSync(`${DIR}/usage-${arm}-${Date.now()}.json`, JSON.stringify({ arm, n, errs, ...t }, null, 2));
