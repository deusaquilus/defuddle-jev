# 8. Next steps: building the per-reason acquittal into Defuddle

The user's decision (2026-10-28): "The design worth building next is a mix chosen by removal reason. Yes! I want to build this."

## 8.1 Target design

| Part | Choice |
|---|---|
| Where it runs | Node API, CLI, Cloudflare Worker only. The browser bundle stays synchronous and offline. |
| When Jev is asked | Only when a removal step is about to remove an element **with visible text**, and only for trigger families that can be wrong (chapter 6.1). |
| What is asked | The v2 reason-specific question (chapter 7.3); the role coproduct as a backstop for blocks of 20+ words. |
| Decision | Keep the element if v2 ≥ 0.9, or role ≥ 0.9 and the block has 20+ words. Jev can only keep, never remove. |
| Code rules | No-text and reference-furniture exclusions; never restore the page title; never restore text already in the output; one copy of identical twins (unless nested); never restore hidden math renderings (KaTeX/MathJax). |
| Failure mode | Any error, timeout or budget overrun → Defuddle's normal output. |
| Determinism | Model pinned; answers cached by `sha1(model, state, question)`; tests run on recorded answers. |

Measured for this design (post-hoc, so to be re-validated): 10/18 open bugs, 16/21 unseen historical cases, 5/226 fixture outputs changed, 0/69 clutter controls leaked on bug pages.

## 8.2 Steps

1. **Fix the sanitizer ordering bug first** (chapter 3.6). It is independent of Jev and is a security issue. Add a poisoned-attribute regression to `tests/extractor-xss.test.ts`.
2. **One removal choke point in core.** Replace the scattered `el.remove()` calls in `src/removals/selectors.ts`, `scoring.ts`, `hidden.ts`, `content-patterns.ts` (and the eyebrow-label step) with one function, e.g. `removeCandidate(el, step, reason, selector)`. It records the candidate (the same fields the harness records: step, reason, selector, element text, marked context, siblings, heading, link density, share of page words, fingerprint) and skips the removal when the candidate's fingerprint is in an `acquitted` set passed through options. Core stays synchronous and free of any Jev code; with no set passed, behavior is byte-identical (all 226 fixtures must still pass).
3. **A two-pass async API for server-side callers.** Pass 1 collects candidates; the caller decides; pass 2 re-runs with the acquitted set; repeat until no new candidates appear (at most three rounds; the harness needed up to five on rare pages). Because Defuddle mutates the document, each pass needs a fresh copy (re-parse the HTML, or clone the original document before pass 1) on linkedom, JSDOM and happy-dom alike. The harness proves fingerprints are stable across passes (2,818 of 2,818).
4. **The router, outside core** (Node/Worker code only): trigger mapping (`familyOf`), v2 question builders, role backstop, thresholds, code rules, a Jev client (Workers AI binding or HTTPS), a cache (memory or file in Node, KV in the Worker), per-page budget and concurrency limits, timeouts, fail-open. The experiment's `questions-v2.mjs`, `questions.mjs#familyOf` and `run-policies.mjs#runPage` are the reference implementation.
5. **Tests.** Commit recorded Jev answers as test data so CI stays offline and deterministic; add a fixture per fixed bug (#252, #257, #279, #321, #360, #365, #375, #441, #444, #460) with the acquittal option on; keep every existing expected output unchanged with the option off; add a test that an acquitted element still goes through the final sanitizer.
6. **Shadow mode on defuddle.md.** Compute acquittal decisions on live traffic without applying them; log what would be restored (candidate text, trigger, scores) for review. The reviewed log becomes the fresh validation set the thresholds still need. Then enable behind a flag, then by default for the Worker.
7. **Re-validate on fresh data** before trusting the post-hoc routing: thresholds per family, the 20-word backstop, the code rules.

## 8.3 Decisions only the user can make

- **API shape.** Proposed: an `acquit` option on the Node API that takes an async callback `(candidates) => Promise<Set<fingerprint>>`, with the Jev router shipped as a separate helper. Alternatives: built-in Jev configuration in `defuddle/node`; Worker-only integration.
- **Where Jev runs.** The Workers AI binding `typesafe/jev` (no key, zero data retention, but `jev-1.13.0`, while every number here was measured on `jev-1.14.0`) or the TypeSafe API with a key (`jev-1.14.0`). Choosing 1.13.0 means re-measuring.
- **Privacy text** for defuddle.md (page content would be sent to a model provider), and whether the CLI gets a flag.

## 8.4 Risks and how the design handles them

| Risk | Handling |
|---|---|
| Page text manipulates the model | Acquit-only: the worst a manipulation can do is keep clutter, which measured at 0–5% even under attack. |
| Model drift | Pin the version; re-run the experiment suite (`run-policies.mjs all`) on any upgrade. |
| Non-determinism | Cache answers; recorded answers in tests. |
| Latency | Only removals with text in risky families are asked; requests per page run in parallel; budget cap; fail-open. Measure the candidate-count distribution on real traffic in shadow mode. |
| Security | Acquittal happens before the final sanitizer on the main pipeline; verify the extractor and fallback paths after the ordering fix. |
| Cost | Negligible: well under a cent per page at $0.042 per million tokens. |

## 8.5 Experiment backlog

Ideas not yet tested, in rough priority:

1. **#372 as a code fix:** do not apply the breadcrumb pattern inside a paragraph longer than the rule's own limit; add the issue's page as a fixture.
2. **Label question:** do not default to "false" when `text_after` is empty; ask labels again after following paragraphs are restored (#445).
3. **Math renderings rule** (KaTeX/MathJax hidden copies) and a **policy flag** for infoboxes.
4. **Per-family thresholds** and the role backstop size, chosen on fresh shadow-mode data.
5. **Re-measure on `jev-1.13.0`** if the Workers AI binding is chosen.
6. **DOM parity:** run the harness under JSDOM and happy-dom for the current build, not only linkedom.
7. **Latency profile:** candidates per page and rounds per page on real pages, for Worker budgets.
8. **Image-only removals** (no text) are never asked today; hero images with captions (#279-type) may deserve a question.
9. **Main-container Choice** (chapter 2.4) as a confidence-gated tie-breaker on pages with several nested candidates.
