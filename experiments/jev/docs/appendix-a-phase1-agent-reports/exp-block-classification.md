# Jev keep-vs-clutter block classification vs defuddle fixtures: V1 (HTML), V2 (text), V3 (JSON+context) on 1,475 units, two ground truths, confidence-band and page-level analysis

_Verbatim final report of the phase-1 workflow agent `exp-block-classification` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

What I did. The live runs for this slice already existed in experiments/jev/research/results/exp-block-classification/ (raw-v1.jsonl 1,475 units, raw-v2/v3 767 units each on the fixed-seed subsample, plus a 767-unit V1 repeat; all jev-1.14.0, 0 errors). Rather than re-spend, I verified them by re-querying 12 random units (12/12 same model, identical input-token counts, mean |dp| 0.005, 0 decision flips) and reused them. I then found that the dataset's ground truth was partly wrong: build-block-dataset.mjs derives 'kept/removed' by shingle-matching unit text against `outDoc.body.textContent` of defuddle's output (line 103), which glues adjacent block elements ("YouTube UI↩That's to say"), so short units (headings, footnote items, list items) lost their shingles and were labeled 'removed' although tests/expected/<fixture>.md keeps them verbatim. I wrote relabel.mjs (whitespace-correct match against both defuddle output and the expected Markdown body): 72 of 367 'removed' units flip to 'kept', 0 flip the other way, 20 become 'mixed' and are excluded. I re-ran a full analysis (analyze2.mjs) under both GT-A (original labels, as specified) and GT-B (corrected), with fixture-clustered bootstrap CIs, two threshold-tuning splits (by unit and by fixture), confidence bands split into content-loss vs clutter-leak errors, cascades at 0.8/0.9/0.94/0.98, and hand judgments for 77 disagreements (both top-40 lists plus every confident-band disagreement under GT-B).

What I found (measured). Jev is a competent but not heuristic-beating standalone classifier. V1 (block HTML) on all units: GT-A accuracy 0.837 at 0.5, AUROC 0.838, F1(removed) 0.645; GT-B accuracy 0.876 [95% CI 0.822-0.914], AUROC 0.891 [0.849-0.923], F1(removed) 0.688, F1(kept) 0.922, ECE 0.068; tuned thresholds (cross-fit, both splits land at p_keep≈0.25-0.32, i.e. Jev under-states keep) raise accuracy to 0.904-0.907. Excluding policy removals (title/byline/date, which defuddle handles deterministically) and site-extractor pages: accuracy 0.929, AUROC 0.948, tuned 0.952. Confidence is informative: |2p-1|≥0.8 covers 66.5% of units at 93.9% agreement (GT-B; 98.1% on the non-policy/non-extractor subset), ≥0.9 covers 42.6% at 96.1%, ≥0.94 covers 19.5% at 99.3%, ≥0.98 covers 0.3%. Text-only state (V2) is best calibrated (ECE 0.047) and most accurate in-band (95.9%) but least confident (38.7% coverage); adding page_title/url as JSON (V3) made Jev more confident and less accurate (AUROC 0.883→0.856 on the same units, 57 confident clutter leaks vs 32) — context stuffed into the state did not help. Repeats are stable (mean |dp| 0.008, 0.8% decision flips, 0 confident contradictions). Cost: 981 tokens/call, $0.061 for all 1,475 blocks, p50 latency 70 ms, p90 106 ms, p99 173 ms at concurrency 8.

Error analysis (judged). Under GT-B, 59 of the 967 confident-band units disagree with the fixtures; by hand: 21 are the page-title h1 (a defuddle policy Jev was never told about), 17 are comment/extractor pages (HN, Reddit, GitHub PR, Gmail) where the literal instruction "do not keep comment sections / dates" is wrong for the page type, 4 are index-listing card metadata, 8 are residual label artifacts (code blocks with line-number gutters, math converted to LaTeX), 1 is a confirmed defuddle bug (footnotes--wikipedia-references: the last body paragraph before "See also" is removed by removeThinPrecedingSection, src/removals/content-patterns.ts:197-215, and the human-reviewed expected file encodes the loss; Jev said keep at p=0.98), 4 are ambiguous (3 leaning Jev), and only 4 are genuine Jev errors (0.4% of the band; 3 would be content loss: an inline "Share this article" link judged out of context, a list item literally reading "Google docs comments", a GitHub PR description judged as a comment). The top-40 list under the original labels is dominated by label artifacts (20) and title policy (8); the previous analysis's headline accuracy (0.837) understated Jev by about 4 points for that reason.

What it implies for the Jev question. (1) Jev cannot replace defuddle's clutter removal: at any threshold it disagrees with the test-verified output on 9-12% of blocks, with page-level perfection on only 56-62% of fixtures, and the "99.99%" target is unreachable (99%+ agreement only below 20% coverage). (2) Layered as a confident-only second opinion (|2p-1|≥0.9 or ≥0.94) with code handling titles, bylines/dates and extractor/comment pages, Jev would contradict a correct pipeline on roughly 0.4-0.8% of the blocks it decides, and in the one case where the pipeline was demonstrably wrong it was confidently right; the inverse rate (how often Jev is confidently right when the heuristic is wrong) cannot be measured on this corpus because the corpus is the heuristic's own output. (3) Weak spots: 3-15-word units (accuracy 0.76-0.83 vs 0.95-0.98 for 16-100 words), site-extractor pages (gmail 0.31, github 0.50, hackernews 0.57), literal keyword triggers ("comments"), and instruction-driven policy mismatches; strengths: prose paragraphs (p tags 0.965, 3 errors in 475 confident decisions), nav/header/footer (100%), removeBySelector removals (recall 0.918). The practical value demonstrated is as a shadow-mode regression detector (flag confident-keep on removed blocks), not as an authority in the pipeline.

## Verdict for this dimension

Measured: Jev (jev-1.14.0, one literal Noul + one 12-way Choice per block, ~1k tokens, 70 ms, $0.00004 per block) agrees with defuddle's test-verified keep/remove decisions on 87.6% of 1,455 blocks at p=0.5 (AUROC 0.891) once the dataset's own labeling bug is corrected, 92.9% (AUROC 0.948) when page titles/bylines/dates and site-extractor pages are left to code. That is not 'at least as well as the heuristics' in the sense of replacing them (the heuristic is 100% by construction and Jev disagrees on 7-12% of blocks, perfect on only 56-62% of pages), and nothing approaches 99.99%: 99%+ agreement exists only at |2p-1|>=0.94, which covers 19.5% of blocks. Where Jev is confident (|2p-1|>=0.8, 66% of blocks) it agrees 93.9% (98.1% on non-policy, non-extractor pages), and hand review of every confident disagreement shows the residual is overwhelmingly policy Jev was never told (page title to frontmatter 21, comment/mail/PR pages 17, index-page card metadata 4), dataset artifacts (8), or a genuine defuddle bug Jev caught (1); only 4 of 967 confident decisions (0.4%) are real Jev errors, 3 of which would delete content. Inference: Jev should not be wired in as the clutter decider (short 3-15-word units, extractor pages and literal keyword triggers like 'comments' are its failure modes, and context in the state made it over-confident rather than better), but a confident-only, shadow-mode second opinion gated at >=0.9/0.94 with titles, hidden elements and page type handled in code is cheap, stable across repeats (0.8% flips), and demonstrably able to flag over-stripping regressions the fixtures themselves missed. 'Aggressive' use is not supported by this data.

## Findings

- - **claim:** Raw results from the earlier run are valid and reproducible; no re-spend was needed. 12 random units re-queried against jev-1.14.0 returned identical input-token counts (12/12), mean |dp| 0.005, max 0.04, 0 decision flips, 0 kind flips.
  - **evidence:** experiments/jev/research/results/exp-block-classification/verify-api-1793144780041.json; raw files have 1475/767/767/767 unique ids, 0 errors, model jev-1.14.0 throughout (checked with a node one-liner).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/verify-api.mjs
    - experiments/jev/research/results/exp-block-classification/raw-v1.jsonl
- - **claim:** The block dataset's ground truth has a systematic labeling bug: 72 of 367 'removed' units (19.6%) are actually kept verbatim in the human-reviewed expected Markdown. Cause: the builder matches against output textContent that glues adjacent block elements, destroying shingles of short units (headings, footnote items, list items).
  - **evidence:** build-block-dataset.mjs line 103 `const outputText = normalize(outDoc.body?.textContent || '')` and statusOf (lines 62-73); demonstrated on footnotes--sidenote-inline-with-list where the glued text reads 'YouTube UI↩That's to say, contagious from inwards↩' while expected .md contains '[^2]: That's to say, contagious from inwards'. relabel.mjs (space inserted after every tag, line 29) flips 72 removed->kept, 0 kept->removed, 20 to mixed.
  - **confidence:** high
  - **refs:** - experiments/jev/research/build-block-dataset.mjs:62-73
    - experiments/jev/research/build-block-dataset.mjs:103
    - experiments/jev/research/results/exp-block-classification/relabel.mjs:27-31
    - experiments/jev/research/results/exp-block-classification/relabel-summary.json
- - **claim:** V1 (block HTML, all 1,475 units) under original labels: accuracy 0.837 at p=0.5, AUROC 0.838, F1(removed) 0.645 (P 0.706 / R 0.594), F1(kept) 0.894, ECE 0.067; tuned threshold does not help (cross-fit test F1 0.634 unit split, 0.621 fixture split).
  - **evidence:** analysis2-stdout.txt section 'V1: state = block HTML, all units [orig]'; cluster-bootstrap 95% CI acc 0.790-0.869, AUROC 0.792-0.877.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
    - experiments/jev/research/results/exp-block-classification/analysis2.json
- - **claim:** Under corrected labels (n=1,455) V1 improves to accuracy 0.876 [0.822-0.914], AUROC 0.891 [0.849-0.923], F1(removed) 0.688, F1(kept) 0.922; F1-optimal thresholds found on one half (p_keep 0.245-0.315 on both unit and fixture splits) give 0.903-0.907 accuracy and F1(removed) 0.728-0.734 on the other half. Excluding policy removals and extractor fixtures: accuracy 0.929, AUROC 0.948, tuned accuracy 0.952, F1(kept) 0.958.
  - **evidence:** analysis2-stdout.txt section '[corr]' main table and 'Subsets' table.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
    - experiments/jev/research/results/exp-block-classification/labels-corrected.jsonl
- - **claim:** Confidence bands are informative but never reach the 99.99% regime at useful coverage. GT-B V1: |2p-1| 0.8-1.0 covers 66.5% at 93.9% [CI 0.899-0.965]; 0.6-0.8 covers 15.3% at 84.3%; 0.4-0.6 covers 7.7% at 84.8%; 0-0.4 covers 10.5% at 54.2%. |2p-1|>=0.9: 42.6% at 96.1%; >=0.94: 19.5% at 99.3% (2 errors, both clutter leaks); >=0.98: 0.3% (5 units).
  - **evidence:** Band table in analysis2-stdout.txt [corr]; confidence ECE 0.030.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
- - **claim:** In the confident band under corrected labels, only 4 of 967 decisions (0.4%) are genuine Jev errors after hand review of all 59 disagreements; the rest are page-title policy (21), comment/extractor page policy (17), index-listing metadata (4), residual label artifacts in code/math (8), one confirmed defuddle bug where Jev is right (1), and ambiguous (4, three leaning Jev).
  - **evidence:** judgments.json (77 hand judgments) merged by analyze2.mjs; 'Confident band' line in analysis2-stdout.txt: genuine 4 (0.4% of band), content-loss genuine 3.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/exp-block-classification/judgments.json
    - experiments/jev/research/results/exp-block-classification/disagreements-corr.json
- - **claim:** Jev found a real defuddle defect that the human-reviewed fixture also encodes: in footnotes--wikipedia-references the body paragraph 'In particular, the framework has proven useful ... [4]' is deleted as a 'thin CTA section' because it is the <50-word element immediately before the 'See also' section; the expected .md lacks the sentence. Jev: p_keep 0.98, kind article_body.
  - **evidence:** src/removals/content-patterns.ts removeThinPrecedingSection (lines 197-215) with debug reason 'thin CTA section' at line 213; tests/fixtures/footnotes--wikipedia-references.html contains the paragraph, tests/expected/footnotes--wikipedia-references.md does not.
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/removals/content-patterns.ts:197-215
    - /home/alexi/git/defuddle/tests/expected/footnotes--wikipedia-references.md
- - **claim:** State format matters: text-only (V2) is the best-calibrated (ECE 0.047) and most accurate in the confident band (95.9%, 8 content-loss / 4 clutter-leak errors) but covers only 38.7%; HTML (V1) covers 64.4% at 90.7%; JSON with page_title/page_url (V3) raises coverage to 73.2% but lowers in-band accuracy to 87.6% and AUROC to 0.856 (vs 0.883 for V1 on the same 750 units) with 57 confident clutter leaks. Averaging the three gives AUROC 0.889 and 94.0% in-band accuracy at 48.8% coverage.
  - **evidence:** 'Variant comparison on the common subsample [corr]' table; pairwise agreement at 0.5: V1-V2 0.921, V1-V3 0.953, V2-V3 0.899; 0/0/1 confident contradictions.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
    - experiments/jev/research/results/exp-block-classification/raw-v2.jsonl
    - experiments/jev/research/results/exp-block-classification/raw-v3.jsonl
- - **claim:** Page-level, Jev at 0.5 matches the test-verified output exactly on 56.1% of fixtures (86.1% within one unit); under a cascade that lets Jev decide only when |2p-1|>=0.8 and defers otherwise, it would alter a correct pipeline on 17.5% of fixtures (59 units: 27 content-loss, 32 clutter-leak); at >=0.9 on 7.6% (24 units); at >=0.94 on 0.9% (2 units, clutter leaks only).
  - **evidence:** 'Page-level' table, GT-B V1 all units (223 fixtures with units).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
- - **claim:** The inverse quantity (when the heuristic is wrong, how often is Jev confidently right) cannot be measured on this corpus because the labels are the heuristic's own output; the only evidence is one confirmed heuristic error (wikipedia-references) where Jev was confidently right, and 8 dataset-label artifacts in the confident band where Jev agreed with the human expected output.
  - **evidence:** By construction of build-block-dataset.mjs (label = survival in defuddle output, which equals tests/expected); judged cases in judgments.json.
  - **confidence:** high
  - **refs:** - experiments/jev/research/build-block-dataset.mjs
    - experiments/jev/research/results/exp-block-classification/judgments.json
- - **claim:** Jev's weak spots are short units and extractor pages: words 3-5 accuracy 0.760 (113 removed units: recall 0.54), 6-15 0.827, vs 16-50 0.945, 51-100 0.979; gmail 0.308, github 0.50, hackernews 0.571, mastodon 0.538 (comment/mail pages where the literal instruction is wrong for the page type). Strong spots: p tags 0.965 (3 errors in 475 confident decisions), pre 1.0, footer/header/nav 1.0, removeBySelector removals recall 0.918, 101-300-word units 0 errors in band.
  - **evidence:** 'By words bucket', 'By tag', 'By extractor', 'By removal_step' tables, GT-B V1.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
- - **claim:** The kind Choice adds little over the Noul: a content-kind=>keep rule scores 0.885 accuracy vs 0.876 for the Noul at 0.5; they agree on 94.9% of units (90.1% accurate when agreeing); 'heading' is 32.7% removed (page titles) and 'comments' 45% kept (comment pages), confirming that the disagreements are policy not perception. article_body is only 1.5% removed, navigation_or_menu 95.9% removed.
  - **evidence:** 'Kind (choice) vs label' table, GT-B V1.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
- - **claim:** Cost and latency are negligible: 981 input tokens per block (HTML), 859 (text), 1,049 (JSON); $0.061 for all 1,475 blocks; p50 70 ms, p90 106 ms, p99 173 ms, max 240 ms per call at concurrency 8 (wall 14.2 s for 1,472 calls). Total experiment spend across all runs: 3,788 calls, 3.69M input tokens, about $0.155.
  - **evidence:** usage-*.json files and Cost lines in analysis2-stdout.txt; price $0.042/M input, output free.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/usage-v1-1793140426500.json
    - experiments/jev/research/results/exp-block-classification/usage-v2-1793140443038.json
    - experiments/jev/research/results/exp-block-classification/usage-v3-1793140450878.json
- - **claim:** Repeat stability on 767 units (same state, questions, model): 49.2% identical probabilities, mean |dp| 0.008, p90 0.02, max 0.10, 0.8% decision flips at 0.5, 0.8% kind flips, 2.9% band-membership changes, 0 confident contradictions.
  - **evidence:** 'Repeat run' line in analysis2-stdout.txt from raw-v1r.jsonl.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-block-classification/raw-v1r.jsonl
- - **claim:** Inference: Jev would be most useful to defuddle as a shadow-mode regression detector (confident keep on a removed block = candidate over-stripping, confident remove on a kept long block = candidate leak), gated at |2p-1|>=0.9, with titles, bylines/dates, hidden elements and extractor/comment pages excluded by code; it should not be the primary decider, and nothing in this data supports a '~99.99% reliable' claim for clutter removal.
  - **evidence:** Derived from the band/cascade/judgment numbers above; 99%+ agreement only at <20% coverage; genuine confident error rate 0.4-0.8%.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis2.json

## Metrics

- **model:** jev-1.14.0
- **units_total:** 1475
- **units_GT_A:** - **n:** 1475
  - **removed:** 367
  - **kept:** 1108
- **units_GT_B:** - **n:** 1455
  - **removed:** 279
  - **kept:** 1176
  - **mixed_excluded:** 20
  - **policy_flagged:** 113
- **relabel_flips:** - **removed_to_kept:** 72
  - **kept_to_removed:** 0
  - **to_mixed:** 20
  - **fallback_lt3_words:** 17
- **V1_all_GT_A:** - **acc05:** 0.837
  - **acc05_ci95:** - 0.79
    - 0.869
  - **removed_precision:** 0.706
  - **removed_recall:** 0.594
  - **removed_f1:** 0.645
  - **kept_precision:** 0.872
  - **kept_recall:** 0.918
  - **kept_f1:** 0.894
  - **auroc:** 0.838
  - **auroc_ci95:** - 0.792
    - 0.877
  - **ece_pkeep:** 0.067
  - **tuned_unit_split_thresholds:** - 0.475
    - 0.325
  - **tuned_unit_split_test_f1:** 0.634
  - **tuned_unit_split_test_acc:** 0.84
  - **tuned_fixture_split_thresholds:** - 0.255
    - 0.555
  - **tuned_fixture_split_test_f1:** 0.621
  - **band_ge08:** - **n:** 980
    - **coverage:** 0.664
    - **accuracy:** 0.898
    - **content_loss:** 27
    - **clutter_leak:** 73
  - **band_ge09:** - **n:** 631
    - **coverage:** 0.428
    - **accuracy:** 0.926
  - **band_ge094:** - **n:** 284
    - **coverage:** 0.193
    - **accuracy:** 0.989
  - **page_level_at05:** - **fixtures:** 224
    - **zero_disagreements_frac:** 0.531
    - **le1_frac:** 0.813
    - **total_disagreements:** 240
  - **page_level_cascade08:** - **zero_frac:** 0.772
    - **le1_frac:** 0.929
    - **total_disagreements:** 100
    - **frac_units_decided:** 0.664
  - **excl_policy_and_extractor:** - **n:** 1220
    - **acc05:** 0.882
    - **f1_removed:** 0.659
    - **auroc:** 0.861
    - **band08_cov:** 0.689
    - **band08_acc:** 0.938
- **V1_all_GT_B:** - **acc05:** 0.876
  - **acc05_ci95:** - 0.822
    - 0.914
  - **removed_precision:** 0.662
  - **removed_recall:** 0.717
  - **removed_f1:** 0.688
  - **removed_f1_ci95:** - 0.616
    - 0.754
  - **kept_precision:** 0.931
  - **kept_recall:** 0.913
  - **kept_f1:** 0.922
  - **auroc:** 0.891
  - **auroc_ci95:** - 0.849
    - 0.923
  - **ece_pkeep:** 0.068
  - **ece_confidence:** 0.03
  - **tuned_unit_split_thresholds:** - 0.315
    - 0.245
  - **tuned_unit_split_test_f1:** 0.728
  - **tuned_unit_split_test_acc:** 0.903
  - **tuned_fixture_split_thresholds:** - 0.275
    - 0.245
  - **tuned_fixture_split_test_f1:** 0.73
  - **tuned_fixture_split_test_acc:** 0.903
  - **tuned_crossfit_full_acc:** 0.904
  - **tuned_crossfit_full_removed_precision:** 0.793
  - **tuned_crossfit_full_removed_recall:** 0.674
  - **bands:** - **0.8-1.0:** - **n:** 967
      - **coverage:** 0.665
      - **accuracy:** 0.939
      - **accuracy_ci95:** - 0.899
        - 0.965
      - **content_loss:** 27
      - **clutter_leak:** 32
      - **precision_remove:** 0.846
      - **precision_keep:** 0.96
    - **0.6-0.8:** - **n:** 223
      - **coverage:** 0.153
      - **accuracy:** 0.843
      - **content_loss:** 10
      - **clutter_leak:** 25
    - **0.4-0.6:** - **n:** 112
      - **coverage:** 0.077
      - **accuracy:** 0.848
      - **content_loss:** 11
      - **clutter_leak:** 6
    - **0.0-0.4:** - **n:** 153
      - **coverage:** 0.105
      - **accuracy:** 0.542
      - **content_loss:** 54
      - **clutter_leak:** 16
    - **ge_0.9:** - **n:** 620
      - **coverage:** 0.426
      - **accuracy:** 0.961
      - **content_loss:** 11
      - **clutter_leak:** 13
    - **ge_0.94:** - **n:** 283
      - **coverage:** 0.195
      - **accuracy:** 0.993
      - **content_loss:** 0
      - **clutter_leak:** 2
    - **ge_0.98:** - **n:** 5
      - **coverage:** 0.003
      - **accuracy:** 1
  - **subsets:** - **excl_policy:** - **n:** 1342
      - **removed:** 200
      - **acc05:** 0.914
      - **f1_removed:** 0.745
      - **auroc:** 0.946
      - **tuned_acc:** 0.94
      - **band08_cov:** 0.677
      - **band08_acc:** 0.968
      - **band08_content_loss:** 18
      - **band08_clutter_leak:** 11
    - **excl_extractor:** - **n:** 1304
      - **removed:** 237
      - **acc05:** 0.889
      - **f1_removed:** 0.688
      - **auroc:** 0.89
      - **band08_acc:** 0.953
      - **band08_content_loss:** 9
      - **band08_clutter_leak:** 32
    - **excl_both:** - **n:** 1206
      - **removed:** 168
      - **acc05:** 0.929
      - **removed_precision:** 0.716
      - **removed_recall:** 0.81
      - **f1_removed:** 0.76
      - **f1_kept:** 0.958
      - **auroc:** 0.948
      - **tuned_acc:** 0.952
      - **tuned_f1_removed:** 0.815
      - **band08_cov:** 0.69
      - **band08_acc:** 0.981
      - **band08_content_loss:** 5
      - **band08_clutter_leak:** 11
  - **page_level:** - **fixtures:** 223
    - **at05:** - **zero:** 125
      - **zero_frac:** 0.561
      - **le1:** 192
      - **le1_frac:** 0.861
      - **zero_content_loss_frac:** 0.789
      - **total_disagreements:** 181
      - **content_loss_units:** 102
      - **clutter_leak_units:** 79
    - **tuned:** - **zero_frac:** 0.619
      - **le1_frac:** 0.888
      - **total_disagreements:** 140
      - **content_loss_units:** 49
      - **clutter_leak_units:** 91
    - **cascade08:** - **zero:** 184
      - **zero_frac:** 0.825
      - **le1_frac:** 0.955
      - **zero_content_loss_frac:** 0.946
      - **total_disagreements:** 59
      - **content_loss_units:** 27
      - **clutter_leak_units:** 32
      - **frac_units_decided:** 0.665
    - **cascade09:** - **zero_frac:** 0.924
      - **le1_frac:** 0.982
      - **total_disagreements:** 24
      - **content_loss_units:** 11
      - **clutter_leak_units:** 13
      - **frac_units_decided:** 0.426
    - **cascade094:** - **zero_frac:** 0.991
      - **le1_frac:** 1
      - **total_disagreements:** 2
      - **content_loss_units:** 0
      - **clutter_leak_units:** 2
      - **frac_units_decided:** 0.195
    - **cascade098:** - **zero_frac:** 1
      - **total_disagreements:** 0
      - **frac_units_decided:** 0.003
  - **by_removal_step_recall:** - **unmatched_no_debug_record:** - **n:** 125
      - **recall:** 0.52
    - **removeBySelector:** - **n:** 122
      - **recall:** 0.918
    - **removeByContentPattern:** - **n:** 15
      - **recall:** 0.733
    - **scoreAndRemove:** - **n:** 10
      - **recall:** 0.8
    - **removeHiddenElements:** - **n:** 6
      - **recall:** 0.5
    - **removeEyebrowLabel:** - **n:** 1
      - **recall:** 1
  - **by_words_acc:** - **3-5:** - **n:** 354
      - **acc:** 0.76
      - **removed_recall:** 0.54
      - **kept_recall:** 0.863
    - **6-15:** - **n:** 307
      - **acc:** 0.827
      - **removed_recall:** 0.779
      - **kept_recall:** 0.849
    - **16-50:** - **n:** 420
      - **acc:** 0.945
      - **removed_recall:** 0.902
      - **kept_recall:** 0.951
    - **51-100:** - **n:** 240
      - **acc:** 0.979
      - **removed_recall:** 0.923
      - **kept_recall:** 0.982
    - **101-300:** - **n:** 134
      - **acc:** 0.888
      - **removed_recall:** 1
      - **kept_recall:** 0.882
  - **by_extractor_acc:** - **none:** - **n:** 1304
      - **acc:** 0.889
    - **xarticle:** - **n:** 45
      - **acc:** 0.978
    - **chatgpt:** - **n:** 37
      - **acc:** 0.946
    - **hackernews:** - **n:** 14
      - **acc:** 0.571
    - **mastodon:** - **n:** 13
      - **acc:** 0.538
    - **gmail:** - **n:** 13
      - **acc:** 0.308
    - **reddit:** - **n:** 9
      - **acc:** 0.667
    - **github:** - **n:** 8
      - **acc:** 0.5
    - **substack:** - **n:** 6
      - **acc:** 0.667
    - **twitter:** - **n:** 4
      - **acc:** 0.25
  - **kind_vs_noul:** - **kind_derived_keep_accuracy:** 0.885
    - **kind_derived_f1_removed:** 0.699
    - **agreement_with_noul05:** 0.949
    - **accuracy_when_agree:** 0.901
    - **n_disagree:** 74
    - **noul_right_when_disagree:** 0.405
    - **kind_right_when_disagree:** 0.595
  - **confident_band_disagreements_judged:** - **n:** 59
    - **band_n:** 967
    - **policy_title:** 21
    - **policy_page_type:** 17
    - **policy_index_listing:** 4
    - **label_artifact:** 8
    - **defuddle_bug_jev_right:** 1
    - **ambiguous:** 4
    - **genuine_jev_errors:** 4
    - **genuine_content_loss:** 3
    - **genuine_error_rate_in_band:** 0.004
    - **genuine_plus_ambiguous_rate_in_band:** 0.008
- **subsample_GT_B_n750:** - **V1_html:** - **acc05:** 0.835
    - **p_removed:** 0.816
    - **r_removed:** 0.717
    - **f1_removed:** 0.763
    - **f1_kept:** 0.873
    - **auroc:** 0.883
    - **ece:** 0.075
    - **band08_cov:** 0.644
    - **band08_acc:** 0.907
    - **band08_content_loss:** 13
    - **band08_clutter_leak:** 32
    - **tuned_test_f1_unit:** 0.781
    - **tuned_test_acc_unit:** 0.855
    - **tuned_test_f1_fixture:** 0.782
  - **V2_text:** - **acc05:** 0.815
    - **p_removed:** 0.761
    - **r_removed:** 0.731
    - **f1_removed:** 0.746
    - **f1_kept:** 0.854
    - **auroc:** 0.878
    - **ece:** 0.047
    - **band08_cov:** 0.387
    - **band08_acc:** 0.959
    - **band08_content_loss:** 8
    - **band08_clutter_leak:** 4
    - **band09_cov:** 0.132
    - **band09_acc:** 0.98
    - **tuned_test_f1_unit:** 0.74
    - **tuned_test_acc_unit:** 0.8
    - **tuned_test_f1_fixture:** 0.748
    - **page_cascade08_zero_frac:** 0.94
    - **page_cascade08_disagreements:** 12
  - **V3_json_context:** - **acc05:** 0.847
    - **p_removed:** 0.86
    - **r_removed:** 0.703
    - **f1_removed:** 0.773
    - **f1_kept:** 0.884
    - **auroc:** 0.856
    - **ece:** 0.081
    - **band08_cov:** 0.732
    - **band08_acc:** 0.876
    - **band08_content_loss:** 11
    - **band08_clutter_leak:** 57
    - **band094_acc:** 0.894
    - **tuned_test_f1_unit:** 0.76
    - **tuned_test_acc_unit:** 0.835
    - **tuned_test_f1_fixture:** 0.756
    - **page_cascade08_zero_frac:** 0.657
    - **page_cascade08_disagreements:** 68
  - **mean_V1V2V3:** - **acc05:** 0.836
    - **f1_removed:** 0.764
    - **auroc:** 0.889
    - **ece:** 0.049
    - **band08_cov:** 0.488
    - **band08_acc:** 0.94
    - **band08_content_loss:** 7
    - **band08_clutter_leak:** 15
    - **tuned_test_f1_unit:** 0.79
    - **tuned_test_acc_unit:** 0.863
  - **pairwise_agreement_at05:** - **V1_V2:** 0.921
    - **V1_V3:** 0.953
    - **V2_V3:** 0.899
  - **pairwise_mean_abs_dp:** - **V1_V2:** 0.11
    - **V1_V3:** 0.055
    - **V2_V3:** 0.141
  - **confident_contradictions:** - **V1_V2:** 0
    - **V1_V3:** 0
    - **V2_V3:** 1
- **subsample_GT_A_n767:** - **V1_html:** - **acc05:** 0.761
    - **f1_removed:** 0.704
    - **auroc:** 0.831
    - **ece:** 0.128
    - **band08_cov:** 0.644
    - **band08_acc:** 0.826
  - **V2_text:** - **acc05:** 0.765
    - **f1_removed:** 0.719
    - **auroc:** 0.853
    - **ece:** 0.07
    - **band08_cov:** 0.391
    - **band08_acc:** 0.917
  - **V3_json_context:** - **acc05:** 0.752
    - **f1_removed:** 0.685
    - **auroc:** 0.816
    - **ece:** 0.147
    - **band08_cov:** 0.73
    - **band08_acc:** 0.793
  - **mean_V1V2V3:** - **acc05:** 0.771
    - **f1_removed:** 0.714
    - **auroc:** 0.85
- **repeat_run_V1_vs_V1r:** - **n:** 767
  - **frac_identical_p:** 0.492
  - **mean_abs_dp:** 0.008
  - **p90_abs_dp:** 0.02
  - **max_abs_dp:** 0.1
  - **decision_flips_05:** 6
  - **frac_flips_05:** 0.008
  - **kind_flips:** 6
  - **band_membership_changes:** 22
  - **confident_contradictions:** 0
- **verify_requery:** - **n:** 12
  - **models:** - jev-1.14.0
  - **token_match:** 12
  - **mean_abs_dp:** 0.005
  - **max_abs_dp:** 0.04
  - **decision_flips:** 0
- **cost_latency:** - **V1:** - **calls:** 1475
    - **input_tokens:** 1447274
    - **tokens_per_call:** 981
    - **est_cost_usd:** 0.0608
    - **latency_ms:** - **p50:** 70
      - **p90:** 106
      - **p99:** 173
      - **max:** 240
    - **wall_s_for_1472_calls_conc8:** 14.2
  - **V1r:** - **calls:** 767
    - **input_tokens:** 769446
    - **est_cost_usd:** 0.0323
    - **latency_ms:** - **p50:** 69
      - **p90:** 101
      - **p99:** 172
      - **max:** 406
  - **V2:** - **calls:** 767
    - **input_tokens:** 659013
    - **tokens_per_call:** 859
    - **est_cost_usd:** 0.0277
    - **latency_ms:** - **p50:** 70
      - **p90:** 109
      - **p99:** 197
      - **max:** 300
  - **V3:** - **calls:** 767
    - **input_tokens:** 804280
    - **tokens_per_call:** 1049
    - **est_cost_usd:** 0.0338
    - **latency_ms:** - **p50:** 70
      - **p90:** 105
      - **p99:** 224
      - **max:** 376
  - **verify:** - **calls:** 12
    - **input_tokens:** 12604
    - **est_cost_usd:** 0.0005
  - **total:** - **calls:** 3788
    - **input_tokens:** 3692617
    - **est_cost_usd:** 0.1551
    - **cap_per_script_tokens:** 6000000
    - **largest_single_script_tokens:** 1444142
- **judgment_counts_top40_GT_A:** - **jev_right_defuddle_bug:** 1
  - **jev_right_label_artifact:** 20
  - **policy_title:** 8
  - **policy_page_type:** 7
  - **policy_index_listing:** 3
  - **defuddle_right:** 1
- **judgment_counts_top40_GT_B:** - **jev_right_defuddle_bug:** 1
  - **jev_right_label_artifact:** 5
  - **policy_title:** 18
  - **policy_page_type:** 11
  - **policy_index_listing:** 4
  - **defuddle_right:** 1

## Tables

## 1. Headline: V1 (block HTML), all units, both ground truths
Convention: predicted KEPT iff p_keep >= t; positive class = removed unless stated. Tuned = F1-optimal threshold on one 50% half, scored on the other (cross-fit).

| metric | GT-A orig (n=1475) t=0.5 | GT-A tuned unit split (t 0.475/0.325) | GT-B corrected (n=1455) t=0.5 | GT-B tuned unit split (t 0.315/0.245) | GT-B tuned fixture split (t 0.275/0.245) |
|---|---|---|---|---|---|
| accuracy | 0.837 [CI 0.790-0.869] | 0.840 | 0.876 [CI 0.822-0.914] | 0.904 | 0.907 |
| removed: precision | 0.706 | 0.736 | 0.662 | 0.793 | 0.816 |
| removed: recall | 0.594 | 0.556 | 0.717 | 0.674 | 0.667 |
| removed: F1 | 0.645 [0.573-0.712] | 0.634 | 0.688 [0.616-0.754] | 0.729 | 0.734 |
| kept: precision | 0.872 | 0.864 | 0.931 | 0.925 | 0.924 |
| kept: recall | 0.918 | 0.934 | 0.913 | 0.958 | 0.964 |
| kept: F1 | 0.894 | 0.898 | 0.922 | 0.942 | 0.944 |
| confusion tp/fp/fn/tn | 218/91/149/1017 | 204/73/163/1035 | 200/102/79/1074 | 188/49/91/1127 | 186/42/93/1134 |
| AUROC | 0.838 [0.792-0.877] | | 0.891 [0.849-0.923] | | |
| ECE P(keep), 10 bins | 0.067 | | 0.068 | | |

## 2. Confidence bands |2p-1| (GT-B, V1 all units; decision at 0.5)
content loss = Jev says remove but unit is kept; clutter leak = Jev says keep but unit is removed.

| band | n | coverage | accuracy | errors | says remove | content loss | precision(remove) | says keep | clutter leak | precision(keep) |
|---|---|---|---|---|---|---|---|---|---|---|
| 0.8-1.0 | 967 | 66.5% | 93.9% [0.899-0.965] | 59 | 175 | 27 | 0.846 | 792 | 32 | 0.960 |
| 0.6-0.8 | 223 | 15.3% | 84.3% | 35 | 40 | 10 | 0.750 | 183 | 25 | 0.863 |
| 0.4-0.6 | 112 | 7.7% | 84.8% | 17 | 25 | 11 | 0.560 | 87 | 6 | 0.931 |
| 0.0-0.4 | 153 | 10.5% | 54.2% | 70 | 62 | 54 | 0.129 | 91 | 16 | 0.824 |
| >=0.9 | 620 | 42.6% | 96.1% | 24 | 113 | 11 | 0.903 | 507 | 13 | 0.974 |
| >=0.94 | 283 | 19.5% | 99.3% | 2 | 29 | 0 | 1.000 | 254 | 2 | 0.992 |
| >=0.98 | 5 | 0.3% | 100% | 0 | 0 | 0 | n/a | 5 | 0 | 1.000 |

GT-A for comparison: 0.8-1.0 n=980 (66.4%) 89.8% (27 loss / 73 leak); 0.6-0.8 n=225 80.9%; 0.4-0.6 n=112 75.0%; 0-0.4 n=158 56.3%; >=0.9 n=631 (42.8%) 92.6%; >=0.94 n=284 (19.3%) 98.9%.

## 3. Reliability (GT-B, V1): P(keep) bins
| bin p_keep | n | mean p_keep | frac kept | gap |
|---|---|---|---|---|
| 0.0-0.1 | 165 | 0.051 | 0.145 | +0.095 |
| 0.1-0.2 | 50 | 0.134 | 0.260 | +0.126 |
| 0.2-0.3 | 19 | 0.244 | 0.421 | +0.177 |
| 0.3-0.4 | 28 | 0.329 | 0.679 | +0.349 |
| 0.4-0.5 | 40 | 0.453 | 0.950 | +0.497 |
| 0.5-0.6 | 42 | 0.555 | 0.810 | +0.254 |
| 0.6-0.7 | 45 | 0.647 | 0.822 | +0.175 |
| 0.7-0.8 | 91 | 0.748 | 0.934 | +0.186 |
| 0.8-0.9 | 183 | 0.854 | 0.863 | +0.009 |
| 0.9-1.0 | 792 | 0.951 | 0.960 | +0.009 |
(Jev under-states keep in the 0.2-0.8 range, which is why tuned thresholds land at p_keep ~0.25-0.32.)

## 4. Subsets (GT-B, V1 all units)
| subset | n | removed | acc@0.5 | P rem | R rem | F1 removed | F1 kept | acc tuned | F1 rem tuned | AUROC | ECE | cov >=0.8 | acc in band | band content-loss | band clutter-leak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| all | 1455 | 279 | 0.876 | 0.662 | 0.717 | 0.688 | 0.922 | 0.904 | 0.729 | 0.891 | 0.068 | 66.5% | 0.939 | 27 | 32 |
| excl. policy (title/byline/date) | 1342 | 200 | 0.914 | 0.669 | 0.840 | 0.745 | 0.948 | 0.940 | 0.797 | 0.946 | 0.094 | 67.7% | 0.968 | 18 | 11 |
| excl. extractor fixtures | 1304 | 237 | 0.889 | 0.702 | 0.675 | 0.688 | 0.932 | 0.916 | 0.730 | 0.890 | 0.051 | 67.4% | 0.953 | 9 | 32 |
| excl. both | 1206 | 168 | 0.929 | 0.716 | 0.810 | 0.760 | 0.958 | 0.952 | 0.815 | 0.948 | 0.082 | 69.0% | 0.981 | 5 | 11 |

GT-A subsets: all acc 0.837 / AUROC 0.838; excl policy 0.865 / 0.857; excl extractor 0.853 / 0.842; excl both 0.882 / 0.861 (band>=0.8 cov 68.9%, acc 0.938).

## 5. Variant comparison on the common subsample (all removed + 400 seeded kept; GT-B n=750: 279 removed / 471 kept)
| variant | acc@0.5 | P removed | R removed | F1 removed | F1 kept | AUROC | ECE | cov >=0.8 | acc in band | band content-loss | band clutter-leak | tuned test F1 (unit / fixture split) | tuned test acc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| V1 html | 0.835 | 0.816 | 0.717 | 0.763 | 0.873 | 0.883 | 0.075 | 64.4% | 0.907 | 13 | 32 | 0.781 / 0.782 | 0.855 |
| V2 text only | 0.815 | 0.761 | 0.731 | 0.746 | 0.854 | 0.878 | 0.047 | 38.7% | 0.959 | 8 | 4 | 0.740 / 0.748 | 0.800 |
| V3 json {title,url,html} | 0.847 | 0.860 | 0.703 | 0.773 | 0.884 | 0.856 | 0.081 | 73.2% | 0.876 | 11 | 57 | 0.760 / 0.756 | 0.835 |
| mean(V1,V2,V3) | 0.836 | 0.822 | 0.713 | 0.764 | 0.874 | 0.889 | 0.049 | 48.8% | 0.940 | 7 | 15 | 0.790 / 0.780 | 0.863 |
| mean(V1,V3) | 0.849 | 0.861 | 0.710 | 0.778 | 0.886 | 0.875 | 0.074 | 66.7% | 0.904 | 13 | 35 | 0.766 / 0.775 | 0.849 |

Same table under GT-A (n=767): V1 acc 0.761 / F1r 0.704 / AUROC 0.831 / ECE 0.128 / band 64.4% @ 0.826; V2 0.765 / 0.719 / 0.853 / 0.070 / 39.1% @ 0.917; V3 0.752 / 0.685 / 0.816 / 0.147 / 73.0% @ 0.793; mean 0.771 / 0.714 / 0.850 / 0.107 / 49.2% @ 0.889.
Pairwise agreement at 0.5 (n=750): V1-V2 0.921 (mean |dp| 0.110), V1-V3 0.953 (0.055), V2-V3 0.899 (0.141); both-confident contradictions 0 / 0 / 1.
V2 bands: 0.8-1.0 n=290 (38.7%) 95.9%; >=0.9 n=99 (13.2%) 98.0%; >=0.94 n=25 100%. V3 bands: 0.8-1.0 n=549 (73.2%) 87.6%; >=0.9 n=376 (50.1%) 90.4%; >=0.94 n=198 (26.4%) 89.4% (V3 is over-confident toward keep).

## 6. Page-level disagreements per fixture (GT-B, V1 all units, 223 fixtures)
| mode | 0 disagreements | frac 0 | <=1 | frac <=1 | 0 content-loss | frac | total disagreements | content-loss units | clutter-leak units | units decided by Jev |
|---|---|---|---|---|---|---|---|---|---|---|
| at 0.5 | 125 | 56.1% | 192 | 86.1% | 176 | 78.9% | 181 | 102 | 79 | 100% |
| tuned (cross-fit) | 138 | 61.9% | 198 | 88.8% | 200 | 89.7% | 140 | 49 | 91 | 100% |
| cascade |2p-1|>=0.8 else defer | 184 | 82.5% | 213 | 95.5% | 211 | 94.6% | 59 | 27 | 32 | 66.5% |
| cascade >=0.9 | 206 | 92.4% | 219 | 98.2% | 218 | 97.8% | 24 | 11 | 13 | 42.6% |
| cascade >=0.94 | 221 | 99.1% | 223 | 100% | 223 | 100% | 2 | 0 | 2 | 19.5% |
| cascade >=0.98 | 223 | 100% | 223 | 100% | 223 | 100% | 0 | 0 | 0 | 0.3% |

GT-A (224 fixtures): at 0.5 53.1% zero / 81.3% <=1 / 240 disagreements; tuned 55.4% / 81.7% / 236; cascade 0.8 77.2% / 92.9% / 100 (27 loss, 73 leak); cascade 0.9 88.8% / 96.9% / 47; cascade 0.94 98.7% / 100% / 3.
V2 cascade 0.8 (166 fixtures): 94.0% zero, 98.8% <=1, 12 disagreements (8 loss / 4 leak), 38.7% decided. V3 cascade 0.8: 65.7% zero, 68 disagreements (11 / 57), 73.2% decided.
Worst fixtures GT-B at 0.5: general--wikipedia 20/37, gmail thread 9/13, tailwind-hidden-blog-index 7/13, mastodon 6/13, maggieappleton 6/99, rehype-pretty-copy 5/8, HN comments 4/10, github PR 4/8. Under cascade 0.8: gmail 5/13, HN comments 4/10, github PR 4/8, tailwind index 4/13, reddit comments 3/9, hexo-br 2/8, pygments-lineno 2/4, wikipedia-references 2/5.
Inverse question (heuristic wrong -> is Jev confidently right?): not measurable here, since labels are the heuristic's own output; the single independently confirmed heuristic error (wikipedia-references#2) had Jev at p_keep 0.98.

## 7. Breakdown by removal_step (GT-B, label=removed only; acc = recall)
| step | n | recall@0.5 | recall tuned | errors | mean p_keep | n in band >=0.8 | errors in band |
|---|---|---|---|---|---|---|---|
| unmatched (no debug removal record; mostly title h1s, dropped-by-container, hidden) | 125 | 0.520 | 0.464 | 60 | 0.463 | 62 | 24 |
| removeBySelector | 122 | 0.918 | 0.910 | 10 | 0.133 | 104 | 7 |
| removeByContentPattern | 15 | 0.733 | 0.533 | 4 | 0.335 | 6 | 1 |
| scoreAndRemove | 10 | 0.800 | 0.700 | 2 | 0.207 | 6 | 0 |
| removeHiddenElements | 6 | 0.500 | 0.500 | 3 | 0.363 | 2 | 0 |
| removeEyebrowLabel | 1 | 1.000 | 1.000 | 0 | 0.170 | 0 | 0 |

## 8. Breakdown by tag (GT-B, V1; tags with n>=14)
| tag | n | removed | acc@0.5 | acc tuned | errors | mean p_keep | in band | band errors |
|---|---|---|---|---|---|---|---|---|
| p | 636 | 21 | 0.965 | 0.975 | 22 | 0.880 | 475 | 3 |
| div | 257 | 127 | 0.802 | 0.837 | 51 | 0.409 | 160 | 20 |
| span | 77 | 9 | 0.649 | 0.818 | 27 | 0.651 | 23 | 7 |
| h1 | 60 | 44 | 0.300 | 0.283 | 42 | 0.859 | 31 | 20 |
| article | 50 | 1 | 0.940 | 0.960 | 3 | 0.876 | 38 | 1 |
| h3 | 42 | 4 | 0.905 | 0.905 | 4 | 0.855 | 29 | 1 |
| h2 | 38 | 2 | 0.947 | 0.974 | 2 | 0.897 | 33 | 0 |
| li | 37 | 1 | 0.973 | 0.973 | 1 | 0.921 | 30 | 1 |
| ul | 36 | 3 | 0.917 | 0.889 | 3 | 0.767 | 15 | 0 |
| section | 33 | 9 | 0.939 | 1.000 | 2 | 0.651 | 23 | 0 |
| main | 26 | 0 | 0.808 | 1.000 | 5 | 0.778 | 14 | 0 |
| blockquote | 24 | 0 | 0.958 | 0.958 | 1 | 0.860 | 17 | 0 |
| pre | 20 | 0 | 1.000 | 1.000 | 0 | 0.855 | 3 | 0 |
| footer | 19 | 19 | 1.000 | 1.000 | 0 | 0.051 | 18 | 0 |
| a | 18 | 4 | 0.556 | 0.833 | 8 | 0.435 | 4 | 1 |
| table | 14 | 5 | 0.714 | 0.786 | 4 | 0.615 | 7 | 2 |
| header 11/11 removed 1.000; nav 8/8 removed 1.000; td 9 0.667; figure 7 0.714; ol 10 1.000; h4 6 1.000 | | | | | | | | |

## 9. Breakdown by words bucket x label (GT-B, V1)
| bucket | n | acc | removed n | removed recall | kept n | kept recall | in band | band errors |
|---|---|---|---|---|---|---|---|---|
| 3-5 | 354 | 0.760 | 113 | 0.540 | 241 | 0.863 | 191 | 31 |
| 6-15 | 307 | 0.827 | 95 | 0.779 | 212 | 0.849 | 175 | 16 |
| 16-50 | 420 | 0.945 | 51 | 0.902 | 369 | 0.951 | 312 | 12 |
| 51-100 | 240 | 0.979 | 13 | 0.923 | 227 | 0.982 | 202 | 0 |
| 101-300 | 134 | 0.888 | 7 | 1.000 | 127 | 0.882 | 87 | 0 |

By extractor (GT-B acc@0.5): none 1304 0.889; xarticle 45 0.978; chatgpt 37 0.946; hackernews 14 0.571; mastodon 13 0.538; gmail 13 0.308; reddit 9 0.667; github 8 0.500; substack 6 0.667; twitter 4 0.250; leetcode 2 1.000.

## 10. kind (Choice, 12 options incl. 'other') vs label (GT-B, V1 all units)
| kind | n | label kept | label removed | frac removed | mean p_keep | mean kind confidence |
|---|---|---|---|---|---|---|
| article_body | 825 | 813 | 12 | 0.015 | 0.890 | 0.906 |
| heading | 168 | 113 | 55 | 0.327 | 0.861 | 0.952 |
| code_or_table | 83 | 72 | 11 | 0.133 | 0.859 | 0.839 |
| footnotes_or_references | 83 | 79 | 4 | 0.048 | 0.811 | 0.940 |
| media_or_figure | 20 | 17 | 3 | 0.150 | 0.810 | 0.816 |
| navigation_or_menu | 49 | 2 | 47 | 0.959 | 0.082 | 0.915 |
| promo_or_cta | 17 | 2 | 15 | 0.882 | 0.096 | 0.842 |
| byline_or_metadata | 59 | 13 | 46 | 0.780 | 0.104 | 0.811 |
| related_links_or_cards | 50 | 18 | 32 | 0.640 | 0.206 | 0.783 |
| comments | 44 | 24 | 20 | 0.455 | 0.097 | 0.868 |
| cookie_or_consent | 1 | 0 | 1 | 1.000 | 0.030 | 1.000 |
| other (escape) | 56 | 23 | 33 | 0.589 | 0.304 | 0.665 |
Kind-derived keep rule (content kinds => keep): accuracy 0.885, F1 removed 0.699; agreement with the Noul at 0.5: 94.9%; accuracy when both agree 0.901 (n=1381); when they disagree (n=74) Noul right 40.5%, kind right 59.5%.

## 11. Top 40 V1 disagreements under the ORIGINAL labels (as specified), most confident first, with one-line judgment
| # | fixture | path (abbrev.) | label (GT-A -> GT-B) | p_keep | kind | snippet | removal_reason | judgment |
|---|---|---|---|---|---|---|---|---|
| 1 | footnotes--wikipedia-references | main#content > div#mw-content-text > div.mw-parser-output > p | removed -> removed | 0.98 | article_body | In particular, the framework has proven useful for modeling complex systems where traditional approaches are insufficient.[4] | thin CTA section | JEV RIGHT (defuddle bug): real body paragraph removed by removeThinPrecedingSection; the expected .md encodes the loss |
| 2 | footnotes--sidenote-inline-with-list | main > div.post-content > div.footnotes > div.footnote-definitions > div.footnote-definition | removed -> kept | 0.97 | footnotes_or_references | 2 That's to say, contagious from inwards | - | JEV RIGHT (label artifact): kept as [^2] in expected .md |
| 3 | math--latex-image-services | article | removed -> removed | 0.97 | article_body | LaTeX Image Rendering Services Inline fraction: . Sum notation: . Greek letters: . Path-based service: . | - | JEV RIGHT (label artifact): whole article kept; math images became $..$ |
| 4 | codeblocks--mintlify | div.relative > header > div (h1) | removed -> removed | 0.96 | heading | Cover vs Contain Modes | exact selector match | POLICY (title): page title moved to frontmatter; Jev not told |
| 5 | comments--news.ycombinator.com-item-id=12345678 | td > table > tr > td > div.default > div.comment | kept | 0.04 | comments | This is a really interesting article. The key insight about distributed systems is worth exploring further. | - | POLICY (page-type): HN item page where comments are the content; Jev obeyed 'do not keep comment sections' |
| 6 | comments--news.ycombinator.com-item-id=12345678 | ... > div.comment | kept | 0.04 | comments | I agree. The author makes a compelling case for eventual consistency over strong consistency in this context. | - | POLICY (page-type) |
| 7 | comments--news.ycombinator.com-item-id=12345678 | ... > div.comment | kept | 0.04 | comments | Exactly. And the benchmarks in section 3 back this up nicely. | - | POLICY (page-type) |
| 8 | comments--news.ycombinator.com-item-id=12345678 | ... > div.comment | kept | 0.04 | comments | We tried a similar approach at our company. The tradeoffs are real but manageable if you plan for them. | - | POLICY (page-type) |
| 9 | comments--old.reddit.com-r-test-comments-abc123-test_post | div.commentarea > ... > div.thing.comment > div.entry > div.usertext-body | kept | 0.04 | comments | This is a top-level comment with some thoughts on the topic. | - | POLICY (page-type): Reddit comments page |
| 10 | comments--old.reddit.com-r-test-comments-abc123-test_post | ... > div.usertext-body | kept | 0.04 | comments | Another top-level comment with a link. | - | POLICY (page-type) |
| 11 | general--cp4space-jordan-algebra | div#post-6213 > h1.entry-title | removed -> removed | 0.96 | heading | The exceptional Jordan algebra | partial match: entry-title | POLICY (title) |
| 12 | general--cp4space-jordan-algebra | div.entry-content > ul > li | removed -> removed | 0.96 | article_body | the algebras with the product , known as 'spin factors'. | - | JEV RIGHT (label artifact): LaTeX <img>s become inline math; words kept |
| 13 | general--lesswrong.com-...Simulators | div#postContent > ... > h2#The_limit_of_learned_simulation | removed -> kept | 0.96 | heading | The limit of learned simulation | - | JEV RIGHT (label artifact): section heading kept |
| 14 | general--lesswrong.com-...Simulators | ol.footnotes > li.footnote-item | removed -> kept | 0.96 | footnotes_or_references | ^Prediction and Entropy of Printed English | - | JEV RIGHT (label artifact): footnote kept |
| 15 | general--lesswrong.com-...Simulators | ol.footnotes > li.footnote-item | removed -> kept | 0.96 | footnotes_or_references | ^Multi-Game Decision Transformers | - | JEV RIGHT (label artifact) |
| 16 | general--lesswrong.com-...Simulators | div#postContent > ... > h1#The_old_framework_of_alignment | removed -> kept | 0.96 | heading | The old framework of alignment | - | JEV RIGHT (label artifact): in-article h1 section heading kept |
| 17 | general--lesswrong.com-...Simulators | ... > h1#The_limit_of_sequence_modeling | removed -> kept | 0.96 | heading | The limit of sequence modeling | - | JEV RIGHT (label artifact) |
| 18 | general--news.ycombinator.com-item-id=12345678 | tr#bigbox > td > table.fatitem > tr.athing > td.default > div.comment | kept | 0.04 | comments | This is the main comment text that should be extracted by the Hacker News extractor.It has multiple paragraphs... | - | POLICY (page-type): HN extractor page whose content is the comment |
| 19 | general--svg-content-preservation | main > article > h1 | removed -> removed | 0.96 | heading | Understanding Neural Networks | - | POLICY (title) |
| 20 | general--svg-external-css-fallback | main > article > h1 | removed -> removed | 0.96 | heading | Oil Prices Rise After New Trade Agreement | - | POLICY (title) |
| 21 | general--x.com-article-2026-02-13 | div.DraftEditor-root > ... > div (h2.longform-header-two) | removed -> kept | 0.96 | heading | how to write good notes | - | JEV RIGHT (label artifact): h2 kept |
| 22 | math--katex-centraliser | div.maths | removed -> mixed | 0.96 | code_or_table | Stab(g)=CG(g)\begin{aligned} \text{Stab}(g)=C_G(g) \end{aligned}... | exact selector match | JEV RIGHT (label artifact): KaTeX block kept as $$..$$; MathML+annotation duplication dilutes coverage |
| 23 | math--katex-centraliser | div.maths | removed -> mixed | 0.96 | code_or_table | |Orb(g)|=|G|/ab \begin{aligned} ... | - | JEV RIGHT (label artifact) |
| 24 | selectors--logo-substring-wrapper | main.page-main > article.article-body > h1 | removed -> removed | 0.96 | heading | City Approves Transit Expansion | - | POLICY (title) |
| 25 | codeblocks--chatgpt-codemirror | main > h1 | removed -> removed | 0.95 | heading | Fibonacci in Python | - | POLICY (title) |
| 26 | footnotes--br-separated-named-anchors | article > h1 | removed -> removed | 0.95 | heading | Thoughts on Open Models | - | POLICY (title) |
| 27 | footnotes--hr-strong-numbered | article > p | removed -> kept | 0.95 | footnotes_or_references | 1 First footnote explanation. | - | JEV RIGHT (label artifact): kept as [^1] |
| 28 | footnotes--labeled-section-ol | div.page-wrapper > div...footnotes > ol > li#footnote-2 | removed -> kept | 0.95 | footnotes_or_references | See this report for supporting analysis. | - | JEV RIGHT (label artifact) |
| 29 | general--lesswrong.com-...Simulators | ol.footnotes > li | removed -> kept | 0.95 | footnotes_or_references | ^from Philosophers On GPT-3 | - | JEV RIGHT (label artifact) |
| 30 | general--lesswrong.com-...Simulators | ol.footnotes > li | removed -> kept | 0.95 | footnotes_or_references | ^they are not wrapper minds | - | JEV RIGHT (label artifact) |
| 31 | general--lesswrong.com-...Simulators | ol.footnotes > li | removed -> kept | 0.95 | footnotes_or_references | ^to abuse the term | - | JEV RIGHT (label artifact) |
| 32 | general--lesswrong.com-...Simulators | ol.footnotes > li | removed -> kept | 0.95 | footnotes_or_references | ^Jean Baudrillard, Simulacra and Simulation | - | JEV RIGHT (label artifact) |
| 33 | general--tailwind-hidden-blog-index | main > section > div > article > div | kept | 0.05 | byline_or_metadata | Design 6 min read January 28, 2026 | - | POLICY (index listing): index page kept whole by retry cascade; card tag/read-time/date is metadata by Jev's instruction; product choice |
| 34 | general--tailwind-hidden-blog-index | main > section > div > article > div | kept | 0.05 | byline_or_metadata | Infrastructure 5 min read March 1, 2026 | - | POLICY (index listing) |
| 35 | general--tailwind-hidden-blog-index | main > section > div > article > div | kept | 0.05 | byline_or_metadata | Machine Learning 8 min read February 15, 2026 | - | POLICY (index listing) |
| 36 | general--www.figma.com-blog-introducing-codex-to-figma | ... > h2#starting-an-app-from-a-design | removed -> kept | 0.95 | heading | Starting an app from a design | - | JEV RIGHT (label artifact): h2 with self-anchor kept |
| 37 | general--x.com-article-2026-02-13 | div.DraftEditor-root > ... > div.longform-unstyled | removed -> kept | 0.95 | article_body | think of notes like lego blocks | - | JEV RIGHT (label artifact) |
| 38 | issues--196-og-title-brand-name | main > h1 | removed -> removed | 0.95 | heading | The Darwin Gödel Machine: AI that improves itself by rewriting its own code | - | POLICY (title) |
| 39 | issues--218-footnote-wrapper-text-lost | article > section.footnotes | removed -> kept | 0.95 | footnotes_or_references | First footnote content. Second footnote content. | - | JEV RIGHT (label artifact): footnotes kept |
| 40 | issues--366-screen-reader-links | article > p > a (svg + span.sr-only) | kept | 0.05 | byline_or_metadata | Share this article | - | DEFUDDLE RIGHT (unit lacks context): inline example link inside a prose sentence; isolated <a> looks like a share widget |
Top-40 GT-A tally: Jev right 21 (1 defuddle bug + 20 label artifacts), title policy 8, page-type policy 7, index-listing policy 3, defuddle right 1.

## 12. Top 40 under CORRECTED labels: additional items not in table 11 (rest are the same units)
| rank | fixture | tag/path | label | p_keep | kind | snippet | judgment |
|---|---|---|---|---|---|---|---|
| 23 | math--raw-latex | article > p | removed | 0.95 | article_body | \[F = ma\] | JEV RIGHT (label artifact): kept as $$F = ma$$ |
| 24 | table-layout--peripheral-tables | h1 | removed | 0.95 | heading | Understanding cellular biology | POLICY (title) |
| 25 | codeblocks--pygments-lineno | article > div.highlight | removed | 0.94 | code_or_table | 10class Model(nn.Module): 11 def __init__(self): 12 super().__init__() | JEV RIGHT (label artifact): line-number gutter stripped by defuddle; code kept |
| 26 | comments--old.reddit.com-... | nested div.thing.comment | kept | 0.06 | comments | Great point! I agree with this. | POLICY (page-type) |
| 27, 28, 33-38, 40 | footnotes--pulldown-cmark, general--back-nav-link, issues--159 x2, related--inline-related-stories-block, general--inline-comments-and-link-lists, metadata--h1-sibling-byline, selectors--arm-newsroom, footnotes--span-fnref-colon | h1 | removed | 0.92-0.94 | heading | (page titles) | POLICY (title) |
| 29-31 | general--github.com-test-owner-test-repo-pull-42 | PR timeline comment divs/table | kept | 0.06 | comments | Consider removing just the image element... / The early return here might skip... / Posted a follow-up commit... | POLICY (page-type): GitHub extractor keeps PR discussion |
| 32 | general--tailwind-hidden-blog-index | article > div | kept | 0.06 | byline_or_metadata | API Design 7 min read January 10, 2026 | POLICY (index listing) |
| 39 | codeblocks--pygments-lineno | article > div.highlight | removed | 0.92 | code_or_table | 1import torch 2from torch import nn | JEV RIGHT (label artifact) |
Top-40 GT-B tally: title policy 18, page-type policy 11, index listing 4, Jev right 6 (1 bug + 5 artifacts), defuddle right 1.

## 13. All 59 confident-band (|2p-1|>=0.8) disagreements under corrected labels, by hand judgment
| category | n | examples |
|---|---|---|
| policy (title): h1 equals page title, moved to frontmatter | 21 | 20 h1s + mintlify header div |
| policy (page-type): comment/mail/PR pages where the literal instruction is wrong | 17 | HN x5, Reddit x3, GitHub PR x3, Gmail timestamps x5, X reply header |
| policy (index listing): card metadata on an index page kept whole | 4 | tailwind-hidden-blog-index |
| label artifact (code with line-number gutters, math -> LaTeX) | 8 | pygments-lineno x2, hexo-br x2, chroma-inline-linenums, raw-latex, latex-image-services, cp4space li |
| defuddle bug, Jev right | 1 | wikipedia-references body paragraph (thin CTA section) |
| ambiguous (3 leaning Jev) | 4 | KaTeX render-time line, blogger post-footer byline, 'Dr. A. Researcher, March 2015', Wikipedia infobox |
| genuine Jev error | 4 | 'Share this article' inline link (p=0.05, loss); 'Google docs comments' list item (p=0.09, loss); GitHub PR description judged 'comments' (p=0.10, loss); '^ a b' cite backlink kept (p=0.90, leak) |
Genuine error rate in band: 4/967 = 0.4%; with ambiguous 8/967 = 0.8%.

## 14. Repeat run and cost
| run | calls | input tokens | tokens/call | est cost | p50 ms | p90 ms | p99 ms | max ms |
|---|---|---|---|---|---|---|---|---|
| V1 html (all) | 1475 | 1,447,274 | 981 | $0.0608 | 70 | 106 | 173 | 240 |
| V1 repeat (subsample) | 767 | 769,446 | 1003 | $0.0323 | 69 | 101 | 172 | 406 |
| V2 text (subsample) | 767 | 659,013 | 859 | $0.0277 | 70 | 109 | 197 | 300 |
| V3 json (subsample) | 767 | 804,280 | 1049 | $0.0338 | 70 | 105 | 224 | 376 |
| verify re-query | 12 | 12,604 | 1050 | $0.0005 | 64 | 183 | 205 | 205 |
| total | 3788 | 3,692,617 | | $0.155 | | | | |
Repeat (767 units, V1 vs V1r): identical p 49.2%, mean |dp| 0.008, p90 0.02, max 0.10, decision flips at 0.5: 6 (0.8%), kind flips 6 (0.8%), band-membership changes 22 (2.9%), confident contradictions 0.

## Caveats

- Ground truth is defuddle's own test-verified output, so the heuristic is 100% 'correct' by construction; this measures agreement, not which system is better. The one place the two can be compared independently (fixture errors) yielded a single instance.
- Original labels (GT-A) contain a systematic builder bug (glued textContent); GT-B fixes 72 units but still has residual artifacts (code blocks with line-number gutters, KaTeX/LaTeX math) which I identified by hand only in the confident band (8 units); 20 'mixed' units were excluded from GT-B.
- Fixtures are mostly small synthetic regression cases (median 1.7 KB, 6.5 units per fixture); a handful of real pages (lesswrong 213 units, maggieappleton 99, x.com 43, wikipedia 37) dominate some breakdowns. Results are not a web-scale estimate; fixture-clustered bootstrap CIs are wide (band accuracy 0.899-0.965).
- Units were segmented by the dataset builder (largest homogeneous block <=300 words), not by where defuddle actually makes removal decisions; an integration would ask different questions about different nodes.
- The V2/V3 subsample is class-enriched (37% removed vs 19% in the population), so its accuracies are not comparable to all-unit accuracy; AUROC and in-band precision are comparable.
- Threshold tuning used one seed per split; the fixture split under GT-A produced unstable thresholds (0.255 vs 0.555), so tuned numbers should be read as indicative. Reported tuned metrics are cross-fit (each half scored with the other half's threshold).
- Hand judgments (77 units) are one reviewer's reading of the fixtures; the remaining 110 (GT-A) / 70 (GT-B) low-confidence disagreements were auto-categorized (title/extractor/byline) or left unjudged.
- Jev was given a single literal instruction; it was never told defuddle's policies (title to frontmatter, comment pages are content, index pages kept whole, hidden elements removed via CSS), so a large share of disagreements are instruction design, not model capability. A page-type-aware prompt was not tested; adding page_title/url to the state (V3) hurt rather than helped.
- No adversarial/prompt-injection test was run in this slice; the state is page-derived HTML, which the brief says must be treated as untrusted.
- Raw API results come from an earlier run in this same experiment folder (record timestamps 2026-10-27T22:33-22:37Z) and were reused after a 12-unit re-query confirmed consistency; latency figures are from this host at concurrency 8 and include no gateway hop.
- Cost uses the published $0.042 per million input tokens; output tokens (about 144 per call) were counted but are free.

## Artifacts

- experiments/jev/research/results/exp-block-classification/raw-v1.jsonl
- experiments/jev/research/results/exp-block-classification/raw-v1r.jsonl
- experiments/jev/research/results/exp-block-classification/raw-v2.jsonl
- experiments/jev/research/results/exp-block-classification/raw-v3.jsonl
- experiments/jev/research/results/exp-block-classification/subsample-ids.json
- experiments/jev/research/results/exp-block-classification/common.mjs
- experiments/jev/research/results/exp-block-classification/run-variant.mjs
- experiments/jev/research/results/exp-block-classification/verify-api.mjs
- experiments/jev/research/results/exp-block-classification/verify-api-1793144780041.json
- experiments/jev/research/results/exp-block-classification/relabel.mjs
- experiments/jev/research/results/exp-block-classification/labels-corrected.jsonl
- experiments/jev/research/results/exp-block-classification/relabel-summary.json
- experiments/jev/research/results/exp-block-classification/analyze2.mjs
- experiments/jev/research/results/exp-block-classification/analysis2.json
- experiments/jev/research/results/exp-block-classification/analysis2-stdout.txt
- experiments/jev/research/results/exp-block-classification/judgments.json
- experiments/jev/research/results/exp-block-classification/top40-orig.json
- experiments/jev/research/results/exp-block-classification/top40-corr.json
- experiments/jev/research/results/exp-block-classification/disagreements-orig.json
- experiments/jev/research/results/exp-block-classification/disagreements-corr.json
- experiments/jev/research/results/exp-block-classification/usage-v1-1793140426500.json
- experiments/jev/research/results/exp-block-classification/usage-v1r-1793140660677.json
- experiments/jev/research/results/exp-block-classification/usage-v2-1793140443038.json
- experiments/jev/research/results/exp-block-classification/usage-v3-1793140450878.json
- experiments/jev/research/results/exp-block-classification/analyze.mjs
- experiments/jev/research/results/exp-block-classification/analysis-stdout.txt
