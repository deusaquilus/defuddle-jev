# 1. The question and how the work unfolded

## 1.1 The original request (2026-10-27)

Two documents were attached: `JEV_AGENT_BRIEF.md` (a 42 KB practical brief for agents) and `JEV_DECISION_MODEL_ECOSYSTEM.md` (a 339 KB survey of Jev, its benchmarks, integrations and failure reports). Both are preserved verbatim in [`../inputs/`](../inputs/). The request (verbatim, [`../inputs/ORIGINAL_REQUEST.txt`](../inputs/ORIGINAL_REQUEST.txt)):

> I want you to have a look at the jev agent brief and the larger jev file if needed and THEN I want you to CAREFULLY analyze this product in order to answer the question, CAN this codebase benifit from the Jev model's fuzzy logic to more reliably sanitize the HTML content so that this functionality goes from a "best-effort" sort of thing to a "nearly 99.99" sort of thing. I want to AGGRESSIVELY use Jev for this capability if possible. Do your research and give me pros/cons, a verdict, and a explanation.

## 1.2 Every follow-up instruction, in order

These shaped the direction of the work; each is quoted verbatim (one word elided).

1. *(during phase 1)* "(NOTE. If you need to run ACTUAL experiments on Jev, spin up a new console and use the JEV_API_KEY variable (DO NOT read it directly))" → all live experiments read the key from the environment and never print it.
2. *(after the first workflow failed on Anthropic API credits)* "try again" → the workflow was resumed and completed.
3. "Okay, let's say it's NOT four nines. Does JEV HELP??? That's my FIRST question. Does it help and HOW MUCH???" → led to quantifying help on real bugs, not four nines.
4. "Okay Do the reply" → the replay of 18 reproducible open GitHub issues through Jev.
5. "You said "Replacing heuristics would change 44% of currently correct pages". I DO NOT believe you! Show me what your EXACT instructions were to Jev. Show me the set of prompts you made it use" → the prompt audit (chapter 4). The 44% claim was withdrawn.
6. "Again, this reasoning seems to be […]. Have a look at this MORE CLOSELY: [the 12 `kind` options] Aren't at least SOME of these mutually exclusive so you can just combine them into an elementType of some kind … Maybe ALL of these are a single coproduct or AT LEAST SOME OF THEM either capturable as 2 coproducts (or maybe more) or MAYBE a coproduct(s) and some booleans. Jev supports coproducts. THINK ABOUT THIS CAREFULLY" → the factored role-coproduct design (chapter 4).
7. "WHAT were the old bugs that were not fixed? List them for me BRIEFLY"
8. "Okay, have a look at this for example "372 Inline link spans such as "our other posts" were removed as breadcrumbs. Jev calls them promotion or related links.". Shouldn't that be a SEPARATE question that Jev should ask about the particular element e.g. "Is this an inline link breadcrumb" AND OFFER SPECIFIC EXAMPLES OF SOME OF THESE IN THE PROMPT??? … In EACH CASE we had Jev classify something as an enum element that is then marked for removal. Shouldn't we have some of these questions as SECONDARY Jev questions we ask in only SPECIFIC CASES that we're about to remove those elements? The point here is that this is a "LAST LEVEL ACQUITTAL" sort of thing." → the end-to-end acquittal harness and the reason-specific questions (chapters 5 and 6).
9. "WHAT IS THE PURPOSE OF RUNNING THIS WORKFLOW????" → no multi-agent workflow was launched for phase 3; everything was done with scripts.
10. "continue"
11. "… CAN THIS NOT BE SOLVED WITH BETTER EXAMPLES IN THE PROMPT TO JEV. I want you to have a look at McpMessages in ~/git/kotlin-compiler-server and the mcp-docs-combined pages. I want you to UNDERSTAND HOW I use descriptions with interspersed examples to IMPROVE your prompts to Jev to see if we can make REAL GAINS by you adopting my style. … The design worth building next is a mix chosen by removal reason. Yes! I want to build this. What are the next step for it?" → the v2 prompts and the fresh pre-March test set (chapter 7), and the build plan (chapter 8).
12. "Where are you actually running code from right now?" → all code ran locally on the user's machine; the scratch artifacts were under `/tmp`.
13. "Okay, FIRST I'd like you to make changes to THIS actually REPO HERE and incorporate what you have done. Take EVERYTHING OUT of the temporary directory and put it ALL into THIS REPO … I want a markdown file (or multiple) here to EXTENSIVELY document what we have done so far as well." → this folder.

## 1.3 Two different meanings of "sanitize"

The first finding was definitional: Defuddle does two unrelated things that could both be called sanitizing, and they need opposite answers.

| | **A. Security sanitization** | **B. Clutter removal / main-content extraction** |
|---|---|---|
| What it does | Removes executable or dangerous markup: `script`, `on*` handlers, `javascript:`/`vbscript:`/`blob:` URLs, non-image `data:` URLs, `srcdoc`, unsafe elements. | Decides which parts of a page are the article: picks the main container, removes navigation, ads, comments, related links, bylines, hidden elements, boilerplate. |
| Where it lives | `stripUnsafeElements()` and `isDangerousUrl()` in `src/utils/dom.ts`; `_stripUnsafeElements()` and `_sanitizeExtractorHtml()` in `src/defuddle.ts`. | `ENTRY_POINT_ELEMENTS`, `EXACT_SELECTORS`, `PARTIAL_SELECTORS` in `src/constants.ts`; `src/removals/*` (selectors, scoring, hidden, content patterns); the retry cascade in `_parseWithRetries`. |
| Nature | Deterministic, enumerable, adversarial. A miss is a vulnerability. | Heuristic, judgment-based. A miss is a quality bug (lost content or leaked clutter). |
| Can a probabilistic model help? | No (chapter 3). | Yes, in a narrow role (chapters 4–7). |

## 1.4 Jev in one page

Facts used throughout, from [`../inputs/JEV_AGENT_BRIEF.md`](../inputs/JEV_AGENT_BRIEF.md) and confirmed by measurement where noted:

- **What it is:** a hosted, closed "decision model" (TypeSafe System One). It never generates text. You send a `state` (text or JSON) and typed `questions`; it returns probabilities.
- **Question types:** `noul` (yes/no, returns P(true)), `choice` (pick one of up to 255 named options; probabilities sum to 1), `score` (rubric), `box` (vision, preview).
- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`, model ids `jev-1.14.0` (pinned in all experiments), `jev-1.13.0`, `jev-latest`.
- **Limits and price:** 32k tokens per question, 64k per request; $0.042 per million input tokens. Measured latency p50 ≈ 60–70 ms per call from this machine.
- **Prompting rules (from the brief):** one judgment per question; state exact conditions; option names matter more than definitions; add an escape option to every Choice; avoid negations; rotate option order when stakes are high; thresholds belong in code.
- **Non-determinism:** probabilities are quantized to 0.01 and move slightly between identical calls (measured: 0.7% of keep/remove decisions flip at 0.5).
- **Security posture:** the state is "argued input" (the page can argue with the model); the brief's non-negotiable rule is that Jev is never the sole security gate.
- **Deployment options:** direct API with a key, or Cloudflare Workers AI binding `typesafe/jev` (zero data retention, `jev-1.13.0`).

## 1.5 Defuddle constraints that bound any design

- **Browser bundle** (`defuddle`, `defuddle/full`): synchronous `parse()`, and a privacy promise that the npm package and extension "run entirely locally and make no network requests". A network model cannot run here.
- **Node / CLI / Worker** (`defuddle/node`, `src/cli.ts`, `website/src/convert.ts`): async, can call a service. The Worker is the most constrained runtime.
- **Tests:** 226 fixtures compared byte-for-byte (after attribute normalization) against `tests/expected/*.md`. Any model in the loop needs recorded answers to keep CI deterministic.
- **DOM implementations:** linkedom (CLI, Worker), JSDOM, happy-dom, native DOM.

## 1.6 Phases

| Phase | When | Trigger | Method | Chapter |
|---|---|---|---|---|
| 0. Scouting | 2026-10-27 | original request | read both Jev documents and the codebase; wrote `research/SCOUT_NOTES.md`, `research/EXPERIMENT_RULES.md` | — |
| 1. Broad evaluation | 2026-10-27 | original request, "try again", "Does JEV HELP?", "Do the reply" | one Workflow with nine agents (security map, extraction map, runtime map, document evidence, block classification, main container, determinism and injection, security detector, cost), then a replay of 18 open bugs and an injection spot check | 2, 3 |
| 2. Prompt audit and coproduct | 2026-10-27/28 | "I DO NOT believe you", "coproducts" | recomputation from saved answers; factored role-coproduct design run on all 1,475 blocks; veto replay | 4 |
| 3. End-to-end acquittal (v1) | 2026-10-28 | "LAST LEVEL ACQUITTAL" | a harness that captures every Defuddle removal and replays Defuddle with acquittals applied; datasets from bug pages and 151 history commits; reason-specific questions | 5, 6 |
| 4. Prompt style (v2) | 2026-10-28 | "CAN THIS NOT BE SOLVED WITH BETTER EXAMPLES", McpMessages style | v2 questions in the user's style; a fresh unseen test set from 42 pre-March commits replayed under JSDOM | 7 |
| 5. Archive | 2026-10-28 | "put it ALL into THIS REPO" | this folder | — |
