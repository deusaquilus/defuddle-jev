# Defuddle meaning-B (clutter removal / main-content extraction): decision-point inventory, uncertainty gates, failure-class history, and where a Jev Noul/Choice could plug in

_Verbatim final report of the phase-1 workflow agent `extraction-map` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

I read the full extraction pipeline (src/defuddle.ts _parseWithRetries L88-215, parseInternal L811-1130, findMainContent L1242-1319, findTableBasedContent L1321-1358, findContentByScoring L1360-1370; src/removals/{scoring,selectors,content-patterns,hidden,metadata-block,small-images}.ts; src/content-boundary.ts; src/constants.ts) and produced an inventory of 51 decision points. Only 4 of them are fuzzy text-readable judgments in the pure sense (the 35-word navigationIndicators scorer, the 11 BOILERPLATE_PATTERNS, the newsletter/related/CTA heading regexes, the screen-reader-annotation regex); 13 are deterministic attribute/tag rules (EXACT_SELECTORS 162 entries, PARTIAL_SELECTORS 547 regex fragments over class/id/data-test* attributes, hidden-style/Tailwind tokens, pre/code/footnote/data-defuddle protections); the remaining ~34 are numeric thresholds (I counted ~28 numeric comparisons in scoring.ts, ~85 in content-patterns.ts, 6 in the retry cascade) wrapped around structural/positional facts (is this above the first prose paragraph, does prose follow, is it the last child, is the h1 adjacent, is the child inside the top candidate, is the cell bigger than half the body). The signature of this codebase is that almost every "fuzzy" rule is a text regex AND a position check AND a word-count band, so the evidence is only half "literally present" in a block.

Measured on the 226 fixtures (instrumented dist build, offline; I verified the earlier attempt's measure-gates.mjs and independently reproduced its per-step removal totals 1778/52/50/48/10): removeBySelector does 91.8% of all removals (1,218 exact + 560 partial; 75 distinct partial patterns fired, 'footer' 90x, 'menu-' 48x, 'avatar' 36x); scoreAndRemove removes 52 blocks of 502 scored (408 score exactly 0, 41 nonzero within +/-5, 62 within +/-10); isLikelyContent protects 658 of 1,160 blocks it sees; content patterns remove 50 across 34 rule families (none fires more than 5 times); findMainContent picks the top-scored candidate in 205/211 fixtures, has top-2 margin <80 in 14 (6.6%), and lands on <body> in 25 (11.8%); the <200-word retry fires on 163/226 first passes and the <50 gate on 54, but retries change the final result in only 11 fixtures (fixtures are tiny, median 1.7 KB, so these rates overstate the web). The explicit uncertainty gates number 5 (word-count <200, <50 hidden, hidden-selector, <50 index-page, schema 1.5x) plus 6 implicit ones (candidate margin, child-preference tie, body fallback, score near 0, isLikelyContent borderline, findContentStart returning null which silently disables all pre-content rules).

Failure-class history: of 781 commits, the earlier keyword pass gives infra/docs/deps 293, formatting 186, clutter-removal rules 161, site extractors 80, metadata 25, security 20, main-content selection 14; my sub-classification of 277 extraction-related subjects finds 115 are plain selector-list additions (attribute-token rules, 71% of clutter commits), 52 content-pattern rules (text+structure), 33 container/retry/fallback, 28 explicit "keep content / overly aggressive" repairs (#107/#77 'appendix'/'enhancement', #112 nav words in prose, 0699bb0 breadcrumb lists, 29872c0 trailing-section conclusion, #284 header cells, #286 duplicate images, #358 whole-body fallback), 9 scoring. Of 244 GitHub issues (61 open) classified by title: infra 50, formatting 46, site-extractor 42, main-container/page-structure 30, clutter-FP attribute-rule 21, clutter-FP structural-rule 15, clutter-FP text-heuristic 12, images 8, clutter-FN structural 7, metadata 6, clutter-FN kept-clutter 6. Among the 99 extraction-proper issues, 39 (39%) are text-readable (the block's own content shows it is prose; 21 of these were killed by an attribute token) and 60 (61%) are structural; among open extraction issues it is 11 text-readable vs 20 structural. Formatting (math/code/footnotes/markdown) is 19% of issues, 37% of fixture families and co-changes with 50% of the 196 expected-output commits, and no keep/remove classifier touches it. A live 18-block probe (jev-1.14.0, 5 Nouls per block, $0.00044, p50 65 ms) got 16/18 with a code-owned policy: all 3 attribute-rule FPs (#444, #441, #371) and 9/10 text cases were judged correctly from the block alone; the #445 "Comment" truncation case was wrong alone (P(body)=0.44) and right only when code supplied the next sibling (0.52 vs 0.16 for a real comments section), confirming the text/structural split. The sibling block experiment on 1,475 fixture blocks measured 83.7% accuracy, AUROC 0.838, 66.9% on 3-5-word blocks, and only 40% agreement on container-level removals.

Implication for the Jev question: a per-block "keep?" Noul can plausibly address the text-readable 39% of extraction failures if plugged in as a confidence-gated veto at three specific sites (partial-selector removals of prose-bearing elements, scorer blocks in the [-20,+10] band, and the boilerplate/related-heading trailing-cascade truncations), with code supplying position facts in the state. It cannot address the structural 61% (wrong container, hidden/aria-hidden content, listing pages, retries, images) except via a "which container?" Choice over code-built candidates, and it cannot touch formatting. "99.99%" has no meaning for extraction except page-level identical-to-expected; at 50-200 block decisions per real page, that would require ~1e-6 per-block error, five orders of magnitude beyond the measured 0.84 block accuracy or the 0.95 high-confidence band, and Jev's 12% repeat-flip rate is incompatible with byte-equal fixture tests without caching. Verdict: narrow, gated, opt-in, shadow-mode first; not aggressive, and not a path to four nines.

## Verdict for this dimension

For clutter removal / main-content extraction (meaning B), Jev is a plausible, cheap (~$0.001 per 200-block page, ~65 ms per call) confidence-gated veto for the text-readable minority of failures: roughly 39% of extraction-proper issues (21 attribute-token false positives like #444/#441/#371 plus 12 text-heuristic false positives like #112/#428/#284 and 6 kept-clutter misses), plugged in at three specific sites (partial-selector removals of prose-bearing elements, scorer blocks in the [-20,+10] band, and the boilerplate/related-heading trailing cascades) with code supplying position facts in the state. It is not a replacement for the pipeline: 61% of extraction issues (and 20 of 31 open ones) are structural (wrong container, aria-hidden content, listing pages, lazy images, cascade truncations) where the evidence is not in the block, formatting is the largest class of work and no keep/remove classifier touches it, 91.8% of actual removals are deterministic selector hits that already work, and measured block accuracy is 0.84 (0.67 on 3-5-word blocks) with ~12% repeat non-determinism. '99.99%' is not a meaningful target for extraction: the only ground truth is byte-equal Markdown on 226 fixtures, and page-level four nines over 50-200 block decisions would need ~1e-6 per-block error, five orders of magnitude beyond anything measured. Recommendation for this dimension: narrow, gated, opt-in (Node/CLI/Worker only), shadow-mode first with a labeled block corpus derived from tests/expected; do not use aggressively; the deterministic protections (sanitization, pre/code/footnote/extractor output/tables, retry arithmetic, image logic) must remain code-owned and the model must never emit a selector.

## Findings

- - **claim:** The pipeline has 51 distinct keep/remove decision points; only 4 are pure text-readable judgments, 13 are deterministic attribute/tag rules, and ~34 are numeric thresholds over structural/positional facts.
  - **evidence:** Inventory built from reading the files (see tables). Numeric comparison counts (rough regex count): scoring.ts 28, content-patterns.ts 85, content-boundary.ts 3, _parseWithRetries 6. Word lists: navigationIndicators 35 (scoring.ts L24-60), contentIndicators 14 (L6-21), nonContentPatterns 25 (L93-119), BOILERPLATE_PATTERNS 11 (content-patterns.ts L13-25), 34 content-pattern rule families (distinct debug reasons, L144-1308). EXACT_SELECTORS 162 entries (constants.ts L95-335), PARTIAL_SELECTORS 547 (L353-964), ENTRY_POINT_ELEMENTS 20 (L3-23), TEST_ATTRIBUTES 8 (L340-349).
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/removals/scoring.ts:24-60
    - /home/alexi/git/defuddle/src/removals/content-patterns.ts:13-25
    - /home/alexi/git/defuddle/src/constants.ts:95-964
- - **claim:** Selector removal, not scoring or content patterns, does the overwhelming majority of clutter removal: 1,778 of 1,938 fixture removals (91.8%) are removeBySelector (1,218 exact + 560 partial); scoreAndRemove 52, removeByContentPattern 50, removeHiddenElements 48, removeEyebrowLabel 10.
  - **evidence:** Measured by experiments/jev/research/results/extraction-decision-inventory/tally-removal-reasons.mjs over all 226 fixtures with debug:true (offline, dist build). 75 distinct PARTIAL_SELECTORS patterns fired; top: footer 90, menu- 48, avatar 36, nav- 35, footnote-back 31, pagehead 28. Matches gates-summary.json removals_by_step_total exactly.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/extraction-decision-inventory/removal-reasons.json
    - /home/alexi/git/defuddle/src/removals/selectors.ts:19-206
- - **claim:** The scorer is mostly inert: of 502 blocks scored on fixtures, 408 score exactly 0, 52 are removed (<0), and only 41 nonzero blocks fall within +/-5 of the threshold; isLikelyContent short-circuits 658 of 1,160 blocks before scoring.
  - **evidence:** gates-summary.json (measure-gates.mjs monkey-patches ContentScorer.scoreNonContentBlock/isLikelyContent on dist). Near-zero examples are short labels: 'Aliases: summary, tldr' (+1), 'Posted by Jane Reporter on April 20, 2026' (+1), 'Vincent Vallet Oct 18, 2019 · 8 min read' (+1).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/extraction-decision-inventory/gates-summary.json
    - /home/alexi/git/defuddle/src/removals/scoring.ts:246-549
- - **claim:** Main-container selection is rarely close: top candidate chosen in 205/211 generic fixtures (97.2%); top-2 margin <10 in 2, <40 in 4, <80 in 14 (6.6%); <body> chosen in 25 (11.8%); candidate counts 1:26, 2:123, 3:44, 4:8, 5:3, 6+:7.
  - **evidence:** gates-summary.json findMain. The 6 non-top picks are the child-preference rule (defuddle.ts L1297-1316) or table fallback (L1321-1358): entry-point--js-article-content, maggieappleton (margin 39.8 main vs article), gated-content--cookie-consent, general--substack-app, table-layout--blogger-two-column, table-layout--paulgraham.
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/defuddle.ts:1242-1358
    - experiments/jev/research/results/extraction-decision-inventory/gates-summary.json
- - **claim:** The retry cascade's explicit uncertainty gates fire constantly on fixtures but almost never change the answer: <200-word gate on 163/226 first passes, <50 on 54, yet the final result differs from the first pass in only 11 fixtures (544 parseInternal calls total).
  - **evidence:** gates-summary.json retry_kinds: initial 231, removePartialSelectors 182, removeHiddenElements 64, index-page 57, hidden-contentSelector 7, schema contentSelector 1. Fixtures are small (median 1,755 bytes) so the word-count gates overfire relative to real pages. Retry-changed examples: author-contact-block 0->236 words (partial selectors had removed everything), issues--162-aria-hidden 2->86, issues--361-* 5->170.
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/defuddle.ts:102-215
    - experiments/jev/research/results/extraction-decision-inventory/gates-summary.json
- - **claim:** Historically, 71% of clutter-removal commits (115/161) are bare additions to the selector lists, and the lists grew from 333 partial / 91 exact (v0.3.0) to 547 / 162 (HEAD); 28 commits are explicit 'keep content / overly aggressive' repairs.
  - **evidence:** classify-failures.mjs over gitlog_all.txt; selector counts from git show <tag>:src/constants.ts at 0.3.0, 0.3.7, 0.5.3, 0.6.4, 0.10.0, 0.15.0, 0.19.1, HEAD. Repairs include 9e6fa75 (#112 word-boundary + prose protection), ae6fc5c (#107/#77: 'appendix' commented out, 'enhancement' -> 'enhancement-'), 29872c0 (nango: require <2 prose paragraphs before trailing-section removal; strip heading ids from partial matching), 0699bb0 (breadcrumb list items <=8 words), 0e206c0 (#358 whole-body fallback).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/extraction-decision-inventory/failure-classes.json
    - experiments/jev/research/results/extraction-decision-inventory/commit-classes.json
- - **claim:** Of 244 GitHub issues, 99 are extraction-proper; 39 (39%) are text-readable from the block's own content (12 text-heuristic FPs such as #112 nav words, #428 'register', #445 'Comment', #284 header cells, plus 21 attribute-rule FPs such as #444 id=term-related-claim, #441 [data-date], #321 id=tags, #279 hero, #252 [href*=/author/], #131, #132, #106, and 6 kept-clutter FNs) and 60 (61%) are structural (wrong container, aria-hidden, listing pages, lazy images, trailing-cascade truncation). Open extraction issues: 11 text-readable vs 20 structural.
  - **evidence:** Hand classification by issue title in classify-failures.mjs -> failure-classes.json (issueByClass / openByClass). Overall: infra 50, formatting 46, site-extractor 42, main-container 30, clutter-FP-attr 21, clutter-FP-struct 15, clutter-FP-text 12, images 8, clutter-FN-struct 7, metadata 6, clutter-FN-text 6, unclassified 1 (#66).
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/extraction-decision-inventory/failure-classes.json
    - experiments/jev/research/results/extraction-decision-inventory/gh_issues.json
- - **claim:** Formatting (math/code/footnotes/markdown/headings/whitespace) is the largest single class of work and is untouched by any keep/remove classifier: 186/781 commits, 46/244 issues, 83/226 fixture families (footnotes 28, elements 19, codeblocks 16, math 14, headings 3, others), and 98 of the 196 commits that changed tests/expected touched src/elements|markdown|standardize (66 touched only those).
  - **evidence:** git log --name-only per commit touching tests/expected (expected-commit-areas.txt): formatting 98, constants 51, removals 45, core 44, extractors 21; removals/constants-without-formatting 48; formatting-only 66. Fixture prefix counts via ls tests/fixtures.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/extraction-decision-inventory/expected-commit-areas.txt
- - **claim:** A per-block Noul set reads the attribute-rule and text-heuristic failure classes correctly from the block alone but needs code-supplied neighbour context for the trailing-cascade class: live probe 16/18 (text 9/10, attr 3/3, struct 1/2, struct+context 2/2, policy 1/1).
  - **evidence:** probe-failure-classes.mjs, jev-1.14.0, 18 calls, 10,398 input tokens, $0.000437, latency p50 65 ms / p90 118 ms. #444 P(body)=0.82, #441 0.97, #371 0.59, #112 0.87, #428 0.78, #284 0.79; cookie banner P(chrome)=0.93, byline P(meta)=0.98, newsletter P(cta)=0.98, ToC P(links)=0.98. Misses: '<p>Comment</p>' alone P(body)=0.44 (with next sibling of prose 0.52 keep; with a comments-thread sibling 0.16 remove); a content list of long internal links judged P(link_list)=0.94 (the 0699bb0 ambiguity). Single run, hand-written blocks, untuned thresholds.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/extraction-decision-inventory/probe-results.json
- - **claim:** At fixture scale the sibling block experiment measured Jev at 83.7% block accuracy (AUROC 0.838) with block-only state, 66.9% on 3-5-word blocks (the zone content-patterns operate in), 86.8% agreement with removeBySelector removals but only 40.1% with container-level ('unmatched') removals; |2p-1|>=0.8 covers 66.4% at 89.8%.
  - **evidence:** Read from experiments/jev/research/results/exp-block-classification/analysis-stdout.txt (n=1,475 units from 224 fixtures; not re-run by me). The h1 row (47 removed by Defuddle's title-dedupe policy, Jev keeps them) shows policy decisions must stay in code.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/exp-block-classification/analysis-stdout.txt
- - **claim:** Per-page call volume is bounded and cheap: fixtures average 6.6 candidate blocks (median 3, max 213 on the 200 KB lesswrong page), median 276 chars of cleaned HTML per block; a 200-block real page is roughly 30k input tokens, ~$0.0013, and can be batched as many Nouls per request.
  - **evidence:** experiments/jev/research/results/dataset/blocks.jsonl per-fixture counts (lesswrong 213 units/122k chars, maggieappleton 101/48k, 12gramsofcarbon 54/52k, x.com article 43/48k). Jev brief: 32k tokens per question, questions batch nearly free.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/dataset/summary.json
- - **claim:** Protections that must stay deterministic regardless of any model: unconditional _stripUnsafeElements on the final root (defuddle.ts L1087), pre/code and td/th skips in scoring (scoring.ts L268-285), pre/code skips in selectors (selectors.ts L43, L83), footnote container/backref protection (selectors.ts L166-177; scoring.ts L452-456), [data-defuddle] extractor output (scoring.ts L273; selectors.ts L76), math under display:none (hidden.ts L22-25), paywall aria-hidden exception (constants.ts L83-89), ancestors-of-mainContent (scoring.ts L263; selectors.ts L159), retry acceptance arithmetic (2x, 1.5x, 0.7x), image dedupe/cover URL logic (defuddle.ts L345-491), the 33 px small-image rule, and the title/h1 dedupe policy; model output must never become a selector.
  - **evidence:** Line-cited from source; AGENTS.md 'Preserve sanitization regardless of pipeline options'; Jev brief section 8 (state is argued input; routing flips 93-100% under injection; browser-use ad click 91%).
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/defuddle.ts:1087
    - /home/alexi/git/defuddle/src/removals/scoring.ts:263-285
    - /home/alexi/git/defuddle/src/removals/selectors.ts:43-177
- - **claim:** '99.99%' is not an attainable or even well-defined target for extraction: the only ground truth is byte-equal Markdown for 226 fixtures; page-level identical-to-expected at 99.99% with 50-200 independent block decisions per page needs ~1e-6 per-block error, versus measured 0.16 (block-only) and 0.05 even in the top-confidence band; and Jev's ~12% chosen-option flip on repeat breaks byte-equal tests unless every decision is cached.
  - **evidence:** Arithmetic from measured rates; Jev brief Section 2 (determinism: none; 12% flips) and Section 3 (confidence >=0.99 band 96.3% on Banking77). exp-block-classification: |2p-1|>=0.9 band 94.6% on 520 blocks.
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md
    - experiments/jev/research/results/exp-block-classification/analysis-stdout.txt

## Metrics

- **source_lines:** - **defuddle.ts:** 1847
  - **content-patterns.ts:** 1313
  - **scoring.ts:** 568
  - **selectors.ts:** 222
  - **small-images.ts:** 166
  - **content-boundary.ts:** 139
  - **hidden.ts:** 90
  - **metadata-block.ts:** 34
  - **constants.ts:** 1184
- **decision_points_inventoried:** 51
- **decision_points_by_type:** - **deterministic_rule:** 13
  - **fuzzy_text_readable:** 4
  - **structural_multihop_with_thresholds:** 22
  - **pure_numeric_threshold:** 12
- **hand_maintained_lists:** - **EXACT_SELECTORS:** 162
  - **PARTIAL_SELECTORS:** 547
  - **PARTIAL_SELECTORS_at_v0.3.0:** 333
  - **EXACT_SELECTORS_at_v0.3.0:** 91
  - **ENTRY_POINT_ELEMENTS:** 20
  - **TEST_ATTRIBUTES:** 8
  - **navigationIndicators:** 35
  - **contentIndicators:** 14
  - **nonContentPatterns:** 25
  - **BOILERPLATE_PATTERNS:** 11
  - **content_pattern_rule_families:** 34
  - **FOOTNOTE_LIST_SELECTORS:** 125
  - **FOOTNOTE_INLINE_REFERENCES:** 154
- **numeric_comparisons_rough:** - **scoring.ts:** 28
  - **content-patterns.ts:** 85
  - **content-boundary.ts:** 3
  - **_parseWithRetries:** 6
- **fixture_removals_by_step:** - **removeBySelector:** 1778
  - **removeBySelector_exact:** 1218
  - **removeBySelector_partial:** 560
  - **scoreAndRemove:** 52
  - **removeByContentPattern:** 50
  - **removeHiddenElements:** 48
  - **removeEyebrowLabel:** 10
  - **total:** 1938
  - **distinct_partial_patterns_fired:** 75
- **fixtures_with_step:** - **removeBySelector:** 165
  - **removeByContentPattern:** 24
  - **removeHiddenElements:** 12
  - **removeEyebrowLabel:** 10
  - **scoreAndRemove:** 10
- **scorer_gate:** - **blocks_scored:** 502
  - **exactly_0:** 408
  - **removed_lt0:** 52
  - **nonzero_within_pm5:** 41
  - **nonzero_within_pm10:** 62
  - **le_minus20:** 14
  - **isLikelyContent_calls:** 1160
  - **isLikelyContent_true:** 658
- **main_container_gate:** - **measured:** 211
  - **chosen_is_top:** 205
  - **chosen_not_top:** 6
  - **margin_lt10:** 2
  - **margin_lt40:** 4
  - **margin_lt80:** 14
  - **chosen_is_body:** 25
  - **body_only_candidate:** 26
  - **second_inside_top:** 23
  - **n_candidates_dist:** - **1:** 26
    - **2:** 123
    - **3:** 44
    - **4:** 8
    - **5:** 3
    - **6+:** 7
- **retry_gates:** - **fixtures:** 226
  - **extractor_fixtures:** 17
  - **parseInternal_calls:** 544
  - **firstpass_lt200:** 163
  - **firstpass_lt50:** 54
  - **retry_changed_result:** 11
  - **retry_kinds:** - **initial:** 231
    - **removePartialSelectors:** 182
    - **removeHiddenElements:** 64
    - **indexPage:** 57
    - **hiddenContentSelector:** 7
    - **schemaContentSelector:** 1
- **explicit_uncertainty_gates:** 5
- **implicit_uncertainty_gates:** 6
- **commits_total:** 781
- **commits_by_class_keyword:** - **infra_docs_deps_release:** 293
  - **formatting_standardization:** 186
  - **clutter_removal_rules:** 161
  - **site_extractor:** 80
  - **metadata:** 25
  - **security:** 20
  - **main_content_selection_retries:** 14
  - **other:** 2
- **extraction_commits_subclass:** - **considered:** 277
  - **selector_list_addition:** 115
  - **content_pattern_text_plus_structure:** 52
  - **main_container_retry_fallback:** 33
  - **FP_repair_keep_content:** 28
  - **scoring:** 9
  - **hidden:** 3
  - **security:** 6
  - **other:** 31
- **commits_touching_tests_expected:** - **total:** 196
  - **touch_formatting:** 98
  - **touch_constants:** 51
  - **touch_removals:** 45
  - **touch_core:** 44
  - **touch_extractors:** 21
  - **removals_or_constants_without_formatting:** 48
  - **formatting_only:** 66
  - **no_src_change:** 13
- **issues:** - **total:** 244
  - **open:** 61
  - **by_class:** - **infra_cli_perf_security_feature:** 50
    - **formatting:** 46
    - **site_extractor:** 42
    - **main_container_or_page_structure:** 30
    - **clutter_FP_attribute_rule:** 21
    - **clutter_FP_structural_rule:** 15
    - **clutter_FP_text_heuristic:** 12
    - **images_lazy_dedupe:** 8
    - **clutter_FN_structural:** 7
    - **metadata:** 6
    - **clutter_FN_kept_clutter:** 6
    - **unclassified:** 1
  - **by_judgeability:** - **struct:** 60
    - **infra:** 50
    - **fmt:** 46
    - **site:** 42
    - **attr:** 21
    - **text:** 18
    - **meta:** 6
  - **extraction_proper:** 99
  - **extraction_text_readable_incl_attr:** 39
  - **extraction_structural:** 60
  - **open_by_judgeability:** - **struct:** 20
    - **site:** 16
    - **infra:** 11
    - **attr:** 7
    - **text:** 4
    - **fmt:** 3
- **fixtures:** - **total:** 226
  - **by_family:** - **issues:** 55
    - **general:** 31
    - **footnotes:** 28
    - **elements:** 19
    - **content-patterns:** 15
    - **math:** 14
    - **codeblocks:** 16
    - **metadata:** 10
    - **table-layout:** 4
    - **eyebrow:** 4
    - **headings:** 3
    - **extractor:** 3
    - **comments:** 3
    - **other_singletons:** 21
  - **formatting_family_total:** 83
  - **clutter_family_total:** 38
  - **html_bytes_median:** 1755
  - **html_bytes_max:** 201904
- **block_dataset:** - **units:** 1475
  - **fixtures:** 224
  - **kept:** 1108
  - **removed:** 367
  - **units_per_fixture_mean:** 6.6
  - **units_per_fixture_median:** 3
  - **units_per_fixture_max:** 213
  - **html_chars_per_unit_mean:** 542
  - **html_chars_per_unit_median:** 276
- **sibling_block_experiment_cited:** - **accuracy_at_0.5:** 0.837
  - **auroc:** 0.838
  - **kept_recall:** 0.918
  - **removed_recall:** 0.594
  - **acc_3_to_5_words:** 0.669
  - **agree_removeBySelector_removals:** 0.868
  - **agree_unmatched_container_removals:** 0.401
  - **band_abs2p1_ge0.8_coverage:** 0.664
  - **band_abs2p1_ge0.8_accuracy:** 0.898
  - **band_abs2p1_ge0.9_coverage:** 0.353
  - **band_abs2p1_ge0.9_accuracy:** 0.946
- **live_probe:** - **model:** jev-1.14.0
  - **blocks:** 18
  - **questions_per_block:** 5
  - **correct:** 16
  - **by_kind:** - **text:** 9/10
    - **attr:** 3/3
    - **struct:** 1/2
    - **struct+context:** 2/2
    - **policy:** 1/1
  - **input_tokens:** 10398
  - **est_cost_usd:** 0.000437
  - **latency_ms_p50:** 65
  - **latency_ms_p90:** 118
  - **latency_ms_max:** 232
- **per_page_cost_estimate:** - **blocks_200_tokens_approx:** 30000
  - **usd_approx:** 0.0013

## Tables

## Table 1. Decision-point inventory (meaning B). Type: DET = deterministic rule, TXT = fuzzy text-readable, STR = structural/multi-hop, NUM = numeric threshold. Evidence: present = readable from the block's own HTML/text; computed = needs DOM position/neighbours/page-level facts code must supply.

| # | Decision point | file:line | Inputs | Type | Protects / removes | Known FP/FN classes (refs) | Evidence |
|---|---|---|---|---|---|---|---|
| D1 | Retry gate 1: wordCount<200 -> rerun without partial selectors; accept only if >2x words | defuddle.ts:102,112 | word count of serialized result | NUM | recovers prose killed by PARTIAL_SELECTORS | c734e58 (retry used to override correct removals on short articles); #358 whole-body fallback winning (0e206c0) | computed |
| D2 | Retry gate 2: wordCount<50 -> rerun without hidden-element removal; accept if >2x | defuddle.ts:121,126 | word count | NUM | pages whose body is display:none/aria-hidden | #162 aria-hidden wrapper, #163 f74fdd0, #232/#234 dismiss buttons survive (edd5cc0) | computed |
| D3 | Retry gate 3: largest hidden subtree (>=30 words) as contentSelector; accept if more words or (>max(20,0.7x) and shorter) | defuddle.ts:144-153, 661-690 | words per hidden subtree | NUM+STR | focused hidden article vs leftovers | issues--232, issues--361-* (5->170 words) | computed |
| D4 | Retry gate 4: wordCount<50 -> rerun without scoring/partial/content-patterns (index page) | defuddle.ts:163-170 | word count | NUM | listing/portfolio pages where cards were scored away | b6fa176; general--tailwind-hidden-blog-index; #380 reddit listing | computed |
| D5 | Schema.org disagreement: schema articleBody words >1.5x result -> locate element containing first 100 chars with >=0.8x words, re-extract | defuddle.ts:181-215, 634-658 | schema text vs result words | NUM+STR | feed pages where scorer picked a sibling post | #139 (unsanitized fallback, f154cb7), 40376f8 type guards | computed |
| D6 | Extractor dispatch; extractor pipeline run disables scoring + hidden removal | defuddle.ts:853-890 (875) | URL/DOM match | DET | site-specific DOM (17 fixtures) | site-extractor class (42 issues) | n/a (site) |
| D7 | Candidate generation: 20 ENTRY_POINT_ELEMENTS, priority*40 | defuddle.ts:1245-1256; constants.ts:3-23 | selector index | DET+NUM | which element is 'the article' | 249951b .post-body (Ghost), 84d959c Oxygen Builder, #115 body in <form> | computed |
| D8 | scoreElement: +words +10/p +commas -3*img/word +5 right-float +10 date +10 author +15 class content/article/post +10 footnote refs +10 footnote list -5/table +10 center td; x(1-min(linkDensity,0.5)) | scoring.ts:127-225 | text, p/img/a/table counts, class, style | NUM+TXT(regex) | ranks containers | fff99bb footnote false positives; 6d482d7 list items | mixed |
| D9 | Child-preference: higher-priority child inside top with >50 words wins unless >1 sibling at same index (listing page) | defuddle.ts:1290-1316 (1297,1307) | containment, word count, sibling count | STR+NUM | <article> inside <main>; multi-article pages | 7c19d57, bd31303, #13 first <article> only, general--multi-article-portfolio | computed |
| D10 | Table-layout fallback: table width>400 / align=center / class content|article / 2+ cells with width; best td via findBestElement(min 50); reject if cellWords*2 < bodyWords | defuddle.ts:1321-1358 | table attrs, td scores, body words | DET+NUM | pre-CSS layouts | #258 ToC-only (92691a0 peripheral tables), #300 nested tables, 4 table-layout fixtures | computed |
| D11 | findContentByScoring (no candidate; effectively dead since body always matches) | defuddle.ts:1360-1370 | scoreElement>0 over BLOCK_ELEMENTS | NUM | last resort | - | computed |
| D12 | data-defuddle ancestor expansion | defuddle.ts:950 | attribute | DET | keeps extractor post+comments together | - | present |
| D13 | Body fallback -> schema text locate | defuddle.ts:958-964 | schema text | STR | avoid whole-body output | #358 | computed |
| D14 | removeMetadataBlock: within 3 siblings after h1, <300 chars, contains date; only if metadata.published/author known | metadata-block.ts:11-34 | DATE_RE, h1 adjacency | TXT+STR+NUM | byline block under title | metadata--h1-sibling-byline, #295 wrong date | mixed |
| D15 | adoptExternalFootnotes: class/id /footnote/ + heading matching FOOTNOTE_SECTION_RE outside main | defuddle.ts:1405-1424 | class, heading text | DET | footnotes outside container | footnotes--external-labeled-section | present |
| D16 | Mobile media-query styles (max-width>=600) applied inline before hidden removal (browser only) | defuddle.ts:1140-1240 (1189) | stylesheets | DET(CSS) | desktop-only chrome | browser-only; none in Node | computed |
| D17 | removeSmallImages: min(attr,style,computed,viewBox,srcset-url width)<33 px; skip LaTeX alt/class; also no-src and base64 placeholders | small-images.ts:39-124, 126-166 | dimensions, src | NUM+DET | icons, trackers, placeholders | #221 base64, #227 lazy, #374 sources, #213 SVGs, #30/#72 missing images, small-images--svg-icon-viewbox | present (attrs) |
| D18 | removeHiddenElements: inline display:none/visibility:hidden/opacity:0 regex; computed style (browser); Tailwind hidden/invisible tokens; skip math | hidden.ts:5-90 (10,22,38-50,60-74) | style attr, class tokens | DET | hidden widgets | #162, #214 hidden code tabs, footnotes--hidden-section (standardize footnotes first), paywall aria-hidden exception constants.ts:83-89 | present |
| D19 | removeEyebrowLabel: element before first h1 (walking up first-child wrappers), 1-6 words, <=40 chars, no sentence punct, no date, no media/heading/list | content-patterns.ts:323-353 | text, position vs h1 | TXT+STR+NUM | category labels | 4 eyebrow-- fixtures; b4bd0c7 | mixed |
| D20 | EXACT_SELECTORS (162) with protections: inside pre/code, responsive show classes, hidden-skip on retry, ancestors of main, heading anchors, footnote containers/backrefs, button media unwrap | selectors.ts:28-54, 158-206; constants.ts:95-335 | tag/attr selectors | DET | nav/footer/ads/forms/etc. | #132 .hero, #106 #menu, #131 [href*=/category], #136 time, #44 .fixed (all commented out with issue refs); open: #252 [href*=/author/], #441 [data-date], #321 id=tags | present (attr) |
| D21 | PARTIAL_SELECTORS (547 regex fragments) vs class + data-component/test/testid/test-id/qa/cy and id (delimited->substring, delimiter-less->anchored; headings class-only) | selectors.ts:56-134 (91-133); constants.ts:340-349, 353-964 | attribute strings | DET | 560 of 1,938 fixture removals | #107 'enhancement', #77 'appendix' (ae6fc5c), #167 inside code (d3673b5), #303 pascalcase ids (0bfaca1), heading slug ids (29872c0), open: #444 'related' in id=term-related-claim, #371 card classes, #279 hero, #346 data-component-part, #439 regex JIT perf | present (attr) |
| D22 | Screen-reader link annotation regex ('opens in new window') when link has visible text | selectors.ts:15-17, 136-151 | text | TXT | keeps sr-only glyphs (#366) | #366/#390 ededffd | present |
| D23 | scoreAndRemove scope: 9 BLOCK_ELEMENTS; skip ancestors of main, inside pre, [data-defuddle], inside td/th; remove if score<0 | scoring.ts:246-318 (263-299) | tag, containment | DET+NUM | - | #284 header cells (td skip) | computed |
| D24 | isLikelyContent protections: role article/main/contentinfo; class/id contains 1 of 14 contentIndicators; contains pre/table/figure/picture; heading-only wrapper (not nav/toc heading); nav-heading section <200 words or linkDensity>0.2 -> not content; card grid -> not; <80 words with social profile link -> not; words>50&&blocks>1; words>100; words>30&&blocks>0; >=10 words with sentence punct and linkDensity<0.1 | scoring.ts:323-443 | text, counts, class, headings, hrefs | TXT+STR+NUM | 658/1,160 blocks protected | 9e6fa75 (#112 prose rule), #148 tables (5af52ae), 947c66e content grids, #460 'Comments' heading wrapper (open) | mixed |
| D25 | scoreNonContentBlock: skip footnotes; <3 words ->0; +commas; -10 per navigationIndicator (35 words); -15 linkDensity>0.5; -15 link-text>0.8 (links>1, <80 words); -10 list-of-links; -15 social profile <80 words; -10 byline+date <15 words; -15 card grid; -8 per nonContentPattern class (25) | scoring.ts:449-549 | text, hrefs, class | TXT+NUM | 52 removals on fixtures | #112 'privacy/share/social/popular' in prose; #428 'register' (open); aafc0dc (#147 bylines), 6aa4c15 bios, 483ab7d (#152) | present (text) + class |
| D26 | isCardGrid: 3-499 words, >=3 h2-h4, >=2 img, prose/heading<20 | scoring.ts:555-567 | counts | NUM+STR | related-post grids | 947c66e, a1e8a51 mid-article image rows | computed |
| D27 | findContentStart / isProseBlock: title h1/h2 anchor; first P/DIV/SECTION/... with >=7 words, sentence punct, not byline<15w, not date<20w, link text<70%, DIV must contain p, not inside aside/nav/header/footer/form/dialog; null = no signal | content-boundary.ts:36-139 | text, tags, ancestors | TXT+STR+NUM | anchors all 'pre-content' rules | b4bd0c7; silent disable when null | computed |
| D28 | Pre-content metadata single pass (<=15 words): timezone widget, pinned label, duplicate title/description, metadata header block (date/relative time <=10w), category badge, 'By X' byline, read time (strip-residual), author+date (1-4 capitalized residual words), standalone date | content-patterns.ts:510-669 (537,546,560,576,592,604,623,642,661) | text regexes + isPreContent | TXT+STR+NUM | bylines/dates/read-time | #233 day-of-week as name (323c895), #136 time, metadata-- fixtures, content-patterns--iso-date-and-read-time | text present, position computed |
| D29 | Boundary <time> elements <=10 words within 200 chars of start/end | content-patterns.ts:672-712 | text position in contentText | STR+NUM | publish dates | #136 inline time preserved | computed |
| D30 | Hero header: <time> above content start, walk up while heading+time and proseWords<30 | content-patterns.ts:228-291 | structure | STR+NUM | title/date/hero wrappers | content-patterns--non-semantic-hero-header | computed |
| D31 | Breadcrumb list: first list, 2-8 items, each <=8 words, internal links incl. root/shallow path | content-patterns.ts:293-321, 363-375 | hrefs, text | TXT+STR+NUM | breadcrumbs | 0699bb0 (content lists), 368cb3b, #253 crumbs | present |
| D32 | Promotional banner <a> before h1 with div child, no media, <=25 words, no sentence | content-patterns.ts:380-398 | structure, text | STR+NUM | announcement banners | - | computed |
| D33 | Audio/TTS widget: 'listen to this article' or pre-content player in <=25-word container | content-patterns.ts:404-432 | text + position | TXT+STR | TTS players | 8d2ef38 | mixed |
| D34 | ToC: list in first 30% of text, >=3 links, >=80% same-page anchors; removes ToC heading and framing hr | content-patterns.ts:436-500 | hrefs vs URL, position | TXT+STR+NUM | ToC | c3b0a59; #258 | present (hrefs) + position |
| D35 | Blog metadata list ul/ol/dl: 2-8 items (dl>=1), each <=8 words, no terminal punct, total <=30 words, within 500 chars of start/end, not after heading or ':' | content-patterns.ts:720-776 | text, position, prev sibling | TXT+STR+NUM | meta lists | #229 github readme list (5bb3f20), #408 nested list after colon (open) | mixed |
| D36 | Section breadcrumb / back-nav: short element with link whose path is a prefix of page path or parent index.html | content-patterns.ts:784-830 | hrefs vs URL | STR | '<- back' links | #372 partial path match removes content links (open), general--back-nav-link | computed (URL) |
| D37 | Trailing external link list: heading + list of off-site links as last block | content-patterns.ts:835-895 | hrefs hostnames, trailing position | STR | affiliate roundups | - | computed |
| D38 | Trailing related posts block: last section/div/aside, >=2 paras all >=60% link text, no sentence punct | content-patterns.ts:900-939 | structure | STR+NUM | related posts | 4e6567f | computed |
| D39 | Trailing thin section: totalWords>300; trailing children <=25 words each, <15% total, has heading, no content elements, <2 prose paragraphs | content-patterns.ts:944-1000 | structure | STR+NUM | CTAs after article | 29872c0 (nango conclusion removed) | computed |
| D40 | Boilerplate sentence -> truncate everything after (11 patterns incl. /^Comments?$/, 'This article originally appeared in'); only if targetPos>=200 | content-patterns.ts:13-25, 1004-1046 | text regex + position | TXT+STR | end-of-article | #445 'Comment' paragraph truncates article (open), #460 (open), #360 Puck cut-off (open), #296 duplicated text, #343 Wikipedia sections | text present, consequence computed |
| D41 | Related/CTA heading sections: RELATED_HEADING_PATTERN / CTA_HEADING_PATTERN after >=500 chars; inline (prose follows) remove block else cascade | content-patterns.ts:51-54, 1050-1097 | heading text, hasFollowingProse | TXT+STR | related/about-author/subscribe | #210 FN kept, #343 'See also' | heading present, position computed |
| D42 | 'For more on...' intro paragraph <=20 words | content-patterns.ts:1100-1111 | text | TXT | orphan intros | - | present |
| D43 | Headingless related card grid: >=2 img, cards>=70% of children, after 500 chars or >=100 preceding prose words, <=30% of words, no following prose | content-patterns.ts:1115-1163 | structure | STR+NUM | related cards | a1e8a51 image rows FP, content-patterns--multi-image-row-midarticle | computed |
| D44 | Newsletter signup: NEWSLETTER_PATTERN on div/section/aside <=60 words or ul <=30 words, no content elements | content-patterns.ts:26, 43-49, 1168-1200 | text | TXT+NUM | CTAs | 25340c1; general--trailing-cta-newsletter | present |
| D45 | Author contact block: 2-40 words within 300 chars of end, label (written by/author/contact), email/phone/mailto | content-patterns.ts:1205-1248 | text + position | TXT+STR | news bylines | author-contact-block fixture | mixed |
| D46 | Author/share widget: label share/follow/author(s)/written by, container <=15 words, no content elements but img | content-patterns.ts:1253-1272 | text | TXT+NUM | Tailwind widgets | author-share-widget fixture | present |
| D47 | Social engagement counter /^\d+ (Likes|Comments|Shares|...)$/ near end or bare <a> | content-patterns.ts:27, 1276-1293 | text | TXT | Substack likes | f91790f, 36024ee | present |
| D48 | Trailing tag link block: <=10 words, no punct, >=80% link text, within 300 chars of end | content-patterns.ts:1296-1313 | text, position | TXT+STR | tag clouds | - | mixed |
| D49 | _deduplicateImages: same alt in a figure, or adjacent outside figures with no visible content between -> keep best (srcset > picture > URL width) | defuddle.ts:345-400 (397) | alt, src, adjacency | DET+STR | lazy-load duplicates | #286 generic alt dedup FP, #59 NYT double images, 884a48d | computed |
| D50 | _removeCoverImage: img src == metadata image unless inside figure with figcaption | defuddle.ts:473-491 | URLs | DET | duplicate hero | - | computed |
| D51 | standardizeContent (formatting, ALLOWED_ATTRIBUTES, div unwrap) | standardize.ts; constants.ts:1080-1148 | - | DET | not a keep/remove judgment | 46 formatting issues | n/a |

## Table 2. Jev questions that would replace or augment each fuzzy judgment (code owns thresholds; every Choice gets an escape option)

| Q | Replaces/augments | Primitive and exact wording | State | Evidence locality | Policy in code |
|---|---|---|---|---|---|
| Q1 keep_block | D24/D25 (scorer) and D21 veto | noul: "Is this HTML block part of the main body of the article or document on the page: prose, a list, a table row, a code sample, a definition, or a caption that a reader came to the page to read? Answer true even if it is short. Answer false for navigation, notices, widgets, bylines, and links to other pages." criteria {true:'Reader-facing article/document content', false:'Not article content (chrome, widget, metadata, links elsewhere)'} | cleaned outerHTML of block (cap ~6k chars) + code facts {word_count, link_text_ratio, position: before_first_prose/inside_body/after_last_prose, parent_heading, next_sibling_preview<=200 chars} | present for prose-vs-chrome; position computed | keep if p>=t_keep (tune per site class; start 0.5); only consulted inside the gate bands |
| Q2 is_site_chrome | D20/D21/D25 nav words | noul: "Is this block site chrome: a navigation menu, breadcrumb trail, cookie or consent notice, site footer, copyright line, share or follow widget, login prompt, or advertisement?" | same | present | remove if >=0.7 and Q1<0.5 |
| Q3 is_metadata_only | D14, D28, D29, D35, D45-D47 | noul: "Does this block consist only of publication metadata such as an author name, a date, a reading time, a category label, or a like/comment count, with no sentence of article text?" | block + position fact | text present; 'pre-content' position computed (D27) | remove if >=0.7 and position != inside_body |
| Q4 is_eyebrow_label | D19 | noul: "Is this short text a category, section, or series label shown above an article title (for example 'Blog post', 'Announcements', 'Opinion') rather than the start of the article?" | text + fact 'immediately precedes the title heading: yes' | position computed | remove if >=0.8 |
| Q5 is_breadcrumb_or_backnav | D31, D36 | noul: "Is this a breadcrumb trail or a back/up navigation link showing where this page sits in the site (for example Home > Blog > Title, '<- back to index')?" | block HTML incl. hrefs + fact 'links target ancestor paths of this page: yes/no' (code) | hrefs present; URL relation computed | remove if >=0.8 and at document start |
| Q6 is_table_of_contents | D34 | noul: "Is this list a table of contents for this same page: short entries that link to sections of this page rather than text to read here?" | list HTML + fact 'N of M links are same-page anchors' | present + computed anchor count | remove if >=0.8 and in first 30% |
| Q7 is_recirculation | D38, D41, D43 | noul: "Is this block a set of links or cards pointing the reader to other articles or posts (related posts, read next, more from, trending), rather than part of this article?" | section digest (heading + each child's first 80 chars + hrefs) + fact 'prose follows: yes/no' | heading/cards present; trailing-ness computed | remove block if >=0.8; cascade-truncate only if >=0.9 AND no prose follows (code) |
| Q8 is_end_of_article_marker | D40 | noul: "Does this text mark the end of the article body, such as the start of a comments section, a syndication note ('This article originally appeared in'), a copyright line, or a 'Leave a reply' prompt?" | {block, next_sibling_preview, remaining_words_after} | NOT present from block alone (probe: '<p>Comment</p>' 0.44 alone vs 0.52/0.16 with sibling) | truncate only if >=0.9; else keep everything |
| Q9 is_newsletter_or_cta | D44, D41 CTA, D39 | noul: "Is this block a call to action asking the reader to subscribe, sign up, follow, join, donate, or read other articles?" | block | present | remove if >=0.8 |
| Q10 is_author_bio_or_contact | D45, D46, D25 social rule | noul: "Is this block an author biography, author contact details, or an author/share widget rather than article text?" | block | present; policy choice whether bios are content | remove if >=0.8 (policy flag) |
| Q11 is_listing_page | D4, D9 | noul (page-level): "Does this page present many separate articles or posts as a list of previews, rather than one article to read?" | outline digest of top candidate: headings + first 60 chars of each child + link density | structural but code-summarizable | if >=0.8 skip scorer/content-patterns (replaces index retry) |
| Q12 which_container | D7-D10, D13 | choice: "Which candidate element contains the full main article body and nothing else that is a separate article? Pick the smallest candidate that still contains all article paragraphs." criteria {cand_1..cand_n: 'selector, N words, first 200 chars, last 100 chars, H headings, link density L', none_of_these:'No candidate is the article body or the page is a listing'} | per-candidate digests (2-10 per page; fixtures 2:126, 3:35, 4:4) | words/headings computed; text present | consult only when margin<80 or chosen is body; accept if confidence>=0.7; else keep heuristic; model never emits a selector |
| Q13 hidden_block_is_article | D2, D3 | noul: "Is this hidden block the article's own text (for example collapsed sections, tabs, paywalled paragraphs) rather than a menu, dialog, or notice?" | text of largest hidden subtree + fact 'visible words: N, hidden words: M' | present | use as contentSelector only if >=0.8 and M>N |
| Q14 cell_is_main_column | D10 | noul: "Is this table cell the main reading column of the page rather than a sidebar, header, or navigation column?" | td digest + fact 'cell words / body words' | computed | prefer over width heuristics only if >=0.8 |
| (keep deterministic) | D17 small images, D18 hidden CSS, D49/D50 image dedupe/cover, D15 footnotes, D20 exact selectors, D23 skips, D51 | - | - | not text-readable (dimensions, URLs, CSS semantics, policy) | code only |

## Table 3. Where the pipeline already knows it is uncertain (gates) with measured firing on 226 fixtures

| Gate | file:line | Condition | Fired (fixtures) | Changed outcome | Could gate a model call? |
|---|---|---|---|---|---|
| G1 word count <200 | defuddle.ts:102 | first pass words <200 | 163/226 first passes (fixtures tiny) | part of 11 | yes: Q1 veto on partial-selector removals instead of blanket disable |
| G2 word count <50 (hidden) | defuddle.ts:121 | <50 after G1 | 54 | part of 11 (e.g. issues--162 2->86) | yes: Q13 |
| G3 hidden-selector retry | defuddle.ts:144-153 | largest hidden subtree >=30 words | 7 retries | 7 | yes: Q13 |
| G4 index-page retry | defuddle.ts:163-170 | still <50 | 57 retries | 2-3 (issues--131 19->31, substack-app) | yes: Q11 |
| G5 schema.org 1.5x | defuddle.ts:181 | schema words >1.5x result | 1 | 1 | yes: Q12 with schema-located candidate |
| G6 candidate margin | defuddle.ts:1245-1316 | top-2 score gap | <10: 2, <40: 4, <80: 14 of 211 | n/a | yes: Q12 only in this band (6.6%) |
| G7 child-preference / multi-article tie | defuddle.ts:1297-1310 | child >50 words inside top; siblingsAtIndex>1 | 23 'second inside top'; chosen!=top 6 | 6 | yes: Q11/Q12 |
| G8 body fallback | defuddle.ts:958, 1277 | top candidate is body | 25 chosen body; 26 body-only -> table fallback 2 | - | yes: Q12/Q14 |
| G9 scorer near zero | scoring.ts:293-298 | score in [-10,+10] nonzero | 62 of 502 blocks (41 within +/-5); 52 removed | - | yes: Q1/Q2/Q3 only for this band |
| G10 isLikelyContent borderline | scoring.ts:418-440 | words 30-100 or >=10 words+punct rules | 1,160 calls, 658 true | - | yes: the >=10-word prose rule (L434) is exactly Q1 |
| G11 findContentStart null | content-boundary.ts:72-74,129 | no prose block found | not instrumented (silently disables D28-D30, D33) | - | yes: Q3 with position=unknown |
| G12 boilerplate targetPos<200 / cascade | content-patterns.ts:1027-1041 | truncation would start near top | not instrumented | - | yes: Q8 before any removeTrailingWithCascade |

## Table 4. Failure-class history from 244 GitHub issues (titles; hand-classified)

| Class | Issues | Open | Judgeability | Example issues |
|---|---|---|---|---|
| infra / CLI / perf / security / feature | 50 | 11 | none | #447 gist hang, #439 regex JIT, #393 ESM, #139 schema sanitization |
| formatting (markdown, code, math, footnotes, headings) | 46 | 3 | none (no classifier) | #436, #433, #431-#415 MathML, #367 sub/sup, #224 LaTeX, #222 Pygments, #188 headings |
| site extractor / API | 42 | 16 | site-DOM | YouTube x13, X/Twitter x9, Reddit x4, ChatGPT/Claude x7, Bilibili x2 |
| main container / page structure | 30 | 10 | structural | #162 aria-hidden, #352/#361 selector escaping -> whole body, #358, #115 <form>, #13 first article, #283 SPA, 'site X broken' reports |
| clutter FP: attribute-token rule | 21 | 7 | text-readable to repair (block is prose) | #444 id=term-related-claim, #441 [data-date], #321 id=tags, #279 hero, #252 /author/, #131, #132, #106, #107, #77, #167, #303, #371, #346, #366, #263 |
| clutter FP: structural rule | 15 | 6 | structural | #372 path-prefix links, #343 Wikipedia sections, #214 hidden tabs/final headings, #360 cut-off, #258, #240 subtitle, #408, #218, #395, #369, #287, #296 |
| clutter FP: text heuristic | 12 | 4 | text-readable | #112, #428 'register', #445 'Comment', #460 'Comments' wrapper, #284 header cell, #148 data tables, #233 weekday name, #371-adjacent #45/#182 callouts, #136 time, #114 leading hr |
| images (lazy, dedupe, picture) | 8 | 3 | structural | #227, #221, #374, #406, #286, #72, #30, #213 |
| clutter FN: structural | 7 | 1 | structural | #232 dismiss buttons, #254 empty video, #242 empty tables, #253 crumbs, #59 double images, #35 |
| clutter FN: kept clutter | 6 | 0 | text-readable | #210 related links, #241 nav chrome/footer, #68 menu, #160 tooltips, #235, #222 |
| metadata fields | 6 | 0 | text-readable (other pipeline) | #335, #295, #196, #183, #135, #21 |
| unclassified | 1 | 0 | - | #66 |
| Roll-up (extraction-proper = 99) | 99 | 31 | text-readable 39 (39%; 18 text + 21 attr) vs structural 60 (61%) | open: 11 text-readable vs 20 structural |

## Table 5. Commit history (781 commits)

| Bucket | Count | Share |
|---|---|---|
| infra / docs / deps / release / CI / website | 293 | 37.5% |
| formatting / standardization (code, math, footnotes, markdown, images conversion) | 186 | 23.8% |
| clutter-removal rules | 161 | 20.6% |
| site extractors | 80 | 10.2% |
| metadata | 25 | 3.2% |
| security | 20 | 2.6% |
| main-content selection / retries | 14 | 1.8% |
| other | 2 | 0.3% |

Sub-classification of 277 extraction-related subjects: selector-list additions 115 (bare 'removals', 'Removals: Bloomberg/NYT/Medium/...'), content-pattern rules 52, container/retry/fallback 33 (keyword bucket over-includes ~10 YouTube/metadata fallbacks), explicit keep-content repairs 28, scoring 9, hidden 3, security 6, other 31 (mostly formatting removals such as <br>, empty video, wbr).

Commits touching tests/expected (196): touch formatting code 98 (66 formatting-only), constants 51, removals 45, core 44, extractors 21, no src change 13; removals/constants without formatting 48. Most-churned expected files: maggieappleton xanadu (8), reddit (6), github issue (6), x.com (5+4), lesswrong (5+5), blogger-two-column (4), mathjax (4), wikipedia (4).

## Table 6. Fixture families (226)

| Family | Count | Nature |
|---|---|---|
| issues--* | 55 | mixed regression cases |
| general--* | 31 | mixed, includes the few full real pages |
| footnotes--* | 28 | formatting |
| elements--* | 19 | formatting/images |
| codeblocks--* / code-blocks--* | 16 | formatting |
| content-patterns--* | 15 | clutter (meaning B) |
| math--* | 14 | formatting |
| metadata--* | 10 | metadata |
| table-layout, eyebrow (4 each); headings, extractor, comments (3 each); selectors, security, scoring, hidden (2 each); 13 singletons | 38 | mixed |
| Formatting families total | 83 (37%) | no classifier involved |
| Clutter/extraction families total | 38 (17%) | meaning B proper |

## Table 7. Live probe (jev-1.14.0, 18 hand-written blocks x 5 Nouls; policy keep iff P(body)>=0.5 and max clutter Noul <0.7)

| Block | Models | Truth | Decision | P(body) | P(chrome) | P(cta) | P(meta) | P(links) |
|---|---|---|---|---|---|---|---|---|
| prose containing privacy/share/social/popular | #112 | keep | keep | 0.87 | 0.07 | 0.01 | 0.01 | 0.02 |
| 'Store the result in register R1' | #428 | keep | keep | 0.78 | 0.05 | 0.02 | 0.03 | 0.03 |
| td 'Defined in header <cstddef>' | #284 | keep | keep | 0.79 | 0.07 | 0.01 | 0.42 | 0.09 |
| div#term-related-claim definition | #444 | keep | keep | 0.82 | 0.10 | 0.01 | 0.02 | 0.03 |
| div.post-body[data-date] two paragraphs | #441 | keep | keep | 0.97 | 0.04 | 0.02 | 0.02 | 0.02 |
| ul of long internal doc links | 0699bb0 | keep | remove (ERR) | 0.59 | 0.50 | 0.56 | 0.02 | 0.94 |
| div.card-warning callout | #371 | keep | keep | 0.59 | 0.06 | 0.02 | 0.02 | 0.02 |
| cookie banner | baseline | remove | remove | 0.04 | 0.93 | 0.04 | 0.03 | 0.05 |
| Related Posts section | fixture | remove | remove | 0.08 | 0.12 | 0.68 | 0.14 | 0.98 |
| 'By Jane Reporter · March 4, 2026 · 8 min read' | D28 | remove | remove | 0.04 | 0.11 | 0.03 | 0.98 | 0.04 |
| newsletter CTA | D44 | remove | remove | 0.09 | 0.37 | 0.98 | 0.03 | 0.04 |
| ToC of #anchors | D34 | remove | remove | 0.11 | 0.80 | 0.03 | 0.05 | 0.98 |
| footer copyright | D20 | remove | remove | 0.04 | 0.95 | 0.02 | 0.24 | 0.28 |
| author bio with twitter link | D25 policy | remove | remove | 0.07 | 0.59 | 0.93 | 0.32 | 0.06 |
| '<p>Comment</p>' alone | #445 | keep | remove (ERR) | 0.44 | 0.14 | 0.03 | 0.38 | 0.05 |
| '<p>Comment</p>' + next sibling prose | #445 | keep | keep | 0.52 | 0.05 | 0.01 | 0.34 | 0.02 |
| '<p>Comments</p>' + next sibling comment thread | baseline | remove | remove | 0.16 | 0.09 | 0.03 | 0.27 | 0.05 |
| div with h2 'Comments' wrapping a short note | #460 | keep | keep | 0.70 | 0.06 | 0.02 | 0.03 | 0.03 |

Totals: 16/18; text 9/10, attr 3/3, struct 1/2, struct+context 2/2, policy 1/1; 10,398 input tokens; $0.000437; latency p50 65 ms, p90 118 ms. Note the three keep decisions at 0.52-0.59 sit in the band the brief calls unreliable.

## Table 8. Which rule fires (all 226 fixtures, final winning pass)

| Step : reason | Count |
|---|---|
| removeBySelector : exact | 1218 |
| removeBySelector : partial (75 distinct patterns; footer 90, menu- 48, avatar 36, nav- 35, footnote-back 31, pagehead 28, dropdown 24, mw-editsection 24, mw-cite-backlink 23, tooltip-content 17, metadata 16, loading 12, bottomnav 12, recommend 10, btn- 10, comments 9, marketing 9) | 560 |
| scoreAndRemove : score<0 | 52 |
| removeHiddenElements : class token / display:none / opacity:0 / visibility:hidden | 21 / 20 / 4 / 3 |
| removeEyebrowLabel | 10 |
| removeByContentPattern : 34 families, max 5 each (duplicate title 5, social counter 5, trailing non-content 5, boilerplate 4, read time 3, trailing thin section 3, ...) | 50 |

## Table 9. Concrete plug-in points

| Plug-in | Where | Trigger (code) | State | Consequence policy |
|---|---|---|---|---|
| P1 Per-block keep? veto on partial-selector removals | selectors.ts:117-133 before elementsToRemove.set for type 'partial' (exact matches untouched) | element not inside pre/code/[data-defuddle]/footnotes AND contains >=N words with sentence punctuation (e.g. N=30) | Q1+Q2+Q3+Q7+Q9 batched; block outerHTML + facts | keep (skip removal) if Q1>=t_keep and all clutter Nouls<0.7; log disagreement; fail-open to current behaviour on API error. Targets 21 attribute-rule issues + #107/#77/#303 class |
| P2 Per-block keep? inside the scorer band | scoring.ts:293-298 | isLikelyContent false AND score in [-20,+10] (62/502 fixture blocks) | same | override removal only if Q1>=0.7; override keep only if Q1<=0.2 and a clutter Noul>=0.9 |
| P3 Truncation guard | content-patterns.ts:1004-1046 (boilerplate) and 1050-1097 (related/CTA heading) before removeTrailingWithCascade | always (these decisions delete the rest of the page) | Q8/Q7 with {block, next_sibling_preview, remaining_words_after} | truncate only if >=0.9 AND remaining words after < 50% of total; otherwise remove only the matched block. Targets #445, #460, #360, #296, #343 |
| P4 Which container? | defuddle.ts:1290-1316 after sorting, and 958 body fallback | margin<80 and second not inside top (14/211), or chosen is body (25/211), or siblingsAtIndex>1 | Q12 over ENTRY_POINT candidate digests + none_of_these; Q11 is_listing_page | accept candidate if confidence>=0.7 else keep heuristic; model never produces a selector; candidate list is code-built |
| P5 Replace index-page and hidden retries | defuddle.ts:121-170 | wordCount<50 | Q11 on top candidate digest; Q13 on largest hidden subtree | pick strategy by probability instead of running three extra passes; keep 2x/0.7x acceptance arithmetic in code |
| Must stay deterministic | _stripUnsafeElements (defuddle.ts:1087) and extractor sanitize; pre/code/td/footnote/data-defuddle protections; math under display:none; ALLOWED_ATTRIBUTES; small-image 33 px; hidden CSS semantics; image dedupe/cover; retry acceptance ratios; title/h1 dedupe policy; everything in standardizeContent | - | - | - |

## Caveats

- Issue classification (Table 4) is by title only and hand-assigned; borderline titles (e.g. 'site X missing data') were put in main-container/page-structure without reading the threads; one issue (#66) left unclassified. Treat +/-5 per class as noise.
- The commit sub-classification is keyword-based; the 'main-container/retry/fallback' bucket over-includes ~10 YouTube/metadata fallback commits, and 'other-extraction' is mostly formatting removals. The earlier attempt's coarse classifier (293/186/161/80/25/20/14/2) was reused after reading its rules.
- Gate statistics (Table 3) come from the 226 fixtures, which are small hand-made regression cases (median 1,755 bytes, p90 8.8 KB); the word-count retry gates fire on 72% of them but would fire far less on real pages, and candidate counts/margins are similarly fixture-biased. I verified the instrumentation script (measure-gates.mjs) and independently reproduced its per-step removal totals (1778/52/50/48/10) but did not re-execute it.
- The live probe is 18 hand-written anonymized blocks, one run, untuned thresholds, no option rotation; it demonstrates evidence locality (text vs structural), not accuracy. Mid-range probabilities (0.44-0.59) decided several cases, exactly the band the brief says is unreliable.
- Sibling-slice numbers (1,475-block experiment: 0.837 accuracy, AUROC 0.838; main-container build summary 153/167 heuristic agreement) are quoted from their stdout/JSON and were not re-run here.
- Numeric-threshold counts per file are rough regex counts of comparison operators, intended as orders of magnitude.
- Line numbers refer to the working tree at commit 3e8bde9 (0.19.6); the repo was not modified (git status clean apart from dist/ and node_modules).
- Runtime constraints (browser bundle is synchronous, promises no network requests, cannot hold an API key; Worker is linkedom and most constrained) are another slice's topic but bound any plug-in to the Node/CLI/Worker opt-in path; nothing here assumes Jev in the extension.
- No labeled block corpus exists beyond the 226 expected outputs; every threshold in Table 2 is a starting point to be tuned in shadow mode, per the brief's finding that F1-optimal Noul thresholds are task-specific (median 0.35).

## Artifacts

- experiments/jev/research/results/extraction-decision-inventory/classify-failures.mjs
- experiments/jev/research/results/extraction-decision-inventory/failure-classes.json
- experiments/jev/research/results/extraction-decision-inventory/tally-removal-reasons.mjs
- experiments/jev/research/results/extraction-decision-inventory/removal-reasons.json
- experiments/jev/research/results/extraction-decision-inventory/probe-failure-classes.mjs
- experiments/jev/research/results/extraction-decision-inventory/probe-results.json
- experiments/jev/research/results/extraction-decision-inventory/expected-commit-areas.txt
- experiments/jev/research/results/extraction-decision-inventory/measure-gates.mjs (earlier attempt; verified, reused)
- experiments/jev/research/results/extraction-decision-inventory/gates-summary.json (earlier attempt; cross-validated by removal-reasons.json)
- experiments/jev/research/results/extraction-decision-inventory/gates-per-fixture.json
- experiments/jev/research/results/extraction-decision-inventory/classify-commits.mjs and commit-classes.json (earlier attempt; reused)
- experiments/jev/research/results/extraction-decision-inventory/gh_issues.json (244 issues, earlier attempt)
- experiments/jev/research/results/gitlog_all.txt
