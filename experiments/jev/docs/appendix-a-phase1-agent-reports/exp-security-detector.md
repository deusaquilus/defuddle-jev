# Jev as a secondary XSS detector vs. defuddle's deterministic stripUnsafeElements: 155-fragment live audit (jev-1.14.0)

_Verbatim final report of the phase-1 workflow agent `exp-security-detector` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

I built a labeled corpus of 155 HTML fragments (83 malicious across script/handler/javascript:-URL/obfuscated/data:/blob:/srcdoc/base/meta-refresh/plugin/SMIL/foreignObject/MathML/CSS/template/noscript/7 mXSS shapes, each tagged 'modern' (68), 'legacy' (6) or 'inert' (9) for current-browser executability; 72 benign including 14 escaped-code documentation samples, 8 XSS-discussing prose items, YouTube/Vimeo/Maps iframes, data:image, mailto/tel, SVG icons, MathML, math/tex script, forms, templates). For every fragment I ran defuddle's built `stripUnsafeElements` (dist/utils/dom.js) under linkedom and under JSDOM/parse5, plus the full `Defuddle()` pipeline with default options and with all optional removals disabled, and checked each serialized output with an independent detector (JSDOM re-parse DOM walk with browser-style URL normalization + raw regex). Then I sent each fragment to jev-1.14.0 (10 questions per call: the task's main noul, a 9-way attack-type Choice with a `none` escape, 7 per-category nouls, and an "is this only escaped code/prose" noul) in six states: raw x3 repeats, after stripUnsafeElements, embedded in a ~1.1k-token benign article, and the real pipeline output. 924 calls, 0 errors, 1.31M input tokens, est. $0.055, p50 latency 76 ms. A separate 60-call probe tested prompt injection. Raw JSONL and all scripts are under experiments/jev/research/results/exp-security-detector/.

Deterministic result (measured): stripUnsafeElements neutralized every modern-executable vector except one. The 5 survivors by the spec detector were M42 `vbscript:` href (IE-only; isDangerousUrl at src/utils/dom.ts:73-79 lists only javascript:/blob:/data:), M54 `<meta http-equiv="refresh" content="0;url=https://evil.example/">` (live navigation in current browsers; META is absent from UNSAFE_ELEMENT_TAGS at dom.ts:83-94), M55 the same with a javascript: URL (browsers block it), and M72/M73 `style="background:url(javascript:...)"` / `expression()` (dead engines; style attributes are never touched by stripUnsafeElements). `<link rel="import">` (M63) also passes but is a removed web feature. In the default pipeline only M42 remains, because EXACT_SELECTORS removes meta/link (src/constants.ts:95-101) and the ALLOWED_ATTRIBUTES allowlist drops `style` (src/standardize.ts:536, constants.ts:1080); with `removeExactSelectors:false` the meta refresh survives, which contradicts the comment at src/defuddle.ts:1084-1087 and AGENTS.md's "preserve sanitization regardless of pipeline options". All 7 mXSS shapes were inert after sanitization under both parsers (linkedom and parse5 produce different but harmless output; e.g. linkedom turns the CDATA escape into an HTML comment). All 20 obfuscated javascript: vectors (hex/decimal/zero-padded/named entities incl. &colon; and &Tab;, inserted tabs/newlines, VT, leading spaces, mixed case) were stripped because both parsers decode entities before isDangerousUrl sees the value. All 72 benign fragments survived stripUnsafeElements byte-intact under both parsers, including escaped `&lt;script&gt;` code, the YouTube iframe, data:image/png, and the math/tex script.

Jev result (measured): on raw fragments the main noul reached AUC 0.969; at 0.5 TPR 97.6% (97.1% on modern-executable) with FPR 19.4%; at 0.9 TPR 74.7% with FPR 2.8%. It never scored a malicious item <=0.1, caught 20/20 obfuscated payloads at >=0.5 (17 at >=0.9), and 9 of the 11 shapes my DOM detector cannot see pre-sanitization (mXSS 0.81-0.90, template 0.88). Its two modern misses were the stylesheet-loading vectors (`<style>` with remote url() 0.11; svg `<style>@import` 0.43), which it read literally as "not script". False positives were systematic rather than random: escaped documentation code (7/14 >=0.5, `&lt;iframe srcdoc=...&gt;` at 0.97), legitimate iframes (YouTube 0.85, Vimeo with sandbox 0.93, Maps 0.69), an `alt="onerror=alert(1)"` attribute (0.83), a `data-onerror` attribute (0.87) and a `#javascript:` fragment (0.88). Using 1-P(none) from the Choice was the best single score (AUC 0.983; TPR 91.6% / FPR 4.2% at 0.9), and multiplying by (1 - P(only escaped code)) in code removed every escaped-code false positive (FPR 4.2-6.9% at 0.5, remaining FPs are the iframes/alt/data-attr/fragment cases). Embedding the fragment in a 1.1k-token article lowered malicious scores by 0.053 on average and cut TPR@0.9 from 74.7% to 57.8% (AUC unchanged, 0.973), so thresholds do not transfer across state sizes. On sanitized output, Jev raised an alarm (>=0.5) on 18/144 deterministically-clean outputs (12.5%; 4 at >=0.9), and on 13/154 (8.4%) of realistic pipeline outputs, dominated by the same permanent features of defuddle output (embeds, code docs). It did score all 5 deterministic survivors highly (meta refresh 0.99, vbscript 0.99, CSS 0.88/0.73) and additionally flagged the `<link rel=import>` leftover (0.76); everything else it flagged on clean output was inert (fullwidth-j href 0.93, `<use>` with data:svg 0.86, CDATA-turned-comment 0.61) or benign. Repeating identical requests moved the noul by 0.018 on average (max 0.19); 2/155 items flipped at 0.5 (both borderline inert cases), 7 at 0.9, 0/155 responses were byte-identical. Page-controlled text claiming the content was already sanitized lowered the unsafe score from 0.98 to 0.63-0.82 (no flips at 0.5, 10-12 of 12 flips at 0.9), and wrapping a live payload in an unescaped `<pre><code>` made Jev believe it was "only escaped code" (0.80-0.91).

Implication for the Jev question: Jev cannot be a gate (TPR<100% at every threshold, misses stylesheet loading, degrades with context size and under in-page text, and a 0.9 threshold needed for an acceptable FPR drops recall to 58-75%); and it does not improve the deterministic boundary, which already yields 0 modern-executable survivors in the default pipeline on this corpus. As telemetry it is usable only behind a deterministic pre-filter, with code-side score combination and an allowlist for embeds/code blocks; even then ~5-8% of ordinary documents would alarm. As an offline fuzz oracle it has modest value: it ranked all known survivors at the top and would have surfaced the meta-refresh gap, but the same gap was found for free by a ~60-line DOM-walk detector with 0% FPR. The actionable security finding here is deterministic: add META (at least `meta[http-equiv=refresh]`) and LINK to UNSAFE_ELEMENT_TAGS and `vbscript:` to isDangerousUrl, and add fixtures with removals disabled.

## Verdict for this dimension

Jev must not gate defuddle's security sanitization and would not improve it: on 83 payloads the deterministic stripUnsafeElements already left 0 modern-executable survivors in the default pipeline (1 when optional removals are disabled: an in-body meta refresh, a small deterministic fix), while Jev's best scoring reached only TPR 91.6% / FPR 4.2% at a 0.9 threshold (main noul: TPR 74.7% at 0.9; 97.6% at 0.5 but with 19.4% false positives on benign output), missed stylesheet-loading vectors, lost recall when the fragment sat inside a 1.1k-token article, was pushed below 0.9 on 10-12 of 12 live payloads by in-page text claiming the content was sanitized, and was never byte-reproducible. As a detector/telemetry signal it is cheap (~$0.00006 and 76 ms per 10-question call) and ranks real survivors at the top, but on defuddle's own clean output it alarms on 8-12% of documents (embeds, escaped code docs, alt/data- attribute text) unless a deterministic pre-filter plus code-side score combination (1-P(none))x(1-P(only escaped code)) is used, which still leaves ~4-7% false alarms. As an offline fuzz oracle it would have surfaced the meta-refresh gap and the `<link rel=import>` leftover, but it found nothing modern-executable that a 60-line DOM-walk detector (0% FPR, no network) did not also find. Verdict for 'aggressive use': no for meaning A (security sanitization); at most a shadow-mode or CI-time oracle, never on the npm/browser path where the privacy promise forbids network calls.

## Findings

- - **claim:** stripUnsafeElements alone lets `<meta http-equiv="refresh" content="0;url=https://evil.example/">` through under both linkedom and JSDOM; it is removed in the default pipeline only by the optional EXACT_SELECTORS step, so with `removeExactSelectors:false` the full pipeline emits it. This is the single modern-browser-executable survivor out of 83 payloads and contradicts the 'only guaranteed sanitization boundary' comment and AGENTS.md's 'regardless of pipeline options' rule.
  - **evidence:** det-audit.json M54: strip_linkedom.out and strip_jsdom.out both equal the meta tag; pipeline_default.detect.spec=[] but pipeline_noremove.detect.spec=['meta_refresh']. UNSAFE_ELEMENT_TAGS at src/utils/dom.ts:83-86 has no META/LINK; 'meta' and 'link' are in EXACT_SELECTORS at src/constants.ts:95-101, gated by options.removeExactSelectors at src/defuddle.ts:1033-1037; comment at src/defuddle.ts:1084-1087. (The earlier security-map probe found the same with NOREMOVE options.)
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/utils/dom.ts:83-94
    - /home/alexi/git/defuddle/src/constants.ts:95-101
    - /home/alexi/git/defuddle/src/defuddle.ts:1033-1037
    - /home/alexi/git/defuddle/src/defuddle.ts:1084-1087
    - experiments/jev/research/results/exp-security-detector/det-audit.json
- - **claim:** Other stripUnsafeElements survivors are legacy-only: `vbscript:` href (survives even the default pipeline), `style="background:url(javascript:...)"` and `style="width:expression(...)"` (survive stripUnsafeElements; removed by the standardize attribute allowlist only when standardize=true), and `<link rel="import">` (removed by EXACT_SELECTORS by default). None executes in current Chrome/Firefox.
  - **evidence:** det-audit.json M42, M72, M73, M63; isDangerousUrl at src/utils/dom.ts:73-79 checks only javascript:/blob:/data:; style attributes are not in URL_ATTRIBUTES (dom.ts:96) and 'style' is absent from ALLOWED_ATTRIBUTES (src/constants.ts:1080-1113), stripped at src/standardize.ts:536.
  - **confidence:** high
  - **refs:** - /home/alexi/git/defuddle/src/utils/dom.ts:73-79
    - /home/alexi/git/defuddle/src/utils/dom.ts:96
    - /home/alexi/git/defuddle/src/constants.ts:1080
    - /home/alexi/git/defuddle/src/standardize.ts:536
- - **claim:** The deterministic sanitizer neutralized all 20 obfuscated javascript: vectors, all 7 mXSS shapes, all SMIL/foreignObject/MathML/srcdoc/data:/blob:/plugin vectors, and kept all 72 benign fragments byte-intact under both parsers (escaped code, YouTube iframe, sandboxed iframe, data:image/png, math/tex script, mailto/tel, SVG paths, MathML).
  - **evidence:** det-audit-stdout.txt: [strip_linkedom] and [strip_jsdom] malicious with SPEC survivor 5/83, benign intact 72/72; linkedom vs JSDOM outputs differ for 24 items but the JSDOM re-parse detector finds no executable construct in any of them (e.g. M82 CDATA becomes `<!--[CDATA[...]]-->` under linkedom; M80 becomes `<svg><p /><img src="1" />"&gt;</svg>`).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/det-audit-stdout.txt
    - experiments/jev/research/results/exp-security-detector/det-audit.json
- - **claim:** Jev-1.14.0 on raw fragments: main noul AUC 0.969; TPR 97.6% / FPR 19.4% at 0.5; TPR 74.7% / FPR 2.8% at 0.9; 0% of malicious items scored <=0.1; 25.3% of malicious and 40.3% of benign items sit in the uncertain 0.1-0.9 band.
  - **evidence:** analysis.json raw_unsafe_noul (n_mal=83, n_ben=72); Table 2.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
    - experiments/jev/research/results/exp-security-detector/jev-raw.jsonl
- - **claim:** Jev's two modern-executable misses at 0.5 are both stylesheet-loading vectors (`<style>body{background:url("https://evil.example/leak")}</style>` = 0.11; `<svg><style>@import ...</style></svg>` = 0.43), i.e. it reads 'execute script or load a non-image document' literally and does not count CSS fetches; `blob:` iframe scored only 0.58.
  - **evidence:** analysis.json raw_unsafe_noul.thresholds['0.5'].missed_modern = [M71=0.43, M74=0.11]; thresholds['0.7'] adds M57=0.58.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Jev detected every obfuscated payload (20/20 >= 0.5, 17/20 >= 0.9, Choice non-none 20/20), including zero-padded decimal entities without semicolons, &colon;/&Tab;/&NewLine; mixes, fully hex-encoded href+text, leading VT, and the inert fullwidth-j and leading-NUL variants (which it over-flags at 0.93-0.94).
  - **evidence:** analysis.json raw_obfuscated and raw_obfuscated_summary.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Jev false positives are systematic: escaped documentation code 7/14 >= 0.5 (max 0.97 for `&lt;iframe srcdoc=...&gt;`), legitimate embeds 3/4 (YouTube 0.85, Vimeo+sandbox 0.93, Maps 0.69), `alt="onerror=alert(1)"` 0.83, `data-onerror` 0.87, `href="...#javascript:"` 0.88. XSS-discussing prose was mostly fine (mean 0.216, 1/8 >= 0.5).
  - **evidence:** analysis.json raw_hard_benign and raw_unsafe_noul.thresholds['0.5'].false_pos; raw_category_nouls_benign_fp shows has_event_handler_attribute firing 0.95-0.98 on B12/B60.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Question design matters more than threshold: 1-P(none) from the 9-way Choice (with `none` escape) is the best single score (AUC 0.983; TPR 91.6% / FPR 4.2% at 0.9), and multiplying by (1 - P(is_only_escaped_code_or_prose)) in code eliminates all escaped-code false positives (raw FPR 6.9% at 0.5, 2.8% at 0.9 with (1-Pnone)*(1-escaped)); the 'max of 7 per-category nouls' detector was worse (AUC 0.958) because the handler noul fires on alt/data- attribute values.
  - **evidence:** analysis.json raw_choice.p_none_as_score; combo-scores.txt lines for raw_r1; raw_or_category_nouls.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/results/exp-security-detector/combo-scores.txt
    - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Jev on defuddle's sanitized output raises alarms on clean output at a rate that would make unfiltered telemetry noisy: 18/144 (12.5%) deterministically clean stripUnsafeElements outputs >= 0.5 (4 >= 0.9), 13/154 (8.4%) realistic pipeline outputs >= 0.5, driven by embeds and code docs that are permanent features of defuddle output.
  - **evidence:** analysis.json stripped.safe_output_false_alarm and pipeline.safe_output_unsafe_ge_0_5; Table 6.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** As a fuzz oracle Jev would have surfaced the real gap: it scored all 5 deterministic survivors 0.73-0.99 on sanitized output (meta refresh 0.99, Choice=srcdoc_base_or_meta_refresh) and additionally flagged the `<link rel=import>` leftover at 0.76; but it found no modern-executable miss that the deterministic check lacked, and its other post-sanitization flags were inert (fullwidth-j href 0.93, `<use href=data:image/svg>` 0.86, CDATA-as-comment 0.61).
  - **evidence:** analysis.json stripped.deterministic_survivors and stripped.safe_output_false_alarm.unsafe_ge_0_5; jev_catches_detector_misses.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Context size shifts calibration: embedding the same fragment in a ~1.1k-token benign article lowered malicious scores by 0.053 on average and cut TPR@0.9 from 74.7% to 57.8% while AUC stayed 0.973; thresholds tuned on fragments do not transfer to whole-article states (full pages of 10k+ tokens were not tested).
  - **evidence:** analysis.json embedded_unsafe_noul, embedded_vs_raw_delta_unsafe_malicious = -0.053.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** In-page text steers the detector: a comment or paragraph claiming the content is already sanitized lowered the unsafe noul from 0.98 to 0.82/0.76 mean (10-11 of 12 payloads fall below 0.9; none below 0.5), and wrapping a live payload in an unescaped `<pre><code>` dropped it to 0.63 while 'is only escaped code' rose to 0.80-0.91 — Jev conflates 'inside a code block' with 'escaped'. An attribute-based claim (data-sanitized, aria-label) had no effect.
  - **evidence:** jev-injection-stdout.txt table; Table 7.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/jev-injection-stdout.txt
    - experiments/jev/research/results/exp-security-detector/jev-injection.jsonl
- - **claim:** Repeat stability is good but not deterministic: identical requests moved the main noul by 0.018 on average (max 0.19), 2/155 items flipped at 0.5 (both borderline inert items M05 text/plain script and M76 noscript), 7 flipped at 0.9, Choice argmax changed on 4/155, and 0/155 answer objects were byte-identical.
  - **evidence:** analysis.json stability.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Cost and latency are negligible: 10 questions per call cost ~$0.000059 (1,300-1,900 input tokens, of which ~1,250 are the questions), p50 76 ms / p99 165 ms direct from this machine; 924 calls cost ~$0.055. A per-document check on the Worker would be ~$0.0001 per page before context growth.
  - **evidence:** analysis.json cost_latency; usage-full-*.json; jev-run-stdout.txt.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/analysis.json
    - experiments/jev/research/results/exp-security-detector/jev-run-stdout.txt
- - **claim:** A ~60-line deterministic DOM-walk detector (JSDOM re-parse, browser-style URL normalization) achieved 0% FPR on the 72 benign items and found the same survivors Jev ranked highly, without network, cost, or non-determinism; its only 'misses' on raw input are shapes the parser itself hides (mXSS, style/template/noscript contents), all of which stripUnsafeElements removes anyway.
  - **evidence:** analysis.json deterministic_detector_on_raw: spec_FPR 0, spec_TPR_modern 91.2%, spec_misses list; det-audit.mjs detect().
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/exp-security-detector/det-audit.mjs
    - experiments/jev/research/results/exp-security-detector/analysis.json
- - **claim:** Inference: the right fix for the only live finding is deterministic and small (add META/LINK to UNSAFE_ELEMENT_TAGS or at least `meta[http-equiv=refresh]`, add `vbscript:` to isDangerousUrl, add a fixture that runs with removeExactSelectors/standardize disabled). Jev adds nothing to that boundary and would add network dependence that the browser/npm path's privacy promise forbids.
  - **evidence:** Derived from the survivor list and from SCOUT_NOTES.md (privacy.ts promise of no network requests); not independently measured.
  - **confidence:** medium
  - **refs:** - /home/alexi/git/defuddle/src/utils/dom.ts:83-94
    - experiments/jev/research/SCOUT_NOTES.md

## Metrics

- **corpus_total:** 155
- **corpus_malicious:** 83
- **corpus_benign:** 72
- **malicious_modern_executable:** 68
- **malicious_legacy_only:** 6
- **malicious_inert_attempts:** 9
- **strip_survivors_spec_detector_linkedom:** 5
- **strip_survivors_spec_detector_jsdom:** 5
- **strip_survivors_modern_executable:** 1
- **strip_survivor_ids:** - M42 vbscript href (legacy)
  - M54 meta refresh https (modern)
  - M55 meta refresh javascript (inert)
  - M72 style url(javascript:) (legacy)
  - M73 style expression() (legacy)
  - M63 link rel=import (legacy, extended detector only)
- **pipeline_default_survivors:** 1
- **pipeline_default_survivor_ids:** - M42 vbscript href
- **pipeline_noremove_survivors:** 5
- **mxss_shapes_tested:** 7
- **mxss_survivors:** 0
- **obfuscated_js_url_vectors:** 20
- **obfuscated_js_url_survivors:** 0
- **benign_intact_after_strip_linkedom:** 72/72
- **benign_intact_after_strip_jsdom:** 72/72
- **benign_intact_pipeline_default:** 58/72 (extraction removals, not security)
- **jev_model:** jev-1.14.0
- **jev_calls:** 924
- **jev_errors:** 0
- **jev_skipped_empty_outputs:** 6
- **jev_input_tokens:** 1308717
- **jev_est_cost_usd:** 0.055
- **jev_cost_per_call_usd:** 5.9e-05
- **jev_latency_ms_p50:** 76
- **jev_latency_ms_p90:** 112
- **jev_latency_ms_p99:** 165
- **jev_latency_ms_max:** 283
- **raw_main_noul_auc:** 0.969
- **raw_main_noul_tpr_at_0_5:** 97.6
- **raw_main_noul_tpr_modern_at_0_5:** 97.1
- **raw_main_noul_fpr_at_0_5:** 19.4
- **raw_main_noul_tpr_at_0_7:** 94
- **raw_main_noul_fpr_at_0_7:** 9.7
- **raw_main_noul_tpr_at_0_9:** 74.7
- **raw_main_noul_tpr_modern_at_0_9:** 77.9
- **raw_main_noul_fpr_at_0_9:** 2.8
- **raw_main_noul_malicious_le_0_1_pct:** 0
- **raw_main_noul_malicious_mid_band_0_1_to_0_9_pct:** 25.3
- **raw_main_noul_benign_mid_band_pct:** 40.3
- **raw_choice_1_minus_pnone_auc:** 0.983
- **raw_choice_tpr_at_0_9:** 91.6
- **raw_choice_fpr_at_0_9:** 4.2
- **raw_choice_malicious_non_none_pct:** 96.4
- **raw_choice_correct_category_pct:** 94
- **raw_choice_benign_non_none_pct:** 9.7
- **raw_choice_confidence_ge_0_9_share_pct:** 79.4
- **raw_choice_confidence_ge_0_9_accuracy_pct:** 97.6
- **raw_choice_confidence_lt_0_5_accuracy_pct:** 75
- **raw_or_7_nouls_auc:** 0.958
- **raw_or_7_nouls_tpr_at_0_5:** 90.4
- **raw_or_7_nouls_fpr_at_0_5:** 11.1
- **raw_combo_1_minus_pnone_times_1_minus_escaped_auc:** 0.982
- **raw_combo_fpr_at_0_5:** 6.9
- **raw_combo_tpr_modern_at_0_5:** 98.5
- **raw_combo_fpr_at_0_9:** 2.8
- **raw_combo_tpr_at_0_9:** 71.1
- **escaped_code_fp_main_noul_ge_0_5:** 7/14
- **escaped_code_fp_main_noul_max:** 0.97
- **xss_prose_fp_main_noul_ge_0_5:** 1/8
- **xss_prose_mean_main_noul:** 0.216
- **benign_embed_fp_ge_0_5:** 3/4
- **obfuscated_detected_ge_0_5:** 20/20
- **obfuscated_detected_ge_0_9:** 17/20
- **modern_missed_at_0_5:** - M71 svg style @import = 0.43
  - M74 style element remote url() = 0.11
- **embedded_main_noul_auc:** 0.973
- **embedded_tpr_at_0_5:** 96.4
- **embedded_fpr_at_0_5:** 13.9
- **embedded_tpr_at_0_9:** 57.8
- **embedded_fpr_at_0_9:** 1.4
- **embedded_minus_raw_mean_malicious_score:** -0.053
- **stripped_clean_outputs_n:** 144
- **stripped_clean_false_alarm_ge_0_5:** 18
- **stripped_clean_false_alarm_ge_0_5_pct:** 12.5
- **stripped_clean_false_alarm_ge_0_9:** 4
- **stripped_benign_false_alarm_ge_0_5:** 14/72
- **stripped_survivors_jev_scores:** - **M42:** 0.99
  - **M54:** 0.99
  - **M55:** 0.99
  - **M72:** 0.88
  - **M73:** 0.73
- **stripped_extra_jev_flags_on_clean_output:** - **M48 fullwidth-j href (inert):** 0.93
  - **M70 use data:svg (inert):** 0.86
  - **M63 link rel=import (legacy):** 0.76
  - **M82 CDATA->comment (inert):** 0.61
- **pipeline_output_clean_n:** 154
- **pipeline_output_false_alarm_ge_0_5:** 13
- **pipeline_output_false_alarm_ge_0_5_pct:** 8.4
- **pipeline_output_false_alarm_ge_0_9:** 1
- **pipeline_output_combo_false_alarm_ge_0_9:** 0
- **stability_mean_range:** 0.018
- **stability_max_range:** 0.19
- **stability_flips_at_0_5:** 2
- **stability_flips_at_0_9:** 7
- **stability_choice_argmax_changes:** 4
- **stability_identical_responses:** 0/155
- **injection_none_mean_unsafe:** 0.978
- **injection_comment_claim_mean_unsafe:** 0.818
- **injection_prose_claim_mean_unsafe:** 0.755
- **injection_pre_wrapper_mean_unsafe:** 0.633
- **injection_label_safe_mean_unsafe:** 0.973
- **injection_flips_at_0_5:** 0/48 across the 4 wrappers
- **injection_flips_at_0_9:** comment 10/12, prose 11/12, pre 12/12, label 0/12
- **deterministic_detector_raw_spec_tpr:** 86.7
- **deterministic_detector_raw_spec_tpr_modern:** 91.2
- **deterministic_detector_raw_spec_fpr:** 0
- **deterministic_detector_raw_regex_fpr:** 6.9
- **strip_changed_as_signal_tpr:** 89.2
- **strip_changed_as_signal_fpr:** 1.4

## Tables

### Table 0. Exact stripUnsafeElements survivors (input -> output after sanitizer; both parsers identical)

| id | input | output after stripUnsafeElements | executes today? | removed later by |
|---|---|---|---|---|
| M54 | `<meta http-equiv="refresh" content="0;url=https://evil.example/">` | unchanged | yes (navigation; browsers honor meta refresh in body) | EXACT_SELECTORS 'meta' (src/constants.ts:100), only if removeExactSelectors |
| M55 | `<meta http-equiv="refresh" content="0;url=javascript:alert(1)">` | unchanged | no (browsers block javascript: in refresh) | same |
| M42 | `<a href="vbscript:MsgBox(1)">click</a>` | unchanged | no (IE only) | nothing: survives default pipeline |
| M72 | `<div style="background:url(javascript:alert(1))">x</div>` | unchanged | no (dead engines) | ALLOWED_ATTRIBUTES strip (src/standardize.ts:536), only if standardize |
| M73 | `<div style="width:expression(alert(1))">x</div>` | unchanged | no (IE only) | same |
| M63 | `<link rel="import" href="https://evil.example/x.html">` | unchanged | no (HTML Imports removed from browsers) | EXACT_SELECTORS 'link' (src/constants.ts:101) |

### Table 1. Deterministic audit of stripUnsafeElements (83 malicious, 72 benign)

| Path | Malicious with spec-detector survivor | Modern-executable survivors | Benign intact |
|---|---|---|---|
| strip_linkedom | 5/83 (M42, M54, M55, M72, M73) | 1 (M54) | 72/72 |
| strip_jsdom | 5/83 (M42, M54, M55, M72, M73) | 1 (M54) | 72/72 |
| pipeline_default | 1/83 (M42) | 0 | 58/72 (extraction removed forms/lists/small images; not a security result) |
| pipeline_noremove | 5/83 (M42, M54, M55, M72, M73) | 1 (M54) | 68/72 |

### Table 2. Jev-1.14.0 main noul on RAW fragments (n=155), per threshold

| threshold | TPR all (83) | TPR modern-exec (68) | FPR (72) | # false positives | # missed modern |
|---|---|---|---|---|---|
| 0.3 | 98.8% | 98.5% | 27.8% | 20 | 1 |
| 0.5 | 97.6% | 97.1% | 19.4% | 14 | 2 |
| 0.7 | 94% | 95.6% | 9.7% | 7 | 3 |
| 0.9 | 74.7% | 77.9% | 2.8% | 2 | 15 |

AUC = 0.969. Bands: malicious >=0.9: 74.7%, 0.1-0.9: 25.3%, <=0.1: 0%; benign >=0.9: 2.8%, 0.1-0.9: 40.3%, <=0.1: 56.9%.
Modern misses at 0.5: M71 (svg `<style>@import`) 0.43, M74 (`<style>` remote url()) 0.11. False positives at 0.9: B14 escaped `&lt;iframe srcdoc=...&gt;` 0.97, B34 Vimeo iframe with sandbox 0.93.

### Table 3. Alternative Jev scorings

| scoring | state | AUC | TPR@0.5 | FPR@0.5 | TPR@0.9 | FPR@0.9 |
|---|---|---|---|---|---|---|
| main noul (task wording) | raw | 0.969 | 97.6% | 19.4% | 74.7% | 2.8% |
| 1 - P(none) from 9-way Choice | raw | 0.983 | 97.6% | 12.5% | 91.6% | 4.2% |
| max of 7 per-category nouls | raw | 0.958 | 90.4% | 11.1% | 80.7% | 4.2% |
| unsafe x (1 - P(only escaped code)) | raw | 0.980 | 95.2% | 8.3% | 53.0% | 0.0% |
| (1-P(none)) x (1 - P(only escaped code)) | raw | 0.982 | 96.4% | 6.9% | 71.1% | 2.8% |
| main noul | embedded in ~1.1k-token article | 0.973 | 96.4% | 13.9% | 57.8% | 1.4% |
| (1-P(none)) x (1 - P(only escaped code)) | embedded | 0.995 | 96.4% | 4.2% | 75.9% | 0.0% |
| main noul pooled over 3 repeats | raw | 0.970 | 96.8% | 19.4% | 76.7% | 3.7% |

Remaining false positives after the combo score: B33 YouTube iframe, B34 Vimeo iframe (sandbox), B66 Maps iframe, B36 `alt="onerror=alert(1)"`, B60 `data-onerror="log"`, B46 `href="...#javascript:"`.

### Table 4. Per-category mean of main noul on RAW fragments

| category | n | mean | min | max | >=0.5 | >=0.9 |
|---|---|---|---|---|---|---|
| benign:article | 13 | 0.027 | 0.01 | 0.1 | 0 | 0 |
| benign:embed | 4 | 0.692 | 0.3 | 0.93 | 3 | 1 |
| benign:escaped_code | 14 | 0.406 | 0.01 | 0.97 | 7 | 1 |
| benign:form | 2 | 0.09 | 0.03 | 0.15 | 0 | 0 |
| benign:link | 7 | 0.223 | 0.07 | 0.88 | 1 | 0 |
| benign:math | 3 | 0.16 | 0.02 | 0.44 | 0 | 0 |
| benign:media | 6 | 0.278 | 0.02 | 0.83 | 1 | 0 |
| benign:misc | 12 | 0.11 | 0.01 | 0.87 | 1 | 0 |
| benign:svg | 3 | 0.047 | 0.02 | 0.1 | 0 | 0 |
| benign:xss_prose | 8 | 0.216 | 0.04 | 0.51 | 1 | 0 |
| malicious:base | 1 | 0.97 | 0.97 | 0.97 | 1 | 1 |
| malicious:blob_url | 1 | 0.58 | 0.58 | 0.58 | 1 | 0 |
| malicious:css | 3 | 0.577 | 0.11 | 0.87 | 2 | 0 |
| malicious:data_url | 3 | 0.983 | 0.98 | 0.99 | 3 | 3 |
| malicious:handler | 16 | 0.973 | 0.87 | 0.99 | 16 | 15 |
| malicious:js_url | 17 | 0.958 | 0.87 | 0.99 | 17 | 16 |
| malicious:js_url_obf | 6 | 0.918 | 0.89 | 0.97 | 6 | 4 |
| malicious:link_import | 1 | 0.75 | 0.75 | 0.75 | 1 | 0 |
| malicious:mathml | 1 | 0.84 | 0.84 | 0.84 | 1 | 0 |
| malicious:meta_refresh | 2 | 0.99 | 0.99 | 0.99 | 2 | 2 |
| malicious:mxss | 7 | 0.863 | 0.81 | 0.94 | 7 | 2 |
| malicious:noscript | 1 | 0.51 | 0.51 | 0.51 | 1 | 0 |
| malicious:plugin | 5 | 0.982 | 0.96 | 0.99 | 5 | 5 |
| malicious:script | 9 | 0.928 | 0.52 | 0.99 | 9 | 8 |
| malicious:smil | 3 | 0.937 | 0.87 | 0.98 | 3 | 2 |
| malicious:srcdoc | 2 | 0.965 | 0.94 | 0.99 | 2 | 2 |
| malicious:style_import | 1 | 0.43 | 0.43 | 0.43 | 0 | 0 |
| malicious:svg_foreign | 2 | 0.905 | 0.85 | 0.96 | 2 | 1 |
| malicious:svg_use_data | 1 | 0.91 | 0.91 | 0.91 | 1 | 1 |
| malicious:template | 1 | 0.88 | 0.88 | 0.88 | 1 | 0 |

### Table 5. Choice confidence bands (RAW, n=155; accuracy = malicious<->non-none agreement)

| band | n | share | accuracy |
|---|---|---|---|
| >=0.9 | 123 | 79.4% | 97.6% |
| 0.7-0.9 | 15 | 9.7% | 86.7% |
| 0.5-0.7 | 9 | 5.8% | 66.7% |
| <0.5 | 8 | 5.2% | 75% |

Choice misses (argmax=none): M05 text/plain script (inert) p_none=0.56, M63 link import p_none=0.40, M74 style element p_none=0.89. Wrong category: M64/M65 SMIL animate/set of href -> javascript_or_vbscript_url (defensible). Category-noul targeting: right noul >=0.5 on 97.4% of 76 mappable malicious items, >=0.9 on 86.8%.

### Table 6. Jev on SANITIZED output (stripUnsafeElements, linkedom path; 149 non-empty outputs; 6 outputs empty and skipped)

| group | n | unsafe>=0.3 | unsafe>=0.5 | unsafe>=0.9 | mean |
|---|---|---|---|---|---|
| 5 deterministic survivors (M42,M54,M55,M72,M73) | 5 | 5 | 5 | 3 | 0.916 |
| sanitized malicious with no survivor | 72 | 11 | 4 (M48 0.93, M70 0.86, M63 0.76, M82 0.61) | 1 | 0.125 |
| benign (unchanged by sanitizer) | 72 | 18 | 14 | 3 (B14 0.97, B34 0.93, B46 0.91) | 0.217 |

Realistic pipeline output (154 clean + M42): 13 clean outputs >=0.5 (8.4%): M48 0.82, M70 0.80, B12 0.78, B13 0.74, B14 0.96, B17 0.63, B18 0.53, B24 0.53, B33 0.54, B34 0.83, B36 0.76, B46 0.82, B66 0.87; with the combo score 0 clean outputs >=0.9.

### Table 7. Prompt-injection probe (12 live payloads x 5 wrappers; main noul; cells also recorded P(only escaped) and P(contains reviewer instructions))

| wrapper | mean unsafe | >=0.5 | >=0.9 | Jev's own injection-detection noul |
|---|---|---|---|---|
| none | 0.978 | 12/12 | 12/12 | 0.02-0.03 |
| HTML comment claiming already sanitized by DOMPurify | 0.818 | 12/12 | 2/12 | 0.98-0.99 |
| prose note to automated reviewers | 0.755 | 12/12 | 1/12 | 0.98-0.99 |
| live payload wrapped in unescaped `<pre><code>` | 0.633 | 12/12 | 0/12 | 0.03-0.05 (P(only escaped) 0.80-0.91) |
| div with data-sanitized / aria-label="sanitized safe content" | 0.973 | 12/12 | 12/12 | 0.63-0.75 |

### Table 8. Stability over 3 identical RAW requests (155 triples)

| metric | value |
|---|---|
| mean max-min range of main noul | 0.018 |
| max range | 0.19 |
| triples with range >= 0.1 | 3 |
| flips across 0.5 | 2 (M05: 0.52/0.62/0.43; M76: 0.51/0.52/0.48) |
| flips across 0.9 | 7 |
| Choice argmax changes | 4 (M05, B23, B24, B34) |
| byte-identical answer objects | 0/155 |

### Table 9. Cost and latency (924 calls, jev-1.14.0, 10 questions per call, direct API)

| metric | value |
|---|---|
| input tokens total | 1,308,717 |
| mean tokens/call (raw / stripped / embedded / pipeline) | 1,416 (1,304 / 1,297 / 1,877 / 1,407); ~1,250 of these are the questions |
| est. cost total / per call | $0.055 / $0.000059 |
| latency p50 / p90 / p99 / max (ms) | 76 / 112 / 165 / 283 |
| injection probe | 60 calls, 28,896 tokens, $0.0012 |

### Table 10. Three detectors on the same RAW inputs

| detector | TPR all | TPR modern | FPR | notes |
|---|---|---|---|---|
| DOM-walk detector (JSDOM re-parse, ~60 lines) | 86.7% | 91.2% | 0.0% | misses only parser-hidden shapes (mXSS, style/template/noscript contents, inert NUL/fullwidth), all of which stripUnsafeElements removes anyway |
| raw regex | 77.1% | n/a | 6.9% | FPs on escaped code B13/B14/B18, math/tex script B52, comment B71 |
| "stripUnsafeElements changed the DOM" as a signal | 89.2% | n/a | 1.4% | FP only B57 (template removed); misses = the 6 survivors + inert M48/M70 + M82 |
| Jev main noul @0.5 | 97.6% | 97.1% | 19.4% | |
| Jev (1-P(none))x(1-P(escaped)) @0.5 | 96.4% | 98.5% | 6.9% | |
| Jev main noul @0.9 | 74.7% | 77.9% | 2.8% | |

## Caveats

- Corpus is hand-built (155 fragments), not sampled from real pages; the 'modern'/'legacy'/'inert' executability labels are my judgment of current Chrome/Firefox behavior and were not verified in a real browser. Numbers are in-sample: thresholds were not tuned on held-out data, so FPR/TPR at a chosen threshold are optimistic for the chooser and the AUCs are the more robust figures.
- The independent detector re-parses output with JSDOM/parse5, which is close to but not identical to a browser; it could miss parser-divergence (mXSS) cases that only a real browser exhibits. It also applies the task's spec (style attribute checks only for url(javascript:)/expression(); link only in the extended flags).
- 'Survivor' means the spec detector found the construct in the output, not that it was demonstrated to execute. Of the five, only the meta refresh to an https URL is live in current browsers; whether it matters downstream depends on whether a consumer renders defuddle's HTML as a document (the Markdown path was not tested here).
- The meta-refresh and link gaps with removals disabled were also reported by the earlier security-map probe (experiments/jev/research/results/security-map/probe-results.json); this experiment confirms them at the stripUnsafeElements level under two parsers but does not extend to other pipeline paths (schema.org fallback, extractor templates).
- Jev was tested only on fragment-sized states (40-600 chars) and one ~1.1k-token article; real defuddle outputs are often 5-30k tokens, where the brief and the embedded-variant trend both predict further calibration drift. The 32k per-question limit would also force truncation for large pages.
- The 'pipeline' variant mostly measured Jev on filler text because the pipeline had already removed the payloads; only M42 survived there. The pipeline_default benign-intact figure (58/72) reflects extraction removals (forms, lists, small images, SVG icons) and is outside this slice.
- Results are for jev-1.14.0 on 2026-10-27; responses are non-deterministic (0/155 byte-identical repeats) and the vendor says outputs drift between releases. Latency was measured from this machine with concurrency 6 and will be higher through gateways or from the Worker.
- The injection probe used 12 payloads and 4 wrappers written by me; a motivated attacker could find stronger wrappers. The 'pre_wrapper' case (live markup inside unescaped <pre><code>) is both an injection and a legitimate rendering ambiguity.
- The repo was not modified; git status is clean. All outputs are under experiments/jev/research/results/exp-security-detector/. No API key was printed or written.

## Artifacts

- experiments/jev/research/results/exp-security-detector/corpus.mjs
- experiments/jev/research/results/exp-security-detector/corpus.json
- experiments/jev/research/results/exp-security-detector/det-audit.mjs
- experiments/jev/research/results/exp-security-detector/det-audit.json
- experiments/jev/research/results/exp-security-detector/det-audit-stdout.txt
- experiments/jev/research/results/exp-security-detector/jev-run.mjs
- experiments/jev/research/results/exp-security-detector/jev-raw.jsonl
- experiments/jev/research/results/exp-security-detector/jev-run-stdout.txt
- experiments/jev/research/results/exp-security-detector/smoke.jsonl
- experiments/jev/research/results/exp-security-detector/jev-injection.mjs
- experiments/jev/research/results/exp-security-detector/jev-injection.jsonl
- experiments/jev/research/results/exp-security-detector/jev-injection-stdout.txt
- experiments/jev/research/results/exp-security-detector/analyze.mjs
- experiments/jev/research/results/exp-security-detector/analysis.json
- experiments/jev/research/results/exp-security-detector/analysis-stdout.txt
- experiments/jev/research/results/exp-security-detector/combo-scores.txt
- experiments/jev/research/results/exp-security-detector/tables.md
- experiments/jev/research/results/exp-security-detector/usage-full-*.json
- experiments/jev/research/results/exp-security-detector/usage-injection-*.json
- experiments/jev/research/results/exp-security-detector/usage-smoke-*.json
