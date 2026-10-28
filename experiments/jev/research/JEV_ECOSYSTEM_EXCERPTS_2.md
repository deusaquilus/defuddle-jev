# Excerpts from "Jev Built a Category Its Clones Now Lead" (2026-10-27), part 2: applications, patterns, failures, alternatives

## DOM / web-content applications that exist (the closest precedents to an HTML extractor)
- **browser-use/jev-ultrafast** (23.7k stars, 3 commits, 1 contributor): per cycle Jev picks an operation (CLICK, TYPE_TEXT, SELECT, SCROLL, WAIT, DONE, BLOCKED) and a target DOM node from a code-built bounded option list; "Model output never becomes selectors, coordinates, shell commands, or executable JavaScript"; no shadow roots/frames/canvas; "three repeats of one task, not a reliability benchmark". HiddenLayer: it clicked a planted "Confirm Price" ad 91% of the time.
- **realZachi/typesafe-adblock** (81 stars; demo tweet 3,872 likes): asks Jev whether a DOM element is an ad. No accuracy figures published.
- **kitze/unclutter** (304 stars), "Hide posts on X in plain language" (Pociot), Doomscroll Filter (Read/Skim/Pass), "The X algorithm, rebuilt with Jev": feed/element filtering demos, no measured accuracy.
- **TypeSafe semantic-find cookbook**: scores 218 line ids of GitHub's ToS in one request (one Noul per line id as question keys over a shared state).
- **TypeSafe RAG passage cookbook**: "a filter, not a security boundary"; a planted injection scored 0.99 when asked for injection explicitly.
- **TypeSafe hierarchical classification cookbook**: beam search over Choice probabilities through category trees; **classification-using-confidence cookbook**: fall back to a parent category on low confidence.
- **tedliou/decision-model-playground**: putting all 18 article descriptions into one question "seriously disrupted Laya"; Laya's 256-token option budget silently truncates.
- **nexibeo/jev-cookbook** (15 recipes on 16-36-item samples): support triage 34/34; multi-label tagging with 13 Nouls F1 87% at 0.5 (precision 97%/recall 64% at 0.9); log triage: a single severity Score caught 4/7 critical events vs four Nouls 7/7; moderation (five Nouls) 0 harmful published / 0 clean blocked; dedupe 0 wrong merges only with code-checked numbers; invoice extraction 40/40 over regex candidates; browser recipe passed 5/6 live tasks, failing once because "both checks agreed, so code must verify outcomes".
- Every/Dan Shipper: 4 writing checks x 12 passages, 6/7 planted defects (Fable 5.1 7/7).
- No WebArena/OSWorld score for any Jev harness; no harness has migrated to 1.14 image input; all work around text-only via DOM snapshots, accessibility trees, OCR.

## Coding-agent guards (the best production data on gating with Jev)
- pi-warden: irreversibility Score with hold at >= 0.9; 18,075 replayed calls held 0.27% at 0.7; judge wrong 15% below confidence 0.8, <1% above; ~250 ms/judgment; features that failed their own gates did not ship (relevance compaction kept only 1 of 34 re-read files).
- hermes-jev-approvals: without operator policy text in the state, 17/153 false denials; with it 1; credential reads 6/9 missed → 0 after adding two questions; "never run in anger".
- leepokai/jev-guard: fails OPEN by default with a flag to fail closed; "a guardrail, not a sandbox". CMaintz/jev-guard: "~68% accuracy", "NOT a security boundary", "Jev returns numbers without reasons, so the audit sink is required".
- Liu (2609.33401): "good average calibration hides failures on specific attack groups". Li (2610.02267): Laya lets through 81.5% of harmful requests vs Jev 25.5%; in-sample thresholds targeting 5% FNR miss up to 17% held-out.

## Classification/extraction results (8.3)
- jgrep: SMS spam F1 0.91; AG News 86.6% zero-shot; 994 HN titles in 4.6 s for $0.012; 128/150 questions identical across runs.
- TypeSafe cookbooks [vendor]: batching 13 questions in one call 12.2x cheaper/10x faster with identical answers; reranking top-1 5%→18%; citation check 4/4 planted failures caught; pre-parsed value extraction (regex candidates → Jev selects).
- MindStudio hands-on (8 synthetic requests): refund message routed correctly; forced choice without "other" picked "sales" at 0.31; a fake "system override" did NOT flip technical support; agent-output verification 93% that a success claim was unsupported; 92-214 ms.
- Jev-IDS: text-like NSL-KDD features F1 0.856 vs Gemini 0.880 vs RF 0.748; but purely numeric packet features 28.42% vs RF 69.95%. "Jev does well when the state is semantic and badly when it is purely numeric."

## Section 9: patterns that work (condensed)
- Code owns thresholds and arithmetic; the model never has authority over side effects. "Calibrate thresholds by consequence." "Confidence is not authorization."
- LLM for text, Jev for decisions; extract candidates with regex/code, let Jev select.
- Confidence-gated cascade (most reproduced result); caveat: cascade to an independent judge (reasoning model or human), since flash LLM judges repeat >85% of Jev's confident errors.
- Fail-open vs fail-closed chosen by consequence; expose as a parameter.
- Batch many QUESTIONS per call (free); do NOT batch many ITEMS into one state (accuracy loss; 32k per-question budget forces truncation: jgrep truncates records at 8,000 chars; foreman caps output tails at 12k).
- Option-wise Nouls instead of one Choice or one Score; renormalize in code (per-option Nouls do not sum to 1).
- Predict-then-decide: two calls (predict missing fact → write into state → decide) lifted 33% → 94%; ALFWorld 31% → 87% with code-supplied lookahead. "Jev evaluates what is in the state; it does not simulate what is absent."
- Add an escape option to every Choice ("other", "none_of_these", "not_enough_information").
- Shuffle/rotate options and compare; average over rotations.
- Compute facts in code, then ask the judgment (chess blunders 35% → 5-9% with assisted facts).
- Shadow mode, caching keyed on (model, state, questions), pinned versions; log inputs because Jev returns no reasons.
- Anti-patterns with measured casualties: one multi-level Score for severity (4/7); guessed thresholds ("I Guessed My Jev Threshold. It Threw Away a Third of the Good Pages"); trusting the 0.5 default; confidence as authorization; Jev as a security boundary (91% ad clicks); stuffing many items into one state; reading a Score as a magnitude; expecting counting/date math; unpinned jev-latest.

## Section 10: what does not work yet (condensed)
- Security boundaries against adaptive adversaries: Wang 93-100% ASR on the official API; JevAdvBench one-opinion flip 12.1%; JevOut 61-73%; Azizi 93-100% fail-open under a misleading option label; HiddenLayer 91% ad click; attribute side channel. Every guard author disclaims boundary status. Consensus: treat state as untrusted, argued input and keep a deterministic validator the model cannot override.
- Long documents and many items per state: 32k per question; accuracy loss with irrelevant content; 262k mode "slower and less accurate"; nobody has quantified accuracy lost per kilobyte of irrelevant state.
- Explanations: none; pi-warden's explanation judge matched labels in 2/427 calls.
- Fine-tuning Jev: impossible; only paths are rewriting criteria or switching to an open model (where every measured gain lives: Laya 44%→69% on 2,380 labels; Together's $17 / 25-minute Qwen3.5-4B fine-tune).
- Reproducibility: no seeds; 12% chosen-option change; version drift.
- EU residency / on-prem / audit-heavy sectors: US-hosted; ZDR only via enterprise; the Oct 24 leak.
- Vision in production: preview only.

## Section 6/9 (brief): local and open alternatives on the same wire protocol
- Ollaya ("Ollama for decision models", Rust daemon, `/v1/systemone`, ~25 model families, author-calibrated temperatures ECE 0.022 vs Ollama raw softmax 0.115; default `winnow:e4b`; 5-question latency 14 ms-1.0 s on an RTX 5090 but 314 ms-62 s on a Threadripper CPU).
- H2O-Lightning-4B (Apache-2.0, 29 ms/decision, beats Jev 1.13 on JevBench), Torchcast 4B v1.3 (77.5 vs Jev 1.13's 77.1 at 34 ms, $0.015/1k; weights CC BY-NC), Winnow-12B (Apache-2.0, ~61k HF downloads/month), Kev (Apache-2.0), Clef (Apache-2.0, on Workers AI `@cf/cloudflare/clef`), pplx-decider (Apache-2.0, $0.02/M hosted), Super Decider (Apache-2.0, needs ~48 GB).
- Encoders under 500M params (Laya 421M ModernBERT, GLiNER2.5-Decide 340M) score ~0 on chance-corrected indices zero-shot but are rescued by in-domain fine-tuning (Laya typed-decisions 0.362 → 0.766); Laya runs at 33 ms on a T4, 7.2 ms batched; laya-coreml / laya-ts / receptron/laya (Node/ONNX) / edgejev (ONNX quantized CPU) / SemIf WebGPU browser demo exist. "the floor for 'competitive with Jev on general decision benchmarks' is about 4B."
- Quantization below Q8 costs 1-4 points; Ollama's raw softmax discards calibration.

## Section 12 (brief): ceiling of the model class
"The ceiling of a decision model alone is single-pass evaluation of what is already in front of it. The ceiling of a system built around one is set by how much the surrounding code can precompute." Jev is "a level-1 player"; an explicit "reason" instruction does not help. What would move the ceiling: a trained "unknown" mass (mammoth-1's explicit "I don't know"), robustness to argued input through architecture (undemonstrated), reasoning-on-demand hybrids (cost latency), proper-scoring objectives.
