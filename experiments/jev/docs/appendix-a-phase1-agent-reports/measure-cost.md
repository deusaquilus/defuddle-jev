# Cost / latency / limits model for four Jev integration shapes (measured on 226 Defuddle fixtures, dist build, linkedom; no API calls)

_Verbatim final report of the phase-1 workflow agent `measure-cost` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

I measured every one of the 226 fixtures in /home/alexi/git/defuddle/tests/fixtures with the compiled Node build (dist/node.js -> dist/defuddle.js, linkedom 0.18.12, Node 22.20): raw bytes, cleaned-HTML bytes (script/style/noscript/template, comments, SVG path data, base64 data: URIs and >200-char attribute values stripped, whitespace collapsed), body text bytes, token estimates (HTML bytes/3.5, text bytes/4 — stated assumptions), labeled units from experiments/jev/research/results/dataset/blocks.jsonl, ENTRY_POINT_ELEMENTS candidates counted exactly as findMainContent does (src/defuddle.ts:1247-1256), and which _parseWithRetries branches fire (captured from the debug console.log lines at src/defuddle.ts:103/122/140/164/197/203). I also ran the repo perf test once (unmodified; vitest hid console output on the first run, so it was re-run with --silent=false). Scripts and raw outputs are under experiments/jev/research/results/measure-cost/.

The fixture set is dominated by tiny synthetic cases: median raw 1,755 B, median cleaned-body ~412 HTML tokens, median 3 labeled units. Only 14 fixtures exceed 20 KB raw ("real" group: median 53.6 KB raw, 12.6k HTML tokens, 1.5k text tokens, 28 units, parse 92 ms). The ten largest are mathjax (202 KB), lesswrong (150 KB), maggieappleton (130 KB), x.com article (123 KB), github issue (105 KB), 12gramsofcarbon (98 KB), substack-app (68 KB), katex-centraliser (54 KB), figma blog (45 KB), obsidian blog (32 KB). Because the synthetic fixtures are short, the first retry branch (wordCount < 200, src/defuddle.ts:102) fires on 178/226 (78.8%) fixtures but is accepted on only 3; across all branches a retry is accepted on 11/226 (4.9%). On the real group any retry fires on 1/14 and the final pick is plain `html > body` on 3/14. A "retry fired or body pick" gate therefore fires on 82% of fixtures (loose) or 32-36% (strict: <50-word branches, schema, body pick, excluding extractor pages whose empty selector is by design) — it is not a selective trigger.

Shape costs at $0.042/M: S2 (one container Choice, ~2k tokens) is $0.000084/page = $0.084 per 1,000 pages and adds ~250 ms. S1c (one request per page, N Nouls over an id-annotated cleaned page) costs $0.53/1,000 on the real-fixture median and an extrapolated $0.75-2.00/1,000 for 15k-40k-token real pages, adds ~500 ms, but 2/14 real fixtures (14%) and, by extrapolation, roughly half of 50-500 KB real-world pages exceed the 32k per-question limit (breakpoint ~164 KB raw at the real group's median cleaned/raw ratio 0.68), forcing chunking. S1 (one request per block) costs about the same tokens as S1c ($0.55/1,000 real median, $0.91-2.41/1,000 extrapolated) but is request-rate bound: 28-114 requests per page means 7-28 s sequential or 1-3.75 s at 8-concurrent per page, and only 0.28-0.71 pages/s (1,000-2,600 pages/hour) under the community-cited 1,200 req/min limit. S3 gated (strict gate, 32-36%) brings expected cost to ~$0.03/1,000 under S2 or ~$0.26/1,000 under S1c on real pages. S4 (S1+S2 everywhere) is $0.63/1,000 (real median) to $1.6-2.5/1,000 extrapolated.

Against defuddle.md's $0.003-0.005 per request: S2 is 1.7-2.8% of revenue; S1/S1c on a typical 25k-token page are 25-50%; on a 40k-token page S1/S4 reach 48-83%. Against current parse time (dist: median 21 ms all fixtures, 92 ms real group; vitest: 16 ms median, 355 ms max; total 6.4 s across 226 fixtures, removeBySelector 23% and findMainContent 10% of step time), every shape adds at least 250 ms, i.e. 2.7x the real-group median parse, and S1 adds 11x+ at 8-concurrent. Implication for the Jev question: dollar cost is immaterial for a single container-level Choice or a gated check, significant but not prohibitive for per-block judgments on a paid service, and the real constraints are latency (any shape multiplies parse time), the 32k per-question window (half of real pages need chunking for HTML-state block judgments), the request-rate ceiling (per-block requests cap throughput at ~1,000 pages/hour), and the fact that Defuddle's existing retry signals are far too noisy to serve as a confidence gate without redesign.

## Verdict for this dimension

Cost is not the limiting factor for a single container-level Choice (S2: $0.08 per 1,000 pages, ~2% of defuddle.md's price) or a strictly gated check (~$0.03 per 1,000), and even per-block judgment is affordable on a paid service ($0.5-2.5 per 1,000 real pages, 10-80% of defuddle.md's price depending on page size). The binding constraints are elsewhere: (1) latency — every shape adds >=250 ms, 2.7x the real-page median parse time, and per-block requests add 1-4 s at 8-concurrent, which rules S1/S4 out of the synchronous browser path and makes them marginal for the Worker; (2) the 32k per-question window — 14% of real fixtures and an estimated ~half of 50-500 KB real-world pages exceed it with HTML state, so block-level S1c needs chunking or text-only state; (3) the request-rate ceiling — per-block requests cap throughput at ~1,000 pages/hour at a typical 71 blocks per page, versus 30k-72k/hour for S1c/S2; (4) Defuddle's existing retry signals are far too noisy to serve as a cheap gate (fire on 79-82% of fixtures, accepted 5%); a usable S3 needs a redesigned trigger (strict <50-word branches + body pick fires 29-36%). Net for "use Jev aggressively": an always-on per-block design is feasible in cost but not in latency or throughput; the economically and operationally viable shapes are a single container Choice or a gated, chunk-aware block pass on the server-side paths only.

## Findings

- - **claim:** The fixture corpus is overwhelmingly small synthetic pages; only 14/226 exceed 20 KB raw, so per-page cost figures from the full set understate real-world cost by roughly 10-20x.
  - **evidence:** Measured: raw bytes min 319 / p25 1,210 / median 1,755 / mean 7,432 / p90 8,788 / max 201,904. Real group (>20,000 B, n=14): median 53,613 B raw, 44,013 B cleaned body, 6,034 B text, 12,575 est. HTML tokens, 1,509 est. text tokens, 28 units; synthetic (n=212): median 1,665 B raw, 385 HTML tokens, 2 units.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/measure-cost/measurements.json
    - experiments/jev/research/results/measure-cost/metrics.json (groups.real, groups.synthetic)
- - **claim:** Ten largest fixtures (raw bytes -> est. HTML tokens / units): math--mathjax 201,904 -> 15,906 / 8; lesswrong 149,598 -> 42,178 / 213; maggieappleton 129,896 -> 18,372 / 101; x.com-article-2026-02-13 123,151 -> 33,363 / 43 (extractor); github-issue-56 104,933 -> 23,927 / 11; 12gramsofcarbon 97,605 -> 19,011 / 54; substack-app 68,228 -> 12,575 / 2; katex-centraliser 53,613 -> 14,901 / 18; figma blog 45,359 -> 8,770 / 28; obsidian blog 31,902 -> 5,367 / 25.
  - **evidence:** Measured from file bytes and the cleaned-body regex; units from blocks.jsonl. Cleaned-body/raw ratio in the real group: p25 0.59, median 0.68, p75 0.84 (mathjax drops to 0.28 because of inline MathJax script/style).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/measure-cost/model-output.md (Ten largest table)
- - **claim:** Defuddle's retry cascade is not a usable confidence gate as-is: the <200-word branch fires on 78.8% of fixtures but is accepted on 1.3%; across all branches retries are accepted on only 4.9% of fixtures.
  - **evidence:** Measured from debug log lines: retry_partial fired 178/226, accepted 3; retry_hidden fired 60, accepted 7; hidden-selector fired 7, accepted 7; index-page retry fired 53, accepted 3; schema.org retry fired 1 (general--substack-app), schema text used 0. Real group: any retry fired 1/14 (substack-app, which fires all four), accepted 1/14. Code: src/defuddle.ts:102-173 (word-count thresholds 200/50/50), 189-210 (schema 1.5x).
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/defuddle.ts:102
    - /home/alexi/git/defuddle/src/defuddle.ts:121
    - /home/alexi/git/defuddle/src/defuddle.ts:163
    - /home/alexi/git/defuddle/src/defuddle.ts:189
    - experiments/jev/research/results/measure-cost/metrics.json (groups.*.flags, addendum.gate_decomposition)
- - **claim:** Final content pick is the bare `html > body` on 14/226 fixtures (6.2%) overall and 3/14 (21%) of real pages (mathjax, katex-centraliser, daringfireball); 16 further fixtures have an empty selector only because a site extractor bypassed findMainContent.
  - **evidence:** Measured result.debug.contentSelector. Gate fractions: loose (any retry fired OR body/empty) 186/226 = 82.3% all, 5/14 = 35.7% real; strict (<50-word branches, schema, body/empty) 82/226 = 36.3%, 5/14; strict excluding extractor pages 73/226 = 32.3%, 4/14 = 28.6%.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (addendum.gate_decomposition, addendum.real_group_detail)
- - **claim:** ENTRY_POINT_ELEMENTS yields very few container candidates: unique candidates are 1 (body only) on 36 fixtures, 2 on 136, >=3 on 54; median 2, max 16 (github issue). A container Choice (S2) is therefore a 2-4-option question on most pages, never near the 255-option cap, and has nothing to choose on 16% of fixtures.
  - **evidence:** Measured by replicating src/defuddle.ts:1247-1256 (one candidate per selector x element pair; totals median 2, max 16). ENTRY_POINT_ELEMENTS defined at src/constants.ts:3-24 ends with 'body' so there is always >=1.
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/constants.ts:3
    - /home/alexi/git/defuddle/src/defuddle.ts:1247
- - **claim:** S2 (one ~2k-token container Choice per page) costs $0.000084/page = $0.084 per 1,000 pages, 1.7-2.8% of defuddle.md's $0.003-0.005 price, adds ~250 ms, and is request-rate bound at 20 pages/s (72,000/hour).
  - **evidence:** Model: 2,000 tokens x $0.042/M; latency 250 ms (brief's 100-500 ms p50 range, OpenRouter 175 ms p50); 1,200 req/min / 1 request per page. Measured-candidate alternative estimate (300 + 150 tokens per candidate) gives 1,500-2,700 tokens.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/model.mjs
    - experiments/jev/research/JEV_AGENT_BRIEF.md (Limits and errors table)
- - **claim:** S1c (one request per page, state = id-annotated cleaned body HTML, one Noul per block) costs $0.000534/page on the real-fixture median ($0.53/1,000; p90 $1.05/1,000; max lesswrong $2.36/1,000) and an extrapolated $0.75 / $1.25 / $2.00 per 1,000 for 15k / 25k / 40k-token pages; it adds ~500 ms and is token-rate bound at 8-14 pages/s (30k-50k/hour).
  - **evidence:** Model: tokens = HTML tokens + 6/block annotation + 60/question; real median 12,707 tokens, p90 25,038, max 56,236. Throughput = min(20 req/s, 250k tok/s / tokens). Mid 25k-token page: 71 units, 29,686 tokens, 8.4 pages/s.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (groups.real.shapes.S1c, extrapolation.mid_25k)
- - **claim:** S1c exceeds the 32k per-question limit on 2/14 real fixtures (lesswrong 42,178 state tokens; x.com article 33,363) and, by extrapolation, on roughly half of real-world 50-500 KB pages; the 64k per-request limit never binds (0/226) under the interpretation that state is counted once per request.
  - **evidence:** Measured: s1c_exceeds_q_limit 2/226 (0.9%) overall, 2/14 (14.3%) real. Breakpoint raw size where cleaned-body HTML tokens + 60 > 32,000: 164 KB at the real-group median cleaned/raw ratio 0.68 (134 KB at p75 ratio 0.84, 190 KB at p25 0.59). ASSUMPTION: real-world raw sizes log-uniform on 50-500 KB -> 42-57% exceed (48% at the median ratio). A text-only state variant would not exceed until ~919 KB raw. Per-request interpretation inferred from the semantic-find cookbook (218 Nouls over one ToS state in one request).
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (addendum.s1c_breakpoints)
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md (semantic-find cookbook)
- - **claim:** S1 (one request per block) has roughly the same token cost as S1c ($0.55/1,000 real median; $0.91 / $1.50 / $2.41 per 1,000 extrapolated) but is request-rate bound: 28 requests per real-median page (213 max; 43/71/114 extrapolated) gives 7 s sequential / 1.0 s at 8-concurrent on the real median, 17.75 s / 2.25 s on a typical 25k-token page, and only 0.28-0.71 pages/s (1,000-2,600 pages/hour) at 1,200 req/min, ~25x below its token-rate ceiling.
  - **evidence:** Model: tokens per block = block HTML tokens (mean 203 in real group, 155 overall) + 300 overhead; 250 ms per request; 1,475 total requests across the 226 fixtures = 671,779 tokens = $0.028 for the whole corpus. No block exceeds the per-question limit (units are <=300 words and were capped at 6,000 chars).
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (groups.*.shapes.S1, extrapolation.*.throughput)
- - **claim:** S3 (gated) expected cost on real pages is ~$0.03 per 1,000 under S2 and ~$0.26 per 1,000 under S1c at the measured 35.7% gate rate, with expected added latency 89 ms (S2) / 179 ms (S1c) and worst case 250 / 500 ms; but because the loose gate fires on 82% of fixtures the saving over 'always call' is small unless the gate is redesigned.
  - **evidence:** Model: expected cost = gate fraction x underlying shape cost per page. All fixtures: loose gate under S2 $0.069/1,000, strict $0.031/1,000; under S1c loose $0.041, strict $0.028.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (S3)
- - **claim:** S4 (S1 on every block + S2 on every page) costs $0.63/1,000 on the real-fixture median and $0.99 / $1.59 / $2.49 per 1,000 extrapolated (21%/53%/83% of a $0.003 defuddle.md request at real-median / 25k / 40k tokens), with 1.25-4 s added latency at 8-concurrent and ~1,000 pages/hour throughput.
  - **evidence:** Model sums: real median 15,086 tokens/page, 29 requests; extrapolated 72 / 115 requests per page.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (groups.real.shapes.S4, comparison)
- - **claim:** Current Defuddle parse time is 16-21 ms median (355-492 ms max) with linkedom, so any Jev shape adds at least 2.7x the real-group median parse (92 ms) and S1 at 8-concurrent adds 11x on the real median.
  - **evidence:** Measured: repo perf test (src via vitest, linkedom): total 6,696 ms for 226 fixtures (DOM 204 ms, parse 6,448 ms); parse median 16 ms, p90 53, max 355 (lesswrong), then substack-app 344, mathjax 246, github-issue 195, katex-centraliser 182, mastodon 176, maggieappleton 148. Per-step totals: removeBySelector 1,053 ms (23%), standardizeContent 892 (19%), findMainContent 448 (10%), standardizeElements 428 (9%), removeByContentPattern 386 (8%), standardizeFootnotesCallouts 363 (8%), removeHiddenElements 211 (5%), removeLowScoring 165 (4%). Dist build run: median 21 ms all, 92.4 ms real, p90 282, max 492 (substack-app).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/measure-cost/perf-test-output.txt
    - /home/alexi/git/defuddle/tests/perf.test.ts
- - **claim:** A 120 KB real page maps to ~23k HTML tokens / ~4.2k text tokens / ~70 blocks by the real group's measured ratios, consistent with the task's 15-40k / 1.5-4k assumption; text-only state is 5-6x cheaper than HTML state and almost never hits the window limit, at the price of losing markup cues.
  - **evidence:** Real group ratios: cleaned body/raw median 0.68, text/raw median 0.14, 2.84 units per 1k HTML tokens (p25 1.21, p75 4.69). 120,000 x 0.68 / 3.5 = 23,383 HTML tokens; 120,000 x 0.14 / 4 = 4,170 text tokens. Inference, not measured on real traffic.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/measure-cost/metrics.json (extrapolation.basis, extrapolation.measured_ratio_120kb)

## Metrics

- **fixtures:** 226
- **real_group_n:** 14
- **synthetic_n:** 212
- **real_threshold_bytes:** 20000
- **assumptions:** - **html_bytes_per_token:** 3.5
  - **text_bytes_per_token:** 4
  - **price_usd_per_token:** 4.2e-08
  - **per_question_limit_tokens:** 32000
  - **per_request_limit_tokens:** 64000
  - **s1_question_overhead_tokens:** 300
  - **s1c_tokens_per_question:** 60
  - **s1c_annotation_tokens_per_block:** 6
  - **s2_tokens_nominal:** 2000
  - **latency_small_ms:** 250
  - **latency_large_ms:** 500
  - **concurrency:** 8
  - **rate_rpm:** 1200
  - **rate_tps:** 250000
  - **defuddle_md_price_usd:** - 0.003
    - 0.005
- **raw_bytes:** - **all:** - **min:** 319
    - **p25:** 1210
    - **median:** 1755
    - **mean:** 7432
    - **p75:** 3595
    - **p90:** 8788
    - **max:** 201904
  - **real:** - **min:** 20068
    - **p25:** 30183
    - **median:** 53613
    - **mean:** 79047
    - **p90:** 129896
    - **max:** 201904
  - **synthetic:** - **median:** 1665
    - **mean:** 2703
    - **p90:** 4952
    - **max:** 19430
- **cleaned_body_bytes:** - **all_median:** 1442
  - **real_median:** 44013
  - **real_mean:** 53843
  - **real_max:** 147622
  - **synthetic_median:** 1349
- **text_bytes:** - **all_median:** 621
  - **real_median:** 6034
  - **real_mean:** 13842
  - **real_max:** 83380
- **est_tokens_html_body:** - **all_median:** 412
  - **all_p90:** 2002
  - **real_median:** 12575
  - **real_p90:** 23927
  - **real_max:** 42178
  - **synthetic_median:** 385
- **est_tokens_text:** - **all_median:** 155
  - **real_median:** 1509
  - **real_p90:** 4501
  - **real_max:** 20845
- **units:** - **total:** 1475
  - **all_median:** 3
  - **all_p90:** 10
  - **real_median:** 28
  - **real_p90:** 54
  - **real_max:** 213
  - **synthetic_median:** 2
  - **sum_html_chars:** 799140
  - **sum_est_tokens:** 229279
  - **mean_block_tokens_all:** 155.4
  - **mean_block_tokens_real:** 203.4
  - **units_per_1k_html_tokens_real_median:** 2.84
- **entry_candidates:** - **total_median:** 2
  - **total_max:** 16
  - **unique_eq_1:** 36
  - **unique_eq_2:** 136
  - **unique_ge_3:** 54
  - **real_unique_median:** 2
- **retry_branches_all_226:** - **retry_partial_fired:** 178
  - **retry_partial_accepted:** 3
  - **retry_hidden_fired:** 60
  - **retry_hidden_accepted:** 7
  - **retry_hidden_selector_fired:** 7
  - **retry_hidden_selector_accepted:** 7
  - **retry_index_fired:** 53
  - **retry_index_accepted:** 3
  - **schema_retry_fired:** 1
  - **schema_text_used:** 0
  - **any_retry_fired:** 178
  - **any_retry_accepted:** 11
  - **selector_html_body:** 14
  - **selector_empty_extractor:** 16
  - **gate_loose:** 186
  - **gate_strict:** 82
  - **gate_strict_excluding_extractor_pages:** 73
- **retry_branches_real_14:** - **any_retry_fired:** 1
  - **any_retry_accepted:** 1
  - **selector_html_body:** 3
  - **selector_empty_extractor:** 1
  - **gate_loose:** 5
  - **gate_strict:** 5
  - **gate_strict_excluding_extractor_pages:** 4
- **gate_fractions:** - **all_loose:** 0.823
  - **all_strict:** 0.363
  - **all_strict_no_extractor:** 0.323
  - **real_loose:** 0.357
  - **real_strict:** 0.357
  - **real_strict_no_extractor:** 0.286
- **parse_ms_dist_build:** - **all_median:** 21
  - **all_p90:** 60.5
  - **all_max:** 492.2
  - **real_median:** 92.4
  - **real_p90:** 282.4
  - **real_max:** 492.2
  - **total_parse_ms:** 7747
  - **total_dom_ms:** 216
- **perf_test_vitest:** - **total_ms:** 6696
  - **dom_ms:** 204
  - **parse_ms:** 6448
  - **parse_median_ms:** 16
  - **parse_p90_ms:** 53
  - **parse_max_ms:** 355
  - **top:** - **lesswrong:** 355
    - **substack-app:** 344
    - **mathjax:** 246
    - **github-issue-56:** 195
    - **katex-centraliser:** 182
    - **mastodon:** 176
    - **maggieappleton:** 148
    - **12gramsofcarbon:** 130
    - **author-contact-block:** 114
    - **wikipedia:** 94
  - **per_step_ms:** - **removeBySelector:** 1053
    - **standardizeContent:** 892
    - **findMainContent:** 448
    - **standardizeElements:** 428
    - **removeByContentPattern:** 386
    - **standardizeFootnotesCallouts:** 363
    - **removeHiddenElements:** 211
    - **se_img_latex:** 178
    - **removeLowScoring:** 165
    - **se_pre_prismjs:** 89
    - **removeEmptyLines:** 85
- **shapes_all_fixtures:** - **S1:** - **requests_median:** 3
    - **requests_p90:** 10
    - **requests_max:** 213
    - **tokens_median:** 1157
    - **tokens_p90:** 4448
    - **tokens_max:** 99056
    - **usd_per_page_median:** 4.9e-05
    - **usd_per_1000_median_page:** 0.0486
    - **usd_per_1000_mean_page:** 0.1248
    - **latency_seq_ms_median:** 750
    - **latency_c8_ms_median:** 250
    - **latency_c8_ms_max:** 6750
    - **corpus_total_requests:** 1475
    - **corpus_total_tokens:** 671779
    - **corpus_total_usd:** 0.02821
    - **exceeds_limits:** 0
  - **S1c:** - **tokens_median:** 588
    - **tokens_p90:** 2997
    - **tokens_max:** 56236
    - **usd_per_page_median:** 2.5e-05
    - **usd_per_1000_median_page:** 0.0247
    - **usd_per_1000_mean_page:** 0.083
    - **latency_ms:** 250-500
    - **exceeds_q_limit:** 2
    - **exceeds_req_limit:** 0
    - **corpus_total_tokens:** 446849
    - **corpus_total_usd:** 0.01877
  - **S2:** - **tokens:** 2000
    - **usd_per_page:** 8.4e-05
    - **usd_per_1000:** 0.084
    - **latency_ms:** 250
    - **max_choice_options:** 17
  - **S4:** - **tokens_median:** 3157
    - **usd_per_page_median:** 0.000133
    - **usd_per_1000_median_page:** 0.1326
    - **usd_per_1000_mean_page:** 0.2088
    - **latency_c8_ms_median:** 500
    - **latency_c8_ms_max:** 7000
    - **corpus_total_usd:** 0.0472
- **shapes_real_group:** - **S1:** - **requests_median:** 28
    - **requests_p90:** 54
    - **requests_max:** 213
    - **tokens_median:** 13086
    - **tokens_p90:** 30984
    - **tokens_max:** 99056
    - **usd_per_page_median:** 0.00055
    - **usd_per_page_p90:** 0.0013
    - **usd_per_page_max:** 0.0042
    - **usd_per_1000_median_page:** 0.5496
    - **usd_per_1000_mean_page:** 0.9348
    - **latency_seq_ms_median:** 7000
    - **latency_seq_ms_max:** 53250
    - **latency_c8_ms_median:** 1000
    - **latency_c8_ms_max:** 6750
  - **S1c:** - **tokens_median:** 12707
    - **tokens_p90:** 25038
    - **tokens_max:** 56236
    - **usd_per_page_median:** 0.000534
    - **usd_per_1000_median_page:** 0.5337
    - **usd_per_1000_mean_page:** 0.7687
    - **latency_ms:** 500
    - **exceeds_q_limit_count:** 2
    - **exceeds_q_limit_frac:** 0.143
    - **chunks_max:** 2
  - **S2:** - **usd_per_1000:** 0.084
    - **latency_ms:** 250
  - **S4:** - **requests_median:** 29
    - **tokens_median:** 15086
    - **usd_per_page_median:** 0.000634
    - **usd_per_1000_median_page:** 0.6336
    - **usd_per_1000_mean_page:** 1.0188
    - **latency_c8_ms_median:** 1250
    - **latency_c8_ms_max:** 7000
- **S3_gated:** - **all_loose_under_S2_usd_per_1000:** 0.0691
  - **all_strict_under_S2_usd_per_1000:** 0.0305
  - **all_loose_under_S1c_usd_per_1000:** 0.0409
  - **all_strict_under_S1c_usd_per_1000:** 0.0278
  - **real_under_S2_usd_per_1000:** 0.03
  - **real_under_S1c_usd_per_1000:** 0.2645
  - **real_expected_latency_ms_S2:** 89
  - **real_expected_latency_ms_S1c:** 179
  - **worst_case_latency_ms:** 500
- **extrapolation_real_pages:** - **basis:** - **raw_kb:** 120
    - **measured_ratio_cleaned_body_over_raw:** 0.682
    - **measured_ratio_text_over_raw:** 0.139
    - **cross_check_html_tokens_120kb:** 23383
    - **cross_check_text_tokens_120kb:** 4170
  - **low_15k:** - **units:** 43
    - **S1_requests:** 43
    - **S1_tokens:** 21646
    - **S1_usd_per_1000:** 0.9091
    - **S1_latency_seq_ms:** 10750
    - **S1_latency_c8_ms:** 1500
    - **S1_pages_per_s:** 0.47
    - **S1c_tokens:** 17838
    - **S1c_usd_per_1000:** 0.7492
    - **S1c_exceeds:** False
    - **S1c_pages_per_s:** 14.02
    - **S4_usd_per_1000:** 0.9931
  - **mid_25k:** - **units:** 71
    - **S1_requests:** 71
    - **S1_tokens:** 35741
    - **S1_usd_per_1000:** 1.5011
    - **S1_latency_seq_ms:** 17750
    - **S1_latency_c8_ms:** 2250
    - **S1_pages_per_s:** 0.28
    - **S1_pages_per_hour:** 1015
    - **S1c_tokens:** 29686
    - **S1c_usd_per_1000:** 1.2468
    - **S1c_exceeds:** False
    - **S1c_pages_per_s:** 8.42
    - **S1c_pages_per_hour:** 30312
    - **S4_usd_per_1000:** 1.5851
    - **S4_latency_c8_ms:** 2500
  - **high_40k:** - **units:** 114
    - **S1_requests:** 114
    - **S1_tokens:** 57388
    - **S1_usd_per_1000:** 2.4103
    - **S1_latency_c8_ms:** 3750
    - **S1_pages_per_s:** 0.17
    - **S1c_tokens:** 47524
    - **S1c_usd_per_1000:** 1.996
    - **S1c_exceeds_q_limit:** True
    - **S1c_chunks:** 2
    - **S1c_pages_per_s:** 5.26
    - **S4_usd_per_1000:** 2.4943
  - **heavy_80k:** - **units:** 227
    - **S1_requests:** 227
    - **S1_usd_per_1000:** 4.7994
    - **S1_latency_c8_ms:** 7250
    - **S1_pages_per_hour:** 317
    - **S1c_chunks:** 3
    - **S1c_usd_per_1000:** 3.9892
  - **s1c_breakpoint_raw_bytes:** - **at_ratio_p25_0.59:** 189796
    - **at_ratio_median_0.68:** 163915
    - **at_ratio_p75_0.84:** 133720
    - **at_ratio_0.95:** 117674
  - **assumed_loguniform_50_500kb_fraction_exceeding_32k:** - **p25_ratio:** 0.421
    - **median_ratio:** 0.484
    - **p75_ratio:** 0.573
  - **text_state_variant_breakpoint_raw_bytes:** 919137
- **throughput_at_1200rpm_250ktps:** - **S2_pages_per_s:** 20
  - **S2_pages_per_hour:** 72000
  - **S1_real_fixture_median_pages_per_s:** 0.714
  - **S1c_real_fixture_median_pages_per_s:** 19.67
  - **S1_mid_25k_pages_per_s:** 0.28
  - **S1c_mid_25k_pages_per_s:** 8.42
  - **S1_token_bound_mid_25k_pages_per_s:** 7
  - **S1_binding_constraint:** requests/min
  - **S1c_binding_constraint:** tokens/s
- **comparison_vs_defuddle_md_pct_of_0.003:** - **real_median_S1:** 18.3
  - **real_median_S1c:** 17.8
  - **real_median_S2:** 2.8
  - **real_median_S4:** 21.1
  - **mid_25k_S1:** 50
  - **mid_25k_S1c:** 41.6
  - **mid_25k_S2:** 2.8
  - **mid_25k_S4:** 52.8
  - **high_40k_S1:** 80.3
  - **high_40k_S1c:** 66.5
  - **high_40k_S4:** 83.1
- **comparison_vs_defuddle_md_pct_of_0.005:** - **real_median_S1:** 11
  - **real_median_S1c:** 10.7
  - **real_median_S2:** 1.7
  - **mid_25k_S1:** 30
  - **mid_25k_S1c:** 24.9
  - **high_40k_S4:** 49.9
- **added_latency_vs_current_parse:** - **real_median_parse_ms:** 92.4
  - **S2_multiple:** 2.7
  - **S1c_multiple:** 5.4
  - **S1_c8_real_median_multiple:** 10.8
  - **S1_c8_mid_25k_multiple:** 24.4

## Tables

## Ten largest fixtures (raw > 20,000 B = "real" group, n=14)
| fixture | raw B | cleaned body B | text B | HTML tok | text tok | units | unit tok sum | cands total/uniq | final selector | any retry | parse ms (dist) | parse ms (vitest) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| math--mathjax | 201,904 | 55,670 | 1,336 | 15,906 | 334 | 8 | 123 | 1/1 | html > body | no | 273 | 246 |
| general--lesswrong.com-... | 149,598 | 147,622 | 83,380 | 42,178 | 20,845 | 213 | 35,156 | 2/2 | body > div[id="S:5"] > ... | no | 417 | 355 |
| footnotes--maggieappleton.com-xanadu-patterns | 129,896 | 64,303 | 18,003 | 18,372 | 4,501 | 101 | 13,837 | 4/4 | main > main.styled-main > article | no | 175 | 148 |
| general--x.com-article-2026-02-13 | 123,151 | 116,772 | 10,312 | 33,363 | 2,578 | 43 | 13,865 | 5/3 | (xarticle extractor) | no | 21 | 23 |
| general--github.com-issue-56 | 104,933 | 83,744 | 4,529 | 23,927 | 1,132 | 11 | 9,085 | 16/16 | body.logged-out... | no | 235 | 195 |
| general--12gramsofcarbon.com-... | 97,605 | 66,540 | 22,718 | 19,011 | 5,680 | 54 | 14,784 | 4/3 | div#entry > div#main > ... | no | 180 | 130 |
| general--substack-app | 68,228 | 44,013 | 3,448 | 12,575 | 862 | 2 | 3,439 | 2/2 | div#entry > div.reader-nav-root... | YES (all 4 + schema) | 492 | 344 |
| math--katex-centraliser | 53,613 | 52,153 | 3,482 | 14,901 | 871 | 18 | 7,506 | 1/1 | html > body | no | 282 | 182 |
| general--www.figma.com-blog-... | 45,359 | 30,694 | 7,142 | 8,770 | 1,786 | 28 | 7,064 | 5/5 | div#app > div.blog-wrapper... | no | 84 | 71 |
| general--obsidian.md-blog-... | 31,902 | 18,786 | 6,034 | 5,367 | 1,509 | 25 | 4,887 | 2/2 | div:nth-of-type(3) > div.container... | no | 52 | 41 |
| (rest of real group) general--wikipedia | 30,183 | — | — | 7,897 | 1,503 | 37 | — | — | html.client-nojs... | no | 92 | 94 |
| issues--120-dhammatalks-footnotes | 25,951 | — | — | 6,196 | 3,485 | 46 | — | — | body.d-flex > div.container-xx | no | 48 | 44 |
| general--daringfireball.net-... | 24,263 | — | — | 4,888 | 2,908 | 28 | — | — | html > body | no | 86 | 53 |
| elements--lazy-image | 20,068 | — | — | 2,022 | 457 | 5 | — | — | div#root > div.a.b.c > article | no | 49 | 44 |

## Size distributions (tokens: HTML bytes/3.5, text bytes/4)
| metric | group | n | min | p25 | median | mean | p75 | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| raw_bytes | all | 226 | 319 | 1,210 | 1,755 | 7,432 | 3,595 | 8,788 | 201,904 |
| raw_bytes | real | 14 | 20,068 | 30,183 | 53,613 | 79,047 | 104,933 | 129,896 | 201,904 |
| raw_bytes | synthetic | 212 | 319 | 1,182 | 1,665 | 2,703 | 3,145 | 4,952 | 19,430 |
| cleaned_body_bytes | all | 226 | 187 | 886 | 1,442 | 5,413 | 3,051 | 7,007 | 147,622 |
| cleaned_body_bytes | real | 14 | 7,077 | 21,687 | 44,013 | 53,843 | 64,303 | 83,744 | 147,622 |
| text_bytes | all | 226 | 0 | 334 | 621 | 1,776 | 1,343 | 3,015 | 83,380 |
| text_bytes | real | 14 | 1,336 | 3,482 | 6,034 | 13,842 | 11,631 | 18,003 | 83,380 |
| est HTML tokens (body) | all | 226 | 53 | 253 | 412 | 1,546 | 872 | 2,002 | 42,178 |
| est HTML tokens (body) | real | 14 | 2,022 | 6,196 | 12,575 | 15,384 | 18,372 | 23,927 | 42,178 |
| est HTML tokens (body) | synthetic | 212 | 53 | 243 | 385 | 633 | 756 | 1,201 | 4,026 |
| est text tokens | all | 226 | 0 | 84 | 155 | 444 | 336 | 754 | 20,845 |
| est text tokens | real | 14 | 334 | 871 | 1,509 | 3,461 | 2,908 | 4,501 | 20,845 |
| units (labeled blocks) | all | 226 | 0 | 1 | 3 | 7 | 5 | 10 | 213 |
| units | real | 14 | 2 | 11 | 28 | 44 | 43 | 54 | 213 |
| units | synthetic | 212 | 0 | 1 | 2 | 4 | 4 | 8 | 46 |
| est tokens, sum of unit HTML | all | 226 | 0 | 182 | 337 | 1,015 | 677 | 1,721 | 35,156 |
| est tokens, sum of unit HTML | real | 14 | 123 | 3,978 | 5,615 | 8,993 | 9,085 | 13,865 | 35,156 |
| entry candidates (total, as findMainContent counts) | all | 226 | 1 | 2 | 2 | 2 | 3 | 3 | 16 |
| entry candidates (unique) | all | 226 | 1 | 2 | 2 | 2 | 2 | 3 | 16 |
| parse ms (dist, linkedom) | all | 226 | 2 | 12.2 | 21 | 34.3 | 32.9 | 60.5 | 492 |
| parse ms (dist, linkedom) | real | 14 | 21 | 51.7 | 92.4 | 177.7 | 235.3 | 282.4 | 492 |
| parse ms (dist, linkedom) | synthetic | 212 | 2 | 11.8 | 19.6 | 24.8 | 30.4 | 48.1 | 130 |
| cleaned body / raw ratio | real | 14 | 0.28 | 0.59 | 0.68 | 0.71 | 0.84 | 0.95 | 0.99 |
| text / raw ratio | real | 14 | 0.01 | 0.07 | 0.14 | 0.20 | 0.20 | 0.48 | 0.56 |
| units per 1k HTML tokens | real | 14 | 0.16 | 1.21 | 2.84 | 3.23 | 4.69 | 5.50 | 7.42 |

Unique entry-point candidates: ==1 (body only) 36 fixtures; ==2 136; >=3 54.

## Retry-branch firing (from debug log lines; src/defuddle.ts lines in parentheses)
| branch | all (n=226) | real (n=14) | synthetic (n=212) | non-extractor (n=209) |
|---|---|---|---|---|
| partial-selector retry fired, wordCount<200 (L102-103) | 178 (78.8%) | 1 (7.1%) | 177 (83.5%) | 163 (78.0%) |
| ... accepted (>2x words, L109-112) | 3 (1.3%) | 1 | 2 | 3 |
| hidden-element retry fired, wordCount<50 (L121-122) | 60 (26.6%) | 1 (7.1%) | 59 (27.8%) | 53 (25.4%) |
| ... accepted (L126-128) | 7 (3.1%) | 0 | 7 | 7 |
| hidden-content-selector retry fired (L139-140) | 7 (3.1%) | 0 | 7 | 7 |
| ... accepted (L155-157) | 7 (3.1%) | 0 | 7 | 7 |
| index-page retry fired, wordCount<50 (L163-164) | 53 (23.4%) | 1 (7.1%) | 52 (24.5%) | 46 (22.0%) |
| ... accepted (L170-172) | 3 (1.3%) | 1 | 2 | 3 |
| schema.org retry fired, >1.5x words (L189-197) | 1 (0.4%) | 1 (7.1%) | 0 | 1 |
| schema.org text used as content (L203) | 0 | 0 | 0 | 0 |
| ANY retry fired | 178 (78.8%) | 1 (7.1%) | 177 (83.5%) | 163 (78.0%) |
| ANY retry accepted | 11 (4.9%) | 1 (7.1%) | 10 (4.7%) | 11 (5.3%) |
| final selector == html > body | 14 (6.2%) | 3 (21.4%) | 11 (5.2%) | 14 (6.7%) |
| final selector empty (all are extractor pages) | 16 (7.1%) | 1 | 15 | 0 |
| gate LOOSE (any retry fired OR body/empty) | 186 (82.3%) | 5 (35.7%) | 181 (85.4%) | 169 (80.9%) |
| gate STRICT (<50-word branches, schema, body/empty) | 82 (36.3%) | 5 (35.7%) | 77 (36.3%) | 66 (31.6%) |
| gate STRICT excluding extractor pages | 73 (32.3%) | 4 (28.6%) | 69 (32.5%) | — |

## Perf test (npx vitest run tests/perf.test.ts, unmodified repo, linkedom): total 6,696 ms for 226 fixtures (DOM 204 ms, parse 6,448 ms); parse median 16 ms, p90 53 ms, max 355 ms
| Total | DOM | Parse | Size | Fixture |
|---|---|---|---|---|
| 369 | 14 | 355 | 145KB | general--lesswrong.com-... |
| 349 | 5 | 344 | 67KB | general--substack-app |
| 264 | 18 | 246 | 197KB | math--mathjax |
| 209 | 13 | 195 | 102KB | general--github.com-issue-56 |
| 188 | 7 | 182 | 52KB | math--katex-centraliser |
| 180 | 4 | 176 | 12KB | comments--mastodon.social-@user-12345678 |
| 166 | 19 | 148 | 127KB | footnotes--maggieappleton.com-xanadu-patterns |
| 136 | 6 | 130 | 95KB | general--12gramsofcarbon.com-... |
| 121 | 6 | 114 | 3KB | author-contact-block |
| 98 | 4 | 94 | 29KB | general--wikipedia |

| ms | % | Step |
|---|---|---|
| 1053 | 23% | removeBySelector |
| 892 | 19% | standardizeContent |
| 448 | 10% | findMainContent |
| 428 | 9% | standardizeElements |
| 386 | 8% | removeByContentPattern |
| 363 | 8% | standardizeFootnotesCallouts |
| 211 | 5% | removeHiddenElements |
| 178 | 4% | se:img.latex[src*="latex.php"],sp |
| 165 | 4% | removeLowScoring |
| 89 | 2% | se:pre, div[class*="prismjs"], .s |
| 85 | 2% | removeEmptyLines |
| 53 | 1% | flattenWrapperElements[1] |
| 49 | 1% | cloneDocument |
| (remaining 39 steps) | <=1% each | |

## Shapes on fixtures (per page; $0.042 per 1M input tokens; 250 ms/request small state, 500 ms large; 8-concurrent)
### All 226 fixtures
| shape | requests/page med/p90/max | tokens/page med/p90/max | $/page med/p90/max | $/1,000 (median page) | $/1,000 (mean page) | added latency med/max | exceeds limits |
|---|---|---|---|---|---|---|---|
| S1 per-block, 1 req/block | 3/10/213 | 1,157/4,448/99,056 | $0.000049/$0.000187/$0.0042 | $0.049 | $0.125 | seq 750/53,250 ms; c8 250/6,750 ms | 0 |
| S1c 1 req/page, N Nouls over annotated page | 1 (chunks 1/1/2) | 588/2,997/56,236 | $0.000025/$0.000126/$0.0024 | $0.025 | $0.083 | 250/500 ms | >32k/question: 2 (0.9%); >64k/request: 0 |
| S2 container Choice | 1 | 2,000 (1,500-3,000) | $0.000084 | $0.084 | $0.084 | 250 ms | options>255: 0 (max 17) |
| S4 = S1 + S2 | 4/11/214 | 3,157/6,448/101,056 | $0.000133/$0.000271/$0.0042 | $0.133 | $0.209 | c8 serial 500/7,000 ms | as S1 |
Corpus totals: S1 1,475 requests, 671,779 tokens, $0.028; S1c 446,849 tokens, $0.019; S4 $0.047.

### Real group (14 fixtures > 20 KB)
| shape | requests/page med/p90/max | tokens/page med/p90/max | $/page med/p90/max | $/1,000 (median page) | $/1,000 (mean page) | added latency med/max | exceeds limits |
|---|---|---|---|---|---|---|---|
| S1 | 28/54/213 | 13,086/30,984/99,056 | $0.00055/$0.0013/$0.0042 | $0.550 | $0.935 | seq 7,000/53,250 ms; c8 1,000/6,750 ms | 0 |
| S1c | 1 (chunks 1/1/2) | 12,707/25,038/56,236 | $0.000534/$0.0011/$0.0024 | $0.534 | $0.769 | 500/500 ms | >32k/question: 2/14 (14.3%: lesswrong, x.com article) |
| S2 | 1 | 2,000 | $0.000084 | $0.084 | $0.084 | 250 ms | 0 |
| S4 | 29/55/214 | 15,086/32,984/101,056 | $0.000634/$0.0014/$0.0042 | $0.634 | $1.019 | c8 1,250/7,000 ms | as S1 |

## S3 confidence-gated (expected cost = gate fraction x underlying shape)
| group | gate | underlying | gate fraction | $/page expected | $/1,000 expected | expected added latency | worst case |
|---|---|---|---|---|---|---|---|
| all | loose | S2 | 82.3% | $0.000069 | $0.069 | 206 ms | 250 ms |
| all | strict | S2 | 36.3% | $0.000030 | $0.031 | 91 ms | 250 ms |
| all | loose | S1c | 82.3% | $0.000041 | $0.041 | 211 ms | 500 ms |
| all | strict | S1c | 36.3% | $0.000028 | $0.028 | 96 ms | 500 ms |
| real | loose = strict | S2 | 35.7% | $0.000030 | $0.030 | 89 ms | 250 ms |
| real | loose = strict | S1c | 35.7% | $0.000264 | $0.265 | 179 ms | 500 ms |

## Extrapolation to typical real pages (ASSUMPTION: ~120 KB raw; 15k/25k/40k HTML tokens; 1.5k/2.5k/4k text tokens; units = 2.84 per 1k HTML tokens from the real group; mean block 203 tokens). Measured-ratio cross-check for 120 KB: cleaned body 81,840 B -> 23,383 HTML tokens; text 16,680 B -> 4,170 text tokens.
| page | units | shape | requests | tokens | $/page | $/1,000 | added latency | limit status | pages/s @1,200 rpm & 250k tps | pages/hour |
|---|---|---|---|---|---|---|---|---|---|---|
| low 15k | 43 | S1 | 43 | 21,646 | $0.00091 | $0.91 | seq 10.75 s; c8 1.5 s | ok | 0.47 | 1,674 |
| low 15k | 43 | S1c | 1 | 17,838 | $0.00075 | $0.75 | 500 ms | ok | 14.0 | 50,472 |
| low 15k | 43 | S2 | 1 | 2,000 | $0.000084 | $0.084 | 250 ms | ok | 20 | 72,000 |
| low 15k | 43 | S4 | 44 | 23,646 | $0.00099 | $0.99 | c8 1.75 s | as S1 | 0.46 | 1,638 |
| mid 25k | 71 | S1 | 71 | 35,741 | $0.0015 | $1.50 | seq 17.75 s; c8 2.25 s | ok | 0.28 | 1,015 |
| mid 25k | 71 | S1c | 1 | 29,686 | $0.0012 | $1.25 | 500 ms | ok (state 29,626 < 31,940) | 8.4 | 30,312 |
| mid 25k | 71 | S2 | 1 | 2,000 | $0.000084 | $0.084 | 250 ms | ok | 20 | 72,000 |
| mid 25k | 71 | S4 | 72 | 37,741 | $0.0016 | $1.59 | c8 2.5 s | as S1 | 0.28 | 1,001 |
| high 40k | 114 | S1 | 114 | 57,388 | $0.0024 | $2.41 | seq 28.5 s; c8 3.75 s | ok | 0.17 | 630 |
| high 40k | 114 | S1c | 2 | 47,524 | $0.0020 | $2.00 | 500 ms | EXCEEDS 32k/question -> 2 chunks | 5.3 | 18,936 |
| high 40k | 114 | S2 | 1 | 2,000 | $0.000084 | $0.084 | 250 ms | ok | 20 | 72,000 |
| high 40k | 114 | S4 | 115 | 59,388 | $0.0025 | $2.49 | c8 4.0 s | as S1 | 0.17 | 626 |
| heavy 80k | 227 | S1 | 227 | 114,272 | $0.0048 | $4.80 | seq 56.75 s; c8 7.25 s | ok | 0.09 | 317 |
| heavy 80k | 227 | S1c | 3 | 94,982 | $0.0040 | $3.99 | 500 ms | EXCEEDS -> 3 chunks | 2.6 | 9,468 |

S1c 32k-per-question breakpoint (raw bytes, HTML state at 3.5 B/token): 190 KB at cleaned/raw 0.59 (real p25), 164 KB at 0.68 (median), 134 KB at 0.84 (p75), 118 KB at 0.95. ASSUMPTION log-uniform 50-500 KB real pages -> 42% / 48% / 57% exceed. Text-only state breakpoint: ~919 KB raw.

## Rate-limit sanity (1,200 req/min = 20 req/s; 250k tokens/s)
| shape | page basis | requests/page | tokens/page | request-bound pages/s | token-bound pages/s | binding | pages/hour |
|---|---|---|---|---|---|---|---|
| S1 | real fixture median | 28 | 13,086 | 0.71 | 19.1 | requests | 2,571 |
| S1 | typical 25k | 71 | 35,741 | 0.28 | 7.0 | requests | 1,015 |
| S1 | typical 40k | 114 | 57,388 | 0.18 | 4.4 | requests | 630 |
| S1c | real fixture median | 1 | 12,707 | 20 | 19.7 | tokens | 70,800 |
| S1c | typical 25k | 1 | 29,686 | 20 | 8.4 | tokens | 30,312 |
| S1c | typical 40k (2 chunks) | 2 | 47,524 | 10 | 5.3 | tokens | 18,936 |
| S2 | any | 1 | 2,000 | 20 | 125 | requests | 72,000 |
| S4 | typical 25k | 72 | 37,741 | 0.28 | 6.6 | requests | 1,001 |

## Comparison with defuddle.md ($0.003-0.005 per request) and current parse time
| basis | shape | $/page | % of $0.003 | % of $0.005 | added latency | x current parse (real median 92 ms) |
|---|---|---|---|---|---|---|
| real fixture median | S1 | $0.00055 | 18.3% | 11.0% | 1,000 ms (c8) | 10.8x |
| real fixture median | S1c | $0.000534 | 17.8% | 10.7% | 500 ms | 5.4x |
| real fixture median | S2 | $0.000084 | 2.8% | 1.7% | 250 ms | 2.7x |
| real fixture median | S4 | $0.000634 | 21.1% | 12.7% | 1,250 ms | 13.5x |
| typical 25k | S1 | $0.0015 | 50.0% | 30.0% | 2,250 ms (c8) | 24x |
| typical 25k | S1c | $0.0012 | 41.6% | 24.9% | 500 ms | 5.4x |
| typical 25k | S2 | $0.000084 | 2.8% | 1.7% | 250 ms | 2.7x |
| typical 25k | S4 | $0.0016 | 52.8% | 31.7% | 2,500 ms | 27x |
| typical 40k | S1 | $0.0024 | 80.3% | 48.2% | 3,750 ms | 41x |
| typical 40k | S1c | $0.0020 | 66.5% | 39.9% | 500 ms (2 chunks) | 5.4x |
| typical 40k | S4 | $0.0025 | 83.1% | 49.9% | 4,000 ms | 43x |
| S3 strict gate, real | S2 | $0.00003 expected | 1.0% | 0.6% | 89 ms expected / 250 worst | 1.0x expected |

## Caveats

- Token counts are estimates (HTML bytes/3.5, text bytes/4); Jev's tokenizer is unpublished, and markup-heavy HTML could tokenize 20-40% denser or sparser. No API calls were made in this slice, so nothing here is a measured Jev latency or usage figure.
- Latency constants (250 ms small request, 500 ms multi-thousand-token state) come from the brief's independent measurements (OpenRouter p50 175 ms at ~2.6k tokens; 300-500 ms at a few thousand tokens; Cloudflare 524 ms median); latency for 25-32k-token states has no independent measurement.
- Rate limits (1,200 req/min, 250k tokens/s) are community-cited per-organization numbers, not published; the brief notes the CEO calls rate limits 'the main worry' and signups were paused, so sustained throughput figures are upper bounds.
- The 64k per-request limit is modeled as state counted once plus all questions (interpretation A, inferred from the 218-Noul semantic-find cookbook). If the limit instead sums state per question, S1c is infeasible beyond ~2 questions on any real page.
- Unit counts come from the block dataset built by experiments/jev/research/build-block-dataset.mjs (homogeneous blocks of 3-300 words, HTML capped at 6,000 chars; 14 units truncated; 2 fixtures have 0 units). A production per-block design might classify more or fewer elements; S1/S1c request and token counts scale with that choice.
- Retry-branch flags were captured in debug mode, which preserves attributes and skips div flattening; word counts differed from the non-debug run by at most 23 words (max on general--wikipedia), so branch firing is representative but not byte-identical.
- The 'real page' extrapolation (120 KB median raw, 15k/25k/40k HTML tokens, 50-500 KB log-uniform size range) is an assumption; only 14 fixtures are real full pages and several (mathjax, katex-centraliser, substack-app) are atypical in structure.
- S2 token size (2,000 nominal) assumes a code-built candidate summary; a design that sends the full page as state would cost the same as S1c and hit the same window limits.
- Timing was measured on this machine under linkedom; the browser extension path (native DOM, synchronous parse()) and JSDOM differ, and the Worker is more constrained. Perf-test numbers in the repo output are from src via vitest (6,448 ms total parse) versus 7,747 ms for the dist build run in my script.
- The 20 KB real/synthetic threshold is 20,000 decimal bytes; elements--lazy-image (20,068 B) falls just inside the real group and is structurally a synthetic case.

## Artifacts

- experiments/jev/research/results/measure-cost/measure.mjs
- experiments/jev/research/results/measure-cost/model.mjs
- experiments/jev/research/results/measure-cost/addendum.mjs
- experiments/jev/research/results/measure-cost/measurements.json
- experiments/jev/research/results/measure-cost/metrics.json
- experiments/jev/research/results/measure-cost/model-output.md
- experiments/jev/research/results/measure-cost/per-fixture.csv
- experiments/jev/research/results/measure-cost/perf-test-output.txt
- experiments/jev/research/results/measure-cost/measure.stderr.log
