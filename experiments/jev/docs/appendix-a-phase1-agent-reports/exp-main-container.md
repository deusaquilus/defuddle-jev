# exp-main-container: Jev (jev-1.14.0) vs defuddle findMainContent at picking the main article container on 167 fixtures

_Verbatim final report of the phase-1 workflow agent `exp-main-container` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

What I did. A prior run of this slice had built the candidate set and collected four live Jev variants but never analyzed them or reported; "try again" was the re-launch. I re-ran the offline candidate build into a scratch directory and confirmed it is byte-identical to the stored experiments/jev/research/results/exp-main-container/candidates.jsonl (so the stored Jev results are valid), ran the analysis, audited every ground-truth label, added one new live variant D (same as A but with every tag/id/class hint removed from the candidate descriptions, to test whether Jev reads content or the word "article"), computed order-rotation ensembles and confidence-gated cascades offline, and ran an end-to-end check that swaps each Jev pick into Defuddle as `contentSelector` and compares the Markdown to tests/expected exactly as tests/fixtures.test.ts does (my harness port reproduces 167/167 on the default pipeline). Candidates = ENTRY_POINT_ELEMENTS matches (src/constants.ts:3-24) with >=30 words, document order, truth = smallest candidate covering >=90% of the output's 5-word shingles (with a word-multiset fallback the previous builder added; 123 labels come from strict shingles, 39 from the fallback). Of 226 fixtures: 17 skipped (extractorType set), 42 skipped (<2 candidates), 167 kept; 126 have exactly 2 candidates (almost all body > article/main with identical text), 35 have 3, 6 have 4-10; only 9 are real full pages >20KB and 15 are >8KB; median kept fixture is ~1.7KB synthetic HTML. Total live spend across all five variants: 833 calls, 942,123 input tokens, about $0.040, zero HTTP errors, zero 400 max_tokens_exceeded (the two pages over the 25k-token cap for variant C were excluded, not sent).

What I found (measured). Variant A (JSON candidate list, document order, one Choice + 2 Nouls per candidate, model jev-1.14.0): 157/167 = 94.0% on the spec labels; after relabelling five provable label artifacts (footnote markers rewritten to `[^1]` and math rewritten to LaTeX drop word coverage to 0.82-0.87 although `c2` is the only article element and Jev picked it at 0.92-0.97) and accepting article-or-article-body on one ambiguous fixture, 163/167 = 97.6%. defuddle's own findMainContent pick equals the same adjudicated label 159/167 = 95.2%; on the 41 pages with >=3 nested candidates both score 37/41 (90.2%); on the 9 real pages Jev 9/9, findMainContent 7/9 (but defuddle's final output is still correct there via retries). Every adjudicated Jev-A miss sits at confidence <0.5 (band accuracy: >=0.9 112/112, 0.7-0.9 29/29, 0.5-0.7 11/11, <0.5 11/15). End-to-end: swapping Jev-A's raw pick into Defuddle passes 164/167 fixtures (98.2%); gating at confidence >=0.5 and falling back to findMainContent passes 167/167, as does full-page variant C (8 fall back on none_of_these). The two harmful raw misses are under-inclusion on a blog index (picked one card: 51 words out vs 172) and over-inclusion of a clutter-filled <main> when the real article was 57 words (623 words out vs 77) at confidence 0.45; a third raw e2e failure (GitHub issue) is a case where Jev matched the label but the label is wrong (even the oracle pick fails e2e because GitHub's "## Description" heading lives outside the inner markdown-body).

Sensitivity and what drives the answers. Reversing candidate order (variant B) flipped the argmax on 16/167 = 9.6% of pages and dropped accuracy to 150/167 adjudicated (26/41 = 63.4% on 3+ candidate pages), with 17 over-inclusive picks: Jev shifts toward whichever nested wrapper is listed last, so averaging A and B probabilities does not help (96.4%, below A alone). Exact repeat (A2) flipped 5/167 = 3.0%, all at confidence <=0.35, mean |delta p| 0.016. Removing tag/id/class hints (variant D) cut adjudicated accuracy from 97.6% to 88.0%, mean confidence from 0.85 to 0.49, and left zero picks at >=0.9 confidence: roughly ten points of accuracy and most of the confidence come from reading the same semantic names ("article", "main", "entry-content") that ENTRY_POINT_ELEMENTS already encodes deterministically; on near-identical nested candidates the remaining cue is the word count, which Jev compares poorly. Whole-page HTML (variant C, mean 1,580 tokens/page) scored 155/165 adjudicated with six low-confidence none_of_these abstentions on small synthetic pages, but it fixed the two content-blind misses of A (card grid, js-article-content) because it could see the clutter. The spec's Noul-derived pick (smallest with contains_all>=0.5 and non_article<=0.5) reached only 85.0% adjudicated with 23 abstentions: contains_all separates containers that hold the article from those that do not with AUROC 0.991, but non_article separates a clutter-bearing ancestor from the true container at only AUROC 0.834, because 300/150-character excerpts rarely show the clutter; loosening to contains_all>=0.3 gives 94.0%.

Implication for the Jev question. On this slice Jev is roughly a peer of findMainContent at naming the smallest covering container, and a confidence-gated Jev with findMainContent as fallback reproduces every expected output, but that parity is inherited from defuddle (the fallback and the downstream removal pipeline, which turns most over-inclusive picks into identical output). Nothing here points toward 99.99%: raw error is 2.4% on labels and 1.8% end-to-end, order sensitivity is 9.6% on exactly the nested-wrapper pages where a second opinion would matter, and the model's confidence is largely a restatement of the tag heuristics defuddle already has. The defensible use is narrow: a shadow or tie-break signal, gated at confidence >=0.5 (or >=0.7 for safety), on the roughly one quarter of pages that have three or more nested candidates, with full-page context when the page fits in budget, and never as the sole selector.

## Verdict for this dimension

Measured: on 167 fixtures (126 trivial two-candidate pages, 41 with nested wrappers, 9 real pages) jev-1.14.0 names the smallest covering container 97.6% of the time (adjudicated; 94.0% on strict labels) versus 95.2% for defuddle's findMainContent, and a confidence>=0.5 Jev pick with findMainContent as fallback reproduces 167/167 expected outputs; ungated it breaks 3 fixtures (2 harmfully), reversing option order flips 9.6% of picks (63% accuracy on 3+-candidate pages), and removing tag/class names from the state drops it to 88.0% with no confident picks, showing most of its signal restates the ENTRY_POINT_ELEMENTS heuristic. Verdict: Jev is roughly a peer of findMainContent, not a step toward 99.99%; the only defensible role is a confidence-gated shadow or tie-break signal on pages with three or more nested candidates (ideally with full-page context), never the sole selector, and its end-to-end parity here is borrowed from defuddle's own fallback and downstream clutter removal.

## Findings

- - **claim:** Jev-A (jev-1.14.0, candidate list, document order) names the smallest covering container 157/167 (94.0%) on the spec labels and 163/167 (97.6%) after adjudicating 6 noisy labels; defuddle's findMainContent names it 153/167 (91.6%) / 159/167 (95.2%) on the same labels.
  - **evidence:** analysis.json variant_A.all_167_spec_labels.correct=157; analysis2.json accuracy.A.adjudicated_all=163/167, defuddle_findMainContent.strict_all=153, adjudicated_all=159. Adjudication: 5 'none_of_these' labels are artifacts (expected .md rewrites footnote markers to [^1] and math to LaTeX; word coverage 0.82-0.87 for the sole article element c2, which Jev picked at 0.92-0.97); issues--header-with-subtitle-p accepts c2 (article incl. h1) or c3 (article-body).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/analysis.json
    - experiments/jev/research/results/exp-main-container/analysis2.json
    - /home/alexi/git/defuddle/tests/expected/footnotes--inline-footnote-span.md
    - /home/alexi/git/defuddle/src/constants.ts:3-24
- - **claim:** End-to-end, swapping Jev-A's raw pick into Defuddle as contentSelector passes 164/167 fixture tests (98.2%); gated at confidence >=0.5 with findMainContent as fallback it passes 167/167, as does full-page variant C; baseline is 167/167.
  - **evidence:** e2e_swap_results.json: baseline 167 pass; jev_A 164 pass (fails: entry-point--js-article-content 623 words out vs 77 expected; general--tailwind-hidden-blog-index 51 vs 172; general--github.com-issue-56 267 vs 271); jev_A_conf_ge_0_5_else_default 167 pass (15 fell back); jev_C 167 pass (8 fell back); jev_B 165; jev_D 165; jev_A2 166. Harness port reproduces tests/fixtures.test.ts comparison (normalizeMarkdownHtml from tests/helpers.ts).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/e2e_swap_results.json
    - experiments/jev/research/results/exp-main-container/e2e-swap.mjs
    - /home/alexi/git/defuddle/tests/fixtures.test.ts:96-120
    - /home/alexi/git/defuddle/tests/helpers.ts:33-70
    - /home/alexi/git/defuddle/src/defuddle.ts:934-944
- - **claim:** All four adjudicated Jev-A misses occur at Choice confidence <0.5 (0.20, 0.24, 0.25, 0.45); the 152 picks at confidence >=0.5 are 152/152 correct on adjudicated labels.
  - **evidence:** analysis2.json accuracy.A.adjudicated_by_band: >=0.9 112/112, 0.7-0.9 29/29, 0.5-0.7 11/11, <0.5 11/15. cascade_A 'conf>=0.5': routed 152 (91.0%), jev_accuracy_on_routed 100%, overall 164/167 (the 3 remaining misses are fallback findMainContent misses on labels, all of which still pass e2e).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/analysis2.json
- - **claim:** Order sensitivity is large on this task: reversing candidate order flips the argmax on 16/167 pages (9.6%) and drops adjudicated accuracy to 150/167, with 17 over-inclusive picks and 63.4% accuracy on 3+-candidate pages; Jev shifts toward the wrapper listed last. Averaging A and B probabilities (rotation ensemble) scores 161/167, below A alone.
  - **evidence:** analysis.json order_sensitivity_A_vs_B: choice_flips 16, flip_rate_pct 9.6, both_correct 143, either_correct 158, max |delta p| 0.76; variant_B miss_relation ancestor_of_truth 17; analysis2.json accuracy.B.adjudicated_3plus 26/41; ensemble_A+B adjudicated_all 161/167. Literature figure for reversal flips is 1.8% (JEV_ECOSYSTEM_EXCERPTS_1.md), so nested near-duplicate candidates are a hard case.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/analysis.json
    - experiments/jev/research/results/exp-main-container/misses_B.txt
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md
- - **claim:** Repeat stability is good: an exact repeat (A2) changed the chosen option on 5/167 (3.0%), all at confidence <=0.35; mean absolute probability movement on the chosen option 0.016, max on any option 0.12.
  - **evidence:** analysis.json repeat_stability_A_vs_A2: choice_flips 5, flips at A-confidence 0.24/0.20/0.25/0.25/0.27, mean_abs_dp_chosen 0.016, max_abs_dp_any_option 0.12. Lower than the ~12% repeat-change rate reported in the literature brief.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/analysis.json
    - experiments/jev/research/results/exp-main-container/jev_A2.jsonl
- - **claim:** A substantial share of Jev's accuracy and most of its confidence come from reading tag/id/class names: removing them (variant D) drops adjudicated accuracy from 97.6% to 88.0% (2-candidate pages 100% -> 92.9%; 3+ pages 90.2% -> 73.2%), mean confidence from 0.848 to 0.492, and leaves zero picks at >=0.9 confidence. On the 9 real pages D is still 9/9.
  - **evidence:** analysis2.json accuracy.D and D_vs_A: 19 flips vs A, 14 of them body chosen over the article/main element on pages where both candidates have identical excerpt text and differ only in word count; D picked body 18 times vs 4 in A. Noul AUROC for contains_all fell 0.991 -> 0.971, non_article ancestor-vs-truth 0.834 -> 0.771.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/jev_D.jsonl
    - experiments/jev/research/results/exp-main-container/run-variant-D.mjs
    - experiments/jev/research/results/exp-main-container/analysis2.json
- - **claim:** Whole-page HTML context (variant C) is not better overall (155/165 adjudicated, 93.9%; six low-confidence none_of_these abstentions on small synthetic pages) but it fixes the two misses that the excerpt-based state could not expose (card grid after the article; clutter-filled main around a 57-word article), picking the truth at 0.92 and 0.95.
  - **evidence:** analysis.json variant_C and list_vs_page_A_vs_C flips; misses_C.txt: none_of_these at conf 0.02-0.38 on author-share-widget, trailing-cta-newsletter, issues--162-aria-hidden-main-content, general--substack-app, general--tailwind-hidden-blog-index, footnotes--external-labeled-section. 2/167 pages exceeded the 25k-token cap (general--github.com-issue-56 at 27,237 est. tokens; lesswrong at 41,612) and were not sent; no 400 max_tokens_exceeded occurred in any variant.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/jev_C.jsonl
    - experiments/jev/research/results/exp-main-container/misses_C.txt
    - experiments/jev/research/results/exp-main-container/build_summary.json
- - **claim:** The spec's Noul-derived rule (smallest candidate with contains_all>=0.5 and non_article<=0.5) scores 142/167 (85.0%) adjudicated with 23 abstentions and agrees with the Choice on 85.6%; contains_all separates article-holding containers from the rest at AUROC 0.991, but non_article separates a clutter-bearing ancestor from the true container at only AUROC 0.834 because the 300/150-char excerpts rarely show the clutter. Loosening to contains_all>=0.3 gives 157/167 (94.0%).
  - **evidence:** analysis.json noul_derived_pick_A and noul_diagnostics_A (truth mean contains_all 0.745, ancestor 0.695, descendant 0.154; truth non_article 0.086, ancestor 0.234, only 19.4% of ancestors >=0.5); analysis2.json noul_pick_adjudicated.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/analysis.json
    - experiments/jev/research/results/exp-main-container/analysis2.json
- - **claim:** defuddle's pick does not map to the smallest covering candidate 'by construction': 8/167 adjudicated differences (5 over-inclusive picks cleaned by later removal steps, 2 retry-chosen elements that are not ENTRY_POINT candidates at all, 1 case where defuddle's larger pick is actually what the expected output needs), yet all 167 pass the fixture tests. Over-inclusive container errors are mostly harmless in defuddle; under-inclusive ones are not.
  - **evidence:** analysis2.json defuddle_findMainContent.misses_adjudicated (card-grid, external-labeled-section, labeled-section-ol, appendix-heading, github.com-issue-56, substack-app not_a_candidate, substack-custom-domain, 162-aria-hidden not_a_candidate); e2e oracle_truth fails only on github.com-issue-56 (swapped output loses '## Description' heading outside the inner markdown-body); 17 over-inclusive B picks produce only 2 e2e failures. Retry cascade at src/defuddle.ts:88-215 explains the not_a_candidate picks (hidden-subtree and schema.org retries override contentSelector).
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/defuddle.ts:88-215
    - /home/alexi/git/defuddle/src/defuddle.ts:843
    - /home/alexi/git/defuddle/src/defuddle.ts:1242
    - experiments/jev/research/results/exp-main-container/e2e_swap_results.json
- - **claim:** Cost and latency: list variants average 1,033 input tokens per page (about $0.0000434/page), full-page variant 1,580 tokens ($0.0000664/page); latency p50 67-201 ms, p90 106-207 ms, p99 170-399 ms, max 401 ms at concurrency 6; 833 calls total, 942,123 input tokens, ~$0.040, 0 HTTP errors, all responses model=jev-1.14.0.
  - **evidence:** usage_A.json, usage_B.json, usage_A2.json, usage_C.json, usage_D.json; analysis2.json cost.TOTAL. Batching 5-21 questions per request (1 Choice + 2 Nouls per candidate) did not raise latency versus the 1-question variant C.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/usage_A.json
    - experiments/jev/research/results/exp-main-container/usage_C.json
    - experiments/jev/research/results/exp-main-container/usage_D.json
- - **claim:** The sample is dominated by trivial cases: 126/167 pages have exactly 2 candidates (body plus one article/main with the same text), where Jev-A is 126/126 and findMainContent 122/126; the discriminating subset is the 41 pages with >=3 nested candidates (Jev-A 37/41, findMainContent 37/41, Jev-B 26/41, Jev-D 30/41) and the 9 real pages >20KB (Jev-A 9/9, A2 8/9, B 7/9, C 6/7, D 9/9, findMainContent 7/9).
  - **evidence:** build_summary.json n_candidates_hist {2:126,3:35,4:4,6:1,10:1}, kept_real_pages_gt20KB 9, kept_gt8KB 15; analysis2.json accuracy.*.adjudicated_2cand / adjudicated_3plus / adjudicated_real_gt20KB. SCOUT_NOTES: fixture median 1,755 bytes.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-main-container/build_summary.json
    - experiments/jev/research/SCOUT_NOTES.md
- - **claim:** Inference: Jev's one harmful over-inclusion pattern is preferring a large clutter-filled wrapper over a short true article (57 words) even while its own non_article Noul for that wrapper read 0.83, suggesting it treats a small word count as evidence against 'the whole article'; this is the failure mode a gate must catch, and it was at 0.45 confidence.
  - **evidence:** misses_A.txt entry-point--js-article-content: c2 main 609 words chosen at 0.45 (p: c1 0.05, c2 0.59, c3 0.19, none 0.17), nouls c2 contains_all 0.43 non_article 0.83, c3 contains_all 0.11 non_article 0.05; fixture structure main > sidebar(toc, share) + content-area > .js-article-content + recommended-footer + subscription + legal. Same pick in A2, B; body in D; correct c3@0.95 in C.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/exp-main-container/misses_A.txt
    - /home/alexi/git/defuddle/tests/fixtures/entry-point--js-article-content.html

## Metrics

- **fixtures_total:** 226
- **skipped_extractor:** 17
- **skipped_lt2_candidates:** 42
- **kept:** 167
- **kept_2_candidates:** 126
- **kept_3plus_candidates:** 41
- **kept_real_pages_gt20KB:** 9
- **kept_gt8KB:** 15
- **labels_strict_shingle:** 123
- **labels_fallback_measure:** 39
- **labels_none_of_these_spec:** 5
- **labels_relabelled_as_artifact:** 5
- **model:** jev-1.14.0
- **A_strict_acc:** 157/167=94.0%
- **A_adjudicated_acc:** 163/167=97.6%
- **A_adjudicated_2cand:** 126/126
- **A_adjudicated_3plus:** 37/41=90.2%
- **A_adjudicated_real:** 9/9
- **A_band_ge0.9:** 112/112
- **A_band_0.7_0.9:** 29/29
- **A_band_0.5_0.7:** 11/11
- **A_band_lt0.5:** 11/15=73.3%
- **A_mean_confidence:** 0.848
- **defuddle_findMainContent_strict:** 153/167=91.6%
- **defuddle_findMainContent_adjudicated:** 159/167=95.2%
- **defuddle_findMainContent_3plus:** 37/41
- **defuddle_findMainContent_real:** 7/9
- **jev_A_agrees_with_defuddle_pick:** 157/167
- **B_strict_acc:** 144/167=86.2%
- **B_adjudicated_acc:** 150/167=89.8%
- **B_adjudicated_3plus:** 26/41=63.4%
- **order_flip_rate_A_vs_B:** 16/167=9.6%
- **repeat_flip_rate_A_vs_A2:** 5/167=3.0%
- **repeat_mean_abs_dp_chosen:** 0.016
- **C_strict_acc:** 149/165=90.3%
- **C_adjudicated_acc:** 155/165=93.9%
- **C_none_of_these_picks:** 6
- **C_pages_over_25k_tokens:** 2
- **http_400_max_tokens_exceeded:** 0
- **D_adjudicated_acc:** 147/167=88.0%
- **D_mean_confidence:** 0.492
- **D_picks_ge0.9:** 0
- **noul_spec_rule_adjudicated:** 142/167=85.0%
- **noul_loose_rule_contains_ge0.3:** 157/167=94.0%
- **noul_auroc_contains_all:** 0.991
- **noul_auroc_non_article_ancestor_vs_truth:** 0.834
- **ensemble_A+B_adjudicated:** 161/167=96.4%
- **ensemble_A+B+C_adjudicated:** 162/165=98.2%
- **cascade_A_ge0.5_coverage:** 152/167=91.0%
- **cascade_A_ge0.5_routed_acc:** 152/152
- **e2e_baseline_pass:** 167/167
- **e2e_oracle_truth_pass:** 166/167
- **e2e_jev_A_raw_pass:** 164/167=98.2%
- **e2e_jev_A_conf_ge0.5_fallback_pass:** 167/167
- **e2e_jev_A_conf_ge0.9_fallback_pass:** 167/167 (55 fell back)
- **e2e_jev_B_pass:** 165/167
- **e2e_jev_C_pass:** 167/167 (8 fell back)
- **e2e_jev_D_pass:** 165/167
- **tokens_per_page_list_variant:** 1033
- **tokens_per_page_full_page_variant:** 1580
- **usd_per_page_list_variant:** 4.34e-05
- **usd_per_page_full_page_variant:** 6.64e-05
- **latency_p50_ms_range:** 67-201
- **latency_p99_ms_range:** 170-399
- **latency_max_ms:** 401
- **total_calls:** 833
- **total_input_tokens:** 942123
- **total_est_cost_usd:** 0.0396
- **http_errors:** 0

## Tables

### Table 1. Sample composition (from build_summary.json)
| Item | Count |
|---|---|
| Fixtures in tests/fixtures | 226 |
| Skipped: extractorType set | 17 |
| Skipped: <2 candidates with >=30 words | 42 |
| Kept | 167 |
| Kept with 2 / 3 / 4 / 6 / 10 candidates | 126 / 35 / 4 / 1 / 1 |
| Kept real pages >20 KB (>8 KB) | 9 (15) |
| Truth by strict 5-word shingles / fallback (no-code shingles or word multiset) / none_of_these | 123 / 39 / 5 |
| Variant C eligible (<=25k est. tokens) / too large | 165 / 2 (github issue 27,237; lesswrong 41,612) |

### Table 2. Choice accuracy vs ground truth (jev-1.14.0). "Adj." = 5 artifact labels relabelled to c2 and header-with-subtitle accepts c2|c3
| Variant | State | Strict (n) | Adj. all | Adj. 2-cand | Adj. 3+ cand | Adj. real >20KB | Mean conf | none picks |
|---|---|---|---|---|---|---|---|---|
| A | JSON list, doc order, Choice + 2 Nouls/cand | 157/167 (94.0%) | 163/167 (97.6%) | 126/126 | 37/41 (90.2%) | 9/9 | 0.848 | 0 |
| A2 | exact repeat of A | 157/167 (94.0%) | 163/167 (97.6%) | 125/126 | 38/41 (92.7%) | 8/9 | 0.852 | 1 |
| B | A with candidate order reversed | 144/167 (86.2%) | 150/167 (89.8%) | 124/126 | 26/41 (63.4%) | 7/9 | 0.745 | 0 |
| C | whole cleaned page HTML, data-cand annotations, Choice only | 149/165 (90.3%) | 155/165 (93.9%) | 119/125 | 36/40 (90.0%) | 6/7 | 0.897 | 6 |
| D | A with tag/id/class removed from descriptions and labels | 142/167 (85.0%) | 147/167 (88.0%) | 117/126 | 30/41 (73.2%) | 9/9 | 0.492 | 5 |
| defuddle findMainContent | (its debug.contentSelector mapped to a candidate) | 153/167 (91.6%) | 159/167 (95.2%) | 122/126 | 37/41 (90.2%) | 7/9 | n/a | 2 not-a-candidate |

### Table 3. Accuracy by confidence band (adjudicated labels)
| Variant | >=0.9 | 0.7-0.9 | 0.5-0.7 | <0.5 |
|---|---|---|---|---|
| A | 112/112 | 29/29 | 11/11 | 11/15 (73.3%) |
| A2 | 110/110 | 32/32 | 10/10 | 11/15 |
| B | 43/43 | 74/74 | 24/25 | 9/25 (36.0%) |
| C | 128/128 | 21/21 | 4/4 | 2/12 (16.7%) |
| D | 0/0 | 37/37 | 41/41 | 69/89 (77.5%) |

### Table 4. Order, repeat and context sensitivity
| Comparison | Pairs | Choice flips | Flip % | Both correct (strict) | Either correct | Mean abs dp (chosen) | Max abs dp (any option) |
|---|---|---|---|---|---|---|---|
| A vs B (reversed order) | 167 | 16 | 9.6 | 143 | 158 | 0.122 | 0.76 |
| A vs A2 (repeat) | 167 | 5 | 3.0 | 155 | 159 | 0.016 | 0.12 |
| A vs C (list vs full page) | 165 | 13 | 7.9 | 146 | 158 | 0.085 | 0.77 |
| A vs D (hints removed) | 167 | 19 | 11.4 | - | - | - | - |

Rotation/ensemble (argmax of averaged probabilities), adjudicated: A+B 161/167 (96.4%); A+B+A2 162/167 (97.0%); A+B+C 162/165 (98.2%); A+D 162/167; A+B+D 162/167. Averaging with the reversed order does not beat A alone because B is systematically biased toward the last-listed wrapper.

### Table 5. Confidence-gated cascade on A (use Jev if conf >= t and not none_of_these, else findMainContent), adjudicated labels
| Threshold | Routed to Jev | Coverage | Jev acc. on routed | Overall |
|---|---|---|---|---|
| 0 | 167 | 100% | 163/167 (97.6%) | 163/167 |
| 0.3 | 160 | 95.8% | 159/160 (99.4%) | 163/167 |
| 0.5 | 152 | 91.0% | 152/152 (100%) | 164/167 (98.2%) |
| 0.7 | 141 | 84.4% | 141/141 | 162/167 |
| 0.9 | 112 | 67.1% | 112/112 | 160/167 |

### Table 6. End-to-end: Jev pick passed to Defuddle as contentSelector, Markdown compared to tests/expected exactly as the harness does
| Policy | Pass | Fail | Fell back to default | Failing fixtures |
|---|---|---|---|---|
| baseline (no contentSelector) | 167 | 0 | 167 | - |
| oracle: label truth as selector | 166 | 1 | 5 | github.com-issue-56 (label wrong: '## Description' heading lives outside inner markdown-body) |
| jev_A raw | 164 | 3 | 0 | entry-point--js-article-content (623 words vs 77), github.com-issue-56 (267 vs 271), tailwind-hidden-blog-index (51 vs 172) |
| jev_A conf>=0.5 else default | 167 | 0 | 15 | - |
| jev_A conf>=0.9 else default | 167 | 0 | 55 | - |
| jev_A2 | 166 | 1 | 1 | entry-point--js-article-content |
| jev_B | 165 | 2 | 0 | entry-point--js-article-content, stephango.com-buy-wisely (1329 vs 1249) |
| jev_C | 167 | 0 | 8 | - |
| jev_D | 165 | 2 | 5 | entry-point--js-article-content, github.com-issue-56 |

### Table 7. Noul-derived pick ("smallest candidate with contains_all>=tc and non_article<=tn"), adjudicated labels
| Variant / rule | Correct | Agrees with Choice | Picked none |
|---|---|---|---|
| A, tc 0.5 tn 0.5 (spec) | 142/167 (85.0%) | 143/167 | 23 |
| A, tc 0.7 tn 0.3 | 117/167 (70.1% strict) | 123/167 | 43 |
| A, tc 0.5 only | 142/167 strict 85.0% | 149/167 | 8 |
| A, tc 0.3 tn 0.5 | 157/167 (94.0%) | 158/167 | 7 |
| D, tc 0.5 tn 0.5 | 111/167 (66.5%) | - | - |
| D, tc 0.3 tn 0.5 | 146/167 (87.4%) | - | - |

Noul diagnostics (A, 389 candidate rows): mean contains_all truth 0.745 / ancestor 0.695 / descendant 0.154 / other 0.035; mean non_article truth 0.086 / ancestor 0.234 (only 19.4% of ancestors >=0.5). AUROC contains_all for "holds the whole article" 0.991; AUROC non_article ancestor-vs-truth 0.834 (D: 0.971 / 0.771).

### Table 8. Cost and latency (all model=jev-1.14.0, concurrency 6, 0 HTTP errors)
| Variant | Calls | Input tokens | Tokens/page | USD total | USD/page | p50 ms | p90 ms | p99 ms | max ms | wall s |
|---|---|---|---|---|---|---|---|---|---|---|
| A | 167 | 172,593 | 1,033 | 0.00725 | 0.0000434 | 201 | 207 | 399 | 401 | 5 |
| B | 167 | 172,593 | 1,033 | 0.00725 | 0.0000434 | 75 | 199 | 202 | 204 | 3 |
| A2 | 167 | 172,593 | 1,033 | 0.00725 | 0.0000434 | 67 | 115 | 170 | 176 | 2 |
| C | 165 | 260,761 | 1,580 | 0.01095 | 0.0000664 | 68 | 113 | 207 | 256 | 2 |
| D | 167 | 163,583 | 980 | 0.00687 | 0.0000411 | 70 | 106 | 223 | 226 | 2 |
| Total | 833 | 942,123 | | 0.0396 | | | | | | |

### Table 9. Every Variant A miss (strict labels), with judgment
| Fixture (bytes, n cand) | Candidates (id: tag words) | Jev A pick @conf (probs) | Truth (label basis) | defuddle pick | e2e with Jev pick | Judgment |
|---|---|---|---|---|---|---|
| codeblocks--rockthejvm.com-articles-kotlin-101-type-classes (5,606, 3) | c1 body 286; c2 main 278; c3 article 278 | c1 @0.24 (c1 .43, c2 .09, c3 .40, none .08) | c3 (shingle) | c3 | PASS (nav/footer stripped later) | Not defensible: body excerpt visibly shows "rock the jvm articles" nav and "copyright 2024" footer; near-tie, A2 flipped to c3 |
| content-patterns--card-grid-stripped-headings (3,401, 3) | c1 body 264; c2 main 264; c3 article 193 | c2 @0.20 (c1 .10, c2 .40, c3 .31, none .19) | c3 (shingle) | c2 | PASS | Partly defensible: main holds a 3-card related-article grid after the article, but the 300/150-char excerpts show prose at both ends so the state hid the clutter; with full HTML (C) Jev picked c3 @0.92; defuddle makes the same pick |
| entry-point--js-article-content (7,384, 3) | c1 body 626; c2 main 609; c3 div.js-article-content 57 | c2 @0.45 (c1 .05, c2 .59, c3 .19, none .17) | c3 (shingle) | c3 | FAIL (623 words vs 77) | Not defensible and harmful: main is ToC + share panel + 4 recommended items + subscription + legal text; Jev's own non_article Noul for main was 0.83; same pick in A2 and B; C picked c3 @0.95; caught by a 0.5 gate |
| footnotes--inline-footnote-span (1,329, 2) | c1 body 59; c2 div.entry-content 59 | c2 @0.92 | none_of_these (label artifact: markers -> [^1]) | c2 | PASS | Jev correct; label wrong |
| footnotes--orgmode-css-sidenotes (1,698, 2) | c1 body 87; c2 article 87 | c2 @0.92 | none_of_these (artifact) | c2 | PASS | Jev correct; label wrong |
| footnotes--word-ftn-ftnref (1,152, 2) | c1 body 37; c2 article 37 | c2 @0.92 | none_of_these (artifact) | c2 | PASS | Jev correct; label wrong |
| math--raw-latex (1,087, 2) | c1 body 99; c2 article 99 | c2 @0.97 | none_of_these (artifact: math -> LaTeX) | c2 | PASS | Jev correct; label wrong |
| math--mathjax-tex-scripts (1,127, 2) | c1 body 52; c2 article 52 | c2 @0.97 | none_of_these (artifact) | c2 | PASS | Jev correct; label wrong |
| general--tailwind-hidden-blog-index (3,733, 6) | c1 body 165; c2 main 158; c3-c6 article cards 33-37 | c3 @0.25 (c3 .36, none .29, c6 .14, c2 .11) | c2 (words; blog index kept via defuddle's index-page retry) | c2 | FAIL (51 words vs 172) | Partly defensible: there is no single main article, so none_of_these (A2, C, D) is the honest answer; picking one card is under-inclusive and harmful; caught by a 0.5 gate |
| issues--header-with-subtitle-p (2,110, 3) | c1 body 235; c2 article 231; c3 div.article-body 199 | c2 @0.60 (c1 .13, c2 .70, c3 .10) | c3 (shingle) | c2 | PASS | Defensible / label-ambiguous: article contains the h1, subtitle and byline that article-body excludes, and the question asks for "all paragraphs, headings"; defuddle makes the same pick |

Additional e2e-only failure for A: general--github.com-issue-56 (104,933 bytes, 10 candidates) Jev c4 @0.25 (c2 .17, c3 .22, c4 .35, none .19) equals the label, but the label is wrong: the inner markdown-body omits GitHub's "## Description" and later section headings, so even the oracle pick fails; defuddle's c2 (main) is what the expected output needs. A2 and B picked c2 (PASS). Below the 0.5 gate.

### Table 10. Variant B misses (adjudicated; 17), compact
| Fixture (n) | Jev B pick @conf | Truth | Relation | e2e |
|---|---|---|---|---|
| content-patterns--card-grid-stripped-headings (3) | c2 main @0.25 | c3 | ancestor | PASS |
| codeblocks--rockthejvm (3) | c2 main @0.37 | c3 | ancestor | PASS |
| entry-point--js-article-content (3) | c2 main @0.57 | c3 | ancestor | FAIL |
| general--appendix-heading (4) | c3 article @0.39 | c4 article-body | ancestor | PASS |
| general--cp4space-jordan-algebra (4) | c3 div.post @0.39 | c4 entry-content | ancestor | PASS |
| general--developer.mozilla.org Array (2) | c1 body @0.19 | c2 main | ancestor | PASS |
| general--github.com-issue-56 (10) | c2 main @0.45 | c4 | ancestor | PASS (label wrong) |
| general--stephango.com-buy-wisely (3) | c2 main @0.31 | c3 article | ancestor | FAIL (1329 vs 1249 words) |
| general--substack-app (2) | c2 feed item @0.09 | c1 body | descendant | PASS (defuddle retry overrides) |
| general--svg-external-css-fallback (3) | c2 main @0.28 | c3 | ancestor | PASS |
| general--svg-content-preservation (3) | c2 main @0.29 | c3 | ancestor | PASS |
| issues--159-lean-verso-code-blocks (3) | c2 main @0.35 | c3 | ancestor | PASS |
| issues--159-lean-heading-permalink-emoji (3) | c2 main @0.12 | c3 | ancestor | PASS |
| issues--159-lean-verso-grouped-blocks (3) | c2 main @0.25 | c3 | ancestor | PASS |
| issues--159-lean-verso-missing-section-gap (3) | c2 main @0.33 | c3 | ancestor | PASS |
| issues--159-lean-verso-empty-line-preserved (3) | c2 main @0.35 | c3 | ancestor | PASS |
| thin-section-before-see-also (3) | c2 main @0.37 | c3 | ancestor | PASS |
(B strict also counts the 5 artifact labels and header-with-subtitle-p c2 @0.72 = 23 strict misses.)

### Table 11. Variant C misses (adjudicated; 10), compact
| Fixture (n) | Jev C pick @conf | Truth | Relation | e2e (none -> default) |
|---|---|---|---|---|
| author-share-widget (2) | none_of_these @0.37 | c2 main | abstain | PASS |
| footnotes--external-labeled-section (2) | none_of_these @0.02 | c1 body (footnotes outside article) | abstain | PASS |
| footnotes--labeled-section-ol (2) | c2 article @0.02 | c1 body | descendant | PASS |
| footnotes--sidenote-inline-with-list (3) | c2 main @0.47 | c3 .post-content | ancestor | PASS |
| general--appendix-heading (4) | c3 article @0.45 | c4 article-body | ancestor | PASS |
| general--cp4space-jordan-algebra (4) | c3 div.post @0.45 | c4 entry-content | ancestor | PASS |
| general--trailing-cta-newsletter (2) | none_of_these @0.38 | c2 main | abstain | PASS |
| general--tailwind-hidden-blog-index (6) | none_of_these @0.31 | c2 main | abstain (defensible: index page) | PASS |
| general--substack-app (2) | none_of_these @0.38 | c1 body | abstain | PASS |
| issues--162-aria-hidden-main-content (2) | none_of_these @0.33 | c2 main | abstain | PASS |

### Table 12. Variant D (no structural hints) flips vs A (19)
Body chosen over the article/main element at conf 0.14-0.40 on 14 two-or-three-candidate pages whose excerpts are identical (codeblocks--mintlify, codeblocks--hljs-header, content-patterns--live-blog-metadata, elements--image-dedup, footnotes--aside-ol-start, MDN Array, general--svg-content-preservation, issues--106-menu-id, issues--143-arxiv-cross-references, issues--374-explicit-image-sources, issues--374-image-source, issues--header-with-subtitle-p, card-grid, js-article-content); none_of_these on 5 (tailwind index and four issues--159-lean-verso pages). On the 9 real pages D matched A (9/9).

### Table 13. defuddle findMainContent vs adjudicated label (8 differences; all 167 pass the fixture tests)
| Fixture | defuddle pick | Label | Why the final output is still right |
|---|---|---|---|
| content-patterns--card-grid-stripped-headings | c2 main | c3 article | content-pattern removal strips the card grid |
| footnotes--external-labeled-section | c2 article | c1 body | external footnotes adopted into the article |
| footnotes--labeled-section-ol | c2 article | c1 body | same |
| general--appendix-heading | c3 article | c4 article-body | header stripped later |
| general--github.com-issue-56 | c2 main | c4 markdown-body | label wrong; main is needed for the section headings |
| general--substack-app | retry-chosen element inside body (not a candidate) | c1 body | hidden-subtree/schema retry (src/defuddle.ts:88-215) |
| general--substack-custom-domain | c2 div.post | c3 article | wrapper cleaned later |
| issues--162-aria-hidden-main-content | retry-chosen element inside main (not a candidate) | c2 main | hidden-content retry |

## Caveats

- Sample is small and skewed: 167 fixtures, 126 with only 2 candidates (near-trivial body vs article), 41 with >=3, 9 real full pages >20KB; the 97.6% headline is driven by synthetic regression fixtures and should not be read as a web-scale estimate.
- Ground truth is derived from defuddle's own expected outputs, so it is biased toward defuddle's notion of the container; it is also noisy: 5 'none_of_these' labels are provable artifacts, 1 label (github issue) is contradicted by the oracle end-to-end check, 1 is ambiguous (header vs article-body), and 2 external-footnote labels pick <body> literally. Strict-spec and adjudicated numbers are both reported.
- The previous run's raw Jev results (variants A, B, A2, C) were reused after verifying that an independent rebuild of candidates.jsonl is byte-identical; only variant D and all analyses are new in this run. Jev is non-deterministic (3% repeat flips observed), so re-running would move individual picks at low confidence.
- The 'ground truth = smallest covering candidate' definition penalizes over-inclusive picks that defuddle's later removal stages would clean up; the end-to-end swap check is the better measure of practical harm and is reported separately.
- End-to-end swap passes contentSelector through the normal retry cascade (src/defuddle.ts:88-215), where hidden-subtree and schema.org retries can override it; this matches how a real integration would behave but means a few passes are rescued by defuddle rather than by Jev.
- Variant C truncated nothing but excluded the 2 pages over 25k estimated tokens; real-world pages are often larger, and the brief notes accuracy loss with irrelevant content and the 32k per-question limit.
- Single model version (jev-1.14.0) and single prompt wording; option labels in A/B/C included tag and class names, which variant D shows materially inflate confidence. No test of adversarial content in the state; the brief documents 93-100% injection success on routing tasks.
- Latency p50 varied 67-201 ms across identically sized variants minutes apart, so the latency figures reflect server load at the time, not a stable property.
- Not evaluated here: the browser extension's 'no network requests' promise and synchronous parse() API, and the Worker's cost model; any adoption would have to resolve those before this slice's numbers matter.

## Artifacts

- experiments/jev/research/results/exp-main-container/build-candidates.mjs
- experiments/jev/research/results/exp-main-container/candidates.jsonl
- experiments/jev/research/results/exp-main-container/fixture_log.json
- experiments/jev/research/results/exp-main-container/build_summary.json
- experiments/jev/research/results/exp-main-container/run-jev.mjs
- experiments/jev/research/results/exp-main-container/run-variant-D.mjs
- experiments/jev/research/results/exp-main-container/jev_A.jsonl
- experiments/jev/research/results/exp-main-container/jev_A2.jsonl
- experiments/jev/research/results/exp-main-container/jev_B.jsonl
- experiments/jev/research/results/exp-main-container/jev_C.jsonl
- experiments/jev/research/results/exp-main-container/jev_D.jsonl
- experiments/jev/research/results/exp-main-container/usage_A.json
- experiments/jev/research/results/exp-main-container/usage_A2.json
- experiments/jev/research/results/exp-main-container/usage_B.json
- experiments/jev/research/results/exp-main-container/usage_C.json
- experiments/jev/research/results/exp-main-container/usage_D.json
- experiments/jev/research/results/exp-main-container/analyze.mjs
- experiments/jev/research/results/exp-main-container/analysis.json
- experiments/jev/research/results/exp-main-container/analysis-stdout.txt
- experiments/jev/research/results/exp-main-container/analyze2.mjs
- experiments/jev/research/results/exp-main-container/analysis2.json
- experiments/jev/research/results/exp-main-container/misses_A.txt
- experiments/jev/research/results/exp-main-container/misses_B.txt
- experiments/jev/research/results/exp-main-container/misses_C.txt
- experiments/jev/research/results/exp-main-container/e2e-swap.mjs
- experiments/jev/research/results/exp-main-container/e2e_swap_results.json
- experiments/jev/lab/rebuild/candidates.jsonl
