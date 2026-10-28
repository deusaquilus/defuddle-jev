# 4. Phase 2: prompt audit and the coproduct redesign

Two challenges from the user drove this phase: "I DO NOT believe you" about the claim that replacing the heuristics would change 44% of pages, and "Aren't at least SOME of these mutually exclusive … coproducts". Both were right in substance.

Files: [`../lab/prompt-audit/`](../lab/prompt-audit/) (exact prompts, page-level recomputation), [`../lab/coproduct/`](../lab/coproduct/) (factored design, analyses, raw answers), [`../lab/exp-known-failures/experiment-role.mjs`](../lab/exp-known-failures/experiment-role.mjs) and `results-role.jsonl` (veto replay with the new question).

## 4.1 The exact phase-1 prompt

Every block was one request; only `state` changed. Literal body for one block (also in `lab/prompt-audit/block-request-example.json`):

```json
{
  "model": "jev-1.14.0",
  "state": "<footer><p>© 2025 Example University</p></footer>",
  "questions": {
    "keep": {
      "type": "noul",
      "instructions": "Should this block be kept in a clean reader-mode view of the page's main article? Keep = it is part of the article's own body text, headings, images/figures, code, tables, quotes or footnotes. Do not keep = site navigation, ads, promotions, newsletter/subscribe or sign-in prompts, social sharing, related/recommended/more-stories links, comment sections, cookie/consent banners, author bylines, dates, tags/categories, breadcrumbs, read-time, or other page boilerplate.",
      "criteria": {
        "true": "Keep: the block is part of the article's own content",
        "false": "Do not keep: the block is navigation, promotion, metadata, comments or other page boilerplate"
      }
    },
    "kind": {
      "type": "choice",
      "instructions": "What kind of block is this, in the context of a web page that contains an article? Judge only from what is literally in the block.",
      "criteria": {
        "article_body": "Prose paragraphs, lists or quotes that are part of the article's own text",
        "heading": "A heading or title line of the article or one of its sections",
        "media_or_figure": "An image, figure, caption, video or audio embed that belongs to the article",
        "code_or_table": "A code block, code listing, or data table that belongs to the article",
        "footnotes_or_references": "Footnotes, citations, endnotes or a references list belonging to the article",
        "navigation_or_menu": "Site navigation, menus, breadcrumbs, skip links, table of contents, pagination or previous/next links",
        "promo_or_cta": "Advertisement, promotion, newsletter or subscribe prompt, sign-in prompt, app download or other call to action",
        "related_links_or_cards": "Related, recommended, popular, trending or more-stories links and article cards",
        "comments": "A comment section, comment thread or individual user comments and their headers",
        "byline_or_metadata": "Author byline, author bio, publish date, read time, tags, categories, share counts or similar page metadata",
        "cookie_or_consent": "Cookie, privacy or consent banner or notice",
        "other": "None of the above, or not enough information to tell"
      }
    }
  }
}
```

All other phase-1 prompts (veto replay, injection check, clutter-phrased Noul, keep/remove Choice in both orders, context-dilution variant, main-container Choice, the decomposed probe, the security detector) are reproduced verbatim in [`../lab/prompt-audit/ALL_PROMPTS.md`](../lab/prompt-audit/ALL_PROMPTS.md).

## 4.2 Where "44%" came from, and the recomputation

"44%" was 1 − 125/223: the share of fixture pages where **at least one** block disagreed with Defuddle's reviewed output, using the corrected labels and the HTML state at p = 0.5. Recomputed from the saved answers with no new calls (`lab/prompt-audit/pagelevel.mjs`):

| What is counted | Pages fully agreeing | Pages with ≤ 1 disagreement | Block accuracy |
|---|---|---|---|
| A. Every block, as reported | 125/223 (56.1%) | 86.1% | 87.6% |
| B. Without title, byline and date blocks | 160/223 (71.7%) | 88.3% | 91.4% |
| C. Also without site-extractor pages (X, Gmail, Reddit…) | 156/207 (75.4%) | 90.3% | 92.9% |
| D. Also without blocks under 16 words | 151/179 (84.4%) | 98.9% | 96.0% |

What inflated the number:
- **The prompt contradicted Defuddle's policy.** It said "keep headings", but Defuddle removes the title heading because the title goes into metadata. Jev obeyed and was scored wrong.
- **One block sinks a page.** The LessWrong fixture has 213 blocks.
- **Fragments judged blind.** Blocks under five words without the surrounding page are about a third of the remaining disagreements.
- **Mixed blocks.** One 256-word block held title, date and body; labeled keep; Jev 0.43.
- **The answer key has errors.** Of 16 confident remaining disagreements hand-checked: Jev right 9, Defuddle right 3, ambiguous 4.

Weaknesses of the prompt itself: about twenty conditions in one yes/no (against the brief's one-judgment rule); raw HTML with class names (one block scored 0.11 with its `id="tags"` and 0.89 as plain text); no decomposed version had been tested on the fixtures. Rewordings tested on 150 blocks (keep Noul, clutter Noul, keep/remove Choice in both orders) all scored 80–82%, but all reused the same bundled definition.

## 4.3 The coproduct critique

The 12 `kind` options were already a single Choice (a coproduct). The real defect was that the list mixed **two axes**:

- **Form** (what the block is): prose, heading, media, code or table, footnotes. Exclusive by dominant element.
- **Purpose** (what it is for): navigation, promotion, related links, comments, metadata, consent. Exclusive by main purpose.

Across axes nothing is exclusive. Measured on the saved answers (`lab/coproduct/split.mjs`): on 51 of 1,455 blocks (3.5%) the second-highest option sat on the other axis with p ≥ 0.2, and on those blocks the error rate was **29.4%**, vs **10.8%** elsewhere. Examples: a heading "ABOUT THE AUTHOR" got 0.51 heading / 0.49 metadata; "For More on This Topic" 0.53 heading / 0.39 related links. The user's proposed grouping (code, media and promo in one coproduct) mixes axes the same way: an ad banner is both an image and a promotion.

Converting the 12-way answer into a keep score (sum of the five content options) already beat the bundled Noul at p = 0.5 (88.7% vs 87.6%; 91.5% vs 90.3% with a code-side title rule), though the Noul ranked better (AUROC 0.891 vs 0.840).

## 4.4 The factored design

Script: [`../lab/coproduct/factored.mjs`](../lab/coproduct/factored.mjs); question JSON: `lab/coproduct/questions.json`.

- **Purpose:** one Choice, `role`, with eight options including an escape: `article_content`, `site_navigation`, `promotion_or_call_to_action`, `links_to_other_articles`, `reader_comments`, `author_or_publication_metadata`, `site_footer_or_legal_notice`, `other`. Asked **in both option orders in the same request** (`role_fwd`, `role_rev`) and averaged, which neutralizes order bias at no extra calls. Instruction: "What is the main purpose of this block on its web page? Pick the one role that covers most of the block's text. A heading takes the role of the section it introduces. Judge only from what is in the block."
- **Five literal yes/no cues:** `has_article_prose`, `asks_reader_to_act`, `metadata_only`, `mostly_links_elsewhere`, `written_by_reader`.
- **Form** is computed in code from tags and never asked.
- **Title:** a code rule (Defuddle already knows the title).
- **Two state arms:** A = block HTML; B = text plus code-computed form facts.
- **Run:** all 1,475 blocks × 2 arms, 2,940 calls, $0.16.

## 4.5 Results

Code title rule applied to every row (`lab/coproduct/analysis.txt`, `tuned-pages.mjs`):

| Design | Blocks right, all | Blocks right, fair subset* | Pages fully agreeing, all | Pages fully agreeing, fair subset |
|---|---|---|---|---|
| Bundled keep Noul | 90.3% | 92.9% | 70.0% | 75.4% |
| 12-way kind list | 91.5% | 93.7% | 70.9% | 77.8% |
| **Role coproduct (arm A)** | **92.4%** | **94.7%** | **75.3%** | **82.1%** |

\* fair subset = without title/byline/date blocks and without site-extractor pages.

Read the other way: with the role question and a title rule, 25% of all pages have any difference, 18% of fair-subset pages, and 9% when only blocks of 16+ words count (91.1% of those pages fully agree, vs 84.4% for the bundled Noul).

- With each design's threshold tuned on held-out pages, all three converge to about 81% of fair-subset pages fully agreeing: the gain is **calibration** (the bundled Noul leaned toward "remove"; its best threshold sat near 0.25), not discrimination.
- The five cue Nouls alone scored 76–85% and added nothing at 0.5 (a regression over all answers improved ranking but not accuracy).
- Arm B (text plus form facts) was no better than HTML.
- Role argmax changed between option orders on 2% of blocks.

## 4.6 Veto replay with the role coproduct (block-level)

Same 18 issues as phase 1; the role question was not tuned on these pages (`lab/exp-known-failures/sweep-compare.mjs`):

| Veto rule | Issues fixed (of 18) | Lost words recovered (of 19,043) | Clutter re-inserted (of 69) |
|---|---|---|---|
| Old bundled Noul, P ≥ 0.9 | 1 | 1,752 | 0 |
| Old bundled Noul, P ≥ 0.7 | 8 | 18,826 | 0 |
| **Role coproduct, P(article_content) ≥ 0.9** | **9** (#257 #279 #360 #365 #375 #395 #433 #441 #460) | 18,880 | 0 |
| Role coproduct, P ≥ 0.8 | 10 | 18,887 | 1 |

On the fixture corpus, a 0.9 role veto would restore 11 of 150 step-removed blocks, mostly 2–6-word fragments (citation back-links, line-number gutters); a 20-word floor cuts that to 1 (a Wikipedia infobox) but also cuts the fixes to 6 of 18.

**Later correction:** this replay judged blocks in isolation. Measured end-to-end (chapter 6), the role question alone fixes **7** of 18, not 9: #433's footnote is lost in standardization, #445's label stays removed, and #257's outer wrapper needs a second acquittal.

## 4.7 The nine bugs still unfixed after this phase

#134 (card grids of docs links), #252 (author-name links), #321 (`id="tags"` section), #346 (lost in standardization), #372 (inline links removed as breadcrumbs), #408 (nested list removed as metadata), #428 (short instructions containing "register"), #444 (defined term matched by `related`), #445 (the "Comment" label and what follows). These motivated the reason-specific acquittal of chapters 5–6.
