# Runtime, product and operational constraints on inserting a hosted decision-model (Jev) call into Defuddle, per environment

_Verbatim final report of the phase-1 workflow agent `runtime-map` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

I read the entry points, option plumbing, Worker, privacy/terms/pricing pages, CI and test harness in /home/alexi/git/defuddle (0.19.6 @ 3e8bde9), built the browser bundles to measure them against the CI budgets, ran the perf suite under both DOM backends, and verified four external facts with live fetches (Obsidian Web Clipper source and package.json, Cloudflare Workers limits page, Workers AI typesafe/jev model page, Workers AI pricing/limits pages). Nothing in the repo was modified; outputs are under experiments/jev/research/results/runtime-constraints/.

Measured facts that bound the design: (1) The removal pipeline (`parseInternal`, src/defuddle.ts:811) is synchronous and is called up to six times by the word-count retry cascade (`_parseWithRetries`, :88-215); `parse()` (:73) is a public sync API used by the full bundle (src/index.full.ts:20-24), by the Worker playground route (website/src/convert.ts:22-27 via index.ts:368-380), by conversation extractors (src/extractors/_conversation.ts:26) and by the Obsidian clipper's `parseForClip` (clip-utils.ts, verified). An `await` inside the pipeline is therefore impossible without a breaking change; a model call can only be a pre-pass or post-pass around `parseInternal`, triggered from `parseAsync()` (:737-760), `defuddle/node` (src/node.ts:41), the CLI (src/cli.ts:84) and the Worker URL route (convert.ts:18-20, 129-202), all of which are already async. (2) Current parse time: linkedom p50 16 ms / p90 53 / p99 207 / max 418 ms over 226 fixtures; JSDOM p50 65 / p90 184 / p99 659 / max 1306 ms. A single Jev round trip (100-800 ms per the brief; Cloudflare-measured 524 ms median) is 6-30x the median parse. (3) Bundle budgets: core 90.2 KB gzip against a 92 KB budget (1.8 KB headroom), full 207.3/215 KB. A minimal hand-written client minifies to 705 B gzip and fits; the official `@typesafe-ai/sdk` 0.7.0 is 338,733 bytes unpacked and declares `engines.node >=22` while CI's floor is Node 20 (ci.yml:23), so the SDK is out for both bundles and CI. (4) The privacy page sentence "The npm package and browser extension run entirely locally and make no network requests." (website/src/privacy.ts:31, added 2026-03-14 in e58ecf4) was already inaccurate when written: `parseAsync`/`extractAsync` landed 2026-03-03 (f85fe52), five extractors declare `prefersAsync()` and fetch network-first (YouTube InnerTube, Reddit, bilibili, c2 wiki, X oEmbed/FxTwitter), `useAsync` defaults to true, and the clipper 1.7.1 calls `await parseAsync()` (raced against an ~8 s timeout, falling back to `parse()`) with no `useAsync:false`. README's "Third-party services" section (README.md:298-302) lists only FxTwitter. Any default-on model call would turn an incomplete disclosure into a plainly false one and would ship page text, including logged-in content (a Gmail extractor exists), to a US-hosted third party that had an output-leak incident on Oct 24.

For the Worker: Workers AI exposes `typesafe/jev` at $0.042/M input, $0 output, "Zero data retention: Yes", 32,000-token context, but its sample responses return jev-1.13.0 (not 1.14), billing is "still in neurons in the back end" with 10,000 free neurons/day and the Workers Paid plan required beyond that, and no rate-limit row exists for this model. wrangler.toml (lines 1-28) has no `[ai]` binding and the `Env` type (website/src/index.ts:26-32) has no `AI` member, so this is a config + type change rather than a new secret. Workers limits verified today: CPU 10 ms free / 30 s default, 5 min max paid (network wait is not CPU), HTTP wall-clock "No limit", 50/10,000 subrequests, 6 concurrent connections, 128 MB; whether `env.AI.run` counts as a subrequest is not stated. The Worker has no overall deadline; `FETCH_TIMEOUT` is 10 s per page fetch (src/fetch.ts:3) with a possible second 10 s bot-UA retry, 5 MB max page, 4 s for YouTube oEmbed; results are edge-cached with `s-maxage=300` (index.ts:17, 637). Revenue is $0.005/$0.004/$0.003 per paid request (pricing.ts:10,20,30; index.ts:20-24) and $0 for the 1,000/month/IP free tier (terms.ts:28). A model call costs 0.8% of revenue at 1k input tokens, 4-7% at 5k, 27-45% at the 32k per-question maximum; the task's $0.0004-0.004 range is 8%-133% of revenue. Because the state is billed once per request and questions are nearly free, one batched request per page is the cost shape; fixture decision points per page are p50 3, p90 11, p99 54, max 213.

Testing: tests/fixtures.test.ts:104-105 injects a rejecting `fetch` and compares output byte-for-byte after attribute normalization (:120); CI (ci.yml) runs that under Node 20/22/24 x linkedom/JSDOM with no secrets. With the brief's 12% chosen-option flip rate, the probability that a page's output is identical on rerun is 0.88^N: 53% at 5 decisions, 28% at 10, 0.17% at 50, so an un-cached live model cannot be under byte-equal tests at all. The feasible scheme is record/replay keyed on (pinned model, sha256 of whitespace-normalized state, sha256 of questions) with recordings committed as JSON; one full-suite recording pass over all 226 fixtures' visible text is ~99,760 tokens (~$0.004), but recordings go stale on any wording change and can only be refreshed by a key holder (not by fork PRs). Verdict for this dimension: a hosted decision model is insertable only as an opt-in, async-only, fail-open, cached pre/post-pass in Node, CLI and the Worker (Workers AI binding being the lowest-friction Worker path); it is effectively blocked in the browser/clipper environments by key custody, the privacy promise, the sync `parse()` contract in the clipper's clip path, content-script fetch restrictions and the 1.8 KB bundle headroom; and "aggressive" (default-on, hot-path, all-environments) use is ruled out by these runtime constraints alone. The deterministic security sanitizer (`_stripUnsafeElements`, src/defuddle.ts:1084-1090, unconditional) must remain the only guaranteed boundary; no network-dependent step can be ~99.99% reliable when the transport (429/529, "no guarantees" terms, 12% flip) is not.

## Verdict for this dimension

Runtime and product constraints permit a hosted decision model only as an opt-in, async-only, fail-open, cached pre/post-pass around the synchronous pipeline, and only in Node, CLI and the Worker; the Worker via the Workers AI `typesafe/jev` binding (no key, ZDR, $0.042/M, 4-7% of per-request revenue at typical state sizes, but Paid plan, `[ai]` binding, privacy-page edits and jev-1.13.0) is the lowest-friction place to run a shadow-mode trial. The browser/Obsidian clipper environment is effectively blocked (no safe key custody, the "make no network requests" privacy promise, content-script fetch restrictions, 1.8 KB gzip headroom, the clip path's sync parse(), and user-visible non-determinism). The byte-equal, secret-free, dual-DOM CI can only cover the model path through committed record/replay keyed on a pinned model and normalized state. "Aggressive" use (default-on, in the hot path, across environments) is ruled out by these constraints alone, and "~99.99% reliable" cannot be achieved by any network-dependent step; the unconditional deterministic sanitizer must remain the sole guaranteed boundary.

## Findings

- - **claim:** The removal pipeline is synchronous and multiply-invoked; a model call cannot be awaited inside it without breaking the public sync parse() contract, so any Jev integration must be a pre-pass or post-pass around parseInternal, driven only from already-async entry points.
  - **evidence:** parse() is sync at src/defuddle.ts:73 and calls _parse()/_parseWithRetries (:78-88); _parseWithRetries calls parseInternal() up to six times with different overrideOptions (:99, :104, :123, :141, :165, :198); parseInternal is declared sync at :811 and is also called recursively for extractor contentSelector runs (:873). parseAsync (:737-760) itself calls the sync this._parse() at :746 and only awaits tryAsyncExtractor (:787-807). Sync parse() consumers: src/index.full.ts:20-24, website/src/convert.ts:15 and :22-27 (POST /api/parse at website/src/index.ts:368-380), src/extractors/_conversation.ts:26, and the Obsidian clipper's clip-utils.ts parseForClip (verified by fetch: `new Defuddle(doc, { url: doc.URL }).parse()` from 'defuddle/full'). Async-capable call sites today: Defuddle.parseAsync (src/defuddle.ts:737), fetchAsyncVariables (:767), src/node.ts:41 (`await defuddle.parseAsync()`), src/cli.ts:84 (`await Defuddle(doc, url, defuddleOpts)`), website/src/convert.ts:18-20 defuddleHtmlAsync used by convertToHtml (:129-154) and convertToMarkdown (:156-202), and the clipper's content.ts (`await Promise.race([defuddle.parseAsync(), parseTimeout]).catch(() => defuddle.parse())`).
  - **confidence:** high
  - **refs:** - src/defuddle.ts:73
    - src/defuddle.ts:88-215
    - src/defuddle.ts:737-760
    - src/defuddle.ts:811
    - src/index.full.ts:20-30
    - src/node.ts:41
    - src/cli.ts:84
    - website/src/convert.ts:14-27
    - website/src/convert.ts:129-202
    - src/extractors/_conversation.ts:26
- - **claim:** The existing options.fetch plumbing is the only network seam and already reaches every extractor; a decisionModel option could reuse it, but tests inject a rejecting fetch, so in CI the model path would always fail and must fail open to the deterministic result.
  - **evidence:** DefuddleOptions.fetch at src/types.ts:151-156 ("Useful in environments where the global fetch has restrictions (e.g. browser extensions that need to proxy requests)"); threaded into ExtractorOptions at src/defuddle.ts:773, :793, :861-865 and src/extractors/_base.ts:3-7; BaseExtractor.fetch getter falls back to globalThis.fetch at _base.ts:22-24. tests/fixtures.test.ts:104-105 passes `fetch: () => Promise.reject(new Error('network disabled in fixture tests'))`; tests/perf.test.ts:14-17 and tests/twitter-linkedom.test.ts do the same; tests/preferred-async.test.ts and tests/degraded-fallback.test.ts call parseAsync without a fetch override (they rely on extractor-level behavior).
  - **confidence:** high
  - **refs:** - src/types.ts:151-156
    - src/defuddle.ts:861-865
    - src/extractors/_base.ts:22-24
    - tests/fixtures.test.ts:104-105
    - tests/perf.test.ts:14-17
- - **claim:** The privacy page's claim that the npm package and browser extension make no network requests is already inaccurate today, and README's third-party disclosure is incomplete; a default-on model call would make both plainly false.
  - **evidence:** website/src/privacy.ts:31: "The npm package and browser extension run entirely locally and make no network requests." (page 'updated March 14, 2026', privacy.ts:41; sentence introduced in commit e58ecf4 2026-03-14 'Meter API (#173)'). parseAsync/extractAsync were introduced in f85fe52 2026-03-03 and useAsync (default true) in f8ce8a4 2026-03-03 (src/types.ts:88-92). Five extractors override prefersAsync() (src/extractors/youtube.ts:87, reddit.ts:96, bilibili.ts:81, c2-wiki.ts:18, x-oembed.ts:132) and ExtractorRegistry.findPreferredAsyncExtractor (src/extractor-registry.ts:251-252) runs them FIRST in parseAsync (src/defuddle.ts:738-742) regardless of local content, contradicting README.md:300 ("This only happens when the page HTML contains no usable content"). Hosts fetched: api.fxtwitter.com, publish.twitter.com/oembed, www.youtube.com/youtubei/v1/player and /next, reddit.com (old.reddit/Atom), api.bilibili.com, c2.com/wiki/remodel/pages. README.md:298-302 lists only FxTwitter. The Obsidian clipper 1.7.1 (package.json `"defuddle": "^0.19.2"`) calls `await Promise.race([defuddle.parseAsync(), parseTimeout])` in content.ts with options `{ url: document.URL }` only, so useAsync stays true in the extension.
  - **confidence:** high
  - **refs:** - website/src/privacy.ts:31
    - website/src/privacy.ts:41
    - README.md:298-302
    - src/defuddle.ts:738-742
    - src/extractor-registry.ts:251-252
    - src/types.ts:88-92
- - **claim:** In the browser/clipper environment there is no safe place for a hosted-model API key and no caller-side plumbing to supply one; the only options are BYOK stored by the extension or a proxy someone else pays for.
  - **evidence:** Core bundle is a UMD 'web' target with zero runtime deps (webpack.config.js:48-74; package.json:78-81); any key compiled in is public (brief: "No browser-safe mode: a key shipped in client code is exposed"). Clipper content.ts constructs `new Defuddle(document, { url: document.URL })` with no fetch/useAsync/apiKey option and returns results via sendResponse (message passing), so defuddle has no channel to a key without a clipper change. Clipper README fetched today describes no BYOK/LLM feature and package.json has no LLM SDK dependency. The content script runs with the page's privileges, and a Gmail extractor exists (tests/extractor-attributes.test.ts:44 uses GMAIL_URL), so page state sent to the model may include logged-in private content. Brief: TypeSafe is US-hosted, ZDR only via enterprise sales, Oct 24 incident exposed customers' noul outputs.
  - **confidence:** high
  - **refs:** - webpack.config.js:48-74
    - package.json:78-86
    - tests/extractor-attributes.test.ts:44
    - src/types.ts:151-156
- - **claim:** Bundle budgets leave 1.8 KB (core) and 7.7 KB (full) gzip headroom; a minimal ~50-line HTTP client (705 B gzip) fits, the official JS SDK does not fit anywhere and cannot run on CI's Node 20 floor.
  - **evidence:** Built with `npm run build:js`; scripts/check-bundle-size.mjs output: dist/index.js 90.2 KB gzip / 92 KB budget, dist/index.full.js 207.3 KB gzip / 215 KB budget (raw 340,738 and 770,629 bytes). Budgets at scripts/check-bundle-size.mjs:7-10 ("~10% headroom ... bump them deliberately"); enforced in CI build job (.github/workflows/ci.yml:44-56). Earlier-attempt artifact experiments/jev/research/results/runtime-constraints/jev-client-sample.min.js: 1,112 bytes minified, 705 bytes gzip. `npm view @typesafe-ai/sdk`: version 0.7.0, dist.unpackedSize 338,733, fileCount 9, engines.node '>=22'; CI matrix is node [20, 22, 24] (ci.yml:23) and the comment at ci.yml:15-16 fixes the floor at 20.
  - **confidence:** high
  - **refs:** - scripts/check-bundle-size.mjs:7-10
    - .github/workflows/ci.yml:17-56
    - webpack.config.js:47-101
- - **claim:** Current parse time is small relative to one model round trip: a single Jev call would add 6-30x the median parse time, and the clipper already imposes an ~8 s total race on parseAsync.
  - **evidence:** Measured with tests/perf.test.ts (network disabled, profile:true) on this machine, 226 fixtures: linkedom parse min 3 / p50 16 / p75 27 / p90 53 / p95 81 / p99 207 / max 418 ms (sum 6,731 ms; DOM parse 196 ms = 3%); JSDOM parse min 12 / p50 65 / p75 105 / p90 184 / p95 257 / p99 659 / max 1,306 ms (sum 23,425 ms). Slowest: substack-app 418 ms, lesswrong 348 ms, mathjax 280 ms (linkedom). Per-step share (linkedom): removeBySelector 23%, standardizeContent 20%, standardizeElements 10%, findMainContent 10%, removeByContentPattern 8%, removeLowScoring 4%. Brief/excerpts: Jev p50 100-500 ms direct, 500-800 ms via gateways, Cloudflare-measured 524 ms median. Clipper content.ts races parseAsync against a timeout (reported ~8 s by the fetched source summary) then falls back to sync parse(). Raw outputs: experiments/jev/research/results/runtime-constraints/perf-linkedom.txt and perf-jsdom.txt.
  - **confidence:** high
  - **refs:** - tests/perf.test.ts:12-47
    - experiments/jev/research/results/runtime-constraints/perf-linkedom.txt
    - experiments/jev/research/results/runtime-constraints/perf-jsdom.txt
- - **claim:** For the Worker, Workers AI's typesafe/jev is usable without an outbound key and with ZDR, but it requires adding an [ai] binding and the Paid plan, returns jev-1.13.0 rather than 1.14, and has no published rate limit for this model.
  - **evidence:** Fetched https://developers.cloudflare.com/ai/models/typesafe/jev/ today: model id `typesafe/jev` via `env.AI.run`; pricing $0.042 per 1M input tokens, $0.00 output, $0.00 cached input; "Zero data retention | Yes"; provider "Third-party"; context "32,000 tokens"; sample responses return "jev-1.13.0"; question types shown noul/choice/score (no box); REST alternative uses CLOUDFLARE_API_TOKEN. Workers AI pricing page: "10,000 Neurons per day at no charge", $0.011 per 1,000 Neurons above that, "still billing in neurons in the back end", "To use more than 10,000 Neurons per day, you need to sign up for the Workers Paid plan"; no typesafe/jev row. Workers AI limits page: no row for typesafe/jev or decision models; generic text-generation default 300 rpm (applicability unknown); whether env.AI.run counts toward subrequest limits: not stated. Repo: website/wrangler.toml:1-28 declares only KV RATE_LIMIT and two Durable Objects, no [ai]; Env type at website/src/index.ts:26-32 has no AI member; website/worker-configuration.d.ts:8671-8724 already declares `abstract class Ai` with `run<Name>(model, inputs, options)`, so the types are present.
  - **confidence:** high
  - **refs:** - website/wrangler.toml:1-28
    - website/src/index.ts:26-32
    - website/worker-configuration.d.ts:8671-8724
- - **claim:** Workers platform limits do not block a model call: HTTP wall-clock is unlimited, CPU is 30 s default (5 min max) on Paid and network wait is not CPU, but the Free plan's 10 ms CPU would already be exceeded by current parse times, implying the Worker is on Paid.
  - **evidence:** Fetched https://developers.cloudflare.com/workers/platform/limits/ today: CPU time per HTTP request 10 ms (Free) / 5 min, default 30 s via limits.cpu_ms (Paid); Duration 'HTTP request: No limit'; waitUntil up to 30 s after response; subrequests 50 (Free) / 10,000 up to 10M (Paid); six simultaneous connections per invocation; 128 MB memory; Cache API max object 512 MB. Measured linkedom parse p50 16 ms, p99 207 ms exceeds 10 ms CPU, and the Worker uses Durable Objects (wrangler.toml:20-28). Inference: production runs on Workers Paid (not directly verifiable from the repo).
  - **confidence:** medium
  - **refs:** - website/wrangler.toml:20-28
- - **claim:** The Worker's request timing budget is dominated by page fetches (10 s per fetch, possibly twice), with a 5-minute edge cache; it sets no overall deadline, so a 0.5 s model call fits but adds to the already-uncapped tail.
  - **evidence:** src/fetch.ts:2-3 `MAX_SIZE = 5 * 1024 * 1024` and `FETCH_TIMEOUT = 10_000`; convertToMarkdown fetches once (website/src/convert.ts:170) and again with BOT_UA on wordCount 0 (:175-197); YouTube oEmbed `AbortSignal.timeout(4000)` (:104); Reddit redirect resolution uses FETCH_TIMEOUT (:66). Router: CACHE_TTL 300 (website/src/index.ts:17), `Cache-Control: s-maxage=${CACHE_TTL}` (:637), cache key = target URL + _fmt + _lang (:557-560), cache put via ctx.waitUntil (:643), API-key credit consumed before work (:583-590), IP limit 1,000/month via KV (:18, :146-158, :594-607), errors returned as 502 (:652-655). No request-level AbortSignal or deadline wraps convertToMarkdown.
  - **confidence:** high
  - **refs:** - src/fetch.ts:2-3
    - website/src/convert.ts:104
    - website/src/convert.ts:156-202
    - website/src/index.ts:17-18
    - website/src/index.ts:553-655
- - **claim:** Model cost per Worker request is 0.8%-45% of revenue depending on state size (4-7% at a typical 5k tokens), and 100% loss on the free tier; one batched request per page is the right cost shape because state is billed once per request.
  - **evidence:** Prices: $0.005/$0.004/$0.003 per request (website/src/pricing.ts:10,20,30; BLOCKS at website/src/index.ts:20-24: 1,000 for $5, 10,000 for $40, 100,000 for $300); free tier 1,000 requests/month/IP (terms.ts:28). Computed at $0.042/M input: 1k tokens $0.000042 (0.8-1.4%), 5k $0.00021 (4.2-7.0%), 10k $0.00042 (8.4-14%), 32k $0.00134 (26.9-44.8%), 64k $0.00269 (53.8-89.6%); task's $0.0004-0.004 range = 8%-133% of revenue; free tier at 5k tokens = $0.21/IP/month. Brief: 'A 3-question, 447-token ticket ≈ $0.000019' confirms state is billed once per request regardless of question count; context 32k per question / 64k per request. Fixture visible-text size (chars/4, script/style/svg stripped): p50 155 tok, p90 766, p95 1,501, p99 4,739, max 20,619 (lesswrong); decision points per fixture from earlier-attempt artifact per-fixture-decisions.json (n = removed + kept block decisions): p50 3, p75 5, p90 11, p99 54, max 213, sum 1,475 over 224 fixtures.
  - **confidence:** high
  - **refs:** - website/src/pricing.ts:10-30
    - website/src/index.ts:20-24
    - website/src/terms.ts:28
    - experiments/jev/research/results/runtime-constraints/metrics.json
- - **claim:** A non-deterministic remote model cannot sit under the byte-equal fixture suite without record/replay; with a 12% per-decision flip rate the chance a page's output is unchanged on rerun is 53% at 5 decisions and 0.17% at 50, and CI has no secrets to record with.
  - **evidence:** tests/fixtures.test.ts:120 `expect(normalizeMarkdownHtml(result.trim())).toEqual(normalizeMarkdownHtml(expected.trim()))` (byte-equal after normalization); 226 fixtures (ls tests/fixtures/*.html); CI runs `npm test` and `npm run test:jsdom` on Node 20/22/24 (.github/workflows/ci.yml:17-39) with no `secrets.` or `env:` entries; vitest testTimeout 30,000 ms (vitest.config.ts:11). Computed 0.88^N: N=1 88%, N=3 68%, N=5 53%, N=10 28%, N=20 7.8%, N=50 0.17%; whole suite identical at N=5 per fixture ≈ 1.8e-61. Record/replay requirements: pin `jev-1.14.0` (brief: jev-latest drifts), key on (model, sha256(normalized state), sha256(questions)), normalize whitespace because linkedom and JSDOM serialize text differently (CI runs both), commit recordings as JSON; a full recording pass over all fixtures' visible text is ~99,760 tokens ≈ $0.004; recordings go stale on any question/state-format change and only a key holder can refresh them (fork PRs cannot access secrets). AGENTS.md forbids changing expectations to match behavior, so shadow-mode disagreements would need their own non-golden assertions.
  - **confidence:** high
  - **refs:** - tests/fixtures.test.ts:99-127
    - .github/workflows/ci.yml:17-39
    - vitest.config.ts:11
    - AGENTS.md
- - **claim:** Node and CLI are the least constrained environments: async by design, network already used, key can live in an env var or option; the costs are offline breakage for local-file workflows and output drift for scripts that diff results.
  - **evidence:** src/node.ts:13-46 is `async function Defuddle` awaiting parseAsync (:41); src/cli.ts:84 awaits it; the CLI already fetches pages with proxy support from HTTP(S)_PROXY/NO_PROXY env (src/fetch.ts:22-43) and reads files/stdin offline (cli.ts:69-81). CLI option surface (cli.ts:164-176) and defuddleOpts (cli.ts:56-61) expose neither `fetch` nor `useAsync`, so a `--decision-model`/env plumbing would be new. README.md:36-46 documents Node usage; README Options table (:182-200) would gain rows; README.md:298-302 third-party list would need TypeSafe/Cloudflare added. package.json:24-39 exports map and `files` would be unchanged if the client is hand-written (no new dependency).
  - **confidence:** high
  - **refs:** - src/node.ts:13-46
    - src/cli.ts:56-61
    - src/cli.ts:164-176
    - src/fetch.ts:22-43
    - package.json:24-39
- - **claim:** Security sanitization (meaning A) is unaffected by and must stay independent of any model call: it runs unconditionally after every pipeline path and is the only guaranteed boundary.
  - **evidence:** src/defuddle.ts:1084-1090: "Strip dangerous elements and URI attributes from the final output. Runs unconditionally — the pipeline steps above are all optional, so this is the only guaranteed sanitization boundary on this path"; `_stripUnsafeElements` defined at :329, also applied at :190, :325, :1824. AGENTS.md: "Preserve sanitization regardless of pipeline options." Brief Section 8: Jev is never the only gate; injection flips 93-100% of routing decisions; confidence is not authorization. A model call inserted as a pre/post-pass around parseInternal never touches this boundary.
  - **confidence:** high
  - **refs:** - src/defuddle.ts:329
    - src/defuddle.ts:1084-1090
    - AGENTS.md

## Metrics

- **repo_version:** defuddle 0.19.6 @ 3e8bde9
- **bundle_gzip_kb:** - **core_actual:** 90.2
  - **core_budget:** 92
  - **core_headroom:** 1.8
  - **full_actual:** 207.3
  - **full_budget:** 215
  - **full_headroom:** 7.7
  - **core_raw_bytes:** 340738
  - **full_raw_bytes:** 770629
- **minimal_client_gzip_bytes:** 705
- **typesafe_sdk:** - **version:** 0.7.0
  - **unpackedSize_bytes:** 338733
  - **engines_node:** >=22
  - **ci_node_floor:** 20
- **parse_ms_linkedom:** - **n:** 226
  - **min:** 3
  - **p50:** 16
  - **p75:** 27
  - **p90:** 53
  - **p95:** 81
  - **p99:** 207
  - **max:** 418
  - **mean:** 29.8
  - **sum:** 6731
- **parse_ms_jsdom:** - **n:** 226
  - **min:** 12
  - **p50:** 65
  - **p75:** 105
  - **p90:** 184
  - **p95:** 257
  - **p99:** 659
  - **max:** 1306
  - **mean:** 103.7
  - **sum:** 23425
- **per_step_share_linkedom:** - **removeBySelector:** 0.23
  - **standardizeContent:** 0.2
  - **standardizeElements:** 0.1
  - **findMainContent:** 0.1
  - **removeByContentPattern:** 0.08
  - **standardizeFootnotesCallouts:** 0.07
  - **removeHiddenElements:** 0.04
  - **removeLowScoring:** 0.04
- **fixture_visible_text_tokens:** - **p50:** 155
  - **p75:** 336
  - **p90:** 766
  - **p95:** 1501
  - **p99:** 4739
  - **max:** 20619
  - **suite_total:** 99760
  - **suite_recording_cost_usd:** 0.0042
- **decision_points_per_fixture:** - **n_fixtures:** 224
  - **p50:** 3
  - **p75:** 5
  - **p90:** 11
  - **p99:** 54
  - **max:** 213
  - **sum:** 1475
- **worker:** - **FETCH_TIMEOUT_ms:** 10000
  - **MAX_PAGE_MB:** 5
  - **oembed_timeout_ms:** 4000
  - **CACHE_TTL_s:** 300
  - **free_requests_per_month_per_ip:** 1000
  - **price_per_request_usd:** - 0.005
    - 0.004
    - 0.003
  - **ai_binding_in_wrangler:** False
  - **ai_type_in_env:** False
  - **overall_request_deadline:** none
- **workers_ai_jev:** - **model_id:** typesafe/jev
  - **usd_per_M_input:** 0.042
  - **usd_per_M_output:** 0
  - **zdr:** Yes
  - **version_in_samples:** jev-1.13.0
  - **context_tokens:** 32000
  - **free_neurons_per_day:** 10000
  - **usd_per_1000_neurons:** 0.011
  - **paid_plan_required_beyond_free:** True
  - **rate_limit_row_for_model:** not stated
- **cf_workers_limits:** - **cpu_ms_free:** 10
  - **cpu_ms_paid_default:** 30000
  - **cpu_ms_paid_max:** 300000
  - **http_wall_clock:** no limit
  - **waitUntil_s:** 30
  - **subrequests_free:** 50
  - **subrequests_paid:** 10000
  - **concurrent_connections:** 6
  - **memory_mb:** 128
  - **ai_run_counts_as_subrequest:** not stated
- **model_cost_fraction_of_revenue:** - **1k_tokens:** 0.8-1.4%
  - **5k_tokens:** 4.2-7.0%
  - **10k_tokens:** 8.4-14%
  - **32k_tokens:** 26.9-44.8%
  - **64k_tokens:** 53.8-89.6%
  - **task_range_0.0004_to_0.004:** 8-133%
  - **free_tier_cost_per_ip_month_at_5k:** 0.21
- **jev_latency_ms_from_brief:** - **direct_p50:** 100-500
  - **gateway:** 500-800
  - **cloudflare_measured_median:** 524
- **flake_probability_12pct_flip:** - **N1:** 0.88
  - **N3:** 0.68
  - **N5:** 0.53
  - **N10:** 0.28
  - **N20:** 0.078
  - **N50:** 0.0017
  - **suite_N5_per_fixture:** 1.8e-63
- **clipper:** - **version:** 1.7.1
  - **defuddle_dep:** ^0.19.2
  - **bundle_used_content_ts:** defuddle (core) + createMarkdownContent from defuddle/full
  - **call:** await Promise.race([parseAsync(), ~8s timeout]).catch(() => parse())
  - **options_passed:** { url: document.URL }
  - **clip_utils_call:** defuddle/full .parse() sync
  - **llm_sdk_deps:** 0
- **privacy_sentence:** - **file:** website/src/privacy.ts:31
  - **added_commit:** e58ecf4 2026-03-14
  - **parseAsync_added_commit:** f85fe52 2026-03-03
  - **prefersAsync_extractors:** 5
  - **readme_third_party_listed:** 1
- **ci:** - **node_matrix:** - 20
    - 22
    - 24
  - **dom_backends:** - linkedom
    - jsdom
  - **secrets:** 0
  - **fixtures:** 226
  - **testTimeout_ms:** 30000

## Tables

## Table 1. Environment x constraint matrix (measured unless marked INF = inference)

| Dimension | Browser core bundle in Obsidian Web Clipper (`defuddle`) | Browser full bundle (`defuddle/full`) | Node (`defuddle/node`) | CLI (`src/cli.ts`) | Cloudflare Worker defuddle.md |
|---|---|---|---|---|---|
| Sync or async API today | Both exported: `parse()` sync (src/defuddle.ts:73), `parseAsync()` (:737). Clipper content.ts: `await Promise.race([parseAsync(), ~8s])` then `.catch(() => parse())`. Removal pipeline itself sync (:811), invoked up to 6x by retries (:88-215) | Wrapper `parse()` sync and `parseAsync()` (src/index.full.ts:20-30). Clipper clip-utils.ts `parseForClip` uses sync `.parse()` only | Async only: `await parseAsync()` (src/node.ts:41) | Async (cli.ts:84 awaits node entry) | URL route async (convert.ts:18-20, 129-202); `POST /api/parse` playground route is sync `parse()` (convert.ts:22-27, index.ts:368-380) |
| Can it make a network call | Yes in principle: extractors already use `globalThis.fetch` (_base.ts:22-24). Content-script fetch is bound by page CORS/CSP; `fetch` option exists precisely for "browser extensions that need to proxy requests" (types.ts:151-156); clipper passes no `fetch` | Same as core | Yes (Node 20+ global fetch; `options.fetch` override) | Yes; already fetches pages with HTTP(S)_PROXY support (src/fetch.ts:22-43) | Yes: outbound fetch or `env.AI` binding. No `[ai]` in wrangler.toml:1-28; `Env` (index.ts:26-32) lacks `AI`; types present (worker-configuration.d.ts:8671) |
| Where would an API key live; safe? | No safe place: bundle is public UMD (webpack.config.js:48-74). Only BYOK in extension storage (requires clipper change; clipper has no LLM SDK dep and README describes no BYOK feature) or a third-party proxy. Not safe by default | Same | Env var (e.g. TYPESAFE_API_KEY) or option; server-side, acceptable | Env var; acceptable; needs new CLI flag/plumbing (cli.ts:56-61, :164-176 expose no fetch/useAsync) | Workers AI binding needs no key (verified); direct API key would be a wrangler secret like STRIPE_SECRET_KEY (index.ts:28). Safe |
| Privacy promise text that applies | privacy.ts:31 "The npm package and browser extension run entirely locally and make no network requests." Already inaccurate (5 `prefersAsync` extractors fetch network-first; clipper leaves useAsync=true). Page state may include logged-in content (Gmail extractor; tests/extractor-attributes.test.ts:44) | Same | privacy.ts:31 ("npm package") + README.md:298-302 third-party list (only FxTwitter listed) | README.md:298-302 | privacy.ts:9 (URL processed, IP for rate limit), :17 no persistent content storage, :21 cache <=24 h, :26-28 third parties = Cloudflare + Stripe only; terms.ts:31 no uptime guarantees. Workers AI jev: ZDR Yes, provider "Third-party" |
| Latency budget and current parse time | Clipper: ~8 s race on parseAsync (fetched source). Parse p50 65 / p90 184 / p99 659 / max 1306 ms (JSDOM proxy). Jev +100-800 ms/round trip | Same | No budget. Parse p50 16 / p90 53 / p99 207 / max 418 ms (linkedom) | Interactive; same as Node | No Worker deadline; FETCH_TIMEOUT 10 s x up to 2 fetches, oEmbed 4 s; parse p50 16 ms; Jev via Workers AI ~524 ms median (excerpts); CPU 30 s default paid, network wait not CPU |
| Cost owner | End user (BYOK); nobody else can pay | End user | Integrator | User | kepano. Revenue $0.005/$0.004/$0.003 per paid request; $0 on 1,000/month/IP free tier. Model = 4-7% of revenue at 5k tokens, 27-45% at 32k; free tier $0.21/IP/month at 5k |
| Offline requirement | Clipping works offline today except async extractors; must fail open | Same | Batch/local-HTML users expect offline; opt-in only | `defuddle parse file.html` / stdin is offline today | None (service is online by nature) |
| Determinism / test implications | Same page clipped twice differs (12% flip/decision; 0.88^N). Not testable in fixtures.test.ts (offline fetch :104-105, byte-equal :120) | Same | Fixture suite uses this entry (fixtures.test.ts:4). Needs record/replay keyed on (model, normalized state hash, questions hash); CI has no secrets; linkedom vs JSDOM text differences must be normalized | Scripts diffing CLI output break | Edge cache (s-maxage=300) means a URL's output changes every 5 min of expiry; playground `/api/parse` can't use model at all |
| Bundle-size implications | 90.2/92 KB gzip: 1.8 KB headroom. Minimal client 705 B gzip fits; `@typesafe-ai/sdk` (338,733 B unpacked, node>=22) does not | 207.3/215 KB: 7.7 KB headroom | None (tsc output, no budget); SDK's node>=22 conflicts with CI Node 20 | None | None (wrangler/esbuild; no budget) |
| Breaking-change implications | `parse()` must stay sync; model only via parseAsync pre/post-pass. New options additive. Clipper must opt in explicitly. Output drift for users | Same; clip-utils sync path unreachable | Additive option; no new dependency if hand-written client | New flag; additive | Add `[ai]` binding + Env type + privacy/terms text; API output drift; `/api/parse` unchanged |

## Table 2. Model cost per Worker request vs revenue ($0.042/M input, output free)

| input tokens/request | model cost | % of $0.005 | % of $0.004 | % of $0.003 |
|---|---|---|---|---|
| 1,000 | $0.000042 | 0.8% | 1.1% | 1.4% |
| 2,500 | $0.000105 | 2.1% | 2.6% | 3.5% |
| 5,000 | $0.000210 | 4.2% | 5.3% | 7.0% |
| 10,000 | $0.000420 | 8.4% | 10.5% | 14.0% |
| 20,000 | $0.000840 | 16.8% | 21.0% | 28.0% |
| 32,000 (per-question max) | $0.001344 | 26.9% | 33.6% | 44.8% |
| 64,000 (per-request max) | $0.002688 | 53.8% | 67.2% | 89.6% |

Task-stated $0.0004-0.004 per call = 8%-133% of revenue. Free tier (1,000 req/month/IP, $0 revenue) at 5k tokens = $0.21 per IP per month of pure cost. State is billed once per request; questions are nearly free, so one batched request per page (p50 3, p90 11, p99 54 decision points) is the cost shape. Fixture visible text: p50 155 tok, p95 1,501, p99 4,739, max 20,619.

## Table 3. Flake probability under the brief's 12% chosen-option flip rate (independent decisions)

| decisions per page N | P(identical output on rerun) = 0.88^N |
|---|---|
| 1 | 88.0% |
| 3 | 68.2% |
| 5 | 52.8% |
| 10 | 27.9% |
| 20 | 7.8% |
| 50 | 0.17% |
| 226 fixtures x 5 | 1.8e-61 |

Implication: un-cached live calls can never run under tests/fixtures.test.ts:120 (byte-equal). Record/replay: key = (pinned `jev-1.14.0`, sha256(whitespace-normalized state), sha256(questions)); commit JSON recordings; a full recording pass over all 226 fixtures' visible text is ~99,760 tokens (~$0.004); refresh requires a key holder (CI has no secrets; fork PRs cannot use them); shadow-mode disagreement rates need separate non-golden assertions because AGENTS.md forbids changing expectations to match behavior.

## Table 4. Opt-in option surface a design would need (additive to DefuddleOptions, src/types.ts:45-157)

| field | type | purpose / constraint |
|---|---|---|
| `decisionModel.endpoint` | string | default `https://api.typesafe.ai/v1/systemone`; swappable to Ollaya/vllm-jev/OpenRouter (same wire) or a `'workers-ai'` sentinel |
| `decisionModel.model` | string | pinned, e.g. `jev-1.14.0` (Workers AI serves 1.13.0) |
| `decisionModel.apiKey` or `decisionModel.fetch` or `decisionModel.run` | string / fetch-like / `(state, questions) => Promise` | `fetch` lets extensions proxy via background; `run` lets the Worker pass `env.AI.run.bind(env.AI)`; never store a key in the bundle |
| `decisionModel.mode` | `'shadow' \| 'tiebreak' \| 'full'` | shadow = call, log disagreements in `debug`, never change output; tiebreak = only for blocks in a configurable score band (e.g. scoring.ts score in [-k, +k]) or when retries fire; full = replace heuristic decisions |
| `decisionModel.timeoutMs` | number | must be well under clipper's ~8 s race and under FETCH_TIMEOUT; AbortSignal.timeout |
| `decisionModel.failOpen` | boolean (default true) | on error/timeout/429/529/low confidence return the deterministic result; fail-closed makes no sense for a clutter remover |
| `decisionModel.cache` | `{ get, set }` | keyed on (model, state hash, questions hash); Worker could use KV/Cache API; tests use committed recordings |
| `decisionModel.maxStateTokens` | number | truncate/strip (script/style/svg/base64) to stay under 32k per question / 64k per request |
| `decisionModel.thresholds` | per-question numbers | tuned on labeled data (brief: 0.5 default is wrong per task) |
| `decisionModel.redact` | boolean | strip emails/URLs/etc. from state before sending (privacy); still not a security control |
| result additions | `debug.decisions[]`, `profile['decisionModel']`, `decisionModelUsed: boolean` | audit trail because Jev returns no reasons |

Async-capable call sites today that could host the pre/post-pass: `Defuddle.parseAsync` (src/defuddle.ts:737), `fetchAsyncVariables` (:767), `tryAsyncExtractor` (:787), `defuddle/node` (src/node.ts:41), CLI (src/cli.ts:84, :97, :103), Worker `defuddleHtmlAsync` (website/src/convert.ts:18-20) used by `convertToHtml` (:129) and `convertToMarkdown` (:156), clipper content.ts. Sync-only, unreachable: `parse()` (:73), full-bundle `parse()` (index.full.ts:20), Worker `/api/parse` (convert.ts:22-27), `_conversation.ts:26`, clipper clip-utils.ts.

## Table 5. Blockers vs feasible paths per environment

| Environment | Blockers | Feasible path (if any) |
|---|---|---|
| Browser core in clipper | No safe key; privacy sentence; content-script fetch restrictions; 1.8 KB headroom; 8 s race; sends possibly private page text to US third party; output non-determinism visible to end users | Only: clipper-owned BYOK + background proxy passed through a `decisionModel.fetch`/`run` hook, `mode:'tiebreak'`, failOpen, hand-written client. Requires clipper code and privacy-page changes; not something defuddle can enable alone |
| Browser full | Same plus clip-utils uses sync `parse()` | Same as core; clip path unreachable |
| Node | Offline users; output drift; README/privacy disclosure | Opt-in `decisionModel` with env-var key, shadow first; hand-written client (SDK needs node>=22) |
| CLI | Offline file/stdin workflows; scripts diffing output; new flag plumbing | `--decision-model` / env var, default off, failOpen |
| Worker | Needs `[ai]` binding + Paid plan + privacy/terms text; margin 4-45%; free tier pure cost; Workers AI serves jev-1.13.0; `/api/parse` sync; no per-model rate limit published | Best candidate: `env.AI.run('typesafe/jev')` in `defuddleHtmlAsync` as shadow mode behind a flag, cache decisions in KV/Cache API keyed by URL+lang like the response cache, restrict to paid-key requests to protect margin, hard timeout ~1 s, failOpen |

## Caveats

- Perf numbers are from one Linux machine with tests/perf.test.ts (single cold run per fixture, JIT warming across fixtures) and 226 mostly small hand-made fixtures (median 1.7 KB HTML); real pages are larger and slower. JSDOM is a proxy for browser DOM, not a measurement of Chrome.
- Token counts use chars/4 on visible text as an estimate; Jev's tokenizer was not used. Decision-points-per-fixture (p50 3, p90 11, max 213) come from an earlier attempt's artifact per-fixture-decisions.json (224 entries, n = removed + kept block decisions); the exact counting rule in that script was not re-derived here.
- The 12% chosen-option flip rate and latency figures are from the brief/excerpts (Yang et al.; OpenRouter; Cloudflare-measured 524 ms), not measured here; the flake table assumes independent flips.
- Obsidian Web Clipper facts (defuddle ^0.19.2, parseAsync raced against a timeout, {url} only, clip-utils sync parse) come from WebFetch summaries of main-branch source today; the timeout value (~8 s) is as reported by that summary and was not read verbatim. My recollection that the clipper ships an 'Interpreter' BYOK feature is NOT confirmed by the README fetched today and should be treated as unverified.
- Whether production defuddle.md runs on Workers Paid is inferred from parse times exceeding the Free plan's 10 ms CPU limit and from Durable Object use; not directly verifiable from the repo. Whether env.AI.run counts toward subrequest limits and what rate limit applies to typesafe/jev on Workers AI are 'not stated' on the pages fetched.
- Workers AI pricing is in neurons; the $0.042/M figure on the model page is the token-equivalent and the pricing page says billing is 'still in neurons in the back end'. The model page's sample responses show jev-1.13.0; whether 1.14 is served was not verifiable.
- Cost-fraction math assumes state billed once per request (brief's 447-token/3-question example) and ignores cache hits (s-maxage=300) which would reduce effective per-request model cost by the cache hit rate, which is unknown.
- No live Jev API calls were made in this slice; nothing here measures model accuracy. `npm view` and WebFetch were used for public metadata only; no key was read or printed. The repo stayed clean apart from untracked dist/ build output (npm run build:js was run to measure bundle sizes).

## Artifacts

- experiments/jev/research/results/runtime-constraints/metrics.json
- experiments/jev/research/results/runtime-constraints/perf-linkedom.txt
- experiments/jev/research/results/runtime-constraints/perf-jsdom.txt
- experiments/jev/research/results/runtime-constraints/jev-client-sample.min.js
- experiments/jev/research/results/runtime-constraints/per-fixture-decisions.json
- experiments/jev/research/results/runtime-constraints/parse-times.json
