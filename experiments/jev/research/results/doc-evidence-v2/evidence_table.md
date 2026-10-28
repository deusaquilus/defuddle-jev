# Evidence table extracted from the Jev documents (no API calls, no code reading)

Sources: BRIEF = /home/alexi/git/defuddle/experiments/jev/research/JEV_AGENT_BRIEF.md; EXC1 = /home/alexi/git/defuddle/experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md; EXC2 = /home/alexi/git/defuddle/experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md; SCOUT = /home/alexi/git/defuddle/experiments/jev/research/SCOUT_NOTES.md. "Lnn" = line number.
Kind: IND = independent (arXiv paper or third party with no stake), COMM = community/self-reported project measurement, GW = gateway/reseller (OpenRouter, Cloudflare, Vercel), VENDOR = TypeSafe claim, OTHER-VENDOR = a competing model vendor's claim about its own model.

| # | Topic | Claim | Number | Source | Kind | Ref |
|---|---|---|---|---|---|---|
| 1 | a | Jev vs frontier LLMs on text-readable classification | 3-6 points below; collapses on arithmetic, dates, counting, multi-step, anything not literally in the state | brief synthesis | IND synthesis | BRIEF L13 |
| 2 | a | Banking77 (3,080 utterances, 77 intents) | Jev 1.13 81.0% vs Claude Opus 5 84.4%; p50 175 ms vs 2,266 ms; $0.34 vs $7.44 | OpenRouter | GW | EXC1 L7; BRIEF L12 |
| 3 | a | Easiest text benchmarks (37-dataset sweep, 346,009 requests) | 95-99% on IMDB, SST-2, HellaSwag, ARC; MMLU 91.8% | Deusser et al. (Bonn) | IND | EXC1 L8 |
| 4 | a | Hard/rubric text benchmarks | Emotion 0.585; SST-5 0.579; GoEmotions macro-F1 0.243; legal clause F1 0.204 ("rubric judging is Jev's weakest category") | Deusser et al. | IND | EXC1 L8, L52; BRIEF L374 |
| 5 | a | Jev-as-a-Judge vs GPT-6 | within 3 points "where the verdict can be read from the text"; 0.15 s median; 0.36% of fee; cascade +0.9 over GPT-6 at 41% cost | Li, Miao, Krishnan, Padman | IND | EXC1 L59 |
| 6 | a | SMS spam, one Noul per line (5,574 msgs) | F1 0.91 (P 0.87 / R 0.95); 27 s; $0.07 | keltokhy/jgrep | COMM | EXC1 L61; EXC2 L22 |
| 7 | a | AG News zero-shot (7,600 articles, 4 classes) | 86.6%; business-class precision 0.58 (over-triggered) | jgrep | COMM | EXC1 L61; EXC2 L22 |
| 8 | a | Relevance judgment on 2,380 labeled search results | Jev 74%; Laya fine-tuned 44% -> 69% | Distil Labs | OTHER-VENDOR | EXC1 L65; EXC2 L45 |
| 9 | a | Single generic Noul across 44 alignment benchmarks | median AUROC 0.886 zero-shot; F1 0.706 -> 0.793 after tuning thresholds on 10 labeled items | Guo et al. | IND | EXC1 L60; BRIEF L177 |
| 10 | a | Phishing detection | 62.6% (1 question) -> 95.0% (5 questions + logistic regression on 1,000 labels); Haiku 4.5 81.3% / 93.2% | Beri.net / greennode | COMM | EXC1 L62; BRIEF L345 |
| 11 | a | Editorial defect detection (n=7) | 6/7 planted defects vs Fable 5.1 7/7; 0.35 s vs 8.83 s | Every (Dan Shipper) | COMM | EXC1 L63; EXC2 L12 |
| 12 | a | Resume screening | 77.1% agreement with DeepSeek V4.1 Flash; disagreements at adjacent boundaries | Voyager | COMM | EXC1 L64 |
| 13 | a | Cookbook recipes on 16-36 item samples | triage 34/34; 13-Noul tagging F1 87% at 0.5 (P 97% / R 64% at 0.9); one Score 4/7 vs four Nouls 7/7; moderation 0/0 errors; invoice 40/40; browser 5/6 | nexibeo/jev-cookbook | COMM (tiny n) | EXC2 L11 |
| 14 | a | Semantic vs numeric features | NSL-KDD text-like F1 0.856 vs Gemini 0.880 vs RF 0.748; numeric packet features 28.42% vs RF 69.95% | Jev-IDS paper | IND | EXC2 L25; EXC1 L39 |
| 15 | a | Option-wise Nouls vs one Choice at 0.90 threshold | 97.0% vs 79.4% accuracy retained | Du et al. | IND | BRIEF L326 |
| 16 | a | Leaderboard standing | JevBench: 1.13 rank 26, 1.14 rank 31; Decision Index: 1.14 rank 43; untuned Gemma 4 31B 79.6 vs Jev 80.1 on OpenDecisions | BenchmarkHeaven; HF; Geuter et al. | IND | BRIEF L393, L406; EXC1 L10 |
| 17 | a | Headline speed/cost multiplier | 193.6x faster / 444.6x cheaper (vendor workflows scored vs LLM consensus labels); user-reported medians 7x / 30x over 12,759 tweets | TypeSafe vs tweets | VENDOR vs COMM | EXC1 L9 |
| 18 | a | A shipped guard's self-assessed accuracy | "~68% accuracy", "NOT a security boundary" | CMaintz/jev-guard | COMM | EXC2 L18 |
| 19 | a | Non-English | Belebele 0.867 across 122 languages; AfriXNLI ECE 0.165; "English works best"; 1.14's largest claimed gain multilingual | IND / VENDOR | mixed | EXC1 L53; BRIEF L331 |
| 20 | a | High-confidence Choice band on Banking77 | confidence >= 0.99 covered 58% of utterances at 96.3% accuracy; < 0.50 covered 3.5% at 29.6% | OpenRouter | GW | EXC1 L66; BRIEF L179 |
| 21 | a | Production guard by confidence (15,346 judged tool calls) | wrong 15% below 0.8, "under 1%" above (coverage of the >0.8 band not stated) | pi-warden | COMM (production logs) | EXC1 L67; EXC2 L16; BRIEF L179 |
| 22 | a | Errors at probability exactly 1.0 | 1,819 decisions at p=1 contained 102 errors (5.6%) | Du et al. (medicine) | IND | EXC1 L33 |
| 23 | b | Confidence definition | Choice (p_max-1/n)/(1-1/n); Score 1 - weighted distance from mode; Noul has NO confidence field (docs suggest abs(2p-1); start 0.7 yes / 0.3 no) | TypeSafe docs | VENDOR (verifiable formula) | BRIEF L169-173; EXC1 L19 |
| 24 | b | Vendor calibration disclaimer | calibration "is measured across groups of predictions and does not guarantee that any single answer is correct" | TypeSafe docs | VENDOR | EXC1 L19 |
| 25 | b | Default threshold is wrong per task | median F1-optimal Noul threshold 0.35 across 31 benchmarks, not 0.5 | Guo et al. | IND | BRIEF L177; EXC1 L47 |
| 26 | b | Calibration pooled vs per task | pooled ECE 0.047; median per-benchmark ECE 0.168; range 0.003 (sentiment, MMLU) to 0.28 (emotion, legal) | Guo et al. | IND | BRIEF L180; EXC1 L47 |
| 27 | b | Primitive soft accuracy | Noul 0.918; Score 0.886; Choice 0.764; Choice OVL 0.771 raw / 0.903 corrected ("hidden unknown mass") | Porcedda, Sys1Cal-v1 | IND | BRIEF L181; EXC1 L29-30 |
| 28 | b | Zero probability on the true answer | 6.2% of DDXPlus cases | medRxiv | IND | EXC1 L31 |
| 29 | b | Overconfidence on empty input | up to 96% on one option with no information; mean 58% without a "none" option | medRxiv | IND | EXC1 L32; BRIEF L324 |
| 30 | b | Probability coherence | P(X)+P(not X) misses 1 by 0.064; three exclusive labels sum to 1.14 | Li, He, Li | IND | EXC1 L48; BRIEF L182 |
| 31 | b | Threshold tuning gains | UNFAIR-ToS micro-F1 0.50 -> 0.75; recalibration cut calibration error 3.3x; "each model needs its own audit" | Deusser; Rafe & Das | IND | EXC1 L51 |
| 32 | b | Held-out threshold drift | in-sample thresholds targeting 5% FNR miss up to 17% held-out | Li (2610.02267) | IND | EXC2 L19 |
| 33 | b | Three-band cascade pattern | act automatically / proceed cautiously / route to human or LLM; >= 0.9 for high-stakes auto-actions; 0.5 floor for human routing | TypeSafe concept page | VENDOR | BRIEF L183 |
| 34 | b | Cascade at 0.90 on Banking77 | Jev handles 75.9%, 84.0% overall (Opus alone 84.4%) at ~28% of Opus cost | OpenRouter | GW | EXC1 L66; BRIEF L341 |
| 35 | b | Cascade ceiling | flash-tier LLM judges repeat >85% of Jev's most confident errors; cascades gain <= 2.7 points even with oracle thresholds | Rao & Callison-Burch | IND | EXC1 L52; BRIEF L341 |
| 36 | b | Guessed-threshold casualty on web pages | "I Guessed My Jev Threshold. It Threw Away a Third of the Good Pages" | community post title | COMM | EXC2 L39 |
| 37 | b | Calibrated even when wrong | two-step word problems 32% correct at mean top-probability 0.30 | Hume | COMM | EXC1 L50 |
| 38 | b | Ordinal Score compression | 37.67% macro accuracy ordinal vs 84.39% nominal | Gao et al. | IND | EXC1 L34; BRIEF L325 |
| 39 | b | Abstention | -11.4 to -12.0 pts when the right answer is "none of the above"; picks "I don't know" when it should answer 10.5% of the time | Du et al.; Madrid-Garcia | IND | EXC1 L38; BRIEF L372 |
| 40 | b | Guard hold rate at a tuned threshold | 18,075 replayed calls held 0.27% at 0.7; hold at >= 0.9 for irreversibility Score | pi-warden | COMM | EXC2 L16 |
| 41 | c | Repeat variability | 0.04 average probability movement; 12% chosen-option change rate on repeats | Yang et al. | IND | BRIEF L150, L373; EXC1 L20, L49 |
| 42 | c | Rerun identity | 128/150 questions identical over three uncached runs; rest moved <= 0.03 | jgrep | COMM | EXC1 L20; EXC2 L22 |
| 43 | c | Same message, two calls | Score 1.21 then 1.17; Noul 0.42 then 0.44 | OpenRouter | GW | EXC1 L20 |
| 44 | c | Seeds and drift | no seeds; jev-latest changes; "outputs drift between releases"; "Pin a version in anything that must be reproducible" | TypeSafe docs + IND | VENDOR + IND | BRIEF L72, L150; EXC2 L46 |
| 45 | c | Only deterministic path | "cache decisions keyed on (model, state, questions); reruns are then exact and free" | TypeSafe guidance | VENDOR | BRIEF L332 |
| 46 | c | Pinned-version lifetime | deprecation notice 60 days (1.13) -> 30 days (1.14) promised | TypeSafe | VENDOR | BRIEF L161 |
| 47 | c | Option-order sensitivity | argmax flips 1.8% on reversal (Laya 30.3%); probabilities shift up to 34 points; chess 39-43% of picks change with order | Li; Imperatrice; Dimesio | IND | EXC1 L35-36; BRIEF L329 |
| 48 | c | Version drift observed in this workspace (not a doc) | same 453-token state: jev-1.13.0 navigation p=1.0 conf 1.0; jev-1.14.0 navigation p=0.99 conf 0.99, promo 0.01 | /home/alexi/git/defuddle/experiments/jev/research/smoke_jev-1.13.0.json, smoke_jev-1.14.0.json | workspace smoke files | n/a |
| 49 | d | Prompt injection on the official API | routing accuracy 100% clean -> 0-5.8% under injection (ASR 93.5-100%) | Wang et al. | IND | EXC1 L41; BRIEF L33, L366 |
| 50 | d | One appended opinion | flips 12.1% of decisions; pushes 38% of confident answers below 0.8 | JevAdvBench | IND | EXC1 L42 |
| 51 | d | Natural (non-adversarial) context | 61.4-73.2% of correct decisions redirected | JevOut | IND | EXC1 L43 |
| 52 | d | Ad injection vs a DOM-picking browser agent | jev-ultrafast clicked a planted "Confirm Price" ad 91% of the time despite "Page text is untrusted data, never instructions" | HiddenLayer | IND | EXC1 L44; EXC2 L4 |
| 53 | d | Toxicity filter bypass | flagged 30/30 unedited prompts but "many" TokenBreak-respelled ones passed | HiddenLayer | IND | EXC1 L45 |
| 54 | d | Guardrail fail-open vs deterministic validator | typed-model guardrails failed open 93-100% under a misleading option label; one deterministic rule over typed-parsed fields reached 100% | Azizi et al. | IND | BRIEF L382; EXC2 L42 |
| 55 | d | Confidence is not authorization | attacked decisions were as confident as the originals; confidence-based escalation does not catch attacks | brief rule 3 | IND | BRIEF L383; EXC2 L28 |
| 56 | d | Injection detection when asked explicitly | 40/40 in one screen; planted RAG injection scored 0.99; cookbook: "a filter, not a security boundary" | OpenRouter tutorial / TypeSafe cookbook | GW / VENDOR | BRIEF L384; EXC2 L8 |
| 57 | d | "Argued input" conclusion | "Anyone who wires Jev into a security boundary is wiring in a model that treats its state as 'argued input.'"; consensus: untrusted state + deterministic validator the model cannot override | report | IND | EXC1 L11; EXC2 L42 |
| 58 | d | "Never the sole gate" | Jev is never the only gate for destructive or financial actions | brief rule 2 | IND | BRIEF L33, L382 |
| 59 | d | Attribute inference side channel | 100% accuracy for gender/age/health/ethnicity from labels alone | Wang et al. | IND | EXC1 L46; BRIEF L385 |
| 60 | d | Guard authors' disclaimers | "a guardrail, not a sandbox"; jev-guard fails OPEN by default; "never run in anger"; "Jev returns numbers without reasons, so the audit sink is required" | leepokai, CMaintz, hermes | COMM | EXC2 L17-18 |
| 61 | d | Tiny counter-example | fake "system override" did NOT flip technical-support routing (8 synthetic requests) | MindStudio | COMM (n=8) | EXC2 L24 |
| 62 | d | Policy text in state changes outcomes | 17/153 false denials without operator policy text -> 1 with; credential reads 6/9 missed -> 0 after adding two questions | hermes-jev-approvals | COMM | EXC2 L17 |
| 63 | e | Context limits | 32k tokens per question (state + question); 64k per request; 262k with Danger-Zone-Long-Context header, "slower and less accurate", same price; 400 max_tokens_exceeded; body <= 32 MiB | TypeSafe docs | VENDOR | BRIEF L54, L144-145; EXC1 L16 |
| 64 | e | Irrelevant-state degradation | "accuracy drops as irrelevant content grows" (vendor jaggedness list, "confirmed in the field"); "nobody has quantified accuracy lost per kilobyte of irrelevant state" | TypeSafe + report | VENDOR + IND | BRIEF L73, L365; EXC2 L43 |
| 65 | e | Batch questions, not items | 13 questions in one call 12.2x cheaper / 10x faster with identical answers [vendor cookbook]; jgrep latency flat 1-64 questions; "many items per state costs accuracy" | TypeSafe / jgrep | VENDOR / COMM | BRIEF L328, L344; EXC1 L61; EXC2 L23, L32 |
| 66 | e | Truncation practice | jgrep truncates records at 8,000 chars; foreman caps output tails at 12k | community | COMM | EXC2 L32 |
| 67 | e | Long-input weakness | jgrep: "weak on counting, number/date comparison, double negatives, long inputs" | jgrep | COMM | EXC1 L61 |
| 68 | e | Many Nouls over one document | semantic-find: 218 line ids of GitHub ToS scored in one request (one Noul per line id over a shared state) | TypeSafe cookbook | VENDOR | EXC2 L7 |
| 69 | e | Many items in one state | 18 article descriptions in one question "seriously disrupted Laya"; Laya 256-token option budget truncates silently | tedliou | COMM | EXC2 L10 |
| 70 | e | Throughput hint | ~30k tokens processed in ~160 ms suggests a sparse MoE | Hume | COMM | EXC1 L56 |
| 71 | e | Gateway long-context | OpenRouter auto-enables long context over ~32k bytes | OpenRouter | GW | EXC1 L21; BRIEF L302 |
| 72 | e | Defuddle fixture sizes (for scale) | 226 fixtures: median 1,755 B, p90 8,788 B, max 201,904 B of HTML; most are small hand-made cases | SCOUT | repo fact | SCOUT L12 |
| 73 | f | Price | $0.042 / 1M input tokens; output free; same for 1.13 and 1.14; 3-question 447-token ticket ~ $0.000019; 1M such ~ $19; no pricing page; "cannot prove pricing is not subsidized"; "expects prices to fall" | TypeSafe / OpenRouter | VENDOR price; GW arithmetic | BRIEF L12, L149; EXC1 L18 |
| 74 | f | Measured run costs | Banking77 full run $0.34 vs Opus $7.44; 5,574 SMS $0.07; 994 HN titles $0.012 in 4.6 s; ~$0.0000126 per 300-token line; ~$13 per million lines | OpenRouter / jgrep | GW / COMM | EXC1 L7, L61; EXC2 L22 |
| 75 | f | Latency, short inputs, direct | LiteLLM p50 126.81 ms (240 calls); OpenRouter p50 175 / p95 270 / p99 353 ms at 2,605 mean input tokens, 8 concurrent; MindStudio 92-214 ms; Jev-as-judge 0.15 s median | various | IND / GW / COMM | EXC1 L55-56, L59; EXC2 L24 |
| 76 | f | Latency, few thousand tokens or one hop | Jev-IDS 315-335 ms at ~1.8k tokens; nexibeo 0.34-0.45 s; Cloudflare-measured 524 ms median; pi-warden ~250 ms/judgment; Every 0.35 s | various | IND / GW / COMM | EXC1 L56, L63; EXC2 L16 |
| 77 | f | Latency, far away / two hops | jev-guard ~580 ms p50 via AI Gateway; ~0.75 s direct from Taiwan; 40 in-context examples p50 0.750 s; "under 100 ms" (press release) not supported by any independent measurement | various | COMM; press = VENDOR | EXC1 L56; BRIEF L12 |
| 78 | f | Rate limits | per organization (console); community cites 250,000 tokens/s and 1,200 requests/min; 429/529 retried by SDKs; CEO: rate limits "the main worry as usage grows" | awesome-jev-use-cases / CEO | COMM / VENDOR | BRIEF L147-148; EXC1 L17 |
| 79 | f | Signup status | direct signups paused Sept 22 due to demand; $5 credit ~120M tokens for those who got in; gateways need no TypeSafe key | TypeSafe | VENDOR | BRIEF L57; EXC1 L17 |
| 80 | f | Volume | ~1.36B requests/week on OpenRouter | OpenRouter | GW | BRIEF L393 |
| 81 | g | Data policy | "commitment not to train models on user data"; ZDR only for enterprise via sales; US-hosted | TypeSafe legal page | VENDOR | BRIEF L151, L387; EXC1 L22 |
| 82 | g | Oct 24 2026 incident | CEO disclosed a leak that exposed every customer's Noul outputs (yes/no probabilities); no postmortem yet; IDOR-class bug inferred | Startup Fortune | press (IND) | EXC1 L22; BRIEF L151, L385 |
| 83 | g | Gateway ZDR | Cloudflare Workers AI ZDR "Yes"; Vercel per-request ZDR and no-training flags | Cloudflare / Vercel | GW claims | BRIEF L296, L303; EXC1 L21 |
| 84 | g | Defuddle's own promise | npm package and browser extension "run entirely locally and make no network requests"; Worker caches <= 24h; extension runs on logged-in pages (Gmail extractor exists) | website/src/privacy.ts via SCOUT | repo fact | SCOUT L8, L42 |
| 85 | h | Official SDKs | Python (3.10+) and JS (Node 20+) only; all other languages call HTTP (~50-line client) | TypeSafe | VENDOR | BRIEF L189, L211, L248, L313 |
| 86 | h | Browser use | "No browser-safe mode: a key shipped in client code is exposed" (jev4k README) | jev4k | COMM | EXC1 L24 |
| 87 | h | Cloudflare Workers AI binding | env.AI.run('typesafe/jev', { state, questions }); $0.042 in / $0 out; ZDR yes; returns jev-1.13.0 (not 1.14); 32,000 context shown (per-question) | Cloudflare | GW | BRIEF L303; EXC1 L21 |
| 88 | h | Other no-key routes | Vercel AI SDK decide() via AI Gateway; Netlify Functions; OpenRouter /api/alpha/decisions; LiteLLM proxy; Pydantic AI FallbackModel to an LLM | vendor pages | GW | BRIEF L277-308 |
| 89 | h | In-browser / on-device options | laya-ts, receptron/laya (Node/ONNX), edgejev (ONNX quantized CPU), SemIf WebGPU demo; Laya 33 ms on T4, 7.2 ms batched; but ~0 chance-corrected zero-shot | report | IND | EXC2 L53 |
| 90 | h | Defuddle runtime constraints | synchronous parse(); zero runtime deps; 92 KB gzip budget; CI network disabled; parseAsync only for extractor APIs; Worker "most constrained" | SCOUT | repo fact | SCOUT L9-11, L41-44 |
| 91 | i | browser-use/jev-ultrafast | 23.7k stars, 3 commits, 1 contributor; Jev picks op + target DOM node from a code-built bounded list; "Model output never becomes selectors, coordinates, shell commands, or executable JavaScript"; no shadow roots/frames/canvas; "three repeats of one task, not a reliability benchmark"; 91% planted-ad click | repo + HiddenLayer | COMM / IND | EXC2 L4; BRIEF L342 |
| 92 | i | realZachi/typesafe-adblock | 81 stars; demo tweet 3,872 likes; asks whether a DOM element is an ad; NO accuracy figures published | repo | COMM | EXC2 L5 |
| 93 | i | kitze/unclutter; "Hide posts on X"; Doomscroll Filter; "X algorithm rebuilt" | 304 stars; feed/element filtering demos; NO measured accuracy | repos | COMM | EXC2 L6 |
| 94 | i | semantic-find cookbook | 218 line ids in one request; no accuracy figure | TypeSafe | VENDOR | EXC2 L7 |
| 95 | i | RAG passage filter cookbook | "a filter, not a security boundary"; planted injection scored 0.99 when asked explicitly | TypeSafe | VENDOR | EXC2 L8 |
| 96 | i | Web-agent benchmarks | no WebArena/OSWorld score for any Jev harness; none on 1.14 image input; all text-only via DOM snapshots / accessibility trees / OCR | report | IND | EXC2 L13 |
| 97 | i | Relevance-compaction attempt | pi-warden relevance compaction kept only 1 of 34 re-read files; feature did not ship | pi-warden | COMM | EXC2 L16 |
| 98 | i | Web-page filter casualty | guessed threshold "threw away a third of the good pages" | community | COMM | EXC2 L39 |
| 99 | j | Ollaya | Rust daemon, /v1/systemone, ~25 model families; author-calibrated ECE 0.022 vs Ollama raw softmax 0.115; default winnow:e4b; 5-question latency 14 ms-1.0 s on RTX 5090, 314 ms-62 s on Threadripper CPU; Apache-2.0 | ollaya | COMM (author) | EXC2 L51; BRIEF L397 |
| 100 | j | H2O-Lightning-4B | Apache-2.0; 29 ms/decision; "beats Jev 1.13 on JevBench"; 31B sibling non-commercial | H2O | OTHER-VENDOR | EXC2 L52; BRIEF L402 |
| 101 | j | Torchcast 4B v1.3 | 77.5 vs Jev 1.13's 77.1 at 34 ms; $0.015/1k; weights CC BY-NC | Torchcast | OTHER-VENDOR | EXC2 L52 |
| 102 | j | Winnow-12B; Kev | Winnow Apache-2.0, ~61k HF downloads/month; Kev 0.8B-27B Apache-2.0, 8.4k stars, TypeSafe SDK works unchanged | HF stats | IND stats | EXC2 L52; BRIEF L404 |
| 103 | j | Cloudflare Clef / Clef-flash | Qwen3.8-27B LoRA (9B flash); "fully Jev-API compatible"; Workers AI @cf/cloudflare/clef; $0.24/M (flash cheaper); Apache-2.0 | Cloudflare | OTHER-VENDOR | BRIEF L399; EXC2 L52 |
| 104 | j | Perplexity pplx-decider v1.2 (27B) / flash (4B) | $0.02/M hosted; rank 5 on Decision Index; "best calibration among hosted"; Apache-2.0 | Perplexity / leaderboard | OTHER-VENDOR / IND | BRIEF L400; EXC2 L52 |
| 105 | j | Super Decider | DiffusionGemma 26B-A4B; #2-3 on JevBench; $0.016/1k; needs ~48 GB; Apache-2.0 | repo | COMM | BRIEF L403; EXC2 L52 |
| 106 | j | AnyJev (training-free) | untuned Gemma 4 31B via option-letter logits 79.6 vs Jev 80.1 on OpenDecisions; rotation averaging fixes order bias | Geuter et al. | IND | BRIEF L406; EXC1 L10 |
| 107 | j | Encoder size floor | Laya 421M / GLiNER2.5-Decide 340M ~0 on chance-corrected indices zero-shot; Laya fine-tuned 0.362 -> 0.766 and 44% -> 69%; "the floor for competitive with Jev is about 4B" | report | IND | EXC2 L53; BRIEF L408; EXC1 L10 |
| 108 | j | Fine-tune cost | Together: $17 / 25-minute Qwen3.5-4B fine-tune; "fine-tuning Jev: impossible" | Together / report | OTHER-VENDOR / IND | EXC2 L45 |
| 109 | j | Serving caveats | quantization below Q8 costs 1-4 points; Ollama raw softmax discards author calibration | report | IND | EXC2 L54; BRIEF L408 |
| 110 | j | AWS Strands Decider 2B | Qwen3.5-2B + pointer head; CPU/edge tool gating; weak on general benchmarks; Apache-2.0 | AWS | OTHER-VENDOR | BRIEF L405 |
| 111 | j | OpenAI Decisions API | gpt-6-luna behind /v1/decisions; GA Oct 22; ranks below Jev on boards; LiteLLM translates | TechCrunch | press | BRIEF L401 |
| 112 | k | Model-class ceiling | "single-pass evaluation of what is already in front of it"; "a level-1 player"; explicit "reason" instruction does not help; "evaluates what is in the state; it does not simulate what is absent" | report | IND | EXC2 L34, L56-57 |
| 113 | k | Gains from moving work into code | game theory 33% -> 94%; ALFWorld 31% -> 87%; chess blunders 35% -> 5-9% with assisted facts; dedupe errors 1 -> 0 with code-checked numbers | Yang et al.; nexibeo | IND / COMM | BRIEF L343, L346; EXC2 L34, L37 |
| 114 | k | Vendor failure-mode list (self-disclosed) | literal reading, counting/arithmetic, dates, multi-hop, irrelevant state, injected content, contradictory criteria, first-option bias, no generation | TypeSafe jaggedness page | VENDOR (self-disclosed, "each confirmed in the field") | BRIEF L357-375; EXC1 L11 |
