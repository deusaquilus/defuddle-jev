# Jev document evidence extraction: what the three Jev docs do and do not support for a 99.99%-reliable Defuddle sanitizer/clutter-remover

_Verbatim final report of the phase-1 workflow agent `jev-evidence` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

I read SCOUT_NOTES.md, EXPERIMENT_RULES.md and all three Jev documents (JEV_AGENT_BRIEF.md, 437 lines; JEV_ECOSYSTEM_EXCERPTS_1.md, 67 lines; JEV_ECOSYSTEM_EXCERPTS_2.md, 57 lines) end to end, made no API calls, and extracted every number bearing on topics (a)-(k) into a 106-row evidence table (experiments/jev/research/results/doc-evidence/evidence_table.tsv) with a vendor-vs-independent flag and file:line references. I also computed, in experiments/jev/research/results/doc-evidence/page_level_math.csv, how per-block accuracies compound into page-level reliability, because Defuddle's unit of correctness is a whole page (byte-equal expected Markdown), not a single decision.

Measured facts: on text-readable classification Jev sits 3-6 points below frontier LLMs (Banking77 81.0% vs 84.4%, n=3,080; Jev-as-a-Judge within 3 points of GPT-6 "where the verdict can be read from the text"); the closest analogs to a "keep this block?" Noul score SMS spam F1 0.91, AG News 86.6%, relevance 74%, Noul soft accuracy 0.918. The best filtered bands are 96.3% at confidence >= 0.99 (58% coverage, Banking77) and "<1%" error above 0.8 in pi-warden's 15,346 production judgments; yet Du et al. found 102 errors among 1,819 decisions at probability exactly 1.0 (5.6%). Calibration is good pooled (ECE 0.047) but bad per task (median ECE 0.168; F1-optimal Noul threshold median 0.35, not 0.5). Determinism: none (no seeds; 0.04 mean probability movement; 12% chosen-option flips; jgrep 128/150 identical across uncached reruns; jev-latest drifts; pinned versions get 30 days' deprecation notice; the local smoke files show confidence 1.0 on 1.13.0 vs 0.99 on 1.14.0 for an identical state). Security: injection flips 93.5-100% of routing decisions on the official API, one appended opinion flips 12.1% and pushes 38% of confident answers below 0.8, a browser agent clicked a planted ad 91% of the time, a toxicity filter was bypassed by respelling, and attacked decisions are as confident as clean ones; the docs' unanimous conclusion is "argued input", "never the sole gate", "confidence is not authorization". Context is 32k tokens per question / 64k per request (262k mode "slower and less accurate"); accuracy loss from irrelevant state is acknowledged but unquantified. Cost is $0.042/M input tokens (~$0.0004 per 10k-token page); latency 100-800 ms depending on hop count; signups were paused Sept 22; data is US-hosted, ZDR only for enterprise, and an Oct 24 leak exposed customers' Noul outputs. Official SDKs are Python/JS only, there is no browser-safe mode, and the only DOM-element precedents (typesafe-adblock, unclutter, jev-ultrafast, Hide posts on X) publish zero accuracy figures.

Implication for the Jev question: no number in the documents comes within two orders of magnitude of 99.99% per decision; the best measured bands are 100x-561x the 1e-4 error target, and those are per-item. At the page level, 96.3% per block gives a 15% chance that a 50-block page is fully correct, 99% gives 60.5%, and 99.99% page-level reliability would require 99.9998% per block. For Defuddle's meaning A (security sanitization) the docs forbid the use outright: every guard author disclaims boundary status and the recommended architecture is a deterministic validator the model cannot override, which is exactly what `stripUnsafeElements`/`isDangerousUrl` already are. For meaning B (clutter removal) the evidence supports a narrow, asynchronous, threshold-tuned, cached, shadow-mode tie-breaker for ambiguous blocks in the Node/Worker paths (where the Workers AI binding with ZDR exists), not an aggressive replacement of the heuristic pipeline, and never in the synchronous, no-network, logged-in-page browser extension path.

## Verdict for this dimension

The documents contain no evidence that Jev can make either meaning of Defuddle "sanitization" ~99.99% reliable. For deterministic security sanitization (A) the docs are unanimous and prohibitive: state is "argued input", injection succeeds 93.5-100% of the time, guards fail open 93-100% under misleading labels, confidence is not authorization, and the recommended design is a deterministic validator the model cannot override, which Defuddle already has. For heuristic clutter removal (B) the best analogous measurements put a zero-shot "keep this block?" Noul at roughly 85-92% per block, ~93-97% after threshold tuning on Defuddle's labeled fixtures, and ~96-99% inside a high-confidence band covering ~58-76% of blocks; even the p=1.0 band carries 5.6% error in one study, outputs flip on ~12% of repeats with no seeds and 30-day version deprecation, and no DOM-element precedent publishes any accuracy. Compounded over tens of blocks per page, 99%-per-block yields ~60% fully-correct pages and 99.99% page-level would need 99.9998% per block, two to three orders of magnitude beyond any number in the docs. The evidence therefore supports, at most, a cautious use: an asynchronous, version-pinned, cached, shadow-mode, threshold-tuned tie-breaker for ambiguous blocks in the Node/Worker paths (Workers AI binding with ZDR), with the deterministic sanitizer and the existing heuristics retained as the decision of record. Aggressive use is contradicted by every production precedent, and the browser-extension path is excluded by the synchronous API, the no-network privacy promise, key exposure, and the Oct 24 output leak.

## Findings

- - **claim:** No number in the three Jev documents supports 99.99% per-decision reliability; the best measured filtered bands are 100x to 561x the 1e-4 error target, and even probability-1.0 outputs carried 5.6% error in one study.
  - **evidence:** conf >= 0.99 band: 96.3% accurate on 58% of Banking77 (EXC1 L66; BRIEF L179) = 370x; pi-warden '<1%' wrong above 0.8 on 15,346 calls (EXC1 L67) = >=100x; Du et al. 102 errors in 1,819 decisions at p=1 (EXC1 L33) = 561x; Noul soft accuracy 0.918 (BRIEF L181) = 820x. Vendor's own docs: calibration 'does not guarantee that any single answer is correct' (EXC1 L19).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:33
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:66-67
    - experiments/jev/research/JEV_AGENT_BRIEF.md:179-181
    - experiments/jev/research/results/doc-evidence/page_level_math.csv
- - **claim:** Page-level correctness compounds per-block errors: at 50 block decisions per page, 96.3% per block yields 15.2% fully-correct pages, 99% yields 60.5%, and a 99.99% page-level target requires 99.9998% per block (computed; assumes independent errors).
  - **evidence:** python computation in page_level_math.csv: 0.963^50=0.1518, 0.99^50=0.605, 0.999^50=0.951; required per-block for page target 0.9999 at N=10/20/50/100 = 0.99999/0.999995/0.999998/0.999999. Defuddle's unit of test is a byte-equal page (SCOUT L11).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/doc-evidence/page_level_math.csv
    - experiments/jev/research/SCOUT_NOTES.md:11
- - **claim:** By analogy, a zero-shot 'keep this block?' Noul could plausibly reach ~85-92% per-block accuracy at a default threshold, ~93-97% after threshold tuning and multi-Noul decomposition, and ~96-99% inside a high-confidence band covering roughly 58-76% of blocks; the remainder would still need the existing heuristics.
  - **evidence:** SMS spam F1 0.91 (P 0.87/R 0.95, n=5,574) (EXC1 L61); AG News 86.6% (n=7,600) (EXC1 L61); relevance 74% on 2,380 labels (EXC1 L65); Jev-as-judge within 3 pts of GPT-6 where verdict readable (EXC1 L59); Banking77 81.0% (EXC1 L7). Tuning on 10 labels F1 0.706->0.793 (EXC1 L60); UNFAIR-ToS 0.50->0.75 (EXC1 L51); phishing 62.6%->95.0% with 5 Nouls + LR on 1,000 labels (EXC1 L62); option-wise Nouls retain 97.0% vs Choice 79.4% at 0.90 (BRIEF L326). Bands: 96.3%@>=0.99 on 58%; cascade@0.90 handles 75.9% (EXC1 L66). This is inference by analogy, not a measurement on DOM blocks.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:59-66
    - experiments/jev/research/JEV_AGENT_BRIEF.md:326
- - **claim:** Confidence is a deterministic transform of the distribution, not a correctness estimate; Noul has no confidence field; the 0.5 default is wrong per task and per-task calibration is poor, so any Defuddle threshold must be tuned on its own labeled blocks and re-audited per version.
  - **evidence:** Choice confidence = (p_max-1/n)/(1-1/n); Noul: docs suggest |2p-1|, starting 0.7/0.3 [vendor] (BRIEF L169-173). Median F1-optimal Noul threshold 0.35 across 31 benchmarks (BRIEF L177). Pooled ECE 0.047 vs median per-benchmark 0.168, range 0.003-0.28 (BRIEF L180). In-sample thresholds targeting 5% FNR miss up to 17% held-out (EXC2 L19). 'I Guessed My Jev Threshold. It Threw Away a Third of the Good Pages' (EXC2 L39). P(X)+P(not X) off by 0.064 (EXC1 L48).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:169-183
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:47-51
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:19,39
- - **claim:** The three-band cascade (auto-act / cautious / route elsewhere) is the most reproduced pattern, but its measured ceiling is small and it requires an independent second judge; in Defuddle that second judge would be the existing deterministic heuristics or a human-reviewed fixture, not another flash LLM.
  - **evidence:** Banking77 cascade at 0.90: Jev handles 75.9%, 84.0% overall vs Opus alone 84.4%, ~28% of cost (EXC1 L66; BRIEF L341). Flash-tier LLM judges repeat >85% of Jev's most confident errors; cascades gain <=2.7 pts even with oracle thresholds (EXC1 L52). TypeSafe's worked examples use >=0.9 for high-stakes auto-actions and a 0.5 floor [vendor] (BRIEF L183).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:183,341
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:52,66
- - **claim:** Jev is non-deterministic and version-drifting, so a byte-exact 226-fixture suite can only be reproducible against a recorded response cache, which tests the cache rather than the model; Defuddle's CI is network-disabled anyway.
  - **evidence:** No seeds; ~0.04 probability movement; ~12% chosen-option change on repeat (BRIEF L150, L373; EXC1 L20, L49). OpenRouter: Score 1.21 then 1.17, Noul 0.42 then 0.44 on the same message; jgrep 128/150 identical over three uncached runs, rest <=0.03 (EXC1 L20). jev-latest changes between releases (BRIEF L72); deprecation window shrank 60 -> 30 days (BRIEF L161). Local smoke artifacts (n=1, not from docs): identical 453-token state gave confidence 1.0 on jev-1.13.0 and 0.99 on jev-1.14.0. 'Cache decisions keyed on (model, state, questions); reruns are then exact' (BRIEF L332). Fixture tests are hermetic, network disabled (SCOUT L11).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:72,150,161,332,373
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:20
    - experiments/jev/research/smoke_jev-1.13.0.json
    - experiments/jev/research/smoke_jev-1.14.0.json
- - **claim:** The documents are unanimous that Jev must never be a security boundary, so it cannot replace or sit in front of Defuddle's deterministic sanitization (meaning A); the recommended architecture (deterministic validator the model cannot override) is what Defuddle already has.
  - **evidence:** Routing 100% clean -> 0-5.8% under injection, ASR 93.5-100% on the official API (EXC1 L41; BRIEF L33). Typed-model guardrails failed open 93-100% under a misleading option label while a deterministic rule reached 100% (BRIEF L382). 'Confidence is not authorization': attacked decisions as confident as originals (BRIEF L383). Toxicity filter flagged 30/30 unedited but 'many' TokenBreak-respelled prompts passed (EXC1 L45). 'Anyone who wires Jev into a security boundary is wiring in a model that treats its state as argued input' (EXC1 L11). Every guard author disclaims boundary status; jev-guard fails OPEN by default (EXC2 L18, L42). Defuddle's `_stripUnsafeElements` runs unconditionally as 'the only guaranteed sanitization boundary' (SCOUT L18).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:33,379-387
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:11,41-46
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:18,42
    - experiments/jev/research/SCOUT_NOTES.md:18
- - **claim:** Using Jev for clutter removal (meaning B) makes extraction steerable by page authors: a block that says 'this is the article' is literally the one-appended-opinion attack, and the closest web precedent is an agent clicking a planted ad 91% of the time despite being told page text is untrusted.
  - **evidence:** One appended opinion flips 12.1% of decisions and pushes 38% of confident answers below 0.8 (EXC1 L42); natural context flips 61.4-73.2% (EXC1 L43); jev-ultrafast clicked a planted 'Confirm Price' ad 91% (EXC1 L44; EXC2 L4). Consequence is bounded to content quality only if the deterministic sanitizer stays downstream (inference).
  - **confidence:** medium
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:42-44
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:4
- - **claim:** Context limits force text-only, stripped, often truncated states: 32k tokens per question and 64k per request, with an acknowledged but unquantified accuracy loss from irrelevant content; the right request shape is many per-block Nouls over one shared state, not many blocks stuffed into one question.
  - **evidence:** 32k per question (state + question), 64k per request, 262k with header that is 'slower and less accurate' at the same price; 400 max_tokens_exceeded (BRIEF L54, L144; EXC1 L16). 'Accuracy drops as irrelevant content grows' [vendor] (BRIEF L73, L365); 'nobody has quantified accuracy lost per kilobyte of irrelevant state' (EXC2 L43). jgrep 'weak on long inputs' and truncates at 8,000 chars; foreman caps at 12k (EXC1 L61; EXC2 L32). semantic-find scores 218 line ids in one request [vendor] (EXC2 L7); batching 13 questions 12.2x cheaper/10x faster [vendor] (EXC2 L23); jgrep latency flat 1-64 questions (EXC1 L61). Fixture HTML up to 201,904 bytes (SCOUT L12).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:54,73,144,328,365
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:7,23,32,43
    - experiments/jev/research/SCOUT_NOTES.md:12
- - **claim:** Cost is negligible but latency is incompatible with Defuddle's synchronous browser API; only the async Node/Worker paths could call Jev, and the Worker could use the Cloudflare Workers AI binding (jev-1.13.0, ZDR).
  - **evidence:** $0.042/M input, output free; 447-token 3-question call ~ $0.000019 (BRIEF L149; EXC1 L18) -> ~$0.0004 per 10k-token page if the shared state is billed once (inference from vendor '12.2x cheaper' batching claim). Latency: p50 126.81-175 ms direct short; p95 270 / p99 353 ms at 2,605 tokens; 315-524 ms with a few k tokens or one gateway; 580-800 ms two hops; 'under 100 ms' press claim unsupported (EXC1 L55-56). Browser parse() is synchronous (SCOUT L10). Workers AI env.AI.run('typesafe/jev') returns jev-1.13.0, ZDR 'Yes', $0.042 (BRIEF L303; EXC1 L21). Defuddle Worker charges $0.003-0.005/request (SCOUT L6).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:149,303
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:18,21,55-56
    - experiments/jev/research/SCOUT_NOTES.md:6,10
- - **claim:** Availability is fragile: direct signups paused, rate limits are the CEO's stated 'main worry', 429/529 are expected, and there is no browser-safe mode (a shipped key is exposed), so the browser extension cannot call Jev directly.
  - **evidence:** Signups paused Sept 22; $5 credit ~120M tokens (BRIEF L57; EXC1 L17). Community-cited limits 250,000 tokens/s and 1,200 req/min; 429/529 retried by SDKs (BRIEF L147-148). Official SDKs Python/JS only (BRIEF L189). jev4k README: key exposed in a browser (EXC1 L24). Defuddle: zero deps, 92 KB gzip budget (SCOUT L9).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:57,147-148,189
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:17,24
    - experiments/jev/research/SCOUT_NOTES.md:9
- - **claim:** Privacy facts exclude the browser extension path and complicate the Worker path: US hosting, ZDR only for enterprise, an Oct 24 2026 leak of every customer's Noul outputs, and Defuddle's own promise that the npm package and extension make no network requests while running on logged-in pages.
  - **evidence:** No training on user data; ZDR via enterprise sales; US-hosted (BRIEF L151, L387; EXC1 L22). Oct 24 leak disclosed by CEO, no postmortem, IDOR-class inferred (EXC1 L22; BRIEF L385). Attribute inference 100% from labels alone (EXC1 L46). Gateway ZDR: Workers AI 'Yes', Vercel per-request flags (BRIEF L296, L303). privacy.ts promise and Gmail extractor (SCOUT L8, L42).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:151,296,303,385-387
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:22,46
    - experiments/jev/research/SCOUT_NOTES.md:8,42
- - **claim:** Every precedent that judges DOM elements or web content publishes no accuracy number; the only measured web-page outcomes in the docs are failures.
  - **evidence:** typesafe-adblock (81 stars): 'No accuracy figures published' (EXC2 L5); unclutter, Hide posts on X, Doomscroll Filter: 'no measured accuracy' (EXC2 L6); jev-ultrafast: 'three repeats of one task, not a reliability benchmark', 91% ad click (EXC2 L4); no WebArena/OSWorld score for any harness (EXC2 L13); guessed threshold threw away a third of good pages (EXC2 L39); pi-warden relevance compaction kept 1 of 34 files and did not ship (EXC2 L16). Positive vendor demos only: semantic-find 218 line ids, RAG cookbook 'a filter, not a security boundary' (EXC2 L7-8).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:4-8,13,16,39
- - **claim:** Jev is not uniquely capable: open models at or above ~4B parameters match or beat it on the same wire protocol, including options deployable on Workers AI or locally, while sub-500M encoders are useless zero-shot but become useful if fine-tuned in-domain (which Defuddle's 226 expected outputs could seed).
  - **evidence:** JevBench ranks Jev 1.13 #26, 1.14 #31; Decision Index #43; untuned Gemma 4 31B 79.6 vs Jev 80.1 (BRIEF L393, L406; EXC1 L10). H2O-Lightning-4B Apache-2.0, 29 ms/decision, beats 1.13 (EXC2 L52). Clef on Workers AI @cf/cloudflare/clef $0.24/M; pplx-decider $0.02/M, 'best calibration among hosted' [vendor]; Ollaya local ECE 0.022 vs raw softmax 0.115 but 314 ms-62 s on CPU (EXC2 L51-52). Laya 421M / GLiNER2.5 340M ~0 chance-corrected zero-shot; Laya fine-tuned 0.362->0.766 and 44%->69%; 33 ms T4, 7.2 ms batched; laya-ts/receptron/edgejev/SemIf WebGPU exist (EXC2 L53). Quantization below Q8 costs 1-4 pts (EXC2 L54). Together $17/25-min Qwen3.5-4B fine-tune (EXC2 L45).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md:393-408
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:45,51-54
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:10
- - **claim:** Strongest PRO-Jev evidence for clutter classification: Defuddle's known false positives are semantic misreads of prose (navigation words inside paragraphs), which is exactly the text-readable judgment where Jev is within 3 points of frontier LLMs at ~$0.0004/page, dozens of block questions per call are near-free, and thresholds can be tuned from Defuddle's existing labeled outputs.
  - **evidence:** Scoring removes prose that merely contains words like 'privacy'/'share' (#112) and hand-maintained word/regex lists (SCOUT L33, L47). Jev-as-judge within 3 pts where verdict readable (EXC1 L59); spam F1 0.91, AG News 86.6% (EXC1 L61); 97.0% retained with option-wise Nouls at 0.90 (BRIEF L326); 10-label tuning +8.7 F1 (EXC1 L60); batching 218 questions over one state [vendor] (EXC2 L7); 'model output never becomes selectors' pattern in jev-ultrafast matches Defuddle's code-owns-candidates architecture (EXC2 L4); Workers AI ZDR binding (BRIEF L303).
  - **confidence:** medium
  - **refs:** - experiments/jev/research/SCOUT_NOTES.md:33,47
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:59-61
    - experiments/jev/research/JEV_AGENT_BRIEF.md:303,326
- - **claim:** Strongest ANTI evidence: many of Defuddle's removal decisions depend on facts not literally present in block text (hidden styles, image pixel size, link density, position relative to h1, word counts), which the docs say Jev cannot compute or simulate; those facts would have to be precomputed in code, which is what the existing pipeline already does.
  - **evidence:** 'Jev evaluates what is in the state; it does not simulate what is absent' (EXC2 L34); counting/arithmetic collapse: MathQA 17.7 pts below, numeric packet features 28.42% vs RF 69.95% (BRIEF L362; EXC2 L25); 'Nothing numeric, temporal, or counted is left for the model to compute' checklist (BRIEF L416); compute-facts-then-judge gains chess 35%->5-9% (BRIEF L346). Defuddle steps 5-6 and 9 use measured sizes, computed styles, link density and word counts (SCOUT L29-33).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:25,34
    - experiments/jev/research/JEV_AGENT_BRIEF.md:346,362,416
    - experiments/jev/research/SCOUT_NOTES.md:29-33
- - **claim:** Vendor-origin facts in the docs that should not be treated as independent measurements: pricing ($0.042/M, no pricing page, possibly subsidized), the 193.6x/444.6x speed-cost multipliers, 'under 100 ms', the 12.2x-cheaper batching claim, the confidence formulas and 0.7/0.3 and >=0.9/0.5 thresholds, the jaggedness failure list, the no-training/ZDR/US-hosting policy, context limits and the '262k is slower and less accurate' admission, 30/60-day deprecation promises, Workers AI ZDR 'Yes' and Clef/pplx-decider/H2O/Torchcast/Together numbers (third-party vendors), the semantic-find/RAG/citation/reranking cookbook results, 1.14's 'subtle improvements', and first-option bias.
  - **evidence:** Flags: EXC1 L9 ('193.6x faster, 444.6x cheaper' from vendor workflows vs LLM consensus labels; user medians 7x/30x); EXC1 L18 ('cannot prove pricing is not subsidized'); BRIEF L12 and EXC1 L56 ('under 100 ms' not supported by any independent measurement); EXC2 L23 ([vendor] batching); BRIEF L169-173, L183 (confidence page, concept page); BRIEF L357 (jaggedness list, 'each confirmed in the field'); BRIEF L151 (legal page); BRIEF L54, L144 (models page); BRIEF L161; BRIEF L303, L399-405; EXC2 L7-9; BRIEF L160, L368 [vendor]. Rate-limit figures (250k tokens/s, 1,200 rpm) are community-cited, not vendor-published (BRIEF L147).
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md:9,18,56
    - experiments/jev/research/JEV_AGENT_BRIEF.md:12,54,144,147,151,160-161,169-183,303,357,368,399-405
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md:7-9,23

## Metrics

- **banking77_jev_1_13_acc:** 0.81
- **banking77_opus5_acc:** 0.844
- **banking77_n:** 3080
- **banking77_p50_ms_jev:** 175
- **banking77_p50_ms_opus:** 2266
- **banking77_cost_usd_jev:** 0.34
- **banking77_cost_usd_opus:** 7.44
- **deusser_requests:** 346009
- **deusser_datasets:** 37
- **deusser_easy_range:** 95-99%
- **deusser_mmlu:** 0.918
- **deusser_emotion:** 0.585
- **deusser_goemotions_macro_f1:** 0.243
- **deusser_legal_clause_f1:** 0.204
- **judge_gap_vs_gpt6_points:** 3
- **judge_median_s:** 0.15
- **sms_spam_f1:** 0.91
- **sms_spam_precision:** 0.87
- **sms_spam_recall:** 0.95
- **sms_spam_n:** 5574
- **agnews_acc:** 0.866
- **agnews_n:** 7600
- **relevance_acc_distil:** 0.74
- **relevance_n:** 2380
- **guo_median_auroc:** 0.886
- **guo_f1_before_after_10_labels:** 0.706 -> 0.793
- **phishing_1q_vs_5q_lr:** 62.6% -> 95.0%
- **optionwise_nouls_vs_choice_at_0_90:** 97.0% vs 79.4%
- **conf_ge_0_99_coverage:** 0.58
- **conf_ge_0_99_acc:** 0.963
- **conf_lt_0_50_coverage:** 0.035
- **conf_lt_0_50_acc:** 0.296
- **cascade_0_90_jev_share:** 0.759
- **cascade_0_90_overall_acc:** 0.84
- **cascade_cost_fraction_of_opus:** 0.28
- **cascade_gain_ceiling_points:** 2.7
- **flash_judge_repeat_confident_errors:** >85%
- **pi_warden_n:** 15346
- **pi_warden_err_below_0_8:** 0.15
- **pi_warden_err_above_0_8:** <0.01
- **pi_warden_replays:** 18075
- **pi_warden_held_at_0_7:** 0.0027
- **errors_at_p_equal_1:** 102/1819 = 5.6%
- **zero_prob_on_true_answer:** 0.062
- **noul_soft_acc:** 0.918
- **score_soft_acc:** 0.886
- **choice_soft_acc:** 0.764
- **ece_pooled:** 0.047
- **ece_median_per_benchmark:** 0.168
- **ece_range:** 0.003-0.28
- **f1_optimal_noul_threshold_median:** 0.35
- **held_out_fnr_miss_at_5pct_target:** up to 17%
- **coherence_miss:** 0.064
- **ordinal_vs_nominal_macro_acc:** 37.67% vs 84.39%
- **abstention_penalty_points:** -11.4 to -12.0
- **repeat_prob_movement:** 0.04
- **repeat_choice_flip_rate:** 0.12
- **jgrep_identical_reruns:** 128/150
- **jgrep_rerun_movement:** <=0.03
- **argmax_flip_on_option_reversal:** 0.018
- **prob_shift_on_reversal_points:** 34
- **deprecation_notice_days:** 60 (1.13) -> 30 (1.14)
- **injection_asr:** 93.5-100%
- **routing_acc_under_injection:** 0-5.8%
- **one_opinion_flip:** 0.121
- **one_opinion_confident_pushed_below_0_8:** 0.38
- **natural_context_flip:** 61.4-73.2%
- **planted_ad_click_rate:** 0.91
- **toxicity_filter_unedited_caught:** 30/30
- **guardrail_fail_open_under_misleading_label:** 93-100%
- **attribute_inference_acc:** 1
- **context_per_question_tokens:** 32000
- **context_per_request_tokens:** 64000
- **long_context_tokens:** 262000
- **body_limit_mib:** 32
- **jgrep_truncate_chars:** 8000
- **semantic_find_questions_per_request:** 218
- **price_usd_per_M_input:** 0.042
- **price_output:** 0
- **cost_3q_447_token_call_usd:** 1.9e-05
- **cost_per_million_300_token_lines_usd:** 13
- **est_cost_per_10k_token_page_usd:** 0.00042
- **latency_p50_direct_ms:** 126.81-175
- **latency_p95_ms:** 270
- **latency_p99_ms:** 353
- **latency_few_k_tokens_ms:** 315-524
- **latency_two_hops_ms:** 580-800
- **rate_limit_tokens_per_s_community:** 250000
- **rate_limit_rpm_community:** 1200
- **signups_paused_since:** 2026-09-22
- **leak_disclosed:** 2026-10-24
- **openrouter_requests_per_week:** 1.36B
- **jevbench_rank_1_13:** 26
- **jevbench_rank_1_14:** 31
- **decision_index_rank_1_14:** 43
- **gemma4_31b_untuned_vs_jev:** 79.6 vs 80.1
- **open_model_size_floor_params:** ~4B
- **laya_finetune_gain:** 0.362 -> 0.766; 44% -> 69%
- **ollaya_cpu_latency_5q:** 314 ms - 62 s
- **ollaya_gpu_latency_5q:** 14 ms - 1.0 s
- **dom_precedents_with_published_accuracy:** 0
- **page_ok_prob_N50_at_0_963:** 0.1518
- **page_ok_prob_N50_at_0_99:** 0.605
- **page_ok_prob_N50_at_0_999:** 0.9512
- **required_per_block_for_0_9999_page_N50:** 0.999998
- **required_per_block_for_0_9999_page_N10:** 0.99999
- **error_multiple_vs_1e-4_best_bands:** 100x (pi-warden >0.8) to 561x (p=1 band)
- **smoke_version_drift_local_n1:** same 453-token state: 1.13.0 confidence 1.0 / navigation 1.0; 1.14.0 confidence 0.99 / navigation 0.99, promo 0.01
- **defuddle_fixtures:** 226
- **defuddle_worker_price_per_request_usd:** 0.003-0.005
- **defuddle_bundle_budget_gzip_kb:** 92

## Tables

## (a) Accuracy on text-readable classification

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Gap to frontier LLMs on text-readable classification | 3-6 points below; collapses on arithmetic/dates/counting/multi-step | Brief synthesis | independent (synthesis) | BRIEF L13 |
| Banking77 (77 intents, n=3,080) | Jev 1.13 81.0% vs Claude Opus 5 84.4% | OpenRouter | independent | EXC1 L7 |
| Deusser 37 datasets, 346,009 requests | 95-99% IMDB/SST-2/HellaSwag/ARC; MMLU 91.8% | Deusser et al. | independent | EXC1 L8 |
| Deusser weak sets | Emotion 0.585; SST-5 0.579; GoEmotions macro-F1 0.243; legal clause F1 0.204 | Deusser et al. | independent | EXC1 L8; BRIEF L374 |
| Jev-as-a-Judge vs GPT-6 | within 3 pts "where the verdict can be read from the text"; 0.15 s median; 0.36% of fee; cascade +0.9 at 41% cost | Li, Miao, Krishnan, Padman | independent | EXC1 L59 |
| SMS spam, one Noul per line (n=5,574) | F1 0.91 (P 0.87 / R 0.95); 27 s; $0.07 | jgrep | community | EXC1 L61 |
| AG News zero-shot (n=7,600) | 86.6%; business precision 0.58 (over-triggered) | jgrep | community | EXC1 L61 |
| Relevance (n=2,380 labels) | Jev 74%; fine-tuned Laya 44% -> 69% | Distil Labs | independent (competitor) | EXC1 L65 |
| Generic Noul, 44 alignment benchmarks | median AUROC 0.886; F1 0.706 -> 0.793 with 10 labels | Guo et al. | independent | EXC1 L60 |
| Phishing | 62.6% (1 Q) -> 95.0% (5 Qs + LR, 1,000 labels); Haiku 4.5 81.3% / 93.2% | Beri.net | community | EXC1 L62 |
| Editorial defects (n=7) | 6/7 vs Fable 5.1 7/7; 0.35 s vs 8.83 s | Every | community | EXC1 L63 |
| Resume screening | 77.1% agreement with DeepSeek V4.1 Flash | Voyager | community | EXC1 L64 |
| nexibeo recipes (16-36 items) | triage 34/34; 13-Noul tagging F1 87% @0.5 (P 97 / R 64 @0.9); Score 4/7 vs 4 Nouls 7/7; invoice 40/40; browser 5/6 | nexibeo | community | EXC2 L11 |
| Jev-IDS | text-like features F1 0.856 vs Gemini 0.880 vs RF 0.748; numeric 28.42% vs RF 69.95% | paper | independent | EXC2 L25 |
| Option-wise Nouls vs Choice at 0.90 | 97.0% vs 79.4% retained | Du et al. | independent | BRIEF L326 |
| Leaderboards | JevBench 1.13 #26, 1.14 #31; Decision Index 1.14 #43; untuned Gemma 4 31B 79.6 vs Jev 80.1 | BenchmarkHeaven / HF / Geuter | independent | BRIEF L393, L406 |
| Speed/cost multiplier | 193.6x faster / 444.6x cheaper **[VENDOR]**; user medians 7x / 30x | TypeSafe vs 12,759 tweets | vendor vs community | EXC1 L9 |
| CMaintz jev-guard | ~68% accuracy | CMaintz | community | EXC2 L18 |
| Multilingual | Belebele 0.867 (122 langs); AfriXNLI ECE 0.165; 1.14 multilingual gain **[VENDOR]** | Deusser / TypeSafe | mixed | EXC1 L53; BRIEF L331 |

### Plausible accuracy of a "keep this block?" Noul, by analogy (INFERENCE)

| Analog | Measured | Why analogous to a DOM block decision | Implied per-block band |
|---|---|---|---|
| SMS spam F1 0.91 | short junk-vs-not text | cookie banners, CTAs, newsletter boxes are junk-like short texts | ~0.90 |
| AG News 86.6% | paragraph topic | "is this paragraph article prose vs navigation/listing" | ~0.85-0.87 |
| Relevance 74% | passage relevant to query | "is this block part of the article" for related/aside content | ~0.74 on ambiguous blocks |
| Jev-as-judge within 3 pts of GPT-6 | verdict readable from text | blocks whose role is explicit in text ("Share this", "Cookie settings") | near-LLM accuracy, i.e. still not 99.99% |
| Banking77 81% (77-way Choice) | multi-class | a "block kind" Choice would score lower than Nouls (97.0% vs 79.4% at 0.9) | prefer Nouls |
| conf >= 0.99: 96.3% on 58%; pi-warden <1% above 0.8 | high-confidence band | gated auto-decisions | 96-99% on ~58-76% of blocks |
| Tuning: +8.7 F1 on 10 labels; 0.50 -> 0.75; 62.6 -> 95.0 | threshold/ensemble | Defuddle has 226 labeled expected outputs | +5 to +25 pts over raw |
| **Combined** | | | **~85-92% raw; ~93-97% tuned; ~96-99% in high band; rest needs heuristics** |

### Page-level implication (computed, independent-error assumption)

| Per-block accuracy (source) | P(all 10 right) | P(all 20) | P(all 50) | P(all 100) | E[errors] at N=50 |
|---|---|---|---|---|---|
| 0.81 (Banking77) | 0.122 | 0.0148 | 2.7e-5 | 7.1e-10 | 9.5 |
| 0.866 (AG News) | 0.237 | 0.0563 | 7.5e-4 | 5.6e-7 | 6.7 |
| 0.91 (spam F1) | 0.389 | 0.152 | 0.0090 | 8.0e-5 | 4.5 |
| 0.918 (Noul soft acc) | 0.425 | 0.181 | 0.0139 | 1.9e-4 | 4.1 |
| 0.944 (p=1.0 band, Du) | 0.562 | 0.316 | 0.056 | 0.0031 | 2.8 |
| 0.963 (conf >= 0.99 band) | 0.686 | 0.471 | 0.152 | 0.023 | 1.85 |
| 0.99 (pi-warden "<1%" above 0.8) | 0.904 | 0.818 | 0.605 | 0.366 | 0.5 |
| 0.999 (hypothetical) | 0.990 | 0.980 | 0.951 | 0.905 | 0.05 |
| 0.9999 (hypothetical) | 0.999 | 0.998 | 0.995 | 0.990 | 0.005 |
| **Required per block for page-level 0.9999** | 0.99999 | 0.999995 | 0.999998 | 0.999999 | |
| Required per block for page-level 0.99 | 0.998996 | 0.999498 | 0.999799 | 0.999900 | |

## (b) Calibration, thresholds, bands, cascade

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Confidence definition | Choice (p_max-1/n)/(1-1/n); Score 1 minus weighted distance; Noul has NO confidence field; docs suggest abs(2p-1); start 0.7 yes / 0.3 no | TypeSafe confidence page | **VENDOR** | BRIEF L169-173 |
| Calibration disclaimer | "measured across groups ... does not guarantee that any single answer is correct" | TypeSafe docs | **VENDOR** | EXC1 L19 |
| F1-optimal Noul threshold | median 0.35 across 31 benchmarks (0.5 default wrong) | Guo et al. | independent | BRIEF L177; EXC1 L47 |
| Bands on Banking77 | >=0.99: 58% coverage, 96.3% acc; <0.50: 3.5%, 29.6%; cascade @0.90: 75.9% handled, 84.0% overall, ~28% cost | OpenRouter | independent | EXC1 L66; BRIEF L179 |
| Production guard by band | 15,346 calls: wrong 15% below 0.8, <1% above; hold at >=0.9; 18,075 replays held 0.27% at 0.7 | pi-warden | community (production) | EXC1 L67; EXC2 L16 |
| ECE | pooled 0.047; median per-benchmark 0.168; range 0.003-0.28 | Guo et al. | independent | BRIEF L180 |
| Primitive soft accuracy | Noul 0.918; Score 0.886; Choice 0.764; Choice OVL 0.771 raw / 0.903 corrected | Porcedda | independent | BRIEF L181; EXC1 L29-30 |
| Errors at p = 1.0 | 102 of 1,819 (5.6%) | Du et al. | independent | EXC1 L33 |
| Zero probability on true answer | 6.2% of DDXPlus | medRxiv | independent | EXC1 L31 |
| Overconfidence on empty input | up to 96% on one option; mean 58% without "none" | medRxiv | independent | EXC1 L32 |
| Coherence | P(X)+P(not X) off by 0.064; 3 exclusive labels sum 1.14 | Li, He, Li | independent | EXC1 L48 |
| Threshold tuning gains | UNFAIR-ToS micro-F1 0.50 -> 0.75; recalibration cut error 3.3x | Deusser; Rafe & Das | independent | EXC1 L51 |
| Three-band pattern | act / caution / route; >=0.9 high-stakes auto, 0.5 floor | TypeSafe concept page | **VENDOR** | BRIEF L183 |
| Cascade ceiling | flash LLM judges repeat >85% of confident errors; gain <=2.7 pts even with oracle thresholds | Rao & Callison-Burch | independent | EXC1 L52 |
| Held-out drift | 5% FNR in-sample target misses up to 17% held-out | Li (2610.02267) | independent | EXC2 L19 |
| Guessed threshold on pages | "Threw Away a Third of the Good Pages" | blog | community | EXC2 L39 |
| Calibrated even when wrong | 32% correct at mean top-prob 0.30 | Hume | community | EXC1 L50 |
| Ordinal compression | 37.67% ordinal vs 84.39% nominal macro acc | Gao et al. | independent | EXC1 L34 |
| Abstention | -11.4 to -12.0 pts on "none"; wrong "I don't know" 10.5% | Du; Madrid-Garcia | independent | EXC1 L38; BRIEF L372 |

## (c) Determinism and reproducibility

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Repeat variability | 0.04 mean probability movement; 12% chosen-option change | Yang et al. | independent | BRIEF L150; EXC1 L49 |
| jgrep reruns | 128/150 identical over 3 uncached runs; rest <=0.03 | jgrep | community | EXC1 L20 |
| OpenRouter repeat | Score 1.21 -> 1.17; Noul 0.42 -> 0.44, same message | OpenRouter | independent | EXC1 L20 |
| Seeds / drift | no seeds; jev-latest changes; outputs drift between releases | docs / report | vendor + independent | BRIEF L72; EXC2 L46 |
| Only path to exact reruns | cache keyed on (model, state, questions) | brief | vendor guidance | BRIEF L332 |
| Pinned-version lifetime | deprecation notice 60 d (1.13) -> 30 d (1.14) promised | TypeSafe | **VENDOR** | BRIEF L161 |
| Option order | argmax 1.8% flip on reversal; probs shift up to 34 pts; chess 39-43% picks change | Li; Imperatrice; Dimesio | independent | EXC1 L35-36 |
| Local smoke (NOT a doc fact, n=1) | identical 453-token state: 1.13.0 conf 1.0 vs 1.14.0 conf 0.99; jev-latest resolves to 1.14.0 | experiments/jev/research/smoke_*.json | local artifact | - |
| Implication for 226 byte-exact fixtures | CI is network-disabled (SCOUT L11); live Jev cannot run in CI; recorded cache tests the recording, not the model; any block near threshold is a flake source | inference | - | SCOUT L11 |

## (d) Security

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Injection on official API | routing 100% clean -> 0-5.8%; ASR 93.5-100% | Wang et al. | independent | EXC1 L41; BRIEF L33 |
| One appended opinion | flips 12.1%; 38% of confident answers pushed below 0.8 | JevAdvBench | independent | EXC1 L42 |
| Natural context flips | 61.4-73.2% of correct decisions redirected | JevOut | independent | EXC1 L43 |
| Planted ad vs browser agent | clicked 91% despite "page text is untrusted data" | HiddenLayer | independent | EXC1 L44 |
| Toxicity filter bypass | 30/30 unedited caught; "many" TokenBreak-respelled passed | HiddenLayer | independent | EXC1 L45 |
| Guardrail fail-open | typed-model guardrails failed open 93-100% under misleading label; deterministic rule 100% | Azizi et al. | independent | BRIEF L382 |
| Confidence is not authorization | attacked decisions as confident as originals | JevAdvBench | independent | BRIEF L383 |
| Injection detection when asked | 40/40 in one screen; 0.99 on planted RAG injection; "a filter, not a security boundary" | OpenRouter tutorial / TypeSafe cookbook | community / **VENDOR** | BRIEF L384; EXC2 L8 |
| "Argued input" conclusion | "Anyone who wires Jev into a security boundary is wiring in a model that treats its state as 'argued input'" | report | independent | EXC1 L11; EXC2 L42 |
| Attribute inference | 100% gender/age/health/ethnicity from labels alone | Wang et al. | independent | EXC1 L46 |
| Guard disclaimers | "a guardrail, not a sandbox"; "NOT a security boundary"; fails OPEN by default | leepokai; CMaintz | community | EXC2 L18 |
| Tiny counter-example | fake "system override" did NOT flip (n=8) | MindStudio | community | EXC2 L24 |
| Policy text matters | 17/153 false denials -> 1 with policy text; credential reads 6/9 missed -> 0 with 2 more Qs | hermes | community | EXC2 L17 |

## (e) Context limits

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Limits | 32k tokens per question; 64k per request; 262k with header, "slower and less accurate"; 400 max_tokens_exceeded; body <=32 MiB | TypeSafe | **VENDOR** | BRIEF L54, L144-145 |
| Irrelevant state | "accuracy drops as irrelevant content grows" [vendor]; "nobody has quantified accuracy lost per kilobyte" | TypeSafe / report | vendor + independent | BRIEF L73; EXC2 L43 |
| Batch questions not items | 13 Qs 12.2x cheaper / 10x faster, same answers **[VENDOR]**; jgrep latency flat 1-64 Qs | cookbook / jgrep | vendor / community | EXC2 L23; EXC1 L61 |
| Truncation in the field | jgrep 8,000 chars; foreman 12k | tools | community | EXC2 L32 |
| Long inputs | jgrep "weak on ... long inputs" | jgrep | community | EXC1 L61 |
| Many Qs over one doc | 218 line ids in one request | semantic-find cookbook | **VENDOR** | EXC2 L7 |
| Throughput | ~30k tokens in ~160 ms (sparse MoE inferred) | Hume | community | EXC1 L56 |
| Defuddle input sizes | fixture HTML max 201,904 bytes; p90 8,788 | SCOUT | repo fact | SCOUT L12 |

## (f) Cost, latency, limits, signup

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Price | $0.042/M input; output free; 3-Q 447-token call ~$0.000019; 1M such ~$19; no pricing page; "cannot prove not subsidized" | TypeSafe / OpenRouter | **VENDOR** price | BRIEF L149; EXC1 L18 |
| Measured run costs | Banking77 $0.34 vs $7.44; 5,574 SMS $0.07; 994 HN titles $0.012 / 4.6 s; ~$13 per 1M lines | OpenRouter; jgrep | independent / community | EXC1 L7, L61; EXC2 L22 |
| Latency, direct short | LiteLLM p50 126.81 ms (240 calls); OpenRouter p50 175 / p95 270 / p99 353 ms @2,605 tokens, 8 concurrent; MindStudio 92-214 ms | various | independent | EXC1 L55-56; EXC2 L24 |
| Latency, few k tokens / 1 hop | Jev-IDS 315-335 ms @1.8k; nexibeo 0.34-0.45 s; Cloudflare median 524 ms; pi-warden ~250 ms | various | independent / community | EXC1 L56; EXC2 L16 |
| Latency, far / 2 hops | jev-guard ~580 ms p50 via AI Gateway; 0.75 s from Taiwan; 40-shot prompt 0.750 s; "under 100 ms" unsupported **[VENDOR press]** | various | independent | EXC1 L56; BRIEF L12 |
| Rate limits | per org; community cites 250,000 tokens/s, 1,200 rpm; 429/529 retried; CEO: "the main worry" | community / CEO | community / vendor | BRIEF L147-148; EXC1 L17 |
| Signup | direct signups paused Sept 22; $5 credit ~120M tokens; gateways need no key | TypeSafe | **VENDOR** | BRIEF L57; EXC1 L17 |
| Volume | ~1.36B requests/week on OpenRouter | OpenRouter | independent | BRIEF L393 |
| Defuddle economics (inference) | ~$0.0004 per 10k-token page vs Worker price $0.003-0.005/request (~8-14%) | computed | inference | SCOUT L6 |

## (g) Privacy / data policy

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| Policy | no training on user data; ZDR enterprise-only via sales; US-hosted | TypeSafe legal | **VENDOR** | BRIEF L151, L387 |
| Oct 24 2026 leak | every customer's Noul outputs exposed; no postmortem; IDOR-class inferred | Startup Fortune | independent press | EXC1 L22 |
| Gateway ZDR | Workers AI ZDR "Yes"; Vercel per-request ZDR + no-training flags | Cloudflare / Vercel | third-party vendor | BRIEF L296, L303 |
| Side channel | 100% attribute inference from labels | Wang et al. | independent | EXC1 L46 |
| Defuddle promise | npm + extension "make no network requests"; Worker caches <=24h; extension sees logged-in pages (Gmail extractor) | privacy.ts via SCOUT | repo fact | SCOUT L8, L42 |

## (h) Runtime availability

| Claim | Number | Source | Vendor/Indep. | Ref |
|---|---|---|---|---|
| SDKs | Python 3.10+ and JS Node 20+ only; others HTTP (~50 lines) | TypeSafe | **VENDOR** | BRIEF L189, L248, L313 |
| Browser | no browser-safe mode; shipped key exposed | jev4k README | community | EXC1 L24 |
| Workers AI | env.AI.run('typesafe/jev'); $0.042/$0; ZDR yes; returns jev-1.13.0; 32k per-question | Cloudflare | third-party vendor | BRIEF L303; EXC1 L21 |
| Vercel / Netlify / OpenRouter / LiteLLM / Pydantic AI | decide() via gateway no key; Netlify Functions no key; /api/alpha/decisions; LiteLLM proxy; FallbackModel to LLM | various | vendor pages | BRIEF L277-308 |
| On-device | laya-ts, receptron/laya (Node/ONNX), edgejev (ONNX CPU), SemIf WebGPU; Laya 33 ms T4 / 7.2 ms batched; ~0 zero-shot | report | independent | EXC2 L53 |
| Defuddle constraints | sync parse(); zero deps; 92 KB gzip budget; CI offline; parseAsync only for extractor APIs | SCOUT | repo fact | SCOUT L9-11 |

## (i) Precedents judging DOM elements / web content

| Project | What it does | Accuracy known? | Ref |
|---|---|---|---|
| browser-use/jev-ultrafast (23.7k stars, 3 commits, 1 contributor) | Jev picks op + target DOM node from code-built bounded list; "model output never becomes selectors"; no shadow roots/frames/canvas | "three repeats of one task, not a reliability benchmark"; HiddenLayer 91% planted-ad click | EXC2 L4 |
| realZachi/typesafe-adblock (81 stars; 3,872-like demo) | asks whether a DOM element is an ad | **none published** | EXC2 L5 |
| kitze/unclutter (304 stars); Hide posts on X; Doomscroll Filter; X algorithm rebuilt | feed/element filtering | **none measured** | EXC2 L6 |
| TypeSafe semantic-find cookbook | 218 line ids of GitHub ToS in one request | demo only **[VENDOR]** | EXC2 L7 |
| TypeSafe RAG passage cookbook | passage filter; "a filter, not a security boundary"; injection 0.99 when asked | demo only **[VENDOR]** | EXC2 L8 |
| Any web benchmark | no WebArena/OSWorld score for any Jev harness; all text-only via DOM snapshots / a11y trees / OCR | none | EXC2 L13 |
| pi-warden relevance compaction | kept 1 of 34 re-read files; did not ship | failure | EXC2 L16 |
| "I Guessed My Jev Threshold" | page filter threw away a third of good pages | failure | EXC2 L39 |
| nexibeo browser recipe | 5/6 live tasks; "code must verify outcomes" | n=6 | EXC2 L11 |

## (j) Alternatives on the same wire protocol

| Option | Facts | License / cost | Kind | Ref |
|---|---|---|---|---|
| Ollaya (local daemon) | /v1/systemone; ~25 families; ECE 0.022 vs Ollama raw 0.115; default winnow:e4b; 5-Q latency 14 ms-1.0 s (RTX 5090), 314 ms-62 s (Threadripper CPU) | Apache-2.0 | community | EXC2 L51; BRIEF L397 |
| H2O-Lightning-4B | 29 ms/decision; beats Jev 1.13 on JevBench; 31B sibling non-commercial | Apache-2.0 | vendor + leaderboard | EXC2 L52; BRIEF L402 |
| Torchcast 4B v1.3 | 77.5 vs Jev 77.1 at 34 ms | $0.015/1k; CC BY-NC | vendor | EXC2 L52 |
| Winnow-12B / Kev 0.8B-27B | ~61k HF downloads/month; Kev 8.4k stars, TypeSafe SDK unchanged | Apache-2.0 | stats | EXC2 L52; BRIEF L404 |
| Cloudflare Clef / Clef-flash | Qwen3.8-27B LoRA (9B flash); Workers AI @cf/cloudflare/clef; "fully Jev-API compatible" | Apache-2.0; $0.24/M | **VENDOR** | BRIEF L399 |
| pplx-decider 27B / flash 4B | rank 5 Decision Index; "best calibration among hosted" | Apache-2.0; $0.02/M | vendor / leaderboard | BRIEF L400 |
| Super Decider | DiffusionGemma 26B-A4B; #2-3 JevBench; needs ~48 GB | Apache-2.0; $0.016/1k | community | BRIEF L403 |
| AnyJev | untuned Gemma 4 31B 79.6 vs Jev 80.1; rotation averaging | Apache-2.0 | independent | BRIEF L406 |
| AWS Strands Decider 2B | CPU/edge; weak on general benchmarks | Apache-2.0 | vendor | BRIEF L405 |
| Encoders (Laya 421M, GLiNER2.5 340M) | ~0 chance-corrected zero-shot; Laya fine-tuned 0.362 -> 0.766 and 44% -> 69%; 33 ms T4 / 7.2 ms batched; browser/ONNX ports exist | - | independent | EXC2 L53 |
| Size floor / serving | ~4B floor; <Q8 quantization costs 1-4 pts; Ollama raw softmax discards calibration; Together $17 / 25-min 4B fine-tune | - | independent / vendor | EXC2 L45, L54; BRIEF L408 |

## (k) Strongest PRO vs ANTI for clutter classification

| PRO (with number) | ANTI (with number) |
|---|---|
| Within 3 pts of GPT-6 when verdict readable from text (EXC1 L59); spam F1 0.91; AG News 86.6% (EXC1 L61) | Zero DOM-element precedents with accuracy numbers (EXC2 L5-6); only measured page outcomes are failures (91% ad click; third of good pages lost; 1/34 files kept) |
| High band reliable: 96.3% @>=0.99 on 58%; <1% error above 0.8 on 15,346 production calls (EXC1 L66-67) | 102/1,819 errors at p=1.0 (EXC1 L33); 12% repeat flips, 0.04 drift, no seeds (BRIEF L150); version drift seen locally |
| Per-block Nouls over one shared state are near-free: 218 Qs/request; 13 Qs 12.2x cheaper [vendor]; latency flat 1-64 Qs (EXC2 L7, L23; EXC1 L61) | 32k/question, 64k/request; real pages exceed; irrelevant-state loss unquantified; "weak on long inputs" (BRIEF L144; EXC2 L43) |
| Thresholds tunable from small labeled sets: +8.7 F1 on 10 labels; 0.50 -> 0.75; 62.6 -> 95.0 (EXC1 L51, L60, L62); Defuddle has 226 expected outputs | Median per-task ECE 0.168; 0.5 default wrong (0.35 optimum); 5% FNR target misses up to 17% held-out (BRIEF L177-180; EXC2 L19) |
| Defuddle's known false positives (prose containing "privacy"/"share", SCOUT L47) are semantic misreads, Jev's sweet spot | Many removal cues (hidden styles, pixel sizes, link density, word counts) are not in text; Jev cannot count or simulate (BRIEF L362, L416; EXC2 L34) |
| ~$0.0004/page; 100-500 ms; Workers AI binding with ZDR (BRIEF L303) | Sync browser API, no-network promise, logged-in pages, key exposure, 92 KB budget exclude the extension (SCOUT L8-10, L42; EXC1 L24) |
| Code-owns-candidates pattern proven (jev-ultrafast "model output never becomes selectors") | State is "argued input": ASR 93.5-100%; one opinion flips 12.1%; natural context 61-73%; never a security boundary (EXC1 L11, L41-43) |
| Open models on the same wire can replace Jev if availability fails | Signups paused; rate limits "main worry"; Oct 24 leak; US-only ZDR enterprise-only; 30-day deprecation |

## Every number in the docs bearing on whether "99.99%" is reachable

| # | Number | Meaning for 99.99% (1e-4 error) | Ref |
|---|---|---|---|
| 1 | 102/1,819 errors at p = 1.0 (5.6%) | 561x target even at maximal confidence | EXC1 L33 |
| 2 | 96.3% at conf >= 0.99 (58% coverage) | 370x target in the best measured band | EXC1 L66 |
| 3 | "<1%" wrong above 0.8 (15,346 calls) | >=100x target | EXC1 L67 |
| 4 | Noul soft accuracy 0.918 | 820x | BRIEF L181 |
| 5 | Spam F1 0.91; AG News 86.6%; Banking77 81.0%; relevance 74% | 900-2,600x on the closest analogs | EXC1 L7, L61, L65 |
| 6 | Within 3 pts of GPT-6 when readable | ceiling is the LLM's accuracy, which is also not 99.99% | EXC1 L59 |
| 7 | 12% chosen-option flips; 0.04 drift; 22/150 reruns differ | the same input is not even self-consistent at 1e-1 | BRIEF L150; EXC1 L20 |
| 8 | Median per-task ECE 0.168 (0.003-0.28) | reported probabilities off by ~17% on a typical task | BRIEF L180 |
| 9 | 6.2% zero-prob on true answer; 10.5% wrong abstention; -11 to -12 pts on "none" | structural failure modes, not noise | EXC1 L31, L38; BRIEF L372 |
| 10 | 5% FNR target -> up to 17% held-out | thresholds do not transfer | EXC2 L19 |
| 11 | ASR 93.5-100%; 12.1% / 38%; 61-73%; 91% ad click; toxicity bypass | adversarial pages defeat it | EXC1 L41-45 |
| 12 | Cascade gain <=2.7 pts; flash judges repeat >85% of confident errors | cascading cannot close the gap | EXC1 L52 |
| 13 | "Third of the good pages" lost to a guessed threshold | page filtering casualty | EXC2 L39 |
| 14 | Coherence miss 0.064 | decomposed Nouls need renormalizing | EXC1 L48 |
| 15 | CMaintz guard ~68% | a shipped guard far below target | EXC2 L18 |
| 16 | Vendor: calibration "does not guarantee that any single answer is correct" | vendor disclaims per-item guarantees | EXC1 L19 |
| 17 | 0 DOM precedents with accuracy numbers | no evidence base at all for the DOM case | EXC2 L5-6 |
| 18 | Page-level: 0.963^50 = 0.15; 0.99^50 = 0.61; need 0.999998/block for 0.9999/page | compounding makes the page target unreachable by any band above | page_level_math.csv |

**Conclusion:** 99.99% is not reachable with Jev on the documented evidence, neither per decision (best bands are 100-561x the target error) nor per page (compounding across tens of blocks pushes even a 99%-per-block system to ~60% fully-correct pages). For security sanitization (A) the docs forbid using Jev as a gate at all.

## Vendor claims flagged (treat as unverified)

| Claim | Where |
|---|---|
| $0.042/M input, output free; "expects prices to fall"; no pricing page, "cannot prove not subsidized" | BRIEF L149; EXC1 L18 |
| "193.6x faster, 444.6x cheaper" (vendor workflows vs LLM consensus labels) | EXC1 L9 |
| "Under 100 ms" (press release; no independent support) | BRIEF L12; EXC1 L56 |
| 13 questions in one call 12.2x cheaper / 10x faster with identical answers | EXC2 L23; BRIEF L344 |
| Confidence formulas; abs(2p-1); 0.7/0.3 starting thresholds; three bands >=0.9 / 0.5 | BRIEF L169-173, L183 |
| "Calibration ... does not guarantee that any single answer is correct" | EXC1 L19 |
| Jaggedness failure list ("each confirmed in the field" per brief); first-option bias | BRIEF L357, L368 |
| Context 32k/64k/262k and "262k is slower and less accurate" | BRIEF L54, L144 |
| No-training commitment; ZDR enterprise-only; US-hosted | BRIEF L151; EXC1 L22 |
| Deprecation notice 60 -> 30 days | BRIEF L161 |
| 1.14 "small, subtle improvements", largest gain multilingual | BRIEF L160, L331 |
| Cookbooks: semantic-find 218 line ids; RAG injection 0.99 and "a filter, not a security boundary"; citation check 4/4; reranking 5% -> 18%; hierarchical / confidence-fallback patterns | EXC2 L7-9, L23 |
| Box always returns a box; images "not production-ready"; "all models perform worse on multimodal input" | BRIEF L129, L146, L375 |
| Third-party vendors: Workers AI ZDR "Yes" and $0.042 (Cloudflare); Clef "fully Jev-API compatible" $0.24/M; pplx-decider "best calibration among hosted" $0.02/M; H2O-Lightning-4B beats 1.13 (H2O blog, corroborated by JevBench); Torchcast 77.5; Together $17 fine-tune; AWS Strands | BRIEF L303, L399-405; EXC2 L45, L52 |
| Signups paused Sept 22; $5 credit ~120M tokens; CEO "rate limits the main worry" | BRIEF L57; EXC1 L17 |
| Rate-limit figures 250k tokens/s and 1,200 rpm are community-cited, not vendor-published | BRIEF L147 |

## Caveats

- All numbers come from three condensed documents prepared by others; I did not verify primary sources and made no API calls, so transcription errors upstream would propagate.
- Many figures are from community blog posts or READMEs with tiny samples (Every n=7, MindStudio n=8, nexibeo 16-36 items, jev-ultrafast 'three repeats of one task'); only Deusser (346,009 requests), OpenRouter Banking77 (3,080), pi-warden (15,346 / 18,075), Guo (44 benchmarks) and jgrep (5,574 / 7,600) are large.
- The 12% chosen-option flip rate (Yang et al.) was measured on hard game-theory style tasks; jgrep's 128/150 identical reruns with <=0.03 movement suggests flips are far rarer on confident, text-readable decisions. The true flip rate for near-threshold DOM blocks is unmeasured.
- The 5.6% error at probability 1.0 (Du et al.) is from medical diagnosis (DDXPlus), not text-readable classification, and may overstate the error at p=1 on easy tasks; it is still the only published number for that band.
- Page-level arithmetic assumes independent per-block errors and 10-100 candidate blocks per page; real block errors are correlated and Defuddle's per-page block count is unknown (fixtures are mostly small hand-made cases, SCOUT L12).
- The 'what a keep-this-block Noul could reach' band (85-92% raw; 96-99% in the high-confidence band) is inference by analogy from spam/news/relevance tasks, not a measurement on DOM blocks; no document contains any DOM-element accuracy figure.
- Per-page cost (~$0.0004 at 10k tokens) assumes the shared state is billed once per request regardless of question count; this is inferred from the vendor's '12.2x cheaper' batching claim and jgrep's flat latency, not from a published billing rule.
- The '3-6 points below frontier LLMs' figure is the brief author's synthesis across independent studies, not a single measurement.
- The version-drift observation (confidence 1.0 on 1.13.0 vs 0.99 on 1.14.0) comes from pre-existing local smoke files (n=1) produced by the orchestrator, not from the documents.
- Vendor claims were flagged from the documents' own [vendor] markers plus source attribution (TypeSafe docs/cookbooks, Cloudflare/Perplexity/H2O/Together pages); some third-party-vendor numbers (e.g., H2O-Lightning beating Jev) are corroborated by public leaderboards.

## Artifacts

- experiments/jev/research/results/doc-evidence/evidence_table.tsv
- experiments/jev/research/results/doc-evidence/page_level_math.csv
