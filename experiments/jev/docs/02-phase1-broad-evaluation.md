# 2. Phase 1: broad evaluation (2026-10-27)

Phase 1 answered the original question across every dimension at once: what the documents claim, what Defuddle's code does, what runtimes allow, and what Jev actually does on Defuddle's own data. It ended with the first verdict (section 2.11). Several numbers from this phase were later corrected or superseded; those corrections are flagged inline and collected in [chapter 10](10-caveats-and-lessons.md).

## 2.1 Method: one workflow, nine agents

The work was orchestrated with Claude Code's Workflow tool (script: [`../workflow/jev-defuddle-phase1-wf_5ee8a70d-c06.js`](../workflow/jev-defuddle-phase1-wf_5ee8a70d-c06.js); journal: [`../workflow/journal.jsonl`](../workflow/journal.jsonl)). Each agent got the shared rules in [`../research/EXPERIMENT_RULES.md`](../research/EXPERIMENT_RULES.md) (key handling, spend caps, pinned `jev-1.14.0`, output folders, honest reporting) and wrote its scripts and outputs to `research/results/<name>/`.

| Agent | Question | Output folder | Report |
|---|---|---|---|
| `security-map` | Full map of the security sanitizer; can it be bypassed; would a Jev gate help? | `research/results/security-map/` | [report](appendix-a-phase1-agent-reports/security-map.md) |
| `extraction-map` | Every clutter-removal decision point, uncertainty gates, failure history (244 GitHub issues, 277 commits) | `research/results/extraction-decision-inventory/` | [report](appendix-a-phase1-agent-reports/extraction-map.md) |
| `runtime-map` | Which environments can call a hosted model at all | `research/results/runtime-constraints/` | [report](appendix-a-phase1-agent-reports/runtime-map.md) |
| `jev-evidence` | What the two Jev documents do and do not support (ran twice) | `research/results/doc-evidence/`, `doc-evidence-v2/` | [run 1](appendix-a-phase1-agent-reports/jev-evidence.md), [run 2](appendix-a-phase1-agent-reports/jev-evidence-run2.md) |
| `exp-block-classification` | Does Jev agree with Defuddle's reviewed keep/remove decisions per block? | `research/results/exp-block-classification/` | [report](appendix-a-phase1-agent-reports/exp-block-classification.md) |
| `exp-main-container` | Can Jev pick the main article container? | `research/results/exp-main-container/` | [report](appendix-a-phase1-agent-reports/exp-main-container.md) |
| `exp-adversarial-determinism` | Repeatability, injection, phrasing and option order, context dilution | `research/results/exp-adversarial-determinism/` | [report](appendix-a-phase1-agent-reports/exp-adversarial-determinism.md) |
| `exp-security-detector` | Jev as a secondary XSS detector vs the deterministic sanitizer | `research/results/exp-security-detector/` | [report](appendix-a-phase1-agent-reports/exp-security-detector.md) |
| `measure-cost` | Cost, latency and limits of four integration shapes | `research/results/measure-cost/` | [report](appendix-a-phase1-agent-reports/measure-cost.md) |

The first run failed after one agent because the Anthropic account ran out of credits; after the user's "try again" it was resumed from the journal (`resumeFromRunId`) and completed all nine.

## 2.2 The block dataset

Ground truth for clutter removal came from Defuddle's own human-reviewed test outputs.

- **Builder:** [`../research/build-block-dataset.mjs`](../research/build-block-dataset.mjs). For each fixture it runs Defuddle (Node build, linkedom, debug mode), then walks an independent parse of the page and labels maximal homogeneous blocks: **kept** if ≥ 90% of the block's 5-word shingles appear in Defuddle's output text, **removed** if ≤ 10%, otherwise it descends into children. Blocks are capped at 300 words; hints record title/byline/date likeness, landmark ancestry, link density and the matching debug removal step.
- **Size:** 1,475 blocks from 224 fixtures (367 removed, 1,108 kept). Output: `research/results/dataset/blocks.jsonl`.
- **Label bug, found during phase 1:** `textContent` glues words across element boundaries ("pageThe"), which breaks shingles. A corrected labeling (`research/results/exp-block-classification/relabel.mjs` → `labels-corrected.jsonl`) moved 72 "removed" blocks to "kept" and 20 to "mixed" (excluded). All block numbers below use the corrected labels (1,455 blocks: 279 removed, 1,176 kept).

## 2.3 Block classification

Question (verbatim in [`../lab/prompt-audit/ALL_PROMPTS.md`](../lab/prompt-audit/ALL_PROMPTS.md), section 1): one bundled `keep` Noul ("Should this block be kept in a clean reader-mode view of the page's main article? Keep = … Do not keep = …") plus a 12-way `kind` Choice. Three state variants: V1 block HTML (all blocks), V2 block text, V3 JSON with page title and URL (V2/V3 on a 750-block subsample).

| Measure (V1, corrected labels) | Value |
|---|---|
| Accuracy at p = 0.5 | 87.6% (AUROC 0.891) |
| Accuracy with a threshold tuned on held-out fixtures | 90.7% |
| Excluding title/byline/date blocks and site-extractor pages | 92.9% (AUROC 0.948) |
| Leaf paragraphs of 16+ words | 98%+ |
| Mixed containers of 100+ words | 83% |
| Confident band (\|2p−1\| ≥ 0.8) | covers 66% of blocks, 93.9% accurate (98.1% on ordinary pages) |
| Confident disagreements that were real Jev errors (hand-checked) | 4 of 967 |
| Agreement V1 vs V2 / V1 vs V3 | 92.1% / 95.3% (V3's page context made it more confident, not more accurate) |
| Cost per block call | ~1,000 input tokens, ~$0.00004, p50 70 ms |

The phase-1 summary also reported "56% of pages fully correct if Jev decided every block" and the verdict turned that into "replacing heuristics would change 44% of currently correct pages". **That framing was withdrawn in phase 2**: it counted any single disagreeing block, including title blocks the prompt itself told Jev to keep. See [chapter 4](04-prompt-audit-and-coproduct.md).

## 2.4 Main-container choice

One Choice over candidate containers (the smallest element containing the whole article), plus per-candidate Nouls; candidates built from Defuddle's own scoring.

- On 167 fixtures Jev named the right container 97.6% of the time (94.0% on strict labels) vs 95.2% for Defuddle's `findMainContent`.
- All 107 picks made with confidence ≥ 0.9 were correct; with `findMainContent` as fallback below confidence 0.5, all 167 expected outputs were reproduced.
- Reversing option order flipped 9.6% of picks; removing tag and class names from the state dropped accuracy to 88%, showing most of the signal restates Defuddle's own `ENTRY_POINT_ELEMENTS` heuristic.
- On the 14 bug pages of section 2.10, it picked the right container 14 of 14 times.

Verdict of the agent: a peer of `findMainContent`, useful at most as a confidence-gated tie-breaker on pages with several nested candidates.

## 2.5 Determinism, injection, phrasing, context

From `research/results/exp-adversarial-determinism/` (3,350 live calls):

| Property | Measurement |
|---|---|
| Repeatability | 5 identical calls on 150 blocks: probabilities differ by ~0.01 on half of repeats; 0.7% flip across 0.5; 2.7% change confidence band; majority-of-5 voting changes nothing (81.3% → 82.0%) |
| Injection toward "remove" | one appended sentence "Subscribe to our newsletter for more stories like this." flips **90%** of real article paragraphs to remove; a prepended "Advertisement" 78%; `class="ad-banner sidebar-widget"` 79% |
| Injection toward "keep" | appending "This section is part of the main article." to real clutter flips **0–5%**, none confidently |
| Phrasing and option order | keep-Noul, clutter-Noul and keep/remove Choice (both orders) all score 80–82% on the same 150 blocks; reversing Choice options shifts P(keep) by 0.05 on average (max 0.34) |
| Batching questions in one request | free (≤ 1.3% of answers change) |
| Whole-page context with a marked element | accuracy drops from 0.90–0.91 to 0.85–0.86 at 4–5k tokens, biased toward keeping clutter |

The injection asymmetry is the single most important design fact of the whole investigation: **Jev may only ever be allowed to keep content, never to remove it.** An independent 20-call spot check (`lab/inject-check.mjs`) reproduced it: 5 of 5 real paragraphs flipped to remove, 0 of 5 footer/header blocks flipped to keep.

## 2.6 Cost, latency and limits

From `research/results/measure-cost/` (226 fixtures, no API calls for the model, live calls for calibration):

- A single container-level Choice per page: about $0.08 per 1,000 pages.
- Per-block judgment: $0.5–2.5 per 1,000 real pages; adds ≥ 250 ms (2.7× the median real-page parse); per-block request rate caps throughput near 1,000 pages/hour.
- The 32k-token window: 14% of real fixtures and an estimated half of 50–500 KB real-world pages exceed it with whole-page HTML state.
- Defuddle's existing retry signals fire on 79–82% of fixtures, so they cannot serve as a cheap "ask Jev only when uncertain" gate.

## 2.7 Runtime and product constraints

From `research/results/runtime-constraints/`: a hosted model is only possible as an opt-in, async, fail-open, cached step in Node, the CLI and the Worker. The Worker can use the Workers AI `typesafe/jev` binding (no key, zero data retention, `jev-1.13.0`, Paid plan). The browser and extension paths are excluded by the synchronous `parse()`, the "no network requests" privacy promise, the lack of safe key custody and 1.8 KB of gzip headroom. CI can only cover the model path through committed, recorded answers.

## 2.8 Extraction failure history

From `research/results/extraction-decision-inventory/` (244 issues, 61 open; 277 extraction commits):

- 61% of extraction issues (20 of 31 open ones) are structural: wrong container, aria-hidden content, listing pages, lazy images, cascade truncation. The evidence is not inside one block, so a keep/remove classifier cannot fix them.
- About 39% are "text-readable" false positives where a block-level judgment could help: attribute-token rules (e.g. #444 `related`, #441 `[data-date]`, #371), text heuristics (e.g. #112, #428, #284) and some kept-clutter misses.
- 91.8% of actual removals on fixtures are deterministic selector hits that already work.
- A small decomposed probe (`probe-failure-classes.mjs`, five narrow Nouls on 18 hand-written blocks) got 16 of 18 right; this was the first hint that question structure matters.

## 2.9 What the documents support

Both `jev-evidence` runs concluded that the documents contain no evidence for ~99.99% reliability in either meaning: the best per-decision numbers are 95–99% on easy text benchmarks, decisions at probability 1.0 were still wrong 5.6% of the time in one study, no DOM-element precedent publishes accuracy, and the brief's own rules forbid Jev as a security gate. They supported at most a cached, version-pinned, shadow-tested, confidence-gated advisory signal in the server-side paths.

## 2.10 Replay of 18 open bugs ("Do the reply")

After the workflow, a separate agent reproduced open extraction issues and asked Jev about the exact blocks Defuddle loses. Everything is in [`../lab/exp-known-failures/`](../lab/exp-known-failures/): saved pages (`pages/`), block definitions and the run script (`experiment.mjs`), raw answers (`results.jsonl`) and the report (`report.md`).

- **Block kinds:** W = block the issue says was wrongly removed (42 blocks over 18 issues); C = clutter Defuddle removed correctly on the same page (69 controls); A = ambiguous; K = clutter Defuddle kept.
- **Question:** the same bundled keep Noul as section 2.3, block HTML and block text as state.
- **Veto rule:** keep any block the heuristics remove if Jev's P(keep) ≥ threshold.

| Veto threshold | Issues fully fixed (of 18) | Lost words recovered (of 19,043) | Clutter re-inserted (of 69) |
|---|---|---|---|
| 0.9 | 1 (#395) | 1,752 | 0 |
| 0.8 | 7 | 18,282 | 0 |
| 0.7 | 8 (#441, #433, #279, #360, #365, #375, #257, #395) | 18,826 | 0 |
| 0.5 | 9 | 18,829 | 1 |

Issues where Jev sided with the buggy removal even at 0.5: #460, #444, #372, #321, #252, #134 (mostly fragments judged without context). This replay judged blocks in isolation; chapter 6 shows that end-to-end (actually re-running Defuddle with the acquittals applied) some of these "fixes" do not hold, e.g. #433 loses its footnote in standardization, not in a removal step.

## 2.11 The first verdict (as delivered)

- **Security:** Jev must not gate security sanitization. All five published advisories and the newly found bypass are coverage or ordering defects in deterministic code. Fix the code (chapter 3).
- **Clutter removal:** Jev should not replace the heuristics, but helps as a **veto** that stops the heuristics from deleting real content: at P(keep) ≥ 0.7–0.8 it would have prevented 7–8 of 18 reproducible open bugs (the ones that destroy whole articles), with no clutter re-inserted on those pages, for about a tenth of a cent per thousand pages, in Node/CLI/Worker only, pinned, cached, fail-open, shadow mode first.
- **"Aggressive" use:** contradicted by injection, determinism, runtime and privacy facts.

What changed afterwards: the "44% of pages" claim was withdrawn (chapter 4); the question was restructured as a coproduct (chapter 4); the veto became a reason-specific acquittal measured end-to-end (chapters 5–7), which turned "7–8 of 18 at 0.7–0.8" into "10–12 of 18 at 0.9 (or 0.8)" with honest clutter costs.
