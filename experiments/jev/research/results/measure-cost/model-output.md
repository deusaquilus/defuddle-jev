# Cost / latency / limits model (measured on 226 fixtures, dist build, linkedom)
Generated 2026-10-28T00:01:07.881Z; node v22.20.0; linkedom 0.18.12. Assumptions: {"price_per_token_usd":4.2000000000000006e-8,"per_question_limit":32000,"per_request_limit":64000,"s1_question_overhead_tokens":300,"s1c_tokens_per_question":60,"s1c_annotation_tokens_per_block":6,"s2_tokens_nominal":2000,"s2_tokens_range":[1500,3000],"s2_tokens_per_candidate":150,"latency_small_ms":250,"latency_large_ms":500,"concurrency":8,"rate_rpm":1200,"rate_tps":250000,"defuddle_md_price_usd":[0.003,0.005],"real_threshold_bytes":20000,"typical_real_page":{"raw_kb":120,"html_tokens":[15000,25000,40000],"text_tokens":[1500,2500,4000]}}

## Ten largest fixtures (raw HTML > 20,000 bytes = "real full pages"; the group has 14 fixtures)
| fixture | raw B | cleaned body B | text B | HTML tok | text tok | units | unit tok sum | cands(total/uniq) | selector | retry | parse ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| math--mathjax | 201,904 | 55,670 | 1,336 | 15,906 | 334 | 8 | 123 | 1/1 | html > body | no | 273.06 |
| general--lesswrong.com-s-N7nDePaNabJdnbXeE-p-vJFdjigzmcXMhNTsx | 149,598 | 147,622 | 83,380 | 42,178 | 20,845 | 213 | 35,156 | 2/2 | html > body.whiteBackground > div[id="S: | no | 416.81 |
| footnotes--maggieappleton.com-xanadu-patterns | 129,896 | 64,303 | 18,003 | 18,372 | 4,501 | 101 | 13,837 | 4/4 | html > body > main > main.styled-main >  | no | 175.31 |
| general--x.com-article-2026-02-13 | 123,151 | 116,772 | 10,312 | 33,363 | 2,578 | 43 | 13,865 | 5/3 | (extractor) | no | 21 |
| general--github.com-issue-56 | 104,933 | 83,744 | 4,529 | 23,927 | 1,132 | 11 | 9,085 | 16/16 | html.js-focus-visible > body.logged-out. | no | 235.27 |
| general--12gramsofcarbon.com-p-ilyas-30-papers-to-carmack-vlaes | 97,605 | 66,540 | 22,718 | 19,011 | 5,680 | 54 | 14,784 | 4/3 | html > body > div#entry > div#main > div | no | 179.58 |
| general--substack-app | 68,228 | 44,013 | 3,448 | 12,575 | 862 | 2 | 3,439 | 2/2 | html > body.pc-root > div#entry > div.re | yes | 492.18 |
| math--katex-centraliser | 53,613 | 52,153 | 3,482 | 14,901 | 871 | 18 | 7,506 | 1/1 | html > body | no | 282.40 |
| general--www.figma.com-blog-introducing-codex-to-figma | 45,359 | 30,694 | 7,142 | 8,770 | 1,786 | 28 | 7,064 | 5/5 | html > body > div#app > div.blog-wrapper | no | 84.29 |
| general--obsidian.md-blog-verify-obsidian-sync-encryption | 31,902 | 18,786 | 6,034 | 5,367 | 1,509 | 25 | 4,887 | 2/2 | html > body > div:nth-of-type(3) > div.c | no | 51.70 |

## All real-group fixtures (14)
| fixture | raw B | HTML tok | text tok | units | S1 req | S1 tok | S1c tok | S1c >32k? | gate loose | gate strict | parse ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| math--mathjax | 201,904 | 15,906 | 334 | 8 | 8 | 2,523 | 16,434 | no | y | y | 273.06 |
| general--lesswrong.com-s-N7nDePaNabJdnbXeE-p-vJFdjigzmc | 149,598 | 42,178 | 20,845 | 213 | 213 | 99,056 | 56,236 | YES | n | n | 416.81 |
| footnotes--maggieappleton.com-xanadu-patterns | 129,896 | 18,372 | 4,501 | 101 | 101 | 44,137 | 25,038 | no | n | n | 175.31 |
| general--x.com-article-2026-02-13 | 123,151 | 33,363 | 2,578 | 43 | 43 | 26,765 | 36,201 | YES | y | y | 21 |
| general--github.com-issue-56 | 104,933 | 23,927 | 1,132 | 11 | 11 | 12,385 | 24,653 | no | n | n | 235.27 |
| general--12gramsofcarbon.com-p-ilyas-30-papers-to-carma | 97,605 | 19,011 | 5,680 | 54 | 54 | 30,984 | 22,575 | no | n | n | 179.58 |
| general--substack-app | 68,228 | 12,575 | 862 | 2 | 2 | 4,039 | 12,707 | no | y | y | 492.18 |
| math--katex-centraliser | 53,613 | 14,901 | 871 | 18 | 18 | 12,906 | 16,089 | no | y | y | 282.40 |
| general--www.figma.com-blog-introducing-codex-to-figma | 45,359 | 8,770 | 1,786 | 28 | 28 | 15,464 | 10,618 | no | n | n | 84.29 |
| general--obsidian.md-blog-verify-obsidian-sync-encrypti | 31,902 | 5,367 | 1,509 | 25 | 25 | 12,387 | 7,017 | no | n | n | 51.70 |
| general--wikipedia | 30,183 | 7,897 | 1,503 | 37 | 37 | 15,078 | 10,339 | no | n | n | 92.43 |
| issues--120-dhammatalks-footnotes | 25,951 | 6,196 | 3,485 | 46 | 46 | 19,415 | 9,232 | no | n | n | 48.18 |
| general--daringfireball.net-2025-02-the_iphone_16e | 24,263 | 4,888 | 2,908 | 28 | 28 | 13,086 | 6,736 | no | y | y | 86 |
| elements--lazy-image | 20,068 | 2,022 | 457 | 5 | 5 | 3,383 | 2,352 | no | n | n | 49.27 |

## Size distributions
| metric | group | n | min | p25 | median | mean | p75 | p90 | max |
|---|---|---|---|---|---|---|---|---|---|
| raw_bytes | all | 226 | 319 | 1,210 | 1,755 | 7,432 | 3,595 | 8,788 | 201,904 |
| raw_bytes | real(>20KB) | 14 | 20,068 | 30,183 | 53,613 | 79,047 | 104,933 | 129,896 | 201,904 |
| raw_bytes | synthetic | 212 | 319 | 1,182 | 1,665 | 2,703 | 3,145 | 4,952 | 19,430 |
| cleaned_body_bytes | all | 226 | 187 | 886 | 1,442 | 5,413 | 3,051 | 7,007 | 147,622 |
| cleaned_body_bytes | real(>20KB) | 14 | 7,077 | 21,687 | 44,013 | 53,843 | 64,303 | 83,744 | 147,622 |
| cleaned_body_bytes | synthetic | 212 | 187 | 851 | 1,349 | 2,214 | 2,645 | 4,202 | 14,092 |
| cleaned_full_bytes | all | 226 | 296 | 1,038 | 1,576 | 5,780 | 3,224 | 7,179 | 147,899 |
| cleaned_full_bytes | real(>20KB) | 14 | 8,962 | 22,728 | 49,123 | 56,978 | 66,893 | 96,428 | 147,899 |
| cleaned_full_bytes | synthetic | 212 | 296 | 1,005 | 1,470 | 2,399 | 2,838 | 4,293 | 14,286 |
| text_bytes | all | 226 | 0 | 334 | 621 | 1,776 | 1,343 | 3,015 | 83,380 |
| text_bytes | real(>20KB) | 14 | 1,336 | 3,482 | 6,034 | 13,842 | 11,631 | 18,003 | 83,380 |
| text_bytes | synthetic | 212 | 0 | 317 | 583 | 979 | 1,153 | 1,973 | 10,348 |
| est_tokens_html_body | all | 226 | 53 | 253 | 412 | 1,546 | 872 | 2,002 | 42,178 |
| est_tokens_html_body | real(>20KB) | 14 | 2,022 | 6,196 | 12,575 | 15,384 | 18,372 | 23,927 | 42,178 |
| est_tokens_html_body | synthetic | 212 | 53 | 243 | 385 | 633 | 756 | 1,201 | 4,026 |
| est_tokens_text | all | 226 | 0 | 84 | 155 | 444 | 336 | 754 | 20,845 |
| est_tokens_text | real(>20KB) | 14 | 334 | 871 | 1,509 | 3,461 | 2,908 | 4,501 | 20,845 |
| est_tokens_text | synthetic | 212 | 0 | 79 | 146 | 245 | 288 | 493 | 2,587 |
| units | all | 226 | 0 | 1 | 3 | 7 | 5 | 10 | 213 |
| units | real(>20KB) | 14 | 2 | 11 | 28 | 44 | 43 | 54 | 213 |
| units | synthetic | 212 | 0 | 1 | 2 | 4 | 4 | 8 | 46 |
| est_tokens_units_sum | all | 226 | 0 | 182 | 337 | 1,015 | 677 | 1,721 | 35,156 |
| est_tokens_units_sum | real(>20KB) | 14 | 123 | 3,978 | 5,615 | 8,993 | 9,085 | 13,865 | 35,156 |
| est_tokens_units_sum | synthetic | 212 | 0 | 176 | 313 | 488 | 558 | 993 | 3,587 |
| entry_candidates_total | all | 226 | 1 | 2 | 2 | 2 | 3 | 3 | 16 |
| entry_candidates_total | real(>20KB) | 14 | 1 | 2 | 2 | 4 | 4 | 5 | 16 |
| entry_candidates_total | synthetic | 212 | 1 | 2 | 2 | 2 | 3 | 3 | 12 |
| entry_candidates_unique | all | 226 | 1 | 2 | 2 | 2 | 2 | 3 | 16 |
| entry_candidates_unique | real(>20KB) | 14 | 1 | 2 | 2 | 3 | 3 | 4 | 16 |
| entry_candidates_unique | synthetic | 212 | 1 | 2 | 2 | 2 | 2 | 3 | 12 |
| parse_ms_dist | all | 226 | 2 | 12.20 | 21 | 34.30 | 32.90 | 60.50 | 492.20 |
| parse_ms_dist | real(>20KB) | 14 | 21 | 51.70 | 92.40 | 177.70 | 235.30 | 282.40 | 492.20 |
| parse_ms_dist | synthetic | 212 | 2 | 11.80 | 19.60 | 24.80 | 30.40 | 48.10 | 130 |
| dom_ms_dist | all | 226 | 0.10 | 0.20 | 0.30 | 1 | 0.60 | 1.60 | 15 |
| dom_ms_dist | real(>20KB) | 14 | 1.40 | 2.50 | 4.60 | 7 | 9 | 13.40 | 15 |
| dom_ms_dist | synthetic | 212 | 0.10 | 0.20 | 0.30 | 0.60 | 0.50 | 0.90 | 14.30 |
| ratio_cleaned_body_over_raw | all | 226 | 0.28 | 0.71 | 0.82 | 0.79 | 0.90 | 0.95 | 0.99 |
| ratio_cleaned_body_over_raw | real(>20KB) | 14 | 0.28 | 0.59 | 0.68 | 0.71 | 0.84 | 0.95 | 0.99 |
| ratio_cleaned_body_over_raw | synthetic | 212 | 0.32 | 0.71 | 0.83 | 0.79 | 0.90 | 0.95 | 0.98 |
| ratio_text_over_raw | all | 226 | 0 | 0.20 | 0.37 | 0.38 | 0.54 | 0.65 | 0.88 |
| ratio_text_over_raw | real(>20KB) | 14 | 0.01 | 0.07 | 0.14 | 0.20 | 0.20 | 0.48 | 0.56 |
| ratio_text_over_raw | synthetic | 212 | 0 | 0.23 | 0.38 | 0.39 | 0.55 | 0.65 | 0.88 |
| units_per_1k_html_tokens | all | 226 | 0 | 2.92 | 5.16 | 8.63 | 10.03 | 18.69 | 75.47 |
| units_per_1k_html_tokens | real(>20KB) | 14 | 0.16 | 1.21 | 2.84 | 3.23 | 4.69 | 5.50 | 7.42 |
| units_per_1k_html_tokens | synthetic | 212 | 0 | 3.09 | 5.29 | 8.98 | 10.42 | 18.73 | 75.47 |

## Retry-branch / gate firing (count, fraction)
| flag | all (n=226) | real (n=14) | synthetic (n=212) | non-extractor (n=209) |
|---|---|---|---|---|
| retry_partial_fired | 178 (78.8%) | 1 (7.1%) | 177 (83.5%) | 163 (78.0%) |
| retry_partial_accepted | 3 (1.3%) | 1 (7.1%) | 2 (0.9%) | 3 (1.4%) |
| retry_hidden_fired | 60 (26.6%) | 1 (7.1%) | 59 (27.8%) | 53 (25.4%) |
| retry_hidden_accepted | 7 (3.1%) | 0 (0.0%) | 7 (3.3%) | 7 (3.4%) |
| retry_hidden_selector_fired | 7 (3.1%) | 0 (0.0%) | 7 (3.3%) | 7 (3.4%) |
| retry_hidden_selector_accepted | 7 (3.1%) | 0 (0.0%) | 7 (3.3%) | 7 (3.4%) |
| retry_index_fired | 53 (23.4%) | 1 (7.1%) | 52 (24.5%) | 46 (22.0%) |
| retry_index_accepted | 3 (1.3%) | 1 (7.1%) | 2 (0.9%) | 3 (1.4%) |
| schema_retry_fired | 1 (0.4%) | 1 (7.1%) | 0 (0.0%) | 1 (0.5%) |
| schema_text_used | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
| any_retry_fired | 178 (78.8%) | 1 (7.1%) | 177 (83.5%) | 163 (78.0%) |
| selector_is_body_or_empty | 30 (13.3%) | 4 (28.6%) | 26 (12.3%) | 14 (6.7%) |
| gate_loose | 186 (82.3%) | 5 (35.7%) | 181 (85.4%) | 169 (80.9%) |
| gate_strict | 82 (36.3%) | 5 (35.7%) | 77 (36.3%) | 66 (31.6%) |
| s1c_exceeds_q_limit | 2 (0.9%) | 2 (14.3%) | 0 (0.0%) | 1 (0.5%) |
| s1c_exceeds_req_limit | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
| s1c_exceeds_any | 2 (0.9%) | 2 (14.3%) | 0 (0.0%) | 1 (0.5%) |
| s1_exceeds_q_limit | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |
| s2_exceeds_options | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) |

## Shapes on fixtures (per page; $ at $0.042/M input tokens)

### group: all
| shape | requests/page (med/p90/max) | tokens/page (med/p90/max) | $/page (med/p90/max) | $/1000 pages (median page) | $/1000 pages (mean page) | added latency (med/max) | exceeds limits |
|---|---|---|---|---|---|---|---|
| S1 per-block, 1 req/block | 3/10/213 | 1157/4448/99056 | $0.000049/$0.000187/$0.0042 | $0.0486 | $0.1248 | seq 750/53250 ms; c8 250/6750 ms | 0 (0.0%) |
| S1c one req/page, N Nouls over annotated page | 1 (chunks med/max 1/2) | 588/2997/56236 | $0.000025/$0.000126/$0.0024 | $0.0247 | $0.0830 | 250/500 ms (chunked c8 max 500) | q-limit 2 (0.9%), req-limit 0 |
| S2 container Choice | 1 | 2000 (range 1500-3000) | $0.000084 | $0.0840 | $0.0840 | 250 ms | options>255: 0 |
| S4 = S1 + S2 every page | 4/11/214 | 3157/6448/101056 | $0.000133/$0.000271/$0.0042 | $0.1326 | $0.2088 | c8 serial 500/7000 ms; parallel 250/6750 ms | as S1 |

### group: real(>20KB)
| shape | requests/page (med/p90/max) | tokens/page (med/p90/max) | $/page (med/p90/max) | $/1000 pages (median page) | $/1000 pages (mean page) | added latency (med/max) | exceeds limits |
|---|---|---|---|---|---|---|---|
| S1 per-block, 1 req/block | 28/54/213 | 13086/30984/99056 | $0.000550/$0.0013/$0.0042 | $0.5496 | $0.9348 | seq 7000/53250 ms; c8 1000/6750 ms | 0 (0.0%) |
| S1c one req/page, N Nouls over annotated page | 1 (chunks med/max 1/2) | 12707/25038/56236 | $0.000534/$0.0011/$0.0024 | $0.5337 | $0.7687 | 500/500 ms (chunked c8 max 500) | q-limit 2 (14.3%), req-limit 0 |
| S2 container Choice | 1 | 2000 (range 1500-3000) | $0.000084 | $0.0840 | $0.0840 | 250 ms | options>255: 0 |
| S4 = S1 + S2 every page | 29/55/214 | 15086/32984/101056 | $0.000634/$0.0014/$0.0042 | $0.6336 | $1.0188 | c8 serial 1250/7000 ms; parallel 1000/6750 ms | as S1 |

### group: synthetic
| shape | requests/page (med/p90/max) | tokens/page (med/p90/max) | $/page (med/p90/max) | $/1000 pages (median page) | $/1000 pages (mean page) | added latency (med/max) | exceeds limits |
|---|---|---|---|---|---|---|---|
| S1 per-block, 1 req/block | 2/8/46 | 993/3284/16035 | $0.000042/$0.000138/$0.000674 | $0.0417 | $0.0714 | seq 500/11500 ms; c8 250/1500 ms | 0 (0.0%) |
| S1c one req/page, N Nouls over annotated page | 1 (chunks med/max 1/1) | 569/1729/6118 | $0.000024/$0.000073/$0.000257 | $0.0239 | $0.0378 | 250/500 ms (chunked c8 max 500) | q-limit 0 (0.0%), req-limit 0 |
| S2 container Choice | 1 | 2000 (range 1500-3000) | $0.000084 | $0.0840 | $0.0840 | 250 ms | options>255: 0 |
| S4 = S1 + S2 every page | 3/9/47 | 2993/5284/18035 | $0.000126/$0.000222/$0.000758 | $0.1257 | $0.1554 | c8 serial 500/1750 ms; parallel 250/1500 ms | as S1 |

## S3 confidence-gated (expected cost = gate fraction x underlying shape cost)
| group | gate | underlying | gate fraction | $/page expected | $/1000 expected | expected added latency ms | worst-case latency ms |
|---|---|---|---|---|---|---|---|
| all | gate_loose | S2 | 82.3% | $0.000069 | $0.0691 | 206 | 250 |
| all | gate_loose | S1C | 82.3% | $0.000041 | $0.0409 | 211 | 500 |
| all | gate_strict | S2 | 36.3% | $0.000030 | $0.0305 | 91 | 250 |
| all | gate_strict | S1C | 36.3% | $0.000028 | $0.0278 | 96 | 500 |
| real | gate_loose | S2 | 35.7% | $0.000030 | $0.0300 | 89 | 250 |
| real | gate_loose | S1C | 35.7% | $0.000264 | $0.2645 | 179 | 500 |
| real | gate_strict | S2 | 35.7% | $0.000030 | $0.0300 | 89 | 250 |
| real | gate_strict | S1C | 35.7% | $0.000264 | $0.2645 | 179 | 500 |
| synthetic | gate_loose | S2 | 85.4% | $0.000072 | $0.0717 | 213 | 250 |
| synthetic | gate_loose | S1C | 85.4% | $0.000026 | $0.0261 | 213 | 500 |
| synthetic | gate_strict | S2 | 36.3% | $0.000030 | $0.0305 | 91 | 250 |
| synthetic | gate_strict | S1C | 36.3% | $0.000012 | $0.0121 | 91 | 500 |

## Extrapolation to typical real pages (ASSUMPTION: median real article ~120 KB raw; HTML tokens 15k/25k/40k; text tokens 1.5k/2.5k/4k; units derived from real-group median 2.84 units per 1k HTML tokens; mean block 203.4 tokens)
Measured-ratio cross-check for a 120 KB page: cleaned body 81840 B -> 23383 HTML tokens; text 16680 B -> 4170 text tokens.
| page profile | units | shape | requests | tokens | $/page | $/1000 | added latency | limit status | pages/s @1200rpm,250k tps | pages/hour |
|---|---|---|---|---|---|---|---|---|---|---|
| low_15k | 43 | S1 | 43 | 21,646 | $0.000909 | $0.9091 | seq 10750 ms; c8 1500 ms | ok (blocks <= 6k chars) | 0.47 | 1,674 |
| low_15k | 43 | S1c | 1 | 17,838 | $0.000749 | $0.7492 | 500 ms | ok | 14.02 | 50,472 |
| low_15k | 43 | S2 | 1 | 2,000 | $0.000084 | $0.0840 | 250 ms | ok | 20 | 72,000 |
| low_15k | 43 | S4 | 44 | 23,646 | $0.000993 | $0.9931 | c8 1750 ms | as S1 | 0.46 | 1,638 |
| mid_25k | 71 | S1 | 71 | 35,741 | $0.0015 | $1.5011 | seq 17750 ms; c8 2250 ms | ok (blocks <= 6k chars) | 0.28 | 1,015 |
| mid_25k | 71 | S1c | 1 | 29,686 | $0.0012 | $1.2468 | 500 ms | ok | 8.42 | 30,312 |
| mid_25k | 71 | S2 | 1 | 2,000 | $0.000084 | $0.0840 | 250 ms | ok | 20 | 72,000 |
| mid_25k | 71 | S4 | 72 | 37,741 | $0.0016 | $1.5851 | c8 2500 ms | as S1 | 0.28 | 1,001 |
| high_40k | 114 | S1 | 114 | 57,388 | $0.0024 | $2.4103 | seq 28500 ms; c8 3750 ms | ok (blocks <= 6k chars) | 0.17 | 630 |
| high_40k | 114 | S1c | 2 | 47,524 | $0.0020 | $1.9960 | 500 ms | EXCEEDS 32k/question -> 2 chunks | 5.26 | 18,936 |
| high_40k | 114 | S2 | 1 | 2,000 | $0.000084 | $0.0840 | 250 ms | ok | 20 | 72,000 |
| high_40k | 114 | S4 | 115 | 59,388 | $0.0025 | $2.4943 | c8 4000 ms | as S1 | 0.17 | 626 |
| heavy_80k | 227 | S1 | 227 | 114,272 | $0.0048 | $4.7994 | seq 56750 ms; c8 7250 ms | ok (blocks <= 6k chars) | 0.09 | 317 |
| heavy_80k | 227 | S1c | 3 | 94,982 | $0.0040 | $3.9892 | 500 ms | EXCEEDS 32k/question -> 3 chunks | 2.63 | 9,468 |
| heavy_80k | 227 | S2 | 1 | 2,000 | $0.000084 | $0.0840 | 250 ms | ok | 20 | 72,000 |
| heavy_80k | 227 | S4 | 228 | 116,272 | $0.0049 | $4.8834 | c8 7500 ms | as S1 | 0.09 | 317 |

## Comparison with defuddle.md price ($0.003-0.005 per request) and current parse time
| basis | shape | $/page | % of $0.003 | % of $0.005 |
|---|---|---|---|---|
| fixtures_real_median | S1 | $0.000550 | 18.32 | 10.99 |
| fixtures_real_median | S1c | $0.000534 | 17.79 | 10.67 |
| fixtures_real_median | S2 | $0.000084 | 2.80 | 1.68 |
| fixtures_real_median | S4 | $0.000634 | 21.12 | 12.67 |
| typical_real_page_mid_25k | S1 | $0.0015 | 50.04 | 30.02 |
| typical_real_page_mid_25k | S1c | $0.0012 | 41.56 | 24.94 |
| typical_real_page_mid_25k | S2 | $0.000084 | 2.80 | 1.68 |
| typical_real_page_mid_25k | S4 | $0.0016 | 52.84 | 31.70 |
| typical_real_page_high_40k | S1 | $0.0024 | 80.34 | 48.21 |
| typical_real_page_high_40k | S1c | $0.0020 | 66.53 | 39.92 |
| typical_real_page_high_40k | S2 | $0.000084 | 2.80 | 1.68 |
| typical_real_page_high_40k | S4 | $0.0025 | 83.14 | 49.89 |
Current Defuddle parse time (dist build, linkedom, this machine, excl. DOM parse): all fixtures median 21 ms, p90 60.5 ms; real group median 92.4 ms, p90 282.4 ms, max 492.2 ms.

Real-group fixture-median throughput at community-cited limits: S1 0.714 pages/s, S1c 19.67 pages/s.

## Addendum
### Gate decomposition
{
 "all": {
  "n": 226,
  "body_pick_html_body": 14,
  "empty_selector_extractor": 16,
  "empty_selector_non_extractor": 0,
  "strict_retry_any": 60,
  "partial_retry_only_lt200": 118,
  "gate_strict_excluding_extractor_pages": 73,
  "gate_strict_excluding_extractor_pages_frac": 0.323,
  "retry_accepted_any": 11,
  "retry_accepted_any_frac": 0.0487,
  "body_pick_names": [
   "content-patterns--non-semantic-hero-header",
   "content-patterns--socket-dev-blog",
   "general--back-nav-link",
   "general--daringfireball.net-2025-02-the_iphone_16e",
   "hidden--nodes",
   "issues--280-texinfo-footnotes",
   "issues--296-oreilly-noteref-footnotes",
   "issues--300-nested-layout-tables",
   "issues--sidebar-toggle-checkbox",
   "math--katex-centraliser",
   "math--mathjax",
   "selectors--arm-newsroom",
   "table-layout--peripheral-tables",
   "table-layout--single-column"
  ]
 },
 "real": {
  "n": 14,
  "body_pick_html_body": 3,
  "empty_selector_extractor": 1,
  "empty_selector_non_extractor": 0,
  "strict_retry_any": 1,
  "partial_retry_only_lt200": 0,
  "gate_strict_excluding_extractor_pages": 4,
  "gate_strict_excluding_extractor_pages_frac": 0.2857,
  "retry_accepted_any": 1,
  "retry_accepted_any_frac": 0.0714,
  "body_pick_names": [
   "math--mathjax",
   "math--katex-centraliser",
   "general--daringfireball.net-2025-02-the_iphone_16e"
  ]
 },
 "synthetic": {
  "n": 212,
  "body_pick_html_body": 11,
  "empty_selector_extractor": 15,
  "empty_selector_non_extractor": 0,
  "strict_retry_any": 59,
  "partial_retry_only_lt200": 118,
  "gate_strict_excluding_extractor_pages": 69,
  "gate_strict_excluding_extractor_pages_frac": 0.3255,
  "retry_accepted_any": 10,
  "retry_accepted_any_frac": 0.0472,
  "body_pick_names": [
   "content-patterns--non-semantic-hero-header",
   "content-patterns--socket-dev-blog",
   "general--back-nav-link",
   "hidden--nodes",
   "issues--280-texinfo-footnotes",
   "issues--296-oreilly-noteref-footnotes",
   "issues--300-nested-layout-tables",
   "issues--sidebar-toggle-checkbox",
   "selectors--arm-newsroom",
   "table-layout--peripheral-tables",
   "table-layout--single-column"
  ]
 }
}
### S1c breakpoints
{
 "note": "raw HTML bytes above which S1c state (cleaned body HTML at 3.5 B/token) exceeds the 32k per-question limit, for the real group cleaned/raw ratios",
 "at_real_p25_ratio": {
  "ratio": 0.589,
  "raw_bytes": 189796
 },
 "at_real_median_ratio": {
  "ratio": 0.682,
  "raw_bytes": 163915
 },
 "at_real_p75_ratio": {
  "ratio": 0.836,
  "raw_bytes": 133720
 },
 "at_ratio_0_95": {
  "ratio": 0.95,
  "raw_bytes": 117674
 },
 "assumed_loguniform_50_500kb_fraction_exceeding": {
  "p25": 0.421,
  "median": 0.484,
  "p75": 0.573
 },
 "text_state_variant_breakpoint_raw_bytes_at_real_median_text_ratio": 919137
}
### Perf
{
 "vitest_totals": {
  "total_ms": 6696,
  "dom_ms": 204,
  "parse_ms": 6448,
  "count": 226
 },
 "vitest_per_step_totals_ms": [
  {
   "step": "removeBySelector",
   "ms": 1053,
   "pct": 23
  },
  {
   "step": "standardizeContent",
   "ms": 892,
   "pct": 19
  },
  {
   "step": "findMainContent",
   "ms": 448,
   "pct": 10
  },
  {
   "step": "standardizeElements",
   "ms": 428,
   "pct": 9
  },
  {
   "step": "removeByContentPattern",
   "ms": 386,
   "pct": 8
  },
  {
   "step": "standardizeFootnotesCallouts",
   "ms": 363,
   "pct": 8
  },
  {
   "step": "removeHiddenElements",
   "ms": 211,
   "pct": 5
  },
  {
   "step": "se:img.latex[src*=\"latex.php\"],sp",
   "ms": 178,
   "pct": 4
  },
  {
   "step": "removeLowScoring",
   "ms": 165,
   "pct": 4
  },
  {
   "step": "se:pre, div[class*=\"prismjs\"], .s",
   "ms": 89,
   "pct": 2
  },
  {
   "step": "removeEmptyLines",
   "ms": 85,
   "pct": 2
  },
  {
   "step": "flattenWrapperElements[1]",
   "ms": 53,
   "pct": 1
  },
  {
   "step": "cloneDocument",
   "ms": 49,
   "pct": 1
  },
  {
   "step": "se:convertLatexImages",
   "ms": 44,
   "pct": 1
  },
  {
   "step": "standardizeSpaces",
   "ms": 28,
   "pct": 1
  },
  {
   "step": "stripUnwantedAttributes",
   "ms": 27,
   "pct": 1
  },
  {
   "step": "flattenWrapperElements[2]",
   "ms": 18,
   "pct": 0
  },
  {
   "step": "flattenShadowRoots",
   "ms": 9,
   "pct": 0
  },
  {
   "step": "se:figure, p:has([class*=\"caption",
   "ms": 7,
   "pct": 0
  },
  {
   "step": "resolveRelativeUrls",
   "ms": 7,
   "pct": 0
  },
  {
   "step": "removeEmptyElements",
   "ms": 6,
   "pct": 0
  },
  {
   "step": "removeSmallImages",
   "ms": 5,
   "pct": 0
  },
  {
   "step": "se:wrapRawLatexDelimiters",
   "ms": 5,
   "pct": 0
  },
  {
   "step": "removePermalinkAnchors",
   "ms": 4,
   "pct": 0
  },
  {
   "step": "adoptExternalFootnotes",
   "ms": 3,
   "pct": 0
  },
  {
   "step": "se:h1, h2, h3, h4, h5, h6",
   "ms": 3,
   "pct": 0
  },
  {
   "step": "unwrapSpecialLinks",
   "ms": 3,
   "pct": 0
  },
  {
   "step": "se:picture",
   "ms": 2,
   "pct": 0
  },
  {
   "step": "resolveSvgColors",
   "ms": 2,
   "pct": 0
  },
  {
   "step": "resolveStreamedContent",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "removeMetadataBlock",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "removeEyebrowLabel",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "standardizeHeadings",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "se:img[data-src], img[data-origin",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "se:span:has(img)",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "replaceCustomElements",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "convertBlockSpans",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "unwrapBareSpans",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "removeObsoleteElements",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "removeTrailingHeadings",
   "ms": 1,
   "pct": 0
  },
  {
   "step": "applyMobileStyles",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "standardizeDropCaps",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "removeHtmlComments",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "wrapPreformattedCode",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "se:uni-image-full-width",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "se:div[data-testid^=\"paragraph\"],",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "se:div[role=\"list\"]",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "se:div[role=\"listitem\"]",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "convertDataAsSpans",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "unwrapLayoutTables",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "removeOrphanedDividers[1]",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "removeOrphanedDividers[2]",
   "ms": 0,
   "pct": 0
  },
  {
   "step": "stripExtraBrElements",
   "ms": 0,
   "pct": 0
  }
 ],
 "vitest_top_parse_ms": [
  {
   "name": "general--lesswrong.com-s-N7nDePaNabJdnbXeE-p-vJFdjigzmcXMhNTsx",
   "total_ms": 369,
   "dom_ms": 14,
   "parse_ms": 355,
   "size_kb": 145
  },
  {
   "name": "general--substack-app",
   "total_ms": 349,
   "dom_ms": 5,
   "parse_ms": 344,
   "size_kb": 67
  },
  {
   "name": "math--mathjax",
   "total_ms": 264,
   "dom_ms": 18,
   "parse_ms": 246,
   "size_kb": 197
  },
  {
   "name": "general--github.com-issue-56",
   "total_ms": 209,
   "dom_ms": 13,
   "parse_ms": 195,
   "size_kb": 102
  },
  {
   "name": "math--katex-centraliser",
   "total_ms": 188,
   "dom_ms": 7,
   "parse_ms": 182,
   "size_kb": 52
  },
  {
   "name": "comments--mastodon.social-@user-12345678",
   "total_ms": 180,
   "dom_ms": 4,
   "parse_ms": 176,
   "size_kb": 12
  },
  {
   "name": "footnotes--maggieappleton.com-xanadu-patterns",
   "total_ms": 166,
   "dom_ms": 19,
   "parse_ms": 148,
   "size_kb": 127
  },
  {
   "name": "general--12gramsofcarbon.com-p-ilyas-30-papers-to-carmack-vlaes",
   "total_ms": 136,
   "dom_ms": 6,
   "parse_ms": 130,
   "size_kb": 95
  },
  {
   "name": "author-contact-block",
   "total_ms": 121,
   "dom_ms": 6,
   "parse_ms": 114,
   "size_kb": 3
  },
  {
   "name": "general--wikipedia",
   "total_ms": 98,
   "dom_ms": 4,
   "parse_ms": 94,
   "size_kb": 29
  },
  {
   "name": "callouts--obsidian-publish-callouts",
   "total_ms": 97,
   "dom_ms": 8,
   "parse_ms": 89,
   "size_kb": 8
  },
  {
   "name": "codeblocks--chatgpt-codemirror",
   "total_ms": 83,
   "dom_ms": 1,
   "parse_ms": 81,
   "size_kb": 3
  },
  {
   "name": "general--cp4space-jordan-algebra",
   "total_ms": 75,
   "dom_ms": 1,
   "parse_ms": 74,
   "size_kb": 14
  },
  {
   "name": "general--www.figma.com-blog-introducing-codex-to-figma",
   "total_ms": 74,
   "dom_ms": 4,
   "parse_ms": 71,
   "size_kb": 44
  },
  {
   "name": "codeblocks--stripe",
   "total_ms": 72,
   "dom_ms": 2,
   "parse_ms": 71,
   "size_kb": 9
  }
 ],
 "dist_totals": {
  "parse_ms": 7747,
  "dom_ms": 216
 },
 "real_group_side_by_side": [
  {
   "name": "math--mathjax",
   "raw_bytes": 201904,
   "dist_parse_ms": 273.06,
   "vitest_parse_ms": 246,
   "vitest_total_ms": 264,
   "units": 8
  },
  {
   "name": "general--lesswrong.com-s-N7nDePaNabJdnbXeE-p-vJFdjigzmcXMhNTsx",
   "raw_bytes": 149598,
   "dist_parse_ms": 416.81,
   "vitest_parse_ms": 355,
   "vitest_total_ms": 369,
   "units": 213
  },
  {
   "name": "footnotes--maggieappleton.com-xanadu-patterns",
   "raw_bytes": 129896,
   "dist_parse_ms": 175.31,
   "vitest_parse_ms": 148,
   "vitest_total_ms": 166,
   "units": 101
  },
  {
   "name": "general--x.com-article-2026-02-13",
   "raw_bytes": 123151,
   "dist_parse_ms": 21,
   "vitest_parse_ms": 23,
   "vitest_total_ms": 36,
   "units": 43
  },
  {
   "name": "general--github.com-issue-56",
   "raw_bytes": 104933,
   "dist_parse_ms": 235.27,
   "vitest_parse_ms": 195,
   "vitest_total_ms": 209,
   "units": 11
  },
  {
   "name": "general--12gramsofcarbon.com-p-ilyas-30-papers-to-carmack-vlaes",
   "raw_bytes": 97605,
   "dist_parse_ms": 179.58,
   "vitest_parse_ms": 130,
   "vitest_total_ms": 136,
   "units": 54
  },
  {
   "name": "general--substack-app",
   "raw_bytes": 68228,
   "dist_parse_ms": 492.18,
   "vitest_parse_ms": 344,
   "vitest_total_ms": 349,
   "units": 2
  },
  {
   "name": "math--katex-centraliser",
   "raw_bytes": 53613,
   "dist_parse_ms": 282.4,
   "vitest_parse_ms": 182,
   "vitest_total_ms": 188,
   "units": 18
  },
  {
   "name": "general--www.figma.com-blog-introducing-codex-to-figma",
   "raw_bytes": 45359,
   "dist_parse_ms": 84.29,
   "vitest_parse_ms": 71,
   "vitest_total_ms": 74,
   "units": 28
  },
  {
   "name": "general--obsidian.md-blog-verify-obsidian-sync-encryption",
   "raw_bytes": 31902,
   "dist_parse_ms": 51.7,
   "vitest_parse_ms": 41,
   "vitest_total_ms": 44,
   "units": 25
  },
  {
   "name": "general--wikipedia",
   "raw_bytes": 30183,
   "dist_parse_ms": 92.43,
   "vitest_parse_ms": 94,
   "vitest_total_ms": 98,
   "units": 37
  },
  {
   "name": "issues--120-dhammatalks-footnotes",
   "raw_bytes": 25951,
   "dist_parse_ms": 48.18,
   "vitest_parse_ms": 44,
   "vitest_total_ms": 46,
   "units": 46
  },
  {
   "name": "general--daringfireball.net-2025-02-the_iphone_16e",
   "raw_bytes": 24263,
   "dist_parse_ms": 86,
   "vitest_parse_ms": 53,
   "vitest_total_ms": 57,
   "units": 28
  },
  {
   "name": "elements--lazy-image",
   "raw_bytes": 20068,
   "dist_parse_ms": 49.27,
   "vitest_parse_ms": 44,
   "vitest_total_ms": 48,
   "units": 5
  }
 ],
 "vitest_parse_ms_distribution": {
  "n": 226,
  "min": 3,
  "p25": 10,
  "median": 16,
  "p75": 28,
  "p90": 53,
  "max": 355
 }
}
### Real-group detail
[
 {
  "name": "math--mathjax",
  "extractor": null,
  "selector": "html > body",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": true,
  "gate_strict_no_extractor": true,
  "wordCount": 393
 },
 {
  "name": "general--lesswrong.com-s-N7nDePaNabJdnbXeE-p-vJFdjigzmcXMhNTsx",
  "extractor": null,
  "selector": "html > body.whiteBackground > div[id=\"S:5\"] > div:nth-of-typ",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 13133
 },
 {
  "name": "footnotes--maggieappleton.com-xanadu-patterns",
  "extractor": null,
  "selector": "html > body > main > main.styled-main > article.prose-wrappe",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 2417
 },
 {
  "name": "general--x.com-article-2026-02-13",
  "extractor": "xarticle",
  "selector": "",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 1572
 },
 {
  "name": "general--github.com-issue-56",
  "extractor": null,
  "selector": "html.js-focus-visible > body.logged-out.env-production.page-",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 247
 },
 {
  "name": "general--12gramsofcarbon.com-p-ilyas-30-papers-to-carmack-vlaes",
  "extractor": null,
  "selector": "html > body > div#entry > div#main > div:nth-of-type(2) > di",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 3832
 },
 {
  "name": "general--substack-app",
  "extractor": null,
  "selector": "html > body.pc-root > div#entry > div.reader-nav-root.reader",
  "retry_partial": true,
  "retry_hidden": true,
  "retry_index": true,
  "schema_retry": true,
  "body_pick": false,
  "gate_strict_no_extractor": true,
  "wordCount": 234
 },
 {
  "name": "math--katex-centraliser",
  "extractor": null,
  "selector": "html > body",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": true,
  "gate_strict_no_extractor": true,
  "wordCount": 585
 },
 {
  "name": "general--www.figma.com-blog-introducing-codex-to-figma",
  "extractor": null,
  "selector": "html > body > div#app > div.blog-wrapper.fig-1nahfw7 > div.b",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 878
 },
 {
  "name": "general--obsidian.md-blog-verify-obsidian-sync-encryption",
  "extractor": null,
  "selector": "html > body > div:nth-of-type(3) > div.container > div.mx-au",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 789
 },
 {
  "name": "general--wikipedia",
  "extractor": null,
  "selector": "html.client-nojs.vector-feature-language-in-header-enabled >",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 801
 },
 {
  "name": "issues--120-dhammatalks-footnotes",
  "extractor": null,
  "selector": "html > body.d-flex.flex-column.min-vh-100 > div.container-xx",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 2205
 },
 {
  "name": "general--daringfireball.net-2025-02-the_iphone_16e",
  "extractor": null,
  "selector": "html > body",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": true,
  "gate_strict_no_extractor": true,
  "wordCount": 1954
 },
 {
  "name": "elements--lazy-image",
  "extractor": null,
  "selector": "html > body > div#root > div.a.b.c > article",
  "retry_partial": false,
  "retry_hidden": false,
  "retry_index": false,
  "schema_retry": false,
  "body_pick": false,
  "gate_strict_no_extractor": false,
  "wordCount": 288
 }
]
### Blocks
{
 "all_mean_block_tokens": 155.4,
 "real_mean_block_tokens": 203.4,
 "units_truncated_at_6000_chars": 14,
 "wordCount_debug_vs_plain_max_abs_diff": 23
}
