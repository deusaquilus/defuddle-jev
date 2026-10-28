# Security sanitization (meaning A): full control map, a newly confirmed strip-before-resolve bypass, residual gaps, and why a Jev gate would subtract rather than add

_Verbatim final report of the phase-1 workflow agent `security-map` (workflow run wf_5ee8a70d-c06, 2026-10-27). Paths under /tmp were rewritten to their new repo locations; the raw record is workflow/journal.jsonl._

## Summary

I mapped every security-sanitization control in defuddle 0.19.6 (src/utils/dom.ts, src/defuddle.ts, src/constants.ts, src/standardize.ts, src/markdown.ts, extractors, the innerHTML lint, five XSS test files, five GHSA advisories, and the defuddle.md Worker) and then measured it offline with a round-trip differential harness: 433 probe rows in experiments/jev/research/results/security-map/roundtrip-v2.mjs plus 126 rows from an earlier attempt's probe.mjs/probe2.mjs that I re-scored, each run under both linkedom (htmlparser2 10.1.0) and JSDOM (parse5) input and re-parsed with JSDOM as the consumer-browser oracle. No Jev API calls were made; none were needed to settle this slice.

Measured headline: the deterministic sanitizer has a live, exploitable ordering bug. In `_sanitizeExtractorHtml` (src/defuddle.ts:1824 strips, :1825 resolves) and `_serializeFallbackBody` (:325 strips, :326 resolves), `stripUnsafeElements` runs BEFORE `resolveRelativeUrls`, whose `resolve()` helper strips leading quotes/backslash-quotes (:1447-1450). A page value `href='"javascript:alert(1)'` passes `isDangerousUrl` (starts with `"`), then resolve turns it into `javascript:alert(1)`. Per boundary 18/28 probe rows leaked an executable URL (identical under linkedom and JSDOM), and it reaches the public API end to end through a real site extractor (x-article: output `<a href="javascript:alert(2)">`) and through the schema.org articleBody fallback that fires on any page. The main pipeline (resolve at :1070, strip at :1087) is immune (0/28) and the Markdown layer catches it (0/14), so HTML consumers are the victims; the worst one is defuddle.md's documented `/html/` mode, which serves `result.content` as `text/html` on its own origin with no CSP/sandbox/nosniff (website/src/index.ts:622-636). The bug has shipped since 0.19.0/0.19.1 (June 2026) and is unreported.

Across the remaining 500+ probe rows I found zero script-execution bypasses: 48 mXSS/encoding/raw-text payloads x 3 option sets x 2 parsers, every classic DOMPurify-bypass shape, SMIL, template, foreignObject, MathML href, entity/whitespace/control obfuscation, abrupt comments, CDATA: all clean. The residual gaps are all non-script and all option- or path-dependent: `meta`/`link` survive only when `removeExactSelectors=false` (not covered by stripUnsafeElements); `srcset`/`data-src`/`poster`/`background` are never URL-checked (inert in modern browsers); the iframe `allow` attribute is allowlisted; SVG elements keep every attribute including `style` (standardize.ts:475-481) so `fill:url(https://attacker)` always survives; `resolveTailwindClasses` writes a page-derived `text-[...]` value straight into `style` (standardize.ts:929-953) in DEFAULT mode; Markdown complex tables keep `style`/`bgcolor` (markdown.ts:875). None of these is XSS; they are tracking, CSS overlay, and permission-delegation vectors.

The pattern matters for the Jev question: all five GHSA advisories (Mar 5, Jun 24, Aug 22, Sep 17, Oct 24 2026) and the bug found today are coverage/ordering defects in a deterministic design: a boundary that did not run the sanitizer, an element type not traversed, a sink not escaped, two steps in the wrong order. None was a failure to judge ambiguous content. A probabilistic classifier cannot repair "the sanitizer did not run here" or "ran before the rewrite"; it adds one more path to miss. As a gate, Jev would trade exact string checks for a model whose state is argued input (93-100% injection ASR, TokenBreak respellings bypassed its toxicity filter, 91% planted-ad clicks), that is non-deterministic (12% chosen-option change on repeat, no seeds), that costs 175-500 ms per call against a measured Defuddle p50 of 149 ms, that cannot run in the synchronous browser bundle or offline CLI, that cannot hold an API key in an extension, and that would ship page content (the Gmail/ChatGPT/Claude extractors exist) off-device against the stated "make no network requests" promise. As a fuzz oracle it is dominated by the exact oracle I used (spec-parser round trip + attribute scan), which found a real bypass at zero cost. The only defensible role is Worker-side telemetry that never touches output, and even that adds little the deterministic oracle does not already give.

Verdict for this dimension: do not use Jev for meaning-A sanitization, aggressively or otherwise. The path to "99.99%" is deterministic and concrete: fix the two ordering bugs (strip after resolve, or make strip the last operation in every boundary and have resolve() stop stripping quotes), collapse the five HTML output boundaries into one typed finalizer, replace the element denylist plus five-attribute URL check with an allowlist serializer (DOMPurify-style per-attribute URL policy; `data:` only on img/source/track/image; drop meta/link/base/form/style regardless of options), add the round-trip differential test under linkedom + JSDOM + a real browser to CI with property-based fuzzing, and put a CSP sandbox on defuddle.md `/html/` responses so an origin XSS is impossible even when the sanitizer is wrong.

## Verdict for this dimension

Do not use Jev for security sanitization (meaning A), at any aggressiveness. Every historical defect (5 GHSAs) and the one confirmed today (strip-before-resolve on _sanitizeExtractorHtml and _serializeFallbackBody, exploitable through the schema.org fallback and all 25 site extractors, and an origin XSS on defuddle.md /html/) is a coverage or ordering omission in deterministic code; a probabilistic, non-deterministic, injectable, remote model cannot close that class and would add latency (1-3x the whole parse), privacy exposure, an offline/sync-API break, and a new path to miss. The route to ~99.99% is deterministic: fix the two ordering bugs immediately; funnel all five HTML boundaries through one typed finalizer that strips last; replace the denylist with an allowlist serializer with a per-attribute URL policy (data: only on media attributes; meta/link/base/form/style gone regardless of options; CSS property allowlist on SVG/table style); add the spec-parser round-trip differential test (linkedom + JSDOM + a real browser) and property-based fuzzing to CI; and put a CSP sandbox plus nosniff on defuddle.md /html/ responses so a sanitizer miss can no longer become origin XSS. The only tolerable Jev role is Worker-side telemetry that never influences output, and it earns little over the exact oracle.

## Findings

- - **claim:** NEW, CONFIRMED BYPASS: quote-prefixed dangerous URLs survive on two sanitization boundaries because stripUnsafeElements runs before resolveRelativeUrls, and resolve() strips leading quotes.
  - **evidence:** src/defuddle.ts:1820-1827 (_sanitizeExtractorHtml: :1824 this._stripUnsafeElements(container); :1825 this.resolveRelativeUrls(container)); src/defuddle.ts:322-327 (_serializeFallbackBody: :325 strip, :326 resolveContentUrls); src/defuddle.ts:1444-1458 resolve() does `.replace(/^\\?["']+/, '')` then `new URL(normalized, baseUrl)`. src/utils/dom.ts:73-80 isDangerousUrl checks startsWith('javascript:') on the raw value, so `"javascript:alert(1)` passes. Measured (roundtrip-v2-results.json, strict scheme-anchored oracle): A1 _sanitizeExtractorHtml 18/28 rows leak (a href javascript: x5 variants, a href data:text/html, iframe src javascript:, iframe src data:text/html, img src javascript:; each under linkedom and JSDOM); A2 _serializeFallbackBody 18/28; A3 schema.org articleBody fallback end-to-end through Defuddle() 18/28; A4 main pipeline control 0/28 (resolve at :1070 precedes strip at :1087). Output literally contains `<a href="javascript:alert(1)">click</a>`.
  - **confidence:** high
  - **refs:** - src/defuddle.ts:1820-1827
    - src/defuddle.ts:322-327
    - src/defuddle.ts:1444-1458
    - src/utils/dom.ts:73-80
    - src/defuddle.ts:1070
    - src/defuddle.ts:1087
    - experiments/jev/research/results/security-map/roundtrip-v2-results.json
- - **claim:** The bypass reaches the public API through a real site extractor and through the schema.org fallback that applies to any page; every one of the 25 site extractors is routed through the vulnerable _sanitizeExtractorHtml.
  - **evidence:** src/defuddle.ts:1775 buildExtractorResponse -> _sanitizeExtractorHtml; :204 schema fallback -> _sanitizeExtractorHtml(schemaText); :311 _fallbackResponse -> _serializeFallbackBody. Measured A6: x.com article page with header `<img src='"javascript:alert(1)'>` and body `<a href='"javascript:alert(2)'>` yields content `<article class="x-article"><img src="javascript:alert(1)?name=large" alt="ok"> <h1>Test Article</h1> <p>Body text <a href="javascript:alert(2)">link</a></p></article>` (extractorType xarticle; linkedom and JSDOM). A3: a page with JSON-LD articleBody containing the payload and a short visible body (<main><p>hi</p></main>) returns the payload with the quote stripped. escapeHtml at the extractor sink does not help: escapeHtml('"javascript:...') -> `&quot;javascript:...` which the DOM decodes back to a quote-prefixed value.
  - **confidence:** high
  - **refs:** - src/defuddle.ts:1775
    - src/defuddle.ts:204
    - src/defuddle.ts:311
    - src/extractors/x-article.ts:97
    - src/utils/dom.ts:38-44
- - **claim:** Victim with the highest impact: defuddle.md `/html/` mode serves extracted HTML as text/html on the defuddle.md origin with no Content-Security-Policy, sandbox, X-Frame-Options or nosniff, and Access-Control-Allow-Origin: *; a crafted page therefore yields origin XSS for anyone opening defuddle.md/html/<url> in a browser (cached 5 min for unauthenticated requests).
  - **evidence:** website/src/index.ts:524-525 (htmlMode = path.startsWith('/html/')), :622-636 (Content-Type text/html; ACAO *; s-maxage=CACHE_TTL), :17 CACHE_TTL = 300; grep of website/src/index.ts finds no Content-Security-Policy or sandbox header anywhere; the only nosniff is on the markdown docs path (:385). Documented feature: website/src/docs-content.ts:124-126. convertToHtml (website/src/convert.ts:129-154) returns result.content unchanged. Origin exposure is limited (API keys travel in Authorization header or ?key= query, :563-569; success page shows a one-time key, website/src/success.ts:101-107); still a stored/reflected XSS on a paid API domain.
  - **confidence:** high
  - **refs:** - website/src/index.ts:524-525
    - website/src/index.ts:622-636
    - website/src/index.ts:17
    - website/src/docs-content.ts:124-126
    - website/src/convert.ts:129-154
- - **claim:** The Markdown layer independently neutralizes the bypass, so Markdown consumers (the default for the Obsidian clipper flow and the defuddle.md default endpoint) are not exposed by it.
  - **evidence:** Measured A5: schema fallback + {markdown:true} 0/14 strict hits; C createMarkdownContent direct 0/14 (it never resolves URLs so the quote prefix stays and the value is an inert relative URL). Mechanism: src/markdown.ts:70 formatMarkdownLinkDestination returns '' when isDangerousUrl(href); :211-213 sanitizedOuterHTML re-runs stripUnsafeElements on kept elements (iframe/video/audio/sup/sub/svg/math, :365); :893 complex tables re-run it; :240-245 autolink escaping. Whether the Obsidian Web Clipper consumes `content` HTML or Markdown from defuddle is not verifiable from this repo (inference).
  - **confidence:** high
  - **refs:** - src/markdown.ts:70
    - src/markdown.ts:211-213
    - src/markdown.ts:365
    - src/markdown.ts:893
    - experiments/jev/research/results/security-map/roundtrip-v2-results.json
- - **claim:** Complete control map: the deterministic design is a denylist of 16 element types + on*/srcdoc attribute strip + a 3-scheme URL check on exactly five attributes (href, src, action, formaction, xlink:href), applied at five HTML output boundaries plus two Markdown sub-boundaries, with an optional attribute allowlist and an innerHTML lint.
  - **evidence:** src/utils/dom.ts:83-96 UNSAFE_ELEMENT_TAGS (SCRIPT non-math, STYLE, NOSCRIPT, TEMPLATE, FRAME, FRAMESET, OBJECT, EMBED, APPLET, BASE, ANIMATE, SET, ANIMATEMOTION, ANIMATETRANSFORM, ANIMATECOLOR, DISCARD) and URL_ATTRIBUTES; :114-141 stripUnsafeElements (root included at :125; iframe src disallows data:image at :132; returns unsafeRoot so caller emits '' at defuddle.ts:1090); :186-202 parseHTML via <template> with a <div>.innerHTML fallback; :29-33 decodeHTMLEntities via <textarea>. Boundaries: defuddle.ts:1087 (main, unconditional), :1775/:1820-1827 (extractor), :204 (schema text), :189-190 (schema clone), :311/:322-327 (fallback), markdown.ts:211-213 and :893. Allowlist: src/constants.ts:1080-1148 ALLOWED_ATTRIBUTES (no style/class/id/rel/http-equiv/content/target/action/poster/background; includes allow, sandbox, src, href, srcset, data-src, data-srcset) applied in src/standardize.ts:471-548 only when standardize is on (:207, :251) or on extractor output (:173). Option-gated element removal of noscript/script/style/meta/link in EXACT_SELECTORS src/constants.ts:96-101 (defuddle.ts:1033-1041). Lint: scripts/check-no-innerhtml.mjs bans .innerHTML/.outerHTML assignment outside src/utils/dom.ts. Tests: tests/extractor-xss.test.ts, url-scheme-sanitization.test.ts, markdown-xss.test.ts, svg-sanitization.test.ts, template-sanitization.test.ts.
  - **confidence:** high
  - **refs:** - src/utils/dom.ts:83-141
    - src/utils/dom.ts:186-202
    - src/constants.ts:1080-1148
    - src/standardize.ts:471-548
    - src/constants.ts:96-101
    - scripts/check-no-innerhtml.mjs
- - **claim:** All five published GHSA advisories, and the bug found today, are coverage/ordering defects (a boundary, element type, sink, or step order the deterministic code missed), not judgment failures on ambiguous content.
  - **evidence:** gh api security-advisories: GHSA-5mq8-78gm-pjmq 2026-03-05 medium (unescaped interpolation in _findContentBySchemaText image tag); GHSA-jg4p-g6xj-4qmf 2026-06-24 high (extractor template output bypassed DOM sanitizer); GHSA-wcqc-p9mh-prvm 2026-08-22 medium (JSON-LD articleBody fallback unsanitized); GHSA-3cr7-rgx8-76c3 2026-09-17 medium (<template> content not traversed, mXSS); GHSA-6frv-jcwm-xqcj 2026-10-24 medium (raw HTML kept in Markdown unsanitized). Commits: ea09d84/f154cb7/7cd4a27 (2026-03-05), baf2eae (06-24), ceae461+d179048 (08-22), 39d47d2 (09-16), 3035cea (10-24). Today's finding: strip-before-resolve on two boundaries, present since a432eae (0.19.0, 2026-06-16) and baf2eae (0.19.1, 2026-06-24), enabled by quote-stripping from f74fdd0 (0.13.0, 2026-03-12). Cadence: 6 defects in ~8 months, each fixed by adding one more site-specific pass.
  - **confidence:** high
  - **refs:** - CHANGELOG.md:3-29
    - git log: ea09d84 f154cb7 7cd4a27 baf2eae ceae461 d179048 39d47d2 3035cea a432eae f74fdd0
- - **claim:** No parser-differential or mXSS bypass was found between linkedom/htmlparser2 and parse5/JSDOM across the classic vectors.
  - **evidence:** Group B: 48 payloads x {default, standardize:false, all-removals-off} x {linkedom, JSDOM} = 288 rows; 0 script-execution hits. Includes DOMPurify-2.0.17 form/math/mglyph/style, mtext/table/mglyph/style, svg>p>style, svg CDATA breakout, annotation-xml text/html, attribute-value tag breakout, hex/tab/control/colon entity javascript:, U+2028, mixed case, iframe javascript:/data: b64, details ontoggle, marquee onstart, svg image/feImage/use/script/handler, object/embed/base, nested anchors, comment smuggling. Prior probe.mjs (51 payload/option combos, both parsers): raw-text-vs-foreign-content differentials (svg>noembed/xmp/noframes/iframe/textarea/title/plaintext, math>mtext>textarea), svg style escape mXSS, abrupt comment, bogus PI, template-in-svg, srcdoc entity, slash-separated img onerror: all clean.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/security-map/roundtrip-v2.mjs
    - experiments/jev/research/results/security-map/probe.mjs
    - experiments/jev/research/results/security-map/probe-results.json
- - **claim:** Residual non-script gaps (measured): meta/link survive when removeExactSelectors=false; srcset/data-src/poster/background are never URL-checked; iframe allow is allowlisted; vbscript: passes.
  - **evidence:** probe.mjs rows: 'meta refresh (no removals)' -> <meta http-equiv=refresh> in output; 'link stylesheet (no removals)' -> <link rel=stylesheet href=attacker>; v2 'link import/preload [noremove]' same. Cause: meta/link only in EXACT_SELECTORS (constants.ts:100-101), not in UNSAFE_ELEMENT_TAGS (dom.ts:83-86); with standardize on, rel/http-equiv/content are dropped by ALLOWED_ATTRIBUTES so default mode is inert. srcset/data-src/poster javascript: survive under standardize:false (URL_ATTRIBUTES dom.ts:96 omits them; srcset/data-src are in ALLOWED_ATTRIBUTES constants.ts:1089-1090,1109); browsers do not execute javascript: in these, and markdown.ts:153 checks the selected srcset candidate. `<table background=javascript:>` survives under standardize:false (legacy attribute, inert in modern browsers). `allow="camera *; microphone *; geolocation *"` on an attacker iframe survives in DEFAULT mode (constants.ts:1082). vbscript: passes isDangerousUrl (IE-only). Exploitability: redirect/CSS-injection/permission-delegation/tracking only; deterministic fixes: add meta/link/form/base to UNSAFE tags unconditionally; URL-check srcset/data-src/data-srcset/poster/background/ping; drop or constrain allow; block vbscript:.
  - **confidence:** high
  - **refs:** - src/constants.ts:96-101
    - src/utils/dom.ts:83-96
    - src/constants.ts:1082
    - src/constants.ts:1089-1090
    - experiments/jev/research/results/security-map/probe-results.json
- - **claim:** CSS/style gaps (measured): SVG elements keep `style` in every mode; a page-derived Tailwind `text-[...]` token is written verbatim into a style attribute in DEFAULT mode; Markdown complex tables keep style/bgcolor when standardize is off or via createMarkdownContent.
  - **evidence:** src/standardize.ts:475-481 (SVG elements: only class removed, all other attributes kept) -> `<rect style="fill:url(https://attacker.example/t)">` survives in default/nostd/noremove (6/6 rows). src/standardize.ts:929-931 pushes `font-size:${match[1]}` from TW_ARBITRARY_RE (constants.ts:1184 /^text-\[(.+)\]$/) and :950-953 writes it into style -> class `text-[12px;background:url(https://attacker.example/t)]` becomes style="font-size:12px;background:url(https://attacker.example/t)" in DEFAULT mode (2/2 rows). src/markdown.ts:875 allowedAttributes includes 'style' and 'bgcolor' -> `<td style="position:fixed;...;background:url(...)">` survives with {markdown:true, standardize:false} and with createMarkdownContent direct (2/3 rows). Impact: external fetch (IP/tracking) and UI overlay in renderers honoring inline style; no script. Fix: allowlist CSS properties (fill/stroke/opacity/font-*) and reject `url(`/`position`; validate text-[...] against /^[\d.]+(px|rem|em|%)$/.
  - **confidence:** high
  - **refs:** - src/standardize.ts:475-481
    - src/standardize.ts:929-953
    - src/constants.ts:1184
    - src/markdown.ts:875
- - **claim:** Scheme coverage: entity-encoded, whitespace/control-obfuscated, mixed-case javascript:, data:image/svg+xml on <a>, <use href=data:>, file:, about:, obsidian:// and custom schemes are handled acceptably or are browser-mitigated; only vbscript: (dead) and the quote-prefix ordering bug are real misses.
  - **evidence:** isDangerousUrl (dom.ts:74) removes all \s and \u0000-\u001F before matching, so `java\tscript:`, `&#14; javascript:`, `&#x6A;avascript:` (DOM-decoded) are caught (measured clean). data:image/* is allowed on any href/src except iframe src (:77, :132): `<a href="data:image/svg+xml,<svg onload>">` survives but Chrome/Firefox block top-frame navigation to data: URLs (Firefox explicitly excludes image/svg+xml from its allowlist), and `<use href=data:image/svg+xml>` referenced documents are script-disabled (inference from browser behavior, not executed here). file:/about:/custom schemes pass by design (relative and mailto must pass); risk is click-phishing only. Deterministic tightening: allow data: only on img/source/track/video/audio/svg image, never on <a>/<use>/<feImage>.
  - **confidence:** medium
  - **refs:** - src/utils/dom.ts:73-80
    - src/utils/dom.ts:132
    - experiments/jev/research/results/security-map/probe-results.json
- - **claim:** Defuddle's own latency budget makes a per-page remote decision call a 1-3x slowdown of the whole pipeline, and the browser bundle is synchronous and offline by contract.
  - **evidence:** Measured perf-baseline.json (226 fixtures, linkedom, Node 22, single run, no warm-up): p50 148.8 ms, p90 608 ms, p99 4337 ms, max 7979 ms (general--substack-app.html, 68 KB). Jev independent p50: 175 ms direct at 2.6k tokens (OpenRouter), 300-500 ms with a few k tokens or via gateway, 524 ms Cloudflare-measured median (JEV_ECOSYSTEM_EXCERPTS_1 s5). Browser API `new Defuddle(document).parse()` is synchronous (SCOUT_NOTES); CLI/fixture tests are hermetic; website/src/privacy.ts:31 promises 'The npm package and browser extension run entirely locally and make no network requests'; no browser-safe key mode exists for Jev (brief s3: a key shipped in client code is exposed).
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/security-map/perf-baseline.json
    - website/src/privacy.ts:31
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md
    - experiments/jev/research/JEV_AGENT_BRIEF.md
- - **claim:** Jev as the sanitization gate would subtract from security: the model evaluates argued input it cannot verify, cannot see what later code does to a value, is non-deterministic, and fails exactly on adversarially obfuscated strings.
  - **evidence:** Brief s8 rule 1-3 and excerpts: state is untrusted argued input; routing accuracy 100% -> 0-5.8% under injection (ASR 93.5-100%, Wang et al.); one appended opinion flips 12.1% (JevAdvBench); 'Page text is untrusted data, never instructions' did not stop 91% planted-ad clicks (HiddenLayer); TokenBreak-respelled prompts passed its toxicity filter; attacked decisions were as confident as originals so confidence gating does not catch attacks; 12% chosen-option change on repeat, no seeds, version drift; 'Jev evaluates what is in the state; it does not simulate what is absent' (Yang et al.). Applied here: the confirmed bypass is `"javascript:` followed by a code-side quote strip; a Noul asked 'is this URL dangerous?' sees a quote-prefixed string that is in fact inert until resolve() runs, so a correct literal answer is 'no'. 32k-token per-question cap vs fixtures up to 201,904 bytes forces truncation, and a payload can be placed past the cut. Fail-closed on 429/529/outage would drop all content; fail-open adds nothing.
  - **confidence:** high
  - **refs:** - experiments/jev/research/JEV_AGENT_BRIEF.md (s7, s8)
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md (s4, s10)
    - experiments/jev/research/SCOUT_NOTES.md
- - **claim:** Jev as a secondary detector/telemetry is feasible only on the Worker, adds little beyond the exact deterministic oracle, and costs roughly 6-10% of per-request revenue plus 300-500 ms.
  - **evidence:** Cloudflare Workers AI exposes `typesafe/jev` (jev-1.13.0, ZDR yes, $0.042/M in) so the Worker could ask Nouls like 'contains a login form', 'contains a redirect to another site', 'contains obfuscated markup' for logging. Cost: a 7k-token page ~ $0.0003 vs defuddle.md price $0.003-0.005/request (SCOUT_NOTES). The exact oracle (spec-parser round trip + scan for on*, forbidden elements, dangerous schemes), as implemented in roundtrip-v2.mjs, already detects 100% of the XSS-class constructs with zero false positives on the 33 payload variants the strict scorer demoted; Jev can only add semantic categories outside the XSS threat model (phishing, lookalike). No labeled corpus exists for shadow mode (SCOUT_NOTES: ground truth is 226 expected outputs, none labeled for security). Oct 24 2026 leak exposed all customers' Noul outputs, so even telemetry outputs are a disclosure surface.
  - **confidence:** medium
  - **refs:** - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_1.md (s3)
    - experiments/jev/research/SCOUT_NOTES.md
    - experiments/jev/research/results/security-map/roundtrip-v2.mjs
- - **claim:** Jev as a fuzz-test oracle is dominated by an exact oracle; the exact oracle found a real bypass in 433 probes with no model.
  - **evidence:** A security test oracle must be exact and reproducible; Jev moves 0.04 probability on repeats and 12% of chosen options, reads obfuscated strings poorly (TokenBreak), cannot parse or count (brief s7), and the brief's own cookbook calls RAG screening 'a filter, not a security boundary'. roundtrip-v2.mjs (serialize -> JSDOM/parse5 re-parse -> attribute/element scan, both input parsers) is deterministic, ~70 s for 433 rows, and surfaced the strip-before-resolve bypass plus the Tailwind style injection. Marginal Jev use: clustering fuzzer-found diffs for human triage; existing corpora (DOMPurify tests, PortSwigger cheat sheet) are already categorized, so value is low.
  - **confidence:** high
  - **refs:** - experiments/jev/research/results/security-map/roundtrip-v2.mjs
    - experiments/jev/research/JEV_AGENT_BRIEF.md (s7)
    - experiments/jev/research/JEV_ECOSYSTEM_EXCERPTS_2.md
- - **claim:** Bundle headroom rules out a heavy drop-in library for the core browser bundle without raising budgets, but a purpose-built allowlist serializer fits.
  - **evidence:** scripts/check-bundle-size.mjs:7-10 budgets: dist/index.js 92 KB, dist/index.full.js 215 KB gzip; measured now: 89.8 KB and 207.1 KB (2.2 KB and 7.9 KB headroom). DOMPurify-class library is on the order of 8-10 KB gzip (inference, not measured here); an allowlist serializer over the existing ALLOWED_ATTRIBUTES set plus a per-attribute URL policy is ~1-2 KB (inference).
  - **confidence:** medium
  - **refs:** - scripts/check-bundle-size.mjs:7-10

## Metrics

- **probe_rows_v2:** 433
- **probe_rows_prior_reused:** 126
- **bypass_rows_sanitizeExtractorHtml:** 18/28 strict (16 a/iframe executable, 2 img)
- **bypass_rows_serializeFallbackBody:** 18/28 strict
- **bypass_rows_schema_fallback_e2e:** 18/28 strict
- **bypass_rows_main_pipeline_control:** 0/28
- **bypass_rows_markdown_after_schema:** 0/14
- **bypass_rows_createMarkdownContent_direct:** 0/14 strict
- **x_article_extractor_e2e:** 2/2 (a href javascript:alert(2) + img src javascript:alert(1)?name=large)
- **mxss_encoding_rows:** 288
- **mxss_script_execution_bypasses:** 0
- **mxss_nonscript_hits:** 16 (table background js x4 inert; link import/preload under all-removals-off x4; tailwind style injection default x2; svg style url() x6)
- **prior_probe_hits:** 9/51 loose, identical under linkedom and JSDOM input
- **site_extractors_routed_through_vulnerable_boundary:** 25
- **html_output_boundaries:** 5
- **markdown_sub_boundaries:** 2
- **unsafe_element_tags:** 16
- **url_checked_attributes:** 5
- **ghsa_advisories_2026:** 5
- **security_commits_by_message:** 17
- **bug_window:** 0.19.0 (2026-06-16, fallback) / 0.19.1 (2026-06-24, extractor+schema) through 0.19.6 (HEAD 2026-10-25); enabler since 0.13.0 (2026-03-12)
- **defuddle_parse_ms_p50:** 148.8
- **defuddle_parse_ms_p90:** 608.4
- **defuddle_parse_ms_p99:** 4337.1
- **defuddle_parse_ms_max:** 7978.6
- **jev_p50_ms_published:** 175 direct / 300-500 gateway / 524 Cloudflare median
- **jev_injection_asr_published:** 93.5-100%
- **jev_repeat_option_change_published:** 12%
- **jev_cost_per_7k_token_page_usd:** 0.0003
- **defuddle_md_price_per_request_usd:** 0.003-0.005
- **worker_html_mode_csp:** none
- **worker_html_cache_s:** 300
- **bundle_core_kb_gzip:** 89.8 of 92
- **bundle_full_kb_gzip:** 207.1 of 215
- **linkedom_version:** 0.18.12 (htmlparser2 10.1.0)
- **jsdom_version:** 24.1.3

## Tables

### 1. Security-sanitization control map (defuddle 0.19.6)

| Control | Location | What it does | Conditional? |
|---|---|---|---|
| `escapeHtml` | src/utils/dom.ts:38-44 | Escapes & < > " (not ') for template interpolation | Per-extractor discipline; 11 extractors use it, 8 use none (they copy DOM via serializeHTML instead) |
| `isDangerousUrl` | src/utils/dom.ts:73-80 | Strips \s and C0 controls, blocks javascript:, blob:, non-image data:; iframe src also blocks data:image | Called by stripUnsafeElements and markdown.ts:70,153,245 |
| `UNSAFE_ELEMENT_TAGS` / selector | src/utils/dom.ts:83-94 | Removes script (non-math), style, noscript, template, frame(set), object, embed, applet, base, SMIL animate/set/animateMotion/animateTransform/animateColor/discard | Unconditional inside stripUnsafeElements |
| `URL_ATTRIBUTES` | src/utils/dom.ts:96 | href, src, action, formaction, xlink:href only | srcset/data-src/poster/background/ping NOT checked |
| `stripUnsafeElements` | src/utils/dom.ts:114-141 | Root included; strips on*/srcdoc; URL check; returns unsafeRoot -> caller emits '' | Unconditional where called |
| `parseHTML` | src/utils/dom.ts:186-202 | `<template>` parsing (no script exec/resource load); `<div>.innerHTML` fallback | Fallback only in DOMs lacking template.content |
| Main boundary | src/defuddle.ts:1083-1090 | Unconditional strip after resolveRelativeUrls (:1070); unsafe root -> '' | Correct order |
| Extractor boundary | src/defuddle.ts:1775, 1820-1827 | strip (:1824) THEN resolve (:1825) THEN standardizeExtractorOutput | WRONG ORDER (bypass) |
| Schema text fallback | src/defuddle.ts:182-215 | Clone+strip for element search (:189-190); schemaText through extractor boundary (:204) | Inherits bypass |
| Body fallback | src/defuddle.ts:310-327 | strip (:325) THEN resolveContentUrls (:326) | WRONG ORDER (bypass) |
| `resolve()` | src/defuddle.ts:1444-1458 | Trims, strips leading \" or quotes, `new URL()` | The enabler |
| `ALLOWED_ATTRIBUTES` | src/constants.ts:1080-1148; src/standardize.ts:471-548 | Drops everything not listed (no style/class/id/rel/target/action/poster); keeps allow/sandbox/src/href/srcset/data-src | Only with standardize:true (default) or extractor output; SVG elements exempt (:475-481) |
| EXACT_SELECTORS noscript/script/style/meta/link | src/constants.ts:96-101 | Removes head-ish elements from content | Only with removeExactSelectors:true (default) |
| Markdown link/image/srcset checks | src/markdown.ts:70, 153, 240-245 | Dangerous destinations dropped or escaped | Always in Markdown path |
| Markdown kept-HTML re-sanitization | src/markdown.ts:211-213, 361, 365, 893 | Clone + stripUnsafeElements for iframe/video/audio/sup/sub/svg/math and complex tables; tables keep style/bgcolor (:875) | Always |
| innerHTML lint | scripts/check-no-innerhtml.mjs | Bans .innerHTML/.outerHTML assignment outside dom.ts | CI |
| Tests | tests/extractor-xss, url-scheme-sanitization, markdown-xss, svg-sanitization, template-sanitization | ~124 test/case lines across 5 files | CI (linkedom + JSDOM) |
| Worker `/html/` response | website/src/index.ts:622-636 | text/html, ACAO *, s-maxage 300; no CSP/sandbox/nosniff | Documented feature (docs-content.ts:124-126) |

### 2. Output boundaries and step order

| Boundary | Reached by | resolve vs strip order | Measured leak (strict) |
|---|---|---|---|
| Main pipeline | every normal parse | resolve :1070 -> strip :1087 | 0/28 |
| `_sanitizeExtractorHtml` | 25 site extractors (:1775) + schema text (:204) | strip :1824 -> resolve :1825 | 18/28 |
| `_serializeFallbackBody` | `_fallbackResponse` (:75, :749, :759) on null/exception | strip :325 -> resolve :326 | 18/28 |
| Schema fallback e2e (public API) | any page whose JSON-LD articleBody has >1.5x extracted words | via extractor boundary | 18/28 |
| x-article extractor e2e (public API) | x.com article URL | via extractor boundary | 2/2 |
| Markdown layer | markdown:true / createMarkdownContent | re-checks destinations + re-strips kept HTML | 0/14, 0/14 |

### 3. Residual gaps in the deterministic approach

| Gap | Where | Exploitable? | Deterministic fix |
|---|---|---|---|
| Quote-prefixed javascript:/data:text/html survives (strip before resolve) | defuddle.ts:1824-1825, :325-326, :1447-1450 | YES: a href, iframe src execute in HTML consumers; origin XSS on defuddle.md /html/ | Run strip after resolve (or strip last in every boundary); make resolve() not strip quotes, or re-run isDangerousUrl on the resolved value |
| meta refresh / link stylesheet,import,preload survive | only when removeExactSelectors=false (constants.ts:100-101 vs dom.ts:83-86) | Redirect / CSS injection / fetch; no script | Add meta, link, base, form to UNSAFE tags unconditionally |
| srcset / data-src / data-srcset / poster / background / ping not URL-checked | dom.ts:96 | Inert in modern browsers; downstream lazy-loaders could promote them | Extend URL_ATTRIBUTES; validate each srcset candidate |
| iframe `allow` kept | constants.ts:1082 | Permission delegation to attacker origin (user still prompted) | Drop allow or allowlist values (fullscreen; picture-in-picture) |
| External iframes allowed by design | tests/url-scheme-sanitization.test.ts:18-19 | Cross-origin frame: UI redress/tracking, no XSS | Keep; optionally force sandbox=\"allow-scripts allow-same-origin\" minus top-navigation |
| SVG elements keep `style` (url()) | standardize.ts:475-481 | External fetch / tracking | Allowlist CSS props; reject url( |
| Tailwind text-[...] written into style | standardize.ts:929-953 | CSS injection in DEFAULT mode | Validate against /^[\\d.]+(px|rem|em|%)$/ |
| Markdown table keeps style/bgcolor | markdown.ts:875 | position:fixed overlay / url() in renderers honoring inline style | Drop style or allowlist props |
| data:image/* allowed on any href (a, use, feImage) | dom.ts:77 | Browser-mitigated (top-frame data: nav blocked; use docs script-disabled) | Allow data: only on img/source/track/video/audio/image |
| vbscript:, file:, about:, custom schemes pass | dom.ts:75 | vbscript dead; others click-phishing only | Block vbscript:; optionally allowlist http(s)/mailto/tel/#/relative |
| Parser differential linkedom vs browser | all boundaries | NOT FOUND (0/288 + 0/51) | Keep round-trip tests in CI incl. a real browser |

### 4. Probe summary

| Group | Rows | Strict hits | Notes |
|---|---|---|---|
| A1 _sanitizeExtractorHtml | 28 | 18 | both parsers identical |
| A2 _serializeFallbackBody | 28 | 18 | both parsers identical |
| A3 schema fallback e2e | 28 | 18 | public API |
| A4 main pipeline control | 28 | 0 | |
| A5 markdown after schema | 14 | 0 | Markdown neutralizes |
| A6 x-article e2e | 2 | 2 | public API |
| B mXSS/encoding | 288 | 16 | 0 script-execution; 16 non-script (style/link/background) |
| C markdown table style | 3 | 2 | nostd + direct |
| C createMarkdownContent direct | 14 | 0 | quotes kept -> inert |
| Prior probe.mjs (reused) | 51 x 2 parsers | 9 loose | meta/link noremove; srcset/data-src/poster nostd; allow; style nostd; vbscript |

### 5. Advisories and fix cadence

| Date | ID | Severity | Class |
|---|---|---|---|
| 2026-03-05 | GHSA-5mq8-78gm-pjmq | medium | unescaped sink (schema image tag) |
| 2026-06-24 | GHSA-jg4p-g6xj-4qmf | high | boundary not sanitized (extractors) |
| 2026-08-22 | GHSA-wcqc-p9mh-prvm | medium | boundary not sanitized (JSON-LD fallback) |
| 2026-09-17 | GHSA-3cr7-rgx8-76c3 | medium | element not traversed (template, mXSS) |
| 2026-10-24 | GHSA-6frv-jcwm-xqcj | medium | boundary not sanitized (Markdown kept HTML) |
| today (unreported) | strip-before-resolve | high (HTML consumers) | step ordering on two boundaries |

### 6. Jev role matrix for meaning-A sanitization

| Role | Could add | Would cost | Brief/excerpt evidence | Verdict |
|---|---|---|---|---|
| (a) Gate | nothing the exact check does not already decide; semantic 'looks malicious' | determinism (12% flip, no seeds, drift); +175-500 ms vs 149 ms p50 parse; privacy (page text incl. Gmail/ChatGPT/Claude leaves device; Oct 24 leak); offline/sync browser API and CLI impossible; no key in extension; 32k truncation; fail-closed drops content | state is argued input; ASR 93-100%; TokenBreak bypass; 91% ad clicks; confidence not authorization | NO |
| (b) Secondary detector / telemetry | Worker-only Nouls for phishing form, cross-site redirect, obfuscated markup, logged not enforced | ~$0.0003/page (6-10% of per-request price), +300-500 ms if synchronous, output-disclosure surface, no labeled corpus | Workers AI typesafe/jev ZDR; RAG cookbook 'a filter, not a security boundary' | Optional, low value; never on output path |
| (c) Fuzz oracle | triage/cluster of fuzzer diffs | inexact, non-reproducible, blind to obfuscation | exact oracle (parse5 round trip + scan) already found a real bypass in 433 rows | NO as oracle; marginal as triage |

## Caveats

- No real browser or Obsidian/Electron execution was performed; the oracle is a static re-parse with JSDOM/parse5 plus attribute/element scanning. Statements like 'img src=javascript: is inert' and 'top-frame data: navigation is blocked' rest on known browser behavior, not on runs here.
- The 'strict' oracle treats a value as dangerous only when its parsed scheme is javascript:/vbscript:/blob:/non-image data:; values with a literal leading quote (e.g. after createMarkdownContent, which never resolves URLs) were classified inert. If some downstream consumer strips quotes the way defuddle's resolve() does, those would become live too.
- Whether the Obsidian Web Clipper renders defuddle's HTML `content` or converts it to Markdown itself could not be verified from this repository; Markdown consumers are shown to be protected, HTML consumers are not.
- Perf baseline is a single unwarmed run on this machine with linkedom under Node 22 and includes any per-fixture retry cascades; browser timings will differ. It is used only for order-of-magnitude comparison with published Jev latencies.
- Jev figures (latency, ASR, non-determinism, leak) are taken from the supplied brief and excerpts, not measured by me; no live Jev calls were made in this slice because the security argument does not depend on Jev's accuracy.
- The 25-extractor exposure is by code path (all route through _sanitizeExtractorHtml); only x-article was exercised end to end. The _serializeFallbackBody path was exercised directly; triggering it through the public API requires an exception or null result in _parse(), which I did not demonstrate.
- The earlier attempt's probe.mjs/probe2.mjs/probe-jsdom.mjs and their JSON were reused for 126 rows; I re-scored them and independently reproduced their key result in roundtrip-v2.mjs.
- The repository was not modified (git status clean apart from untracked dist/); all artifacts are under experiments/jev/research/results/security-map/.

## Artifacts

- experiments/jev/research/results/security-map/roundtrip-v2.mjs
- experiments/jev/research/results/security-map/roundtrip-v2-results.json
- experiments/jev/research/results/security-map/perf-baseline.mjs
- experiments/jev/research/results/security-map/perf-baseline.json
- experiments/jev/research/results/security-map/probe.mjs
- experiments/jev/research/results/security-map/probe-jsdom.mjs
- experiments/jev/research/results/security-map/probe2.mjs
- experiments/jev/research/results/security-map/probe-results.json
- experiments/jev/research/results/security-map/probe-results-jsdom.json
- experiments/jev/research/results/security-map/probe2-results.json
