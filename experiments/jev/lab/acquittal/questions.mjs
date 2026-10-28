// Acquittal ("last-level veto") questions. Asked ONLY when Defuddle is about to remove an element, and specific to the
// clutter type Defuddle suspects. All examples are invented; none are taken from test pages.
// Frozen before any historical (git-history) case was inspected.

const EXCLUDED_TAGS = new Set(['script', 'style', 'noscript', 'template', 'meta', 'link', 'input', 'svg', 'iframe', 'select', 'option', 'textarea', 'img', 'picture', 'video', 'audio', 'source', 'br', 'hr']);

export function familyOf(r) {
  if (!r.words || EXCLUDED_TAGS.has(r.tag)) return null;
  const reason = (r.reason || '').toLowerCase();
  if (r.step === 'removeHiddenElements') return 'hidden';
  if (r.step === 'scoreAndRemove') return 'score';
  if (r.step === 'removeEyebrowLabel') return 'meta';
  if (r.step === 'removeByContentPattern') {
    if (/duplicate/.test(reason)) return null;                       // title/description duplicates: code already knows
    if (reason === 'trailing non-content' || /trailing thin|thin section/.test(reason)) return 'trailing';
    if (reason === 'boilerplate text') return 'label';
    if (reason === 'blog metadata list') return 'metalist';
    if (/breadcrumb|table of contents/.test(reason)) return 'nav';
    if (/related|external link list/.test(reason)) return 'related';
    if (/cta|newsletter|promotional|subscribe|banner link|audio player/.test(reason)) return 'promo';
    if (/author/.test(reason)) return 'author';
    if (/date|read time|metadata|category|pinned|counter|eyebrow|timezone/.test(reason)) return 'meta';
    if (/hero header/.test(reason)) return 'chrome';
    return 'other';
  }
  const s = (r.selector === 'exact' ? (r.exact || []).join(' ') : (r.selector || '')).toLowerCase();
  if (/mw-editsection|cite-backlink|footnote-back|ltx_tag_bibitem|copycontent|loading|error-/.test(s)) return null; // reference furniture
  if (/\[hidden\]|aria-hidden|display:\s*none/.test(s)) return 'hidden';
  if (/author|byline|avatar|editorial_contact|profile/.test(s)) return 'author';
  if (/tags|tag-|categor|metadata|date|dateline|published|read-?time/.test(s)) return 'meta';
  if (/related|recommend|more-|card|popular|trending|read-next|next-post/.test(s)) return 'related';
  if (/comment|disqus|reply/.test(s)) return 'comments';
  if (/-ad\b|-ad"|\bads?\b|advert|sponsor|promo|marketing|subscri|newsletter|cta|share|social|consent|cookie|btn-|signup|paywall/.test(s)) return 'promo';
  if (/nav|menu|breadcrumb|dropdown|tree-item|tabs|toc|pagination|sidebar/.test(s)) return 'nav';
  if (/footer|header|pagehead|hero|banner|logo|masthead|copyright|disclaimer|title/.test(s)) return 'chrome';
  if (/button|form|tooltip|dialog|modal|popup|overlay/.test(s)) return 'ui';
  return 'other';
}

export const DESC = {
  nav: ['site navigation: a menu, tab bar, breadcrumb trail, table of contents or list of page links', 'site navigation'],
  author: ['an author byline, author bio or link to an author profile', 'an author byline or bio'],
  meta: ['post metadata: tags, categories, dates, reading time or like and share counts', 'post metadata'],
  related: ['links or cards that point to other articles (related, recommended or more stories)', 'links to other articles'],
  comments: ['reader comments or a comment section', 'reader comments'],
  promo: ['an advertisement, a sponsored message, or a request to subscribe, sign up, share or buy', 'advertising or promotion'],
  chrome: ["the site's header, footer, hero banner or page-title area", 'site header or footer'],
  hidden: ['content hidden from view, such as a collapsed menu, a mobile-only copy or a dark-mode duplicate', 'hidden page furniture'],
  score: ['navigation or boilerplate, because it has few words or many links', 'navigation or boilerplate'],
  ui: ['an interface control such as a button, tooltip, dropdown or form', 'an interface control'],
  other: ['page clutter', 'page clutter'],
  trailing: ['closing material after the end of the article', 'closing material'],
  label: ['the label of a comment, share or related-links area', 'a comment or share label'],
  metalist: ['a list of post metadata (date, author, tags, reading time)', 'post metadata'],
};

// Invented examples: [keep..., remove...]
const BLOCK_EX = {
  nav: [['A tab panel whose text is the article\'s abstract followed by its first section.', 'A numbered list of the steps a guide walks through: "1. Unpack the kit 2. Attach the base 3. Level the frame".'],
        ['"Home | Products | Pricing | Blog | Contact"', '"Contents: 1 Background 2 Method 3 Results"']],
  author: [['A paragraph discussing a person\'s work: "Okafor\'s 2015 field study found that the wetland recovered within a decade."'],
           ['"Lena Park is a staff writer covering energy. Follow her on Mastodon."', '"By Lena Park and Tomás Reyes"']],
  meta: [['A section holding the article\'s headings and paragraphs, even though its label mentions tags or dates: "Water rights in the valley date back to 1902, when the first canal was dug..."'],
         ['"Posted March 3, 2024 · 5 min read"', '"Tags: travel, food, Lisbon"', '"1.2k likes · 48 comments"']],
  related: [['A paragraph of the article that discusses related ideas: "Earlier models assumed a fixed rate; this study relaxes that assumption."'],
            ['"You might also like: Ten winter soups · How to store herbs · Our favourite knives"', '"More from this author" followed by three headlines']],
  comments: [['A section titled "Discussion" in which the author interprets the results.'],
             ['"Leave a reply. Your email address will not be published."', '"anna_k · 2 hours ago — Great post, thanks!"']],
  promo: [['Article paragraphs that sit inside an advertising slot\'s wrapper: "The council voted 7–2 to approve the budget, ending months of debate."'],
          ['"Sponsored: try Acme Cloud free for 30 days"', '"Subscribe to our newsletter for weekly updates"', '"Share this article"']],
  chrome: [['A large illustration at the top of the article captioned "Map of the 1854 cholera outbreak".', 'The header row of a data table: "Country | Population | Growth rate".'],
           ['"© 2024 Example Media · Privacy · Terms · Contact"', 'A site logo, a search box and a "Log in" link']],
  hidden: [['A code example shown in a tab that stays hidden until the reader clicks it.', 'A section of the article collapsed behind a "Show more" toggle.'],
           ['A mobile-only copy of the site menu', 'A "Copied to clipboard" tooltip', 'A cookie consent dialog']],
  score: [['A one-line instruction of the article: "Preheat the oven to 200 °C and line the tray with paper."', 'A documentation home page whose main content is four cards, "Install", "Configure", "Troubleshoot" and "API", each with a one-sentence description.'],
          ['"Home · About · Archive · Contact"', '"Previous: Part 2 | Next: Part 4"', '"Popular posts: How to bake bread · Ten easy soups"']],
  ui: [['An expandable "Details" panel whose text continues the explanation.'], ['"Copy"', '"Load more"', '"Close"']],
  other: [['A paragraph of the article.'], ['"Advertisement"', '"Skip to content"']],
  trailing: [['"The judge\'s reasoning, however, raises a further problem: the order was made before the hearing."', '"In short, the cheaper design held up just as well over five winters."'],
             ['"Share this: Facebook · X · Email"', '"About the author: Priya writes about energy policy."', '"3 thoughts on this post"']],
  label: [['The line "Discussion" followed by text_after "The results suggest the effect is seasonal rather than..."', 'The line "Our view" followed by text_after "The ruling is narrower than it first appears..."'],
          ['The line "Comments" followed by text_after "anna_k · 2 days ago: Thanks for this!"', 'The line "Share" followed by text_after "Facebook X Email"']],
  metalist: [['text_before "The script accepts three flags:" and the list "--fast, --safe, --verbose".'],
             ['The list "March 3, 2024 · 5 min read · Food" placed just under the article\'s heading.']],
};
const INLINE_EX = {
  keep: {
    nav: ['"We covered the wiring in ⟦an earlier post⟧, so this one starts with testing."', '"The full schedule is on ⟦the festival page⟧ and changes daily."'],
    author: ['"As ⟦Ada Lovelace⟧ wrote in her notes, the engine might compose music."'],
    meta: ['"The bug was fixed in ⟦version 2.4⟧, released in May."'],
    related: ['"In this Act, ⟦“licensed vessel”⟧ means a boat registered under Part 2."', '"This builds on ⟦a related result⟧ by the same group."'],
    default: ['"For background, see ⟦the 2019 survey⟧ published by the regional water board."', '"The proof follows ⟦Lemma 3⟧ closely."'],
  },
  remove: {
    nav: ['"⟦Home⟧ › Guides › Installing the CLI"', '"⟦Next post →⟧"'],
    author: ['"By ⟦Maria Chen⟧ · 6 min read"'],
    meta: ['"Filed under: ⟦Gardening⟧, ⟦Soil⟧"'],
    related: ['"⟦Read next: Ten soups for winter⟧"'],
    default: ['"⟦Share on Facebook⟧ ⟦Share on X⟧"', '"⟦Sign in⟧ to leave a reply"'],
  },
};
const exList = a => a.map(x => '- ' + x).join('\n');

export function blockState(r) {
  const st = { element: r.tag, words: r.words, share_of_text_in_links: r.link_density, contains: r.has, text: r.text.slice(0, 2500),
    text_before: r.prev_text || '', text_after: r.next_text || '', section_heading: r.heading || '' };
  if (r.block_words_outside > 0 && r.context) st.context = r.context; // block marked between ⟦ ⟧ inside its parent's text
  return st;
}
export function inlineState(r, withContext = true) {
  return withContext ? { marked_phrase: r.text.slice(0, 300), context: r.context } : { marked_phrase: r.text.slice(0, 300) };
}
export function isInline(r) { return r.inline && r.block_words_outside >= 3; }

export function acquittalQuestion(r, fam, { examples = true, context = true } = {}) {
  const [long, short] = DESC[fam];
  if (isInline(r)) {
    const keep = [...(INLINE_EX.keep[fam] || []), ...INLINE_EX.keep.default].slice(0, 3);
    const rem = [...(INLINE_EX.remove[fam] || []), ...INLINE_EX.remove.default].slice(0, 3);
    const where = context ? 'the phrase marked between ⟦ and ⟧ in state.context' : 'the phrase in state.marked_phrase';
    let instructions = `A reader-mode extractor is about to delete ${where} because it looks like ${long}. Is the marked phrase part of a sentence of the article, so that deleting it would leave that sentence with missing words? Answer false if the phrase stands on its own as a label, link list, byline, tag or button rather than inside an article sentence.`;
    if (examples) instructions += `\nExamples where the answer is true:\n${exList(keep)}\nExamples where the answer is false:\n${exList(rem)}`;
    return { type: 'noul', instructions, criteria: { true: 'Part of an article sentence: deleting it would break the sentence', false: `Standalone ${short}, not part of an article sentence` } };
  }
  const ex = BLOCK_EX[fam] || BLOCK_EX.other;
  let instructions;
  if (fam === 'trailing') instructions = 'A reader-mode extractor is about to delete this block because it appears after the point where it believes the article ends. Is the block a continuation of the article\'s own text, with full sentences that develop the article\'s topic, rather than closing material such as reader comments, share prompts, author bios, newsletter prompts or legal notices?';
  else if (fam === 'label') instructions = 'A reader-mode extractor is about to delete this short line, and the text after it, because it looks like the label of a comment, share or related-links area. Using state.text_after, is this line the heading of a section the article\'s author wrote, followed by more of the article, rather than the start of a reader-comments, sharing or related-links area?';
  else if (fam === 'metalist') instructions = 'A reader-mode extractor is about to delete this list because it looks like post metadata (date, author, tags, reading time). Does the list continue the text just before it (state.text_before, or the text before ⟦ in state.context), for example a sentence ending with a colon that the list items complete, rather than listing post metadata?';
  else instructions = `A reader-mode extractor is about to delete this block because it looks like ${long}. Do not judge from how the block is labeled; judge from its text (state.text) and the text around it. Is the block part of the article itself, meaning paragraphs, headings, list items, figures and captions, tables or code that belong to the article's own content, rather than ${short}?`;
  if (examples) instructions += `\nExamples where the answer is true (keep):\n${exList(ex[0])}\nExamples where the answer is false (delete):\n${exList(ex[1])}`;
  return { type: 'noul', instructions, criteria: { true: 'Article content: keep the block', false: `Not article content: it is ${short}` } };
}

export function requestsFor(r) {
  const fam = familyOf(r); if (!fam) return null;
  const inline = isInline(r);
  const main = { state: inline ? inlineState(r) : blockState(r), questions: { acquit_ex: acquittalQuestion(r, fam, { examples: true }), acquit_plain: acquittalQuestion(r, fam, { examples: false }) } };
  const phraseOnly = inline ? { state: inlineState(r, false), questions: { acquit_phrase_only: acquittalQuestion(r, fam, { examples: true, context: false }) } } : null;
  return { fam, inline, main, phraseOnly };
}
