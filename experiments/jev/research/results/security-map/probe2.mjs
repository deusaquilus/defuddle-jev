// Probe 2: ordering bug (strip before resolve) on the schema.org text fallback path,
// metadata URL fields, and a linkedom-vs-JSDOM input-parser comparison for a subset.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/home/alexi/git/defuddle/package.json');
const { Defuddle } = await import('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = await import('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const { JSDOM } = require('jsdom');
const URL_ = 'https://example.com/page';

function jsdomDoc(html) { return new JSDOM(html, { url: URL_ }).window.document; }
function findJs(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url: URL_ });
  const out = [];
  for (const el of dom.window.document.body.querySelectorAll('*')) for (const a of Array.from(el.attributes)) {
    const v = a.value.replace(/[\s\u0000-\u001F]+/g, '').toLowerCase();
    if (v.startsWith('javascript:') || v.startsWith('blob:') || (v.startsWith('data:') && !v.startsWith('data:image/'))) out.push(`${el.tagName.toLowerCase()}@${a.name}=${a.value.slice(0, 50)}`);
  }
  return out;
}
const results = [];
function log(name, impl, html, extra = {}) {
  const hits = findJs(html);
  results.push({ name, impl, hits, out: html.slice(0, 500), ...extra });
  console.log(`### ${name} [${impl}] hits=${hits.length ? hits.join(' | ') : 'none'}\n  ${html.replace(/\s+/g, ' ').slice(0, 300)}`);
}

// --- A. schema.org articleBody fallback: strip runs BEFORE resolveRelativeUrls, and resolve() strips leading quotes ---
const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
const payloads = {
  'leading double quote': `<a href='"javascript:alert(1)'>click</a>`,
  'leading backslash quote': `<a href='\\"javascript:alert(1)'>click</a>`,
  'leading single quote': `<a href="'javascript:alert(1)">click</a>`,
  'img src leading quote': `<img src='"javascript:alert(1)'>`,
  'iframe src leading quote data': `<iframe src='"data:text/html,<script>alert(1)</script>'></iframe>`,
  'plain javascript (control)': `<a href="javascript:alert(1)">click</a>`,
  'leading quote + relative (control)': `<a href='"/relative'>click</a>`,
};
for (const [name, payload] of Object.entries(payloads)) {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'T', articleBody: `${payload} ${words}` });
  const html = `<!DOCTYPE html><html><head><title>T</title><script type="application/ld+json">${ld}</script></head><body><main><p>hi</p></main></body></html>`;
  for (const impl of ['linkedom', 'jsdom']) {
    const doc = impl === 'jsdom' ? jsdomDoc(html) : parseLinkedomHTML(html, URL_);
    const res = await Defuddle(doc, URL_, {});
    log(`schema-fallback: ${name}`, impl, res.content, { path: 'schema-text-fallback', wordCount: res.wordCount });
  }
  // Markdown layer on the same input
  const res = await Defuddle(parseLinkedomHTML(html, URL_), URL_, { markdown: true });
  const md = res.content;
  const mdHas = /javascript:/i.test(md);
  results.push({ name: `schema-fallback markdown: ${name}`, impl: 'linkedom', hits: mdHas ? ['markdown contains javascript:'] : [], out: md.slice(0, 300) });
  console.log(`### schema-fallback MARKDOWN: ${name} -> ${mdHas ? 'CONTAINS javascript:' : 'clean'}\n  ${md.replace(/\s+/g, ' ').slice(0, 200)}`);
}

// --- B. main pipeline with the same payload (resolve runs BEFORE strip there) ---
{
  const FILLER = '<p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.</p>';
  const html = `<!DOCTYPE html><html><head><title>T</title></head><body><article>${FILLER}<a href='"javascript:alert(1)'>click</a>${FILLER}${FILLER}</article></body></html>`;
  for (const impl of ['linkedom', 'jsdom']) {
    const doc = impl === 'jsdom' ? jsdomDoc(html) : parseLinkedomHTML(html, URL_);
    const res = await Defuddle(doc, URL_, { standardize: false });
    log('main-pipeline: leading double quote', impl, res.content, { path: 'main' });
  }
}

// --- C. metadata URL fields are not scheme-checked ---
{
  const html = `<!DOCTYPE html><html><head><title>T</title><meta property="og:image" content="javascript:alert(1)"><link rel="icon" href="javascript:alert(2)"></head><body><article><p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.</p></article></body></html>`;
  const res = await Defuddle(parseLinkedomHTML(html, URL_), URL_, {});
  results.push({ name: 'metadata fields', impl: 'linkedom', hits: [], image: res.image, favicon: res.favicon });
  console.log(`### metadata: image=${JSON.stringify(res.image)} favicon=${JSON.stringify(res.favicon)}`);
}

writeFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/security-map/probe2-results.json', JSON.stringify(results, null, 2));
