# Jev × Defuddle experiments

This folder is the complete record of an investigation, started on 2026-10-27, into whether **TypeSafe's Jev decision model** can make Defuddle's HTML "sanitization" more reliable, and if so, how. Everything that was produced in temporary directories during the work (scripts, datasets, raw model answers, result files, old builds, agent reports) has been moved here, with absolute paths rewritten to this location so the experiments can be re-run from the repo.

Nothing in Defuddle's own source (`src/`, `tests/`, `website/`) was modified by this work.

## The short version

| Question | Answer |
|---|---|
| Can Jev make **security sanitization** (stripping scripts, `javascript:` URLs, event handlers) ~99.99% reliable? | **No, and it must not be used there.** The deterministic sanitizer already left 0 modern-executable payloads in the default pipeline; Jev as a detector reached 91.6% recall at 4.2% false positives and is injectable. The audit instead found a **real deterministic bypass** (strip-before-resolve on the schema.org / extractor / body-fallback paths) that is still unfixed. See [docs/03-security-findings.md](docs/03-security-findings.md). |
| Can Jev help **clutter removal** (deciding what is article content)? | **Yes, as a "last-level acquittal" only**: when Defuddle is about to remove an element, ask a question specific to *why* it is removing it, and keep the element only if Jev is confident it is content. Jev must never remove anything (page text can push it toward "remove" ~90% of the time, toward "keep" almost never). |
| How much does it help? (end-to-end, real Defuddle runs) | Best measured design: **10–12 of 18 reproducible open extraction bugs fixed**, **16–17 of 21 never-seen historical wrongful removals recovered**, at a cost of **5–13 of 226 fixture outputs changed** (mostly 1–3-word labels and titles) and ~2% of correct removals restored. See [docs/07-v2-prompt-style.md](docs/07-v2-prompt-style.md). |
| Did prompt style matter? | Yes. Rewriting the questions in the style of `McpMessages.kt` (situation, literal test, interspersed examples with reasons, look-alikes, principle) recovered 13 vs 10 of 21 unseen cases at the same threshold with no extra clutter. |
| What is never reachable by acquittal? | Content lost outside removal steps (standardization), e.g. issues #346 and #433. |

The design recommended for building next (chosen after seeing the results, so it still needs fresh validation):

> Ask the **v2 reason-specific question** for every removal that has text; also accept the **role coproduct** as a backstop for blocks of 20+ words; threshold 0.9; code rules for titles, duplicates, twin copies and math renderings.
> Measured: 10/18 open bugs, 16/21 unseen historical cases, 5/226 fixtures changed, 0/69 clutter controls leaked on bug pages.

Build plan: [docs/08-next-steps.md](docs/08-next-steps.md).

## Documents

| File | Contents |
|---|---|
| [docs/01-question-and-approach.md](docs/01-question-and-approach.md) | The original request, every follow-up from the user (verbatim), how "sanitization" was split into two problems, Jev in one page, and the order in which the work happened. |
| [docs/02-phase1-broad-evaluation.md](docs/02-phase1-broad-evaluation.md) | Phase 1: the nine-agent workflow, the block dataset, block classification, main-container choice, determinism and injection, cost and latency, runtime constraints, the replay of 18 open bugs, and the first verdict. |
| [docs/03-security-findings.md](docs/03-security-findings.md) | The deterministic sanitizer map, the confirmed strip-before-resolve bypass with a runnable repro, other gaps, Jev as an XSS detector, and the deterministic fixes. |
| [docs/04-prompt-audit-and-coproduct.md](docs/04-prompt-audit-and-coproduct.md) | Phase 2: the user's challenge to the "44% of pages" claim, the exact prompts, the recomputation, the coproduct (Choice) redesign of the question, and its veto replay. |
| [docs/05-acquittal-harness.md](docs/05-acquittal-harness.md) | Phase 3 infrastructure: the end-to-end harness that captures every removal with its reason and context and replays Defuddle with acquittals applied; the bug-page, history and pre-March datasets. |
| [docs/06-acquittal-v1-results.md](docs/06-acquittal-v1-results.md) | Phase 3 results: reason-specific questions (v1) vs the role question, examples and context ablations, per-trigger rates, what broke and why. |
| [docs/07-v2-prompt-style.md](docs/07-v2-prompt-style.md) | Phase 4: the user's documentation style, the v2 questions, the fresh unseen test set, v1 vs v2 results, per-bug score changes, leak analysis, the routing candidate. |
| [docs/08-next-steps.md](docs/08-next-steps.md) | How to build the per-reason acquittal into Defuddle, decisions needed, risks, and the experiment backlog. |
| [docs/09-reproduce.md](docs/09-reproduce.md) | Environment, the API key rule, every command, runtimes, costs, caches, and file formats. |
| [docs/10-caveats-and-lessons.md](docs/10-caveats-and-lessons.md) | What the numbers can and cannot support, corrections made along the way, lessons about Jev and about the user's working preferences. |
| [docs/appendix-a-phase1-agent-reports/](docs/appendix-a-phase1-agent-reports/) | The ten phase-1 agent reports, verbatim. |
| [docs/appendix-b-acquittal-prompts.md](docs/appendix-b-acquittal-prompts.md) | Every acquittal prompt (v1, v2, role coproduct) exactly as sent, with a real example record per trigger type. Generated. |
| [docs/appendix-c-results.md](docs/appendix-c-results.md) | Every end-to-end result: 21 policies × 4 test sets, per-issue outcomes, per-case recovery, fixture changes. Generated. |
| [docs/appendix-d-file-inventory.md](docs/appendix-d-file-inventory.md) | Every file in this folder with its size. Generated. |

## Directory map

```
experiments/jev/
├── README.md                 this file
├── docs/                     the write-up (see table above)
├── inputs/                   the two documents attached to the original request, and the request text
│   ├── JEV_AGENT_BRIEF.md
│   ├── JEV_DECISION_MODEL_ECOSYSTEM.md
│   └── ORIGINAL_REQUEST.txt
├── research/                 phase 1 (was /tmp/jev-research)
│   ├── jev.mjs               the Jev client used by every experiment (reads JEV_API_KEY; never logs it)
│   ├── EXPERIMENT_RULES.md   rules given to the phase-1 agents
│   ├── SCOUT_NOTES.md        initial codebase map
│   ├── JEV_ECOSYSTEM_EXCERPTS_*.md
│   ├── build-block-dataset.mjs
│   └── results/              one folder per phase-1 experiment (scripts + raw outputs + analyses)
├── lab/                      phases 2–4 (was the Claude Code session scratchpad)
│   ├── exp-known-failures/   replay of 18 open bugs (pages, block definitions, results)
│   ├── coproduct/            factored role-coproduct experiment
│   ├── prompt-audit/         exact prompts (ALL_PROMPTS.md) and the page-level recomputation
│   ├── rebuild/              phase-1 main-container candidate rebuild
│   ├── acquittal/            the end-to-end acquittal harness, questions, datasets, results, Jev answer cache
│   │   └── hist/             ~190 compiled historical Defuddle builds (gitignored, regenerable)
│   ├── verify-schema-bypass.mjs   repro of the sanitizer bypass
│   ├── inject-check.mjs, spot.mjs
├── workflow/                 the phase-1 Workflow script, its journal, and raw agent transcripts (gitignored)
└── session/tool-results/     large tool outputs Claude Code saved during the session
```

## Running things

All scripts are Node ESM and use absolute paths under `/home/alexi/git/defuddle/experiments/jev`. Jev calls need `JEV_API_KEY` in the environment (it is exported in `~/.bashrc`; run scripts as `bash -ic 'node script.mjs'` if a non-interactive shell does not see it). Never print the key.

```bash
cd /home/alexi/git/defuddle && npm run build:node          # the harness loads dist/
cd experiments/jev/lab/acquittal
node validate.mjs                                          # harness self-check: 226/226 fixtures reproduce exactly (no API)
node run-policies.mjs fixtures v2_90_or_role90big_t        # one policy end-to-end; uses cached Jev answers
node summarize.mjs                                         # regenerate docs/appendix-c-results.md
```

Full instructions: [docs/09-reproduce.md](docs/09-reproduce.md).

## Before committing or pushing

- `origin` for this checkout is `git@github.com:kepano/defuddle.git` (the public upstream). Nothing here has been committed.
- `lab/exp-known-failures/pages/` holds **unanonymized third-party pages** saved from GitHub issues (blogs, news, legislation). Do not push them to a public remote.
- `.gitignore` in this folder excludes the regenerable historical builds (`lab/acquittal/hist/`, ~415 MB), the raw subagent transcripts (`workflow/agent-transcripts/`, ~17 MB) and the raw policy-run logs (`lab/acquittal/run*.log`, ~30 MB of mostly debug output; the results are in `policy-*.json`). They remain on disk. What git would track is about 455 files, 49 MB.
- No file in this folder contains the Jev API key (checked by scanning for the key's value before copying).

## Not copied here

- The full Claude Code conversation transcript (~8 MB, includes system context) stays at `~/.claude/projects/-home-alexi-git-defuddle/47caf126-f5d2-4d71-8238-6d9515bbd049.jsonl`; the two attached documents and the original request were extracted from it into `inputs/`.
- Claude Code's internal `auto-mode-classifier-error.txt` (an API credit error log) was left out.
- The original copies in `/tmp/jev-research/` and the session scratchpad were not deleted; they are identical to `research/` and `lab/` apart from the rewritten paths.

## Cost

About 18,000 Jev requests over the whole investigation, well under $2 in total at $0.042 per million input tokens. The answer cache in `lab/acquittal/jev-cache.jsonl` (6,660 entries) lets every acquittal policy be re-scored without new calls.
