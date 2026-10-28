# 7. Phase 4: prompts in the user's documentation style (v2)

## 7.1 The request

> CAN THIS NOT BE SOLVED WITH BETTER EXAMPLES IN THE PROMPT TO JEV. I want you to have a look at McpMessages in ~/git/kotlin-compiler-server and the mcp-docs-combined pages. I want you to UNDERSTAND HOW I use descriptions with interspersed examples to IMPROVE your prompts to Jev to see if we can make REAL GAINS by you adopting my style.

Reference files (in the user's other repository, not copied here):
- `~/git/kotlin-compiler-server/src/main/kotlin/com/compiler/server/mcp/McpMessages.kt`: 1,739 lines of MCP tool and parameter descriptions for ExoBench.
- `~/git/kotlin-compiler-server/src/main/resources/mcp-docs-combined.md`: 4,157 lines in 18 `<!--- FILE: … --->` sections served by `getMcpDocs` (overview, choosing a benchmark tool, common benchmark mistakes, endpoint query mix, benchmark-sql, and others).

## 7.2 What the style is

Read in full (McpMessages) and by section (mcp-docs-combined). The recurring elements:

| Element | How it appears there |
|---|---|
| **The idea first, grounded in one instance** | "An endpoint does not run 'a query'. It runs one SQL statement shape, over and over…" followed immediately by `getClientProductByType(clientId, productType, namePrefix)` and the SQL it becomes. |
| **Examples next to the rule, never in a pile at the end** | Each pattern ("Basic row count:", "FK relationship (orders reference customers):", "Percentage-based skew:") is followed by its one-line example. |
| **WRONG / RIGHT with the mechanism** | "WRONG — fixed start date with relative filter … This breaks silently over time: in 2025, 18 months ago is mid-2023, but your data ends in 2024…" then "RIGHT — anchor data to NOW()". |
| **Problem / Fix pitfalls, numbered** | "Common Benchmark Mistakes": each with the concrete failing input, why it fails, and the fix. |
| **"The general principle:"** | one line that generalizes the examples ("if your filter is relative to NOW(), your data must be too"). |
| **Look-alikes that differ in one detail** | "Data skew and traffic skew are two decisions"; "ANALYZE updates statistics but NOT the visibility map". |
| **Loud markers for silent failures** | `CRITICAL`, `IMPORTANT`, `⚠️ … READ THIS FIRST`, capitalized `MUST`/`NEVER`. |
| **Symptom linked to cause** | "Common error: Table "USER" not found, means you wrote CREATE TABLE User but queried "User"." |
| **Mapping tables and decision trees** | "In the application → In the benchmarkSql call"; an ASCII tree for choosing a tool. |

The v1 Jev prompts had none of this: one instruction sentence, then bare example strings with no reasons and no look-alikes.

## 7.3 The v2 questions

[`../lab/acquittal/questions-v2.mjs`](../lab/acquittal/questions-v2.mjs), frozen before any fresh case was inspected: sha1 `5e4197011ff6760a1ccec02df7123c154de3afbf`, 2026-10-28T06:08:23Z. Same triggers and routing as v1; only instructions (and one state field) changed.

Each question has the same sections:

- **THE SITUATION:** what the extractor is about to do and **which rule fired**, in words (e.g. "because a class, id or attribute contains the pattern "footer"", "because it matched the CSS selector "[data-date]"").
- **THE TEST:** a literal procedure Jev can apply ("Read state.context twice: once as written, once with the marked words removed…").
- **KEEP (true)** and **REMOVE (false):** each criterion with an invented example and the reason it is on that side.
- **LOOK-ALIKES:** pairs that differ only in the deciding detail.
- **IMPORTANT / PRINCIPLE:** the trap named explicitly, and a one-line rule.

Block states gained one code-computed fact, `share_of_page_words`. Specialised texts exist for `author`, `chrome`, `score`, `trailing`, `label`, `metalist`; the other families share a generic template with family-specific KEEP/REMOVE/LOOK-ALIKE lists. Full texts: [appendix B](appendix-b-acquittal-prompts.md). The inline question, as sent for #372:

```text
THE SITUATION
A reader-mode extractor is about to delete the words marked ⟦like this⟧ from inside the text in state.context, because a text pattern matched it ("section breadcrumb"). Deleting words from inside an author's sentence leaves a broken sentence, so the deletion is only right when the marked words are page furniture sitting NEXT TO the text, not part of it.

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
PRINCIPLE: never punch holes in an author's sentence.
```

Rule followed when writing examples: invented text only, never text from the bug pages, history cases or fixtures. The examples were nonetheless informed by the *classes* of the open bugs (self-referential in-sentence links, lists of people, article-sized wrappers with a footer class), which is exactly what the user asked for; the fresh set below measures whether that generalizes.

## 7.4 The fresh test set

Built after v1's results had been seen, to have cases no prompt was written against: 42 commits before 2026-03-06, replayed under JSDOM with stack-detected steps (chapter 5.5). **21 wrongful removals, 402 correct removals.** Their texts were first looked at after v2 was frozen and evaluated.

## 7.5 Results

All end-to-end; every row from appendix C.

| Policy | Open bugs fixed /18 | **Unseen history recovered /21** | History 3+ words /40 | Fixture outputs changed /226 | Unseen correct removals restored /402 | History correct restored /537 | Bug-page clutter leaked /69 |
|---|---|---|---|---|---|---|---|
| Role coproduct ≥ 0.9 | 7 | 7 | 29 | 10 | 5 | 5 | 0 |
| v1 ≥ 0.9 | 8 | 10 | 29 | 8 | 9 | 6 | 1 |
| **v2 ≥ 0.9** | 7 | **13** | 29 | **5** | 8 | 6 | 0 |
| v2 ≥ 0.8 | 10 | 17 | 34 | 8 | 11 | 14 | 0 |
| v1 ≥ 0.9 OR role ≥ 0.9 | 10 | 13 | 34 | 13 | 9 | 9 | 1 |
| **v2 ≥ 0.9 OR role ≥ 0.9** | **11** | **16** | 34 | 13 | 9 | 9 | 0 |
| v2 ≥ 0.8 OR role ≥ 0.9 | 12 | 17 | 36 | 15 | 11 | 16 | 0 |
| v2 ≥ 0.9 OR (role ≥ 0.9 AND 20+ words), title rule | 10 | 16 | 31 | **5** | 8 | 6 | 0 |

- **v2 generalizes.** On the unseen set, at the same 0.9 threshold, v2 recovers 13 of 21 vs v1's 10, with one fewer correct removal restored (8 vs 9). Combined with the role question: 16 vs 13, same 9.
- **v2 is more precise on fixtures.** v2 alone changes 5 fixtures vs 8 for v1.
- **Open bugs:** 11 of 18 with the role question (#252 #257 #279 #321 #360 #365 #375 #395 #441 #444 #460), 12 at 0.8 (adds #408), zero clutter leaked on bug pages.

## 7.6 Where the style moved Jev, and where it did not

Scores on the wrongly-removed blocks of the open bugs:

| Bug | v1 score | v2 score | Outcome |
|---|---|---|---|
| #252 author names in a list | 0.87, 0.88 | 0.95, 0.95 | fixed: the "list of people vs byline" look-alike |
| #257 article in a footer-classed wrapper | 0.88 | 0.95 | fixed: "real footers are short; judge by size" |
| #445 paragraphs after the label (synthetic / live) | 0.36, 0.37 / 0.78, 0.73 | 0.92, 0.80 / 0.95, 0.89 | the trailing question now works (the role question already did) |
| #445 the "Comment" label itself | 0.25 / 0.20 | 0.09 / 0.08 | worse: with the following text already removed, the label is judged alone and generic labels are told to be false |
| #372 inline links | 0.46, 0.33 | 0.58, 0.40 | better, not enough |
| #134 docs landing cards | 0.19–0.46 | 0.23–0.29 (the "what's new" card 0.43 → 0.73) | unmoved |
| #428 short steps with "register" | 0.82–0.98 | 0.86–0.97 | the two failing lines rise to 0.86–0.88, still under 0.9 |
| #408 nested list (synthetic) | 0.90 | 0.83 | drops below 0.9 (fixed at 0.8) |

On the unseen set, v2 (with the role question) additionally recovered three in-sentence category links ("Web Development", "JavaScript", "Tutorials", a #131-type bug) and a 12,967-word article body hidden with `[hidden]`; it lost one case v1 had: a restaurant menu page (`#menu`, "Appetizers Spring rolls…"), where the "menus mean remove" example backfired.

## 7.7 What leaked, honestly

- **Real clutter:** KaTeX's hidden visual math renderings (restored mostly via the role question, partly via v2's hidden-inline question), page titles in `h1` (role question, 0.995–1.0), the Wikipedia infobox (policy), a "Command Line" tab label, an author handle (v2, hidden family), a fixture sentence that literally says "This delimited widget id should still be removed" (v2).
- **Not clutter, but counted as leaks:** several "correct removals" in the history sets are bugs that a later commit fixed. Restored texts include the Figma paragraph of #112, the "Appendix: Quasi-simulators" heading of #107, the "TAI" topic link and "in subsequent usage". The leak columns therefore overstate the clutter cost a little.
- **Catchable in code:** titles (title rule), KaTeX/MathJax renderings (never acquit hidden elements inside math containers), infoboxes (policy flag).

## 7.8 Can better examples fix the rest?

Partly, and the remaining cases should not be chased with examples:

- #252 and #257 were fixed by examples that name the trap.
- #372 moved from 0.46 to 0.58. Pushing it over 0.9 would take an example that mirrors the test sentence, which proves nothing. It is better fixed in code: the synthetic page itself says the paragraph is "long enough to exceed the rule's ten-word limit", i.e. the breadcrumb rule misfires on a paragraph longer than its own limit (compare commit 368cb3b, "Remove breadcrumb matching if p contains content").
- #134 is a judgment call where Jev and Defuddle agree.
- #445's label needs its section: ask after the following paragraphs are restored (the loop does this) and change the label question so an empty `text_after` does not default to "false".
- #346 and #433 are out of reach of any acquittal.

## 7.9 The routing candidate

`v2 ≥ 0.9 OR (role ≥ 0.9 AND 20+ words)`, plus the title rule, chosen **after** seeing these results:

| Open bugs | Unseen history | Seen history 3+ words | Fixtures changed | Unseen restored | Bug clutter leaked |
|---|---|---|---|---|---|
| 10 /18 | 16 /21 | 31 /40 | 5 /226 | 8 /402 | 0 /69 |

It keeps the full combination's unseen recovery at half the fixture changes, losing #395 (short table-header rows) relative to the full OR. It is the starting point for the build (chapter 8), and needs fresh validation because it was selected on this data.
