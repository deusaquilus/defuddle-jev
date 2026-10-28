# 3. Security sanitization: findings

**Bottom line:** Jev must not be used for security sanitization at any level of aggressiveness, and would not improve it. The route toward ~99.99% is deterministic. The audit found one confirmed, still-unfixed bypass in Defuddle's deterministic code.

Sources: the `security-map` and `exp-security-detector` agent reports ([appendix A](appendix-a-phase1-agent-reports/security-map.md), [appendix A](appendix-a-phase1-agent-reports/exp-security-detector.md)), probes in `research/results/security-map/`, the detector corpus and runs in `research/results/exp-security-detector/`, and an independent reproduction in [`../lab/verify-schema-bypass.mjs`](../lab/verify-schema-bypass.mjs).

## 3.1 How the deterministic sanitizer works

| Piece | Location | What it does |
|---|---|---|
| `isDangerousUrl(url, allowInlineImage)` | `src/utils/dom.ts:73` | Strips whitespace and control characters, lowercases, then rejects `javascript:`, `blob:` and non-image `data:`. |
| `stripUnsafeElements(root)` | `src/utils/dom.ts:114` | Neutralizes `script` (except `math/*`), `style`, `noscript`, `template`, `frame(set)`, `object`, `embed`, `applet`, `base`, SMIL animation elements; removes `on*` attributes and `srcdoc`; checks `href`, `src`, `action`, `formaction`, `xlink:href` with `isDangerousUrl`. |
| Main pipeline | `src/defuddle.ts:1087` | Runs `_stripUnsafeElements` on the extracted content **after** URL resolution. Safe. |
| Extractor output | `_sanitizeExtractorHtml`, `src/defuddle.ts:1820` | Sanitizes site-extractor HTML and the schema.org `articleBody` fallback. **Strips before resolving URLs.** |
| Raw body fallback | `_serializeFallbackBody`, `src/defuddle.ts:322` | Sanitizes a clone of the body, then resolves URLs. **Strips before resolving.** |

## 3.2 The confirmed bypass: strip-before-resolve

On two of the HTML boundaries, URLs are checked first and rewritten afterwards:

```ts
// src/defuddle.ts:1820
private _sanitizeExtractorHtml(html: string): string {
    if (!html) return html;
    const container = this.doc.createElement('div');
    container.appendChild(parseHTML(this.doc, html));
    this._stripUnsafeElements(container);   // 1. checks href values as they are
    this.resolveRelativeUrls(container);     // 2. then rewrites them
    standardizeExtractorOutput(container, this.debug);
    return serializeHTML(container);
}
```

and the resolver deliberately trims leading and trailing quotes ("some pages ship escaped quoted hrefs"):

```ts
// src/defuddle.ts:1444 (inside resolveRelativeUrls)
const normalized = url
    .trim()
    .replace(/^\\?["']+/, '')
    .replace(/\\?["']+$/, '');
```

So `href='"javascript:alert(1)'` passes step 1 (it does not start with `javascript:`) and step 2 turns it into `javascript:alert(1)`. `_serializeFallbackBody` (`src/defuddle.ts:322`) has the same order: strip on the clone, then `resolveContentUrls`.

**Reproduction** (`node experiments/jev/lab/verify-schema-bypass.mjs`, against the current `dist/` build; output captured 2026-10-28):

```
schema: leading double quote
   anchor in output: <a href="javascript:alert(1)">
   contains "javascript:" => true
schema: leading single quote
   anchor in output: <a href="javascript:alert(1)">
   contains "javascript:" => true
schema: plain javascript (control)
   anchor in output: <a>
   contains "javascript:" => false
main pipeline: leading double quote
   anchor in output: <article>
   contains "javascript:" => false
```

The control shows the unquoted payload is stripped, and the main pipeline is safe; only the strip-before-resolve paths leak.

**Reachability** (from the security-map report): the schema.org `articleBody` fallback can be triggered by any page whose JSON-LD text is much longer than the extracted content; all site extractors' HTML goes through `_sanitizeExtractorHtml`; and the raw-body fallback is used on degenerate pages. On defuddle.md, the `/html/` mode serves the extracted HTML as `text/html` without a Content-Security-Policy, which turns a sanitizer miss into script execution on that origin.

**Status:** not fixed. The repro above still prints `javascript:` in output.

## 3.3 Smaller gaps found

| Gap | Condition | Severity |
|---|---|---|
| `<meta http-equiv="refresh">` survives in the body | only when `removeExactSelectors: false` (the exact selectors normally remove `meta`) | redirect, small deterministic fix |
| `vbscript:` URLs are not rejected | always (`isDangerousUrl` checks only `javascript:`, `blob:`, `data:`) | legacy browsers only |
| `<link rel=import>` leftover | seen by the detector corpus | low |
| No CSP / `nosniff` on defuddle.md `/html/` responses | always | turns any miss into origin XSS |

In the default pipeline the deterministic sanitizer left **0 modern-executable survivors** out of 83 attack payloads (1 with optional removals disabled: the meta refresh).

## 3.4 Jev as a secondary XSS detector

155 fragments (83 payloads + benign controls), ten questions per call (`research/results/exp-security-detector/jev-run.mjs`; questions in [`../lab/prompt-audit/ALL_PROMPTS.md`](../lab/prompt-audit/ALL_PROMPTS.md) section 7):

| Measure | Result |
|---|---|
| Best scoring rule | true-positive rate 91.6% at 4.2% false positives (threshold 0.9) |
| Main "unsafe" Noul | 74.7% recall at 0.9; 97.6% at 0.5 but 19.4% false positives on benign output |
| Inside a 1.1k-token article | recall drops |
| Payload plus page text claiming the content was sanitized | pushed below 0.9 on 10–12 of 12 live payloads |
| On Defuddle's own clean output | alarms on 8–12% of documents (embeds, escaped code samples, alt and data attributes) |
| Missed classes | stylesheet-loading vectors |
| Reproducibility | never byte-identical |

A 60-line deterministic DOM-walk detector found everything Jev found, with no false positives and no network.

## 3.5 Why a model cannot close this class

Every historical security defect (five GitHub security advisories) and the one found here is a **coverage or ordering omission in deterministic code**. A probabilistic, non-deterministic, injectable, remote model cannot make an enumerable check exact; it adds latency (1–3× the whole parse), privacy exposure, an offline/sync-API break, and a new way to miss.

## 3.6 Deterministic fixes (recommended, not yet implemented)

1. Fix the ordering on both paths: resolve URLs first and strip last (or strip again after resolving).
2. Make `isDangerousUrl` strip leading quotes and backslashes the same way the resolver does, and add `vbscript:`.
3. Funnel all HTML output boundaries (main pipeline, extractor output, schema.org fallback, body fallback, direct Markdown conversion) through one finalizer that strips last.
4. Prefer an allowlist serializer with a per-attribute URL policy (`data:` only on media attributes); remove `meta`, `link`, `base`, `form`, `style` regardless of options.
5. Add a round-trip differential test (linkedom + JSDOM + a real browser parser) and property-based fuzzing to CI.
6. Serve defuddle.md `/html/` responses with a CSP sandbox and `X-Content-Type-Options: nosniff`.

Per the repository's AGENTS.md, the fix should come with a regression case in `tests/extractor-xss.test.ts`.
