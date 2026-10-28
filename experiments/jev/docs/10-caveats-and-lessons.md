# 10. Caveats, corrections and lessons

## 10.1 What the numbers can and cannot support

- **Small samples.** 18 open issues (42 wrongly-removed blocks, 69 clutter controls), 60 seen and 21 unseen historical wrongful removals. Differences of one to three cases between policies are within noise; the v1 → v2 gain on the unseen set (10 → 13, and 13 → 16 with the role question) is suggestive, not proven.
- **What was seen when.**

  | Artifact | Designed with knowledge of |
  |---|---|
  | v1 questions | the open-bug pages and their descriptions; not the history cases |
  | v2 questions | everything except the pre-March removed texts (their commit subjects had been visible) |
  | routing candidate (`v2_90_or_role90big_t`) | all four sets: post-hoc |

  The open bugs are a "seen-class" test for both question versions; the pre-March set is the only unseen test.
- **Synthetic pages.** Several open-bug pages are minimal reproductions built from the issue text (#460, #445, #444, #372, #346, #433, #408, #252, #321 have synthetic variants), often with placeholder or lorem text. Jev judging "A paragraph long enough to exceed the rule's ten-word limit, ending with links to our profile and our other posts." is not the same as judging a real article.
- **Labels are mechanical.** History labels come from shingle and in-context phrase matching against later expected outputs; "correct" means "absent from that commit's expected output", which includes bugs fixed only later. One- and two-character removals (math letters, footnote numbers) are noisy, hence the 3+-word columns.
- **Measurement artifacts.** Restored text that contains math is rendered as LaTeX and can be counted as lost (#428). Coverage thresholds (80% for W blocks, 50% for clutter leaks) are reasonable but arbitrary.
- **"Fixture changed" is not "regression".** Each changed fixture was judged by hand (chapters 6.5 and 7.7); one was an improvement (the expected output was wrong).
- **One model version.** Every number is for `jev-1.14.0`. Answers are cached, so re-scoring is deterministic, but re-asking can differ slightly (0.7% of decisions flip at 0.5 between identical calls).

## 10.2 Corrections made along the way

| # | Original claim | What was wrong | Corrected |
|---|---|---|---|
| 1 | Block dataset labels (phase 1) | `textContent` glued words across elements, breaking shingle matching | relabeled: 72 removed→kept, 20 mixed; block accuracy 83.7% → 87.6% |
| 2 | "Replacing heuristics would change 44% of currently correct pages" | counted any single disagreeing block, including title blocks the prompt told Jev to keep, extractor pages and 2-word fragments | withdrawn. Same answers, fair counts: 28% of pages without title/byline/date blocks, 25% also without extractor pages, 16% also without blocks under 16 words (chapter 4.2). With the factored role question and a title rule: 25% of all pages, 18% on the fair subset, 9% for blocks of 16+ words (chapter 4.5) |
| 3 | "A role veto at 0.9 fixes 9 of 18 open bugs" (block-level replay) | judged blocks in isolation; some content is lost outside removal steps or needs several acquittals | 7 of 18 end-to-end for the role question alone (chapter 6.3) |
| 4 | Early end-to-end runs | harness bugs (chapter 5.6): self-capture, script text, nested twins, duplicate retry-pass records, debug-mode baseline | all affected runs discarded and repeated |
| 5 | "#428's first line is lost" | it is restored but rendered as math | 4 of 6 lines recovered |

## 10.3 Lessons about using Jev

1. **Acquit, never remove.** Page text can push Jev toward "remove" on ~90% of real paragraphs with one sentence; toward "keep" almost never. Any design where Jev deletes content is unsafe; a design where it only keeps content fails toward leaked clutter.
2. **Never for security.** Enumerable checks belong in deterministic code; the model is injectable, non-deterministic and remote.
3. **Structure the question by type.** Exclusive categories on one axis go in one Choice (a coproduct); different axes (form vs purpose) must not share a list; form is computed in code; ask Choices in both option orders in the same request (free) and average.
4. **Give the right context.** Inline phrases need their sentence (7 vs 0 of 24 acquitted); whole-page context dilutes judgment (−4 to −5 points).
5. **Write prompts like good tool documentation.** Situation, literal test, criteria with examples and reasons, look-alikes, principle. Examples that name the trap work (#252, #257); examples can also backfire (the restaurant menu).
6. **Mind calibration.** The bundled Noul's best threshold was ~0.25, not 0.5; compare designs at tuned thresholds too.
7. **Code owns what code knows.** Titles, duplicates, size, form, math renderings, policy elements.
8. **Measure end-to-end.** Block-level agreement overstated real fixes; only replaying Defuddle with the decisions applied shows cascades, retries and nested removals.
9. **Keep a held-out set.** Old git history is a rich source of real, labeled false removals: every fix commit that changed an expected output marks one.

## 10.4 Working preferences learned from the user

- Claims must come with the exact prompts and data behind them; expect them to be checked.
- Design Jev questions as coproducts plus booleans, never one bundled yes/no.
- Write Jev instructions in the style of `McpMessages.kt` / `mcp-docs-combined.md`.
- Explain what a multi-agent workflow buys before launching one; prefer direct scripts for mechanical experiments.
- Keep experiment artifacts in this repo, not in temporary directories.
