# 9. Reproducing the experiments

## 9.1 Environment

- Linux, Node v22.20.0, run from this checkout (`/home/alexi/git/defuddle`).
- Repo dependencies installed (`npm ci`); the harness and most scripts load the compiled Node build, so build it first: `npm run build:node` (writes `dist/`).
- DOMs come from the repo's `node_modules`: linkedom for the current and post-March builds, JSDOM 24.1.3 for pre-March builds.
- All scripts use absolute paths under `/home/alexi/git/defuddle/experiments/jev`. If the folder moves, replace that prefix.

## 9.2 The Jev key and client

- The key is the environment variable `JEV_API_KEY`, exported in `~/.bashrc`. Some non-interactive shells do not load it; then run scripts as `bash -ic 'node script.mjs'`.
- **Never print, log, grep or write the key.** No file in this folder contains it.
- Client: [`../research/jev.mjs`](../research/jev.mjs): `systemOne({ state, questions, model = 'jev-1.14.0' })`, `mapConcurrent(items, fn, n)`, `usageTotals()`, `estimateTokens()`. It retries 429/529/503 with backoff and tracks tokens and latency. `JEV_ENDPOINT` overrides the URL (default `https://api.typesafe.ai/v1/systemone`).
- Price: $0.042 per million input tokens. Typical request: 600–2,000 input tokens.

## 9.3 Phase 3–4: the acquittal harness (most useful entry point)

From `experiments/jev/lab/acquittal/`:

| Command | API calls | Time | Reads | Writes |
|---|---|---|---|---|
| `node validate.mjs` | none | ~20 s | `tests/fixtures`, `tests/expected`, `dist/` | `removals-fixtures.jsonl`; prints the three self-checks |
| `node bugs-capture.mjs` | none | ~2 min | `../exp-known-failures/pages/`, block definitions in `../exp-known-failures/experiment.mjs` | `removals-bugs.jsonl`, `bug-pages.json` |
| `node history.mjs` | none | ~5 min (builds) | git history | `hist/b-<sha>/` builds, `removals-history.jsonl` |
| `node history-pre.mjs` | none | ~3 min | git history | more `hist/` builds, `removals-history-pre.jsonl` |
| `node check-nodebug.mjs` | none | ~1 min | fixtures | prints debug vs no-debug capture agreement |
| `node run-policies.mjs <set> <policy>[,<policy>…]` | only for uncached requests | per policy: fixtures 35–60 s, bugs 100–240 s, history 50–130 s, historypre 120–230 s | removals files, `jev-cache.jsonl`, `hist/` | `policy-<set>-<policy>.json`, appends to `jev-cache.jsonl` |
| `node family-stats.mjs` | none | seconds | removals files, cache | per-trigger table |
| `node why-unfixed.mjs 372 252 …`, `node why-v2.mjs 372 …` | none | seconds | removals, cache, policy files | per-block scores for given issues |
| `node render-prompts.mjs` | none | seconds | question modules, removals | `../../docs/appendix-b-acquittal-prompts.md` |
| `node summarize.mjs` | none | seconds | all `policy-*.json` | `../../docs/appendix-c-results.md` |

Sets for `run-policies.mjs`: `fixtures`, `bugs`, `history`, `historypre`, or `all` (all four). Policies are defined in the `POLICIES` object in `run-policies.mjs` (e.g. `none`, `role90`, `ex90`, `plain90`, `phraseonly90`, `ex80`, `ex95`, `ex90_or_role90`, `ex90_and_role50`, `v2_90`, `v2_80`, `v2_90_or_role90`, `v2_80_or_role90`, `v2_90_or_role90big_t`; a `_t` suffix adds the title rule). Run several sets in parallel as separate processes; within one process pages run sequentially because the hooks are global.

The `hist/` builds are gitignored. If they are missing, `history.mjs` and `history-pre.mjs` rebuild them (each build: `git archive <parent> src tsconfig.json tsconfig.node.json package.json`, a `node_modules` symlink, `npx tsc -p tsconfig.node.json`; existing builds are skipped).

Example: re-score the recommended design on everything, using the cache only.

```bash
cd /home/alexi/git/defuddle/experiments/jev/lab/acquittal
for S in fixtures bugs history historypre; do node run-policies.mjs $S v2_90_or_role90big_t > run-$S.log 2>&1 & done; wait
grep -h '^\[' run-*.log
node summarize.mjs
```

## 9.4 Phase 2

| Command (from `experiments/jev/lab/`) | API | What it does |
|---|---|---|
| `node prompt-audit/pagelevel.mjs` | none | page-level recomputation of the phase-1 block run (the "44%") |
| `node coproduct/offline-kind.mjs`, `node coproduct/split.mjs` | none | 12-way kind answers turned into keep scores; cross-axis split analysis |
| `node coproduct/factored.mjs A\|B [--limit N] [--show]` | yes (resumable) | the factored role-coproduct run; `--show` prints one request |
| `node coproduct/analyze.mjs`, `tuned-pages.mjs`, `veto-corpus.mjs`, `veto-steps.mjs` | none | results of the factored design |
| `node exp-known-failures/experiment-role.mjs` | yes | veto replay with the role coproduct (writes `results-role.jsonl`) |
| `node exp-known-failures/sweep-compare.mjs` | none | old vs role veto sweep |

## 9.5 Phase 1

Each folder under `experiments/jev/research/results/` holds its own scripts and outputs; the corresponding agent report in [appendix A](appendix-a-phase1-agent-reports/) lists them under "Artifacts". The main entry points:

| Folder | Key scripts | API |
|---|---|---|
| `dataset/` (built by `research/build-block-dataset.mjs`) | the block dataset | none |
| `exp-block-classification/` | `run-variant.mjs v1\|v2\|v3\|v1r`, `relabel.mjs`, `analyze2.mjs` | `run-variant` only |
| `exp-main-container/` | `build-candidates.mjs`, `run-jev.mjs`, `run-variant-D.mjs`, `analyze2.mjs`, `e2e-swap.mjs` | `run-*` only |
| `exp-adversarial-determinism/` | `run-all.sh` (g1–g4), `analyze.mjs`, `analyze2.mjs` | `g*.mjs` |
| `exp-security-detector/` | `corpus.mjs`, `det-audit.mjs`, `jev-run.mjs`, `jev-injection.mjs`, `analyze.mjs` | `jev-*` |
| `measure-cost/` | `measure.mjs`, `model.mjs`, `addendum.mjs` | calibration only |
| `runtime-constraints/` | `measure-parse-times.mjs` | none |
| `security-map/` | `probe.mjs`, `probe2.mjs`, `probe-jsdom.mjs`, `roundtrip-v2.mjs`, `perf-baseline.mjs` | none |
| `extraction-decision-inventory/` | `classify-commits.mjs`, `classify-failures.mjs`, `measure-gates.mjs`, `tally-removal-reasons.mjs`, `probe-failure-classes.mjs` | probe only |

The known-failures replay: `node lab/exp-known-failures/experiment.mjs` (API; **overwrites** `results.jsonl`) then `python3 lab/exp-known-failures/analyze.py` (writes `report.md`).

The sanitizer bypass: `node lab/verify-schema-bypass.mjs` (no API).

## 9.6 Data formats

**Removal records** (`lab/acquittal/removals-*.jsonl`, one JSON object per removal):
`step`, `reason`, `selector` (`exact` or the partial pattern), `exact` (matching `EXACT_SELECTORS`), `pass`, `final`, `fp` (fingerprint), `orphan`, `acquitted`, `tag`, `id`, `class`, `attrs`, `inline`, `block_tag`, `words`, `text` (visible text, ≤ 8,000 chars), `html` (cleaned, ≤ 4,000 chars), `link_density`, `links`, `has` (heading/paragraph/list/image/code/table), `context` (marked `⟦…⟧`), `block_words_outside`, `prev_text`, `next_text`, `heading`, `share_of_body_words`, `path`; plus per set: `page`, `url`, `title`, `label` (`wrongful`/`correct`/`ambiguous`/`unlabeled`), `issue` and `blocks` (bug pages), `commit`, `parent`, `subject` (history).

**Policy results** (`lab/acquittal/policy-<set>-<policy>.json`): `fixtures` {`changed`, `changed_list`, `restored`, `restored_list`}; `bugs` {`issues`, `fixed`, `fixed_list`, `W_blocks`, `W_recovered`, `C_blocks`, `C_leaked`, `leaks`, `restored`, `restored_list`, `per_issue`}; `history` / `historypre` {`wrongful`, `recovered`, `controls`, `controls_leaked`, `restored`, `restored_list`, `wrong_list`}. Every restored item carries its scores (`ans`: v1 with examples, v1 plain, phrase-only, role, v2).

**Answer cache** (`lab/acquittal/jev-cache.jsonl`): `{ "k": sha1(JSON.stringify({ MODEL, state, questions })), "a": { <question>: <noul probability or choice probabilities> } }`. 6,660 entries. Phase 1 and phase 2 keep raw answers in their own `raw-*.jsonl` / `results*.jsonl` files.

## 9.7 Cost record

| Phase | Requests | Spend |
|---|---|---|
| 1 (workflow, replay, spot checks) | ~8,000 | under $1 |
| 2 (factored design, role replay) | ~3,200 | ~$0.17 |
| 3–4 (acquittal v1 and v2, all sets) | 6,660 unique | ~$0.40 |
