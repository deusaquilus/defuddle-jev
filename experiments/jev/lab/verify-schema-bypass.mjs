import { createRequire } from 'node:module';
const require = createRequire('/home/alexi/git/defuddle/package.json');
const { Defuddle } = require('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const URL_ = 'https://example.com/page';
const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
const cases = {
  'schema: leading double quote': `<a href='"javascript:alert(1)'>click</a>`,
  'schema: leading single quote': `<a href="'javascript:alert(1)">click</a>`,
  'schema: plain javascript (control)': `<a href="javascript:alert(1)">click</a>`,
};
for (const [name, payload] of Object.entries(cases)) {
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'T', articleBody: `${payload} ${words}` });
  const html = `<!DOCTYPE html><html><head><title>T</title><script type="application/ld+json">${ld}</script></head><body><main><p>hi</p></main></body></html>`;
  const res = await Defuddle(parseLinkedomHTML(html, URL_), URL_, {});
  const m = res.content.match(/<a[^>]*>/);
  console.log(`${name}\n   anchor in output: ${m ? m[0] : '(none)'}\n   contains "javascript:" => ${/javascript:/i.test(res.content)}`);
}
// main pipeline control with the same quoted payload
const FILLER = '<p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.</p>';
const html2 = `<!DOCTYPE html><html><head><title>T</title></head><body><article>${FILLER}<a href='"javascript:alert(1)'>click</a>${FILLER}${FILLER}</article></body></html>`;
const r2 = await Defuddle(parseLinkedomHTML(html2, URL_), URL_, {});
console.log(`main pipeline: leading double quote\n   anchor in output: ${(r2.content.match(/<a[^>]*>/)||['(none)'])[0]}\n   contains "javascript:" => ${/javascript:/i.test(r2.content)}`);
