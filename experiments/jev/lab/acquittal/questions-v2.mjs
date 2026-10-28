// v2 acquittal questions, written in the style of McpMessages.kt / mcp-docs-combined.md:
// the situation first, a literal test, KEEP/REMOVE criteria each with an interspersed example and the reason,
// look-alike pairs that differ only in the deciding detail, and a one-line principle.
// Same routing (familyOf/isInline) as v1. Examples are invented; none copy text from the test pages.
// Frozen before the fresh pre-March cases were inspected.
import { familyOf, isInline } from './questions.mjs';
export { familyOf, isInline };

function trigger(r) {
  if (r.step === 'removeBySelector') {
    if (r.selector === 'exact') return `it matched the CSS selector ${JSON.stringify((r.exact || [])[0] || '?')}`;
    return `a class, id or attribute contains the pattern ${JSON.stringify(r.selector)}`;
  }
  if (r.step === 'scoreAndRemove') return 'it scored as navigation: few words, many links, or words that menus often use';
  if (r.step === 'removeHiddenElements') return `it is hidden by CSS (${(r.reason || '').slice(0, 40)})`;
  if (r.step === 'removeEyebrowLabel') return 'it looks like a short category label above the title';
  return `a text pattern matched it ("${(r.reason || '').slice(0, 40)}")`;
}

export function blockStateV2(r) {
  const st = { element: r.tag, words: r.words, share_of_text_in_links: r.link_density, share_of_page_words: r.share_of_body_words, contains: r.has,
    text: r.text.slice(0, 2500), text_before: r.prev_text || '', text_after: r.next_text || '', section_heading: r.heading || '' };
  if (r.block_words_outside > 0 && r.context) st.context = r.context;
  return st;
}
export function inlineStateV2(r) { return { marked_words: r.text.slice(0, 300), context: r.context }; }

const T = (s) => s.trim();
const INLINE = (r) => T(`
THE SITUATION
A reader-mode extractor is about to delete the words marked ⟦like this⟧ from inside the text in state.context, because ${trigger(r)}. Deleting words from inside an author's sentence leaves a broken sentence, so the deletion is only right when the marked words are page furniture sitting NEXT TO the text, not part of it.

THE TEST
Read state.context twice: once as written, once with the marked words removed. If the second reading is missing words a reader needs, answer true.
  "Earlier we compared both phones in ⟦our first review⟧, so this one covers battery life."
  → without them: "compared both phones in , so this one…" — broken. TRUE.

KEEP (true)
- A link phrase inside a sentence, EVEN when it points to the site's own pages or sounds promotional:
  "The full timetable is on ⟦the festival page⟧ and changes daily." → true. Promotional tone does not make in-sentence words removable.
- A defined or quoted term inside a definition:
  "In this Act ⟦“licensed vessel”⟧ means a boat registered under Part 2." → true. Without it the definition defines nothing.
- A name the sentence is about:
  "The theorem was first proved by ⟦Emmy Noether⟧ in 1915." → true.
- A short technical token inside an explanation:
  "Pass ⟦--dry-run⟧ to preview the changes first." → true.

REMOVE (false)
- A breadcrumb trail: every segment is a link and there is no sentence. "⟦Home⟧ › Guides › Setup" → false.
- A byline or dateline beside the text, not inside a sentence. "By ⟦Maria Chen⟧ · 6 min read" → false.
- Share or follow buttons after a sentence that is already complete. "…reopened on Friday. ⟦Share⟧ ⟦Email⟧" → false.
- A tag list. "Filed under ⟦Gardening⟧, ⟦Soil⟧" → false.

LOOK-ALIKES (same words, different answer)
- "See ⟦our pricing page⟧ for the details." → true (inside a sentence)   vs   "⟦Pricing⟧ ⟦Blog⟧ ⟦Log in⟧" → false (a menu).
- "Thanks to ⟦Priya Nair⟧ for reviewing the draft." → true   vs   "⟦Priya Nair⟧ · March 3, 2024" → false (a byline).

IMPORTANT: the rule that fired looked at a surface cue (a class name, a link pattern, a word). Ignore the cue. Decide only by whether the sentence needs the words.
PRINCIPLE: never punch holes in an author's sentence.`);

const BLOCK = {
  author: (r) => T(`
THE SITUATION
A reader-mode extractor is about to delete this block as an author byline, author bio or author-profile link, because ${trigger(r)}.

THE TEST
A byline names who wrote THIS page: one or two names, usually beside "By", a date or a read time, at the top or bottom. A bio describes that writer. Anything else that mentions people is the article's own content. Use state.text_before and state.text_after: if the neighbours are other people's names in the same list, this is one item of a list the article presents.

KEEP (true)
- One item of a list of several different people that the article presents, e.g. under a heading such as "Poets discussed in this essay":
  "Wisława Szymborska" (text_before "Czesław Miłosz", text_after "Zbigniew Herbert") → true. A list of subjects is not a byline.
- A paragraph about a person's work:
  "Okafor's 2015 field study found that the wetland recovered within a decade." → true.

REMOVE (false)
- "By Lena Park · 5 min read" → false. That is who wrote the page.
- "Lena Park is a staff writer covering energy. Follow her on Mastodon." → false. That is the writer's bio.
- An avatar and a name under the title, next to the publish date → false.

LOOK-ALIKES
- A single name next to a date under the title → false   vs   the same kind of name as one item among many different names in a list → true.

PRINCIPLE: a byline is about the page's author; a list of people is about the article's subject.`),

  chrome: (r) => T(`
THE SITUATION
A reader-mode extractor is about to delete this block as the site's header, footer, hero banner or page-title area, because ${trigger(r)}.

THE TEST
Real headers and footers are SHORT and made of site furniture: a logo, menus, a search box, a copyright line, legal links, a newsletter box. Look at state.words, state.share_of_text_in_links and state.contains before looking at anything else.

KEEP (true)
- A wrapper whose class happens to say "footer", "header" or "hero" but which holds thousands of words of headings and paragraphs (state.words in the thousands, few links):
  it is the page's main container and the class word is an accident → true.
- A figure at the top of the article whose caption describes the article's subject: "Map of the 1854 cholera outbreak" → true.
- The header row of a data table: "Country | Population | Growth rate" → true. The table needs it.

REMOVE (false)
- "© 2024 Example Media · Privacy · Terms · Contact" → false.
- A logo, a search box and a "Log in" link → false.
- The page's own title or the site's name repeated at the top → false. The extractor keeps the title separately.

LOOK-ALIKES
- 40 words, mostly links: "About · Careers · Press · Privacy · Terms…" → false   vs   9,000 words of headings and paragraphs inside a div whose class contains "footer" → true.

PRINCIPLE: judge a block by its size and what it contains, not by the word in its class.`),

  score: (r) => T(`
THE SITUATION
A reader-mode extractor scored this block as navigation or boilerplate and is about to delete it: it is short, has many links, or contains words that menus often use (sign in, log in, subscribe, account).

THE TEST
Menus are lists of short link labels that send the reader to OTHER pages. Is this text instead a sentence, a step or an item that belongs to the article, or the page's own main content?

KEEP (true)
- A one-line step of a procedure, even though it is short: "Seal the jar before heating it." → true.
- A sentence that uses a menu-like word in its ordinary meaning: "Visitors sign in at reception and receive a badge." → true.
- A grid of cards that IS the page's main content: the home page of a product's documentation, where each card has a title and a sentence describing that part of the docs, and state.share_of_page_words is large → true.
- A heading of the article: "Method" or "Results" above the article's own text → true.

REMOVE (false)
- "Home · About · Archive · Contact" → false.
- "Previous: Part 2 | Next: Part 4" → false.
- Cards that point to OTHER articles beside or below an article: "Popular now: How to bake bread · Ten easy soups" → false.

LOOK-ALIKES
- "Sign in to comment" → false (a site prompt)   vs   "Visitors sign in at reception and receive a badge." → true (a sentence of the article).
- Cards headed "More stories" under an article → false   vs   cards that make up a docs home page's whole body → true.

PRINCIPLE: short is not the same as navigation; a sentence or step of the article stays.`),

  trailing: (r) => T(`
THE SITUATION
A reader-mode extractor decided that the article ended earlier (it saw a marker such as a comments heading, a share bar or a short label) and is deleting everything after that point, including this block.

THE TEST
Does this block continue the article (same topic, the author's voice, full sentences), or is it closing material? Position on the page is weak evidence; what the block says decides.

KEEP (true)
- Analysis or argument that continues after a label: "The court's reasoning, however, raises a further problem: the order was made before the hearing." → true.
- A conclusion: "In short, the cheaper design held up just as well over five winters." → true.
- A quotation, example or reference entry that belongs to the article's own text → true.

REMOVE (false)
- "Share this: Facebook · X · Email" → false.
- "About the author: Priya writes about energy policy." → false.
- "3 responses to this post" or "Leave a reply. Your email address will not be published." → false.
- "You might also like: Ten winter soups · How to store herbs" → false.

LOOK-ALIKES
- "Thanks for reading! Subscribe for more." → false   vs   "The ruling therefore leaves the earlier precedent intact." → true.

PRINCIPLE: a paragraph that keeps making the article's point is part of the article wherever it sits.`),

  label: (r) => T(`
THE SITUATION
A reader-mode extractor is deleting this short line, and everything after it, because the line looks like the label that starts a comments, sharing or related-links area.

THE TEST
Look at state.text_after.
- If what follows is the author's own writing on the article's topic, this line is a SECTION HEADING of the article → true.
- If what follows is usernames, timestamps, "Reply" links, share buttons or headlines of other articles → false.
- If state.text_after is empty, judge the line alone: generic site words such as "Comments", "Share" or "Related posts" → false.

KEEP (true)
- "Analysis" followed by "The ruling narrows the earlier test in two ways…" → true.
- "Our view" followed by "The council's plan is cheaper than it looks…" → true.
- "Discussion" followed by "These results suggest the effect is seasonal…" → true.
Legal, academic and opinion writing often heads the author's own commentary with a one-word label; that label belongs to the article.

REMOVE (false)
- "Comments" followed by "anna_k · 2 days ago: Thanks for this!" → false.
- "Share" followed by "Facebook X Email" → false.

PRINCIPLE: a label is judged by what it introduces.`),

  metalist: (r) => T(`
THE SITUATION
A reader-mode extractor is about to delete this list because it looks like post metadata (date, author, tags, reading time).

THE TEST
Does the list continue the text just before it (state.text_before, or the text before ⟦ in state.context)? A sentence that ends with a colon and is completed by the list items makes the list part of the article.

KEEP (true)
- text_before "The script accepts three flags:" and the list "--fast, --safe, --verbose" → true.
- context "Supported formats: ⟦PNG JPEG WebP⟧" → true.

REMOVE (false)
- The list "March 3, 2024 · 5 min read · Food" just under the article's heading → false.
- "Tags: travel, Lisbon, food" → false.

PRINCIPLE: a list that finishes the author's sentence is content.`),
};

const GENERIC = {
  nav: ['site navigation: a menu, tab bar, breadcrumb trail, table of contents or pagination',
    ['A tab panel whose text is the article\'s abstract followed by its first section → true: the tab holds the article.', 'The numbered steps of a guide: "1. Unpack the kit 2. Attach the base 3. Level the frame" → true: the steps are the guide.'],
    ['"Home | Products | Pricing | Blog | Contact" → false: a menu.', '"Contents: 1 Background 2 Method 3 Results" → false: a table of contents.', '"‹ Older posts · Newer posts ›" → false: pagination.'],
    ['A list of link labels to other pages → false   vs   a list of steps or items the article explains → true.']],
  meta: ['post metadata: tags, categories, dates, reading time or like and share counts',
    ['A section holding the article\'s headings and paragraphs, even though a date or tag attribute is attached to it: "Water rights in the valley date back to 1902, when the first canal was dug…" → true.'],
    ['"Posted March 3, 2024 · 5 min read" → false.', '"Tags: travel, food, Lisbon" → false.', 'A short category label above the title, such as "Field notes" or "Release roundup" → false.', '"1.2k likes · 48 comments" → false.'],
    ['"Updated March 3, 2024 · 4 min read" → false   vs   "Updated on March 3, the bridge reopened to traffic on Friday." → true (a sentence of the news).']],
  related: ['links or cards that point to other articles (related, recommended or more stories)',
    ['A paragraph of the article that discusses related ideas: "Earlier models assumed a fixed rate; this study relaxes that assumption." → true.', 'A term that merely contains the word "related": "a related party transaction is one between a company and its director" → true.'],
    ['"You might also like: Ten winter soups · How to store herbs" → false.', 'A heading that introduces an author bio or a more-stories box, such as "About the writer" or "More from this section" → false.'],
    ['A box of headlines of other articles → false   vs   the article\'s own discussion of related work → true.']],
  comments: ['reader comments or a comment section',
    ['A section titled "Discussion" in which the author interprets the results → true.'],
    ['"Leave a reply. Your email address will not be published." → false.', '"anna_k · 2 hours ago — Great post, thanks!" → false.'],
    ['Text with usernames, timestamps and Reply links → false   vs   the author\'s own continuing analysis → true.']],
  promo: ['an advertisement, a sponsored message, or a request to subscribe, sign up, share or buy',
    ['Article paragraphs that sit inside an advertising slot\'s wrapper: "The council voted 7–2 to approve the budget, ending months of debate." → true: the wrapper\'s class is an accident.'],
    ['"Sponsored: try Acme Cloud free for 30 days" → false.', '"Subscribe to our newsletter for weekly updates" → false.', '"Share this article" → false.'],
    ['A box asking the reader to act → false   vs   reporting or explanation that merely sits in an ad-labelled container → true.']],
  hidden: ['content hidden from view',
    ['A collapsed section or an inactive tab whose text or code appears nowhere else on the page → true.'],
    ['A mobile-only copy of the site menu → false.', 'A "Copied to clipboard" tooltip or a dialog → false.', 'A duplicate rendering: visual math markup hidden from screen readers while another copy of the same formula exists, or a dark-mode copy of an image or code block → false.'],
    ['Hidden text that is the ONLY copy of a passage → true   vs   a hidden second rendering of something already visible → false.']],
  ui: ['an interface control such as a button, tooltip, dropdown or form',
    ['An expandable "Details" panel whose text continues the explanation → true.'],
    ['"Copy" → false.', '"Load more" → false.', '"Close" → false.'],
    ['A control label → false   vs   explanatory text that happens to sit inside a control → true.']],
  other: ['page clutter',
    ['A paragraph, heading, list or figure of the article → true.'],
    ['"Advertisement" → false.', '"Skip to content" → false.'],
    ['Site furniture → false   vs   the article\'s own text → true.']],
};
const genericBlock = (r, fam) => { const [desc, keep, rem, look] = GENERIC[fam] || GENERIC.other; return T(`
THE SITUATION
A reader-mode extractor is about to delete this block as ${desc}, because ${trigger(r)}.

THE TEST
The rule that fired looked at a surface cue. Ignore the cue and judge the block by its text (state.text), its size (state.words), how much of it is links (state.share_of_text_in_links) and the text around it (state.text_before, state.text_after, state.section_heading).

KEEP (true)
${keep.map(x => '- ' + x).join('\n')}

REMOVE (false)
${rem.map(x => '- ' + x).join('\n')}

LOOK-ALIKES
${look.map(x => '- ' + x).join('\n')}

PRINCIPLE: the article's own text stays, whatever its container is called.`); };

export function acquittalQuestionV2(r, fam) {
  if (isInline(r)) return { type: 'noul', instructions: INLINE(r), criteria: { true: 'The marked words are part of an article sentence: keep them', false: 'The marked words are page furniture beside the text: delete them' } };
  const instructions = BLOCK[fam] ? BLOCK[fam](r) : genericBlock(r, fam);
  return { type: 'noul', instructions, criteria: { true: 'Article content: keep the block', false: 'Page furniture or clutter: delete the block' } };
}
export function requestsForV2(r) {
  const fam = familyOf(r); if (!fam) return null;
  const inline = isInline(r);
  return { fam, inline, main: { state: inline ? inlineStateV2(r) : blockStateV2(r), questions: { acquit_v2: acquittalQuestionV2(r, fam) } } };
}
