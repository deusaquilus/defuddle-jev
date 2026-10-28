# Rules for live Jev experiments (read before running anything)

1. The API key lives in the environment variable `JEV_API_KEY`, exported in `~/.bashrc` (interactive shells only). Run every script as:
   `bash -ic 'node /home/alexi/git/defuddle/experiments/jev/research/<script>.mjs'`
   NEVER print, echo, grep, cat, log, or write the key or any `Authorization` header. Never `env`/`printenv` without a filter. Never commit anything.
2. Use `/home/alexi/git/defuddle/experiments/jev/research/jev.mjs` (`systemOne`, `mapConcurrent`, `usageTotals`, `estimateTokens`). It retries 429/529 and tracks token usage and latency. Always print `usageTotals()` at the end of a script so cost is known.
3. Default model: pin `jev-1.14.0` (confirmed working; `jev-1.13.0` also works). Report the `model` field from responses.
4. Spend cap per experiment script: stay under ~6M input tokens (~$0.25) unless the experiment plan explicitly says otherwise. Concurrency <= 8. If you hit 429 repeatedly, lower concurrency.
5. Per-question context limit is 32k tokens (state + question); 64k per request. Truncate states (strip script/style/svg paths/base64/long attribute values) rather than sending huge pages; record when truncation happened.
6. Write all scripts and outputs under `/home/alexi/git/defuddle/experiments/jev/research/results/<experiment-name>/`. Do not modify files inside `/home/alexi/git/defuddle` (the repo must stay clean; `git status` must stay clean apart from the untracked `dist/` build output and `node_modules/`).
7. The Defuddle Node build is at `/home/alexi/git/defuddle/dist/` (built with `npm run build:node`). linkedom is in `/home/alexi/git/defuddle/node_modules`. Import from the repo path. If an import fails, read `/home/alexi/git/defuddle/dist/node.js` to see the export shape rather than rebuilding.
8. Fixture tests define ground truth: for each `tests/fixtures/<name>.html` there is `tests/expected/<name>.md` (human-reviewed Markdown + JSON preamble). Treat the expected Markdown text as "what a correct reader view keeps".
9. Write questions the way the Jev brief recommends: one judgment per question, literal conditions, escape options on every Choice, prefer several Nouls over one Score, option names chosen carefully. Pin versions. Report confidence bands (>=0.9, 0.7-0.9, 0.5-0.7, <0.5) separately.
10. Report numbers honestly, including failures and sample sizes. Distinguish measured results from inference.
