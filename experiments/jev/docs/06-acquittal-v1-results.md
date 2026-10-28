# 6. Phase 3 results: reason-specific acquittal questions (v1)

## 6.1 Triggers: which question is asked for which removal

[`../lab/acquittal/questions.mjs`](../lab/acquittal/questions.mjs), function `familyOf(record)`, maps every removal to the clutter type Defuddle suspects:

| Removal | Trigger family |
|---|---|
| `removeHiddenElements` | `hidden` |
| `scoreAndRemove` | `score` |
| `removeEyebrowLabel` | `meta` |
| content pattern "trailing non-content", "trailing thin section" | `trailing` |
| content pattern "boilerplate text" (e.g. a lone "Comment" line) | `label` |
| content pattern "blog metadata list" | `metalist` |
| content patterns about breadcrumbs or tables of contents | `nav` |
| content patterns about related content or external link lists | `related` |
| content patterns about CTAs, newsletters, promotional banners | `promo` |
| content patterns about author bylines or contact blocks | `author` |
| content patterns about dates, read time, metadata headers, categories, counters | `meta` |
| selectors mentioning author, byline, avatar, profile | `author` |
| selectors mentioning tags, categories, metadata, dates | `meta` |
| selectors mentioning related, recommend, more-, card, popular | `related` |
| selectors mentioning comment, disqus, reply | `comments` |
| selectors mentioning ad, sponsor, promo, marketing, subscribe, share, social, consent, cta | `promo` |
| selectors mentioning nav, menu, breadcrumb, dropdown, tabs, toc, pagination, sidebar | `nav` |
| selectors mentioning footer, header, pagehead, hero, banner, logo, title | `chrome` |
| selectors mentioning button, form, tooltip, dialog | `ui` |
| `[hidden]`, `aria-hidden` selectors | `hidden` |
| anything else with text | `other` |

**Never asked** (code decides): removals with no visible text; `script`, `style`, `noscript`, `template`, `meta`, `link`, `input`, `svg`, `iframe`, `select`, `textarea`, media and `br`/`hr` elements; reference furniture (`mw-editsection`, cite back-links, footnote back-links, LaTeXML bibitem tags, copy buttons, loading spinners, error widgets); duplicate title and description patterns.

**Inline vs block:** a removal is treated as an **inline phrase** when the element is inline and its containing block has at least three other words. Inline phrases are judged with the containing sentence (`⟦marked⟧` context); blocks are judged by their text, size, link share, siblings and section heading.

## 6.2 The v1 questions

Frozen before any historical case was inspected: `questions.mjs` sha1 `aa4a88e413814db9e3750e77a7cc7e80b6c36028`, 2026-10-28T04:50:10Z. Exact prompts with real example records are in [appendix B](appendix-b-acquittal-prompts.md). The shapes:

- **Inline:** "A reader-mode extractor is about to delete the phrase marked between ⟦ and ⟧ in state.context because it looks like {suspected type}. Is the marked phrase part of a sentence of the article, so that deleting it would leave that sentence with missing words? Answer false if the phrase stands on its own as a label, link list, byline, tag or button rather than inside an article sentence." Followed by 3 invented true examples and 3 invented false examples for that family.
- **Block:** "A reader-mode extractor is about to delete this block because it looks like {suspected type}. Do not judge from how the block is labeled; judge from its text (state.text) and the text around it. Is the block part of the article itself … rather than {short type}?" plus invented keep/delete examples.
- **Specialised blocks:** `trailing` (does the block continue the article's own text), `label` (is this line the heading of a section the author wrote, using `state.text_after`), `metalist` (does the list complete the sentence before it).

Variants asked in the same request (batching is free): **with examples** (`ex`), **without examples** (`plain`); for inline phrases also a **phrase-only** request with no sentence context. The role coproduct of chapter 4 was asked for every removal as well.

## 6.3 End-to-end results (frozen design)

Full table, including every policy and per-case detail: [appendix C](appendix-c-results.md).

| Policy | Open bugs fixed /18 | History wrongful recovered, 3+ words /40 | Fixture outputs changed /226 | History correct removals restored /537 | Bug-page clutter leaked /69 |
|---|---|---|---|---|---|
| Role coproduct ≥ 0.9 | 7 | 29 | 10 | 5 | 0 |
| v1 with examples ≥ 0.9 | 8 | 29 | 8 | 6 | 1 |
| v1 without examples ≥ 0.9 | 7 | 27 | 8 | 7 | 1 |
| v1, inline phrases without context ≥ 0.9 | 7 | 27 | 8 | 6 | 1 |
| v1 with examples ≥ 0.95 | 5 | 25 | 4 | 3 | 0 |
| v1 with examples ≥ 0.8 | 11 | 31 | 13 | 14 | 1 |
| v1 ≥ 0.9 AND role ≥ 0.5 | 5 | 28 | 5 | 2 | 0 |
| **v1 ≥ 0.9 OR role ≥ 0.9** | **10** | **34** | **13** | **9** | **1** |
| same, plus title rule | 10 | 33 | 11 | 8 | 1 |
| v1 ≥ 0.8 OR role ≥ 0.9, plus title rule | 12 | 33 | 15 | 15 | 1 |

Open bugs fixed by `v1 ≥ 0.9 OR role ≥ 0.9`: #279, #321, #360, #365, #375, #395, #408, #441, #444, #460. Three of the nine left over from chapter 4 (#321, #408, #444) were fixed by the reason-specific questions.

**Correction to chapter 4:** the role coproduct alone fixes 7 open bugs end-to-end, not the 9 the block-level replay suggested.

## 6.4 What the ablations show

Per-trigger rates on round-0 removals (cached answers, `family-stats.mjs`; full table in appendix C):

| Trigger | Wrongful removals | Acquitted at 0.9: v1 with ex / without / role | Correct removals | Wrongly acquitted: v1 with ex / without / role |
|---|---|---|---|---|
| trailing (block) | 19 | 8 / 7 / **17** | 10 | 0 / 0 / 4 |
| score (block) | 15 | 6 / 5 / 9 | 71 | 2 / 1 / 3 |
| hidden (block) | 11 | 11 / 11 / 11 | 70 | 2 / 2 / 4 |
| other (inline) | 10 | 2 / 2 / 4 | 9 | 0 / 0 / 0 |
| chrome (block) | 8 | 6 / 6 / 7 | 159 | **21** / 14 / 25 |
| hidden (inline) | 7 | 1 / 1 / 0 | 67 | 3 / 5 / **27** |
| metalist (block) | 3 | 3 / 3 / 0 | 3 | 1 / 1 / 0 |
| related (inline) | 2 | 2 / 1 / 0 | 0 | 0 / 0 / 0 |
| nav (inline) | 2 | 0 / 0 / 0 | 2 | 0 / 0 / 0 |
| author (block) | 4 | 0 / 0 / 0 | 21 | 0 / 0 / 0 |
| **all** | **104** | **53 / 47 / 60** | **717** | **45 / 38 / 75** |

- **Sentence context is essential for inline phrases.** With context, 7 of 24 wrongful inline removals were acquitted; with the phrase alone, none (and 3 vs 0 of 100 correct ones).
- **Examples help a little.** 53 vs 47 of 104 wrongful removals acquitted, at 45 vs 38 false acquittals; end-to-end +1 open bug, +2 historical cases.
- **A specific question can lose to the generic one.** On paragraphs cut after a supposed article end, the v1 trailing question caught 8 of 19; the role question 17.
- **Site chrome and hidden inline elements are where the leaks come from:** titles in headers, and (for the role question) KaTeX's hidden visual math renderings.

## 6.5 What the clutter cost actually is

The 11 fixtures changed by `v1 ≥ 0.9 OR role ≥ 0.9` plus the title rule, judged one by one:

- **About seven regressions**, all short: an "ABOUT THE AUTHOR" heading, two category/eyebrow labels ("Blog post", "Off-nominal"), "Interactive graph", stray "References" headings (two fixtures), a page-title fragment, a hero caption fused with the title.
- **One improvement:** a Wikipedia body sentence ("In particular, the framework has proven useful…") that Defuddle removes as a "thin CTA section" and Jev keeps at 0.99. The expected output is wrong here.
- **Three ambiguous:** a book note on a footnotes page, an in-article cross-reference sentence, a Wikipedia infobox (Defuddle removes infoboxes by policy).

Most restorations do not change any output at all (the title is later removed by the duplicate-title step, for example), which is why "restored" counts are much larger than "changed".

## 6.6 Why the remaining open bugs stayed unfixed (v1)

| Bug | What the acquittal saw | v1 score | Reason |
|---|---|---|---|
| #372 inline links | "…ending with links to ⟦our profile⟧ and our other posts." | 0.46, 0.33 | Jev reads the phrase as self-promotion |
| #252 author names | list items "Grady Booch", "Erik Meijer" between other names | 0.87–0.89 | just under 0.9 |
| #257 article in a footer-matched wrapper | 13,796 words starting "Advanced Search …" | 0.88 | just under 0.9 (the inner `tabs-` wrapper got 0.97) |
| #134 docs landing cards | "🎓 Learning Start with step-by-step tutorials…" | 0.19–0.46 | Jev agrees with Defuddle that these are navigation |
| #445 "Comment" label | one-word line; at removal time the following paragraphs are already gone | 0.20 | label judged without its section; v1 trailing question weak on the paragraphs (0.36–0.78) |
| #428 short steps with "register" | "Use the cash register carefully." etc. | 0.82–0.85 on two lines | under 0.9; a third line is restored but rendered as math |
| #346, #433 | — | — | lost in standardization, unreachable |

## 6.7 Workflow note

This phase was run entirely with scripts (no multi-agent workflow), after the user asked what a workflow would be for. The Jev cost of all v1 runs was a few cents; most time went into harness correctness (chapter 5.6).
