# 5. Phase 3 infrastructure: the end-to-end acquittal harness

## 5.1 The idea being tested

The user's proposal ("LAST LEVEL ACQUITTAL"): when Defuddle is **about to remove** an element, it already knows **why** (a selector, a text pattern, a low score, a hidden style). Ask Jev a **secondary question specific to that reason**, with examples of the known false-positive cases for that reason, and keep the element only if Jev is confident it is article content. Jev never removes anything; it can only acquit.

Testing this honestly needs more than block-level scoring: an acquittal changes the DOM, which changes what later steps do (scoring, retries, nested removals). So the harness re-runs Defuddle with the acquittals applied and scores the real output.

Everything is in [`../lab/acquittal/`](../lab/acquittal/). No Defuddle source was modified; the harness hooks the compiled build at run time.

## 5.2 How capture works

[`harness.mjs`](../lab/acquittal/harness.mjs), function `capture(api, html, url, opts, decide)`:

1. **Hook `remove()`.** linkedom's `Element.prototype.remove` (found by walking the prototype chain of a probe element) is wrapped once per process. Every removal step in Defuddle ends with `el.remove()`.
2. **Hook removal records.** In debug mode each removal step pushes `{ step, reason, selector?, text }` onto a `debugRemovals` array right before calling `remove()`. `Array.prototype.push` is wrapped (only while a capture is running) to queue any pushed object of that shape, together with the identity of the array (one array per retry pass).
3. **Pair them.** When `remove()` fires, the queued record whose `text` equals Defuddle's own `textPreview(el)` (`textContent.trim().substring(0, 200)`) is paired with the element. Re-entrancy is guarded so the harness's own bookkeeping never triggers the hooks.
4. **Describe the element before it disappears** (`describe(el)`): tag, id, class, attribute names, inline or block, visible text (scripts and styles excluded, block boundaries spaced), word count, cleaned HTML (scripts removed, SVG emptied, long attribute values cut, capped at 4,000 chars), link density, links, what it contains (heading, paragraph, list, image, code, table), the **marked context** (the text of the nearest block ancestor with the element shown as `⟦…⟧`, ±400 chars), previous and next sibling text, nearest preceding heading, the element's share of the page's words, and a DOM path.
5. **Exact selectors.** For `removeBySelector` records with selector `exact`, the matching entries of `EXACT_SELECTORS` are recomputed with `el.matches()`.
6. **Orphans.** If an ancestor was already removed in this run, the record is flagged `orphan` (its fate follows the ancestor).
7. **Final pass.** A record belongs to the output-producing pass if its object is in `result.debug.removals`.
8. **Fingerprint.** `step | tag | sha1(text)[:12] | sha1(marked context)[:8]`. It is identical in debug capture and normal-mode replay.
9. **Acquit.** If `decide(fingerprint)` returns true, the original `remove()` is skipped.

`replay(api, html, url, decide)` runs Defuddle in **normal** (non-debug) mode, which is what the fixture tests compare. Without debug records it detects removal steps from the call stack (`removeBySelector`, `scoreAndRemove`, `removeHiddenElements`, `removeEyebrowLabel`, `removeByContentPattern`) and skips removals whose fingerprint is acquitted.

`captureNoDebug()` does the same for builds that predate debug removal records (before 2026-03-06): steps come from the stack, and the rule that fired is recomputed from that build's own `EXACT_SELECTORS`, `PARTIAL_SELECTORS` and `TEST_ATTRIBUTES`.

## 5.3 Validation

[`validate.mjs`](../lab/acquittal/validate.mjs), no API calls, ~20 s:

| Check | Result |
|---|---|
| Removal records captured for the final pass | 1,937 of 1,938 |
| Replay with no acquittals reproduces `tests/expected/*.md` (same normalization as `tests/fixtures.test.ts`) | 226 of 226 |
| Fingerprints seen in debug capture that reappear in normal-mode replay | 2,818 of 2,818 |

[`check-nodebug.mjs`](../lab/acquittal/check-nodebug.mjs) compared `captureNoDebug` with `capture` on the current build: 1,211 removals found by both, 0 missed, 13 extra (removals inside steps that never write a record, e.g. `<hr>` around a table of contents); selector attribution agreed on 1,045 of 1,048.

## 5.4 The end-to-end loop

[`run-policies.mjs`](../lab/acquittal/run-policies.mjs), `runPage()` per page and policy:

1. Capture with the current acquittal decisions (debug mode, or `captureNoDebug` for old builds).
2. Take every **new** non-orphan removal (unique fingerprint). For removals with a trigger family (chapter 6), fetch all answers (v1 with and without examples, v1 phrase-only for inline phrases, v2, role coproduct); answers are cached on disk by `sha1(model, state, questions)` in `jev-cache.jsonl`.
3. Apply the policy (e.g. `v2 ≥ 0.9 OR role ≥ 0.9`), then the code rules:
   - **Duplicate guard:** never restore text of 8+ words that is already ≥ 80% present in the current output.
   - **One copy:** among identical texts restored in the same round, keep one, unless the elements are nested (an ancestor and its descendant share text).
   - **Title rule** (only in `_t` policies): never restore an element whose text equals or begins with the page title, or a heading contained in the title.
4. Repeat until no new removals appear (at most five rounds). New removals appear when an acquitted parent exposes its children to later steps.
5. Replay once in normal mode with all decisions and score the output.

## 5.5 Test sets

### Fixtures (226)
Current build, all removals as captured (`removals-fixtures.jsonl`). Every fixture removal is treated as correct (the expected outputs are human-reviewed), so any changed output is a cost to examine. Scoring: normalized Markdown vs `tests/expected`.

### Open-bug pages (24 pages, 18 issues)
From phase 1's replay (`lab/exp-known-failures/pages/` and the block definitions in `experiment.mjs`). [`bugs-capture.mjs`](../lab/acquittal/bugs-capture.mjs) labels each removal by overlap with the issue's blocks: a removal relates to a block if it contains ≥ 80% of the block's 3-word shingles, or if ≥ 80% of the removal lies inside the block and the removal is at least 20% of the block's words. Result: 3,918 removals (3,686 final pass); 40 of the 42 wrongly-removed (W) blocks map to a removal step. The other two, #346 and #433, are lost during standardization and cannot be acquitted by any design.

Scoring per issue: a W block is recovered when ≥ 80% of its shingles appear in the output (and < 50% in the baseline), or for phrases under 8 words when the phrase occurs more often than in the baseline; an issue is fixed when all its W blocks are recovered. A clutter control (C) leaks when ≥ 50% of it reappears (< 20% in the baseline).

### History: 151 commits since 2026-03-06 (seen during design)
[`history.mjs`](../lab/acquittal/history.mjs): for every non-merge commit since debug records exist that changed `tests/expected/*.md`, build the **parent** (`git archive` of `src` and configs into `hist/b-<sha>/`, `node_modules` symlinked, `tsc -p tsconfig.node.json`, ~5 s each), run it on the fixtures the commit added or changed, and compare each removal with the commit's new expected output:

- 8+ words: **wrongful** if ≥ 70% of its shingles are in the new expected output and ≤ 30% in the parent's output; **correct** if ≤ 15% are in the new expected output; else ambiguous.
- Under 8 words: wrongful if the phrase with up to four words of context on either side appears in the new expected output and not in the parent's output; correct if the phrase is absent from the expected output; else ambiguous.

151 commits → 370 fixture jobs → 149 parent builds → 680 deduplicated removals: **60 wrongful** (40 with 3+ words), **537 correct**, 83 ambiguous, from 25 commits and 27 fixtures (`removals-history.jsonl`). These are real historical bugs that maintainers later fixed by hand.

### Pre-March history: 42 commits (unseen until v2 was frozen)
[`history-pre.mjs`](../lab/acquittal/history-pre.mjs): the same procedure for commits before 2026-03-06, which needed two adaptations: those builds have no removal records (so `captureNoDebug`), and their Node API took an HTML string or a **JSDOM** instance (so the harness builds a JSDOM document and hooks `remove()` on that window). Old fixture names use `:` for `/` in URLs. 42 commits → 78 jobs → 41 builds → 481 removals: **21 wrongful**, **402 correct**, 58 ambiguous, from 9 commits and 12 fixtures (`removals-history-pre.jsonl`). The removed texts were not inspected until after the v2 questions were frozen; the commits' one-line subjects had been visible in a log.

## 5.6 Harness bugs found and fixed during the work

Each of these was caught by a check, fixed, and all affected policies were re-run:

| Problem | Symptom | Fix |
|---|---|---|
| The harness's own records had the same shape as Defuddle's (`step`, `text`) and were captured by the `push` hook | only 1,270 of 1,938 records paired; fingerprint consistency 75% | re-entrancy guard on both hooks |
| Removed wrappers began with inline ad script, so stored text was JavaScript and truncated before the article (#360) | W blocks of #360 unmatched | store visible text (scripts and styles excluded) |
| Block text built two ways (spaced vs glued at block boundaries) | shingle mismatches (#460, #408) | one `visibleText()` for both sides |
| The one-copy rule treated an ancestor and its descendant with identical text as twins (#460: `main > div`) | `div` restored, `main` removed, content lost | path-based nesting check |
| The same element removed in four retry passes (same fingerprint) was deduplicated after the decision, so the second record overwrote the acquittal (#441) | a 2,161-word article acquitted at 1.0 but still lost | deduplicate by fingerprint before deciding |
| History baseline taken from debug-mode output (spacing differs) | 5 "recoveries" with no acquittals | baseline from a normal-mode replay |
| Old builds expected JSDOM and colon-named fixture URLs | 76 of 78 pre-March runs errored | JSDOM factory with per-window hook; `:` → `/` |

## 5.7 Known measurement artifacts

- Text containing math is rendered as LaTeX in the output ("Apply $D$ and output register $A$."), so the matcher counted #428's first line as lost although it is restored.
- Historical "correct" labels mean "absent from that commit's expected output". Some were bugs not yet fixed at that commit (the same text is wrongful in a later commit), so restoring them counts as a leak although it is right. This inflates the leak counts of chapter 7 slightly.
- 1–2-character removals (math letters, footnote numbers) are noisy to label; results are also reported for 3+ words.
