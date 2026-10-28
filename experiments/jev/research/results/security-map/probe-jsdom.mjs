// Probe: concrete gap checks against the built defuddle (dist/node.js) under linkedom,
// re-parsing output with JSDOM (parse5, spec HTML5 parser) as the "browser" oracle.
// No network, no API. Writes JSON results next to this script.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire('/home/alexi/git/defuddle/package.json');
const { Defuddle } = await import('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = await import('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const { stripUnsafeElements, isDangerousUrl } = await import('/home/alexi/git/defuddle/dist/utils/dom.js');
const { JSDOM } = require('jsdom');

const URL_ = 'https://example.com/page';
const FILLER = '<p>Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris.</p>';
const page = body => `<!DOCTYPE html><html><head><title>T</title></head><body><article><h1>T</h1>${FILLER}${body}${FILLER}${FILLER}</article></body></html>`;

// Oracle: re-parse HTML output with a spec parser and look for executable constructs.
function oracle(html) {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url: URL_ });
  const doc = dom.window.document;
  const hits = [];
  for (const el of doc.body.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    if (['script','style','template','object','embed','applet','base','meta','link','animate','set','animatemotion','animatetransform','frame','frameset'].includes(tag)) hits.push(`element:<${tag}>`);
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      if (n.startsWith('on')) hits.push(`handler:${tag}@${n}`);
      if (n === 'srcdoc') hits.push(`srcdoc:${tag}`);
      if (['href','src','action','formaction','xlink:href','srcset','data-src','poster','ping','background','data'].includes(n)) {
        const v = a.value.replace(/[\s\u0000-\u001F]+/g,'').toLowerCase();
        if (v.includes('javascript:') || v.includes('vbscript:') || v.startsWith('blob:') || (v.startsWith('data:') && !v.startsWith('data:image/'))) hits.push(`url:${tag}@${n}=${a.value.slice(0,60)}`);
      }
      if (n === 'style') hits.push(`style:${tag}`);
      if (n === 'allow') hits.push(`allow:${tag}=${a.value}`);
    }
  }
  return hits;
}

const results = [];
async function run(name, body, options = {}, expectNote = '') {
  const doc = new JSDOM(page(body), { url: URL_ }).window.document;
  const res = await Defuddle(doc, URL_, options);
  const html = res.content || '';
  const hits = oracle(html);
  results.push({ name, options, expectNote, hits, out: html.slice(0, 600) });
  console.log(`\n### ${name} ${JSON.stringify(options)}\n  hits: ${hits.length ? hits.join(' | ') : 'none'}\n  out: ${html.replace(/\s+/g,' ').slice(0, 400)}`);
}

const NOSTD = { standardize: false };
const NOREMOVE = { standardize: false, removeExactSelectors: false, removePartialSelectors: false, removeLowScoring: false, removeContentPatterns: false, removeHiddenElements: false };

// 1. meta refresh / link stylesheet when exact selectors disabled
await run('meta refresh (default)', '<meta http-equiv="refresh" content="0;url=https://attacker.example/">');
await run('meta refresh (no removals)', '<meta http-equiv="refresh" content="0;url=https://attacker.example/">', NOREMOVE);
await run('link stylesheet (default)', '<link rel="stylesheet" href="https://attacker.example/x.css">');
await run('link stylesheet (no removals)', '<link rel="stylesheet" href="https://attacker.example/x.css">', NOREMOVE);
// 2. attributes not URL-checked
await run('srcset javascript (nostd)', '<img src="https://example.com/a.png" srcset="javascript:alert(1) 1w" alt="a">', NOSTD);
await run('data-src javascript (nostd)', '<img src="https://example.com/a.png" data-src="javascript:alert(1)" alt="a">', NOSTD);
await run('poster javascript (nostd)', '<video src="https://example.com/v.mp4" poster="javascript:alert(1)"></video>', NOSTD);
await run('ping attribute (nostd)', '<a href="https://example.com/x" ping="https://attacker.example/ping">x</a>', NOSTD);
await run('iframe allow camera (default)', '<iframe src="https://attacker.example/embed" allow="camera *; microphone *; geolocation *"></iframe>');
await run('iframe allow camera (nostd)', '<iframe src="https://attacker.example/embed" allow="camera *; microphone *" sandbox="allow-scripts allow-same-origin"></iframe>', NOSTD);
await run('style attr fixed overlay (nostd)', '<div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:url(https://attacker.example/leak.png)">overlay</div>', NOSTD);
await run('style attr (default)', '<div style="position:fixed;background:url(https://attacker.example/leak.png)">overlay</div>');
// 3. other URL schemes
await run('vbscript href', '<a href="vbscript:MsgBox(1)">x</a>', NOSTD);
await run('file href', '<a href="file:///etc/passwd">x</a>', NOSTD);
await run('obsidian uri href', '<a href="obsidian://new?name=pwn&content=hi">x</a>', NOSTD);
await run('data:image/svg href on anchor', '<a href="data:image/svg+xml,%3Csvg%20onload%3Dalert(1)%3E">x</a>', NOSTD);
await run('entity-encoded javascript', '<a href="&#106;avascript:alert(1)">x</a>', NOSTD);
await run('colon entity javascript', '<a href="javascript&colon;alert(1)">x</a>', NOSTD);
await run('NUL inside scheme', '<a href="java\u0000script:alert(1)">x</a>', NOSTD);
await run('leading quote javascript (main pipeline)', `<a href='"javascript:alert(1)'>x</a>`, NOSTD);
await run('leading backslash-quote javascript (main pipeline)', `<a href='\\"javascript:alert(1)'>x</a>`, NOSTD);
// 4. SVG / MathML
await run('svg use href javascript', '<svg><use href="javascript:alert(1)"></use></svg>', NOSTD);
await run('svg use data:image/svg', '<svg><use href="data:image/svg+xml;base64,PHN2ZyBpZD0neCc+PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pjwvc3ZnPg==#x"></use></svg>', NOSTD);
await run('svg foreignObject img onerror', '<svg><foreignObject><img src="x" onerror="alert(1)"></foreignObject></svg>', NOSTD);
await run('mathml href javascript', '<math><mi href="javascript:alert(1)">x</mi></math>', NOSTD);
await run('svg a xlink:href javascript', '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>', NOSTD);
await run('svg animate values', '<svg><a><animate attributeName="href" values="javascript:alert(1)" /></a></svg>', NOSTD);
await run('svg set href', '<svg><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>', NOSTD);
await run('svg handler on svg root', '<svg onload="alert(1)"><circle r="1"/></svg>', NOSTD);
// 5. parser differentials: raw-text in linkedom vs foreign content in browsers
await run('svg noembed img (nostd)', '<svg><noembed><img src="x" onerror="alert(1)"></noembed></svg>', NOSTD);
await run('svg noembed img (default)', '<svg><noembed><img src="x" onerror="alert(1)"></noembed></svg>');
await run('svg xmp img (nostd)', '<svg><xmp><img src="x" onerror="alert(1)"></xmp></svg>', NOSTD);
await run('svg noframes img (nostd)', '<svg><noframes><img src="x" onerror="alert(1)"></noframes></svg>', NOSTD);
await run('svg iframe img (nostd)', '<svg><iframe><img src="x" onerror="alert(1)"></iframe></svg>', NOSTD);
await run('svg textarea img (nostd)', '<svg><textarea><img src="x" onerror="alert(1)"></textarea></svg>', NOSTD);
await run('svg title img (nostd)', '<svg><title><img src="x" onerror="alert(1)"></title></svg>', NOSTD);
await run('svg plaintext img (nostd)', '<svg><plaintext><img src="x" onerror="alert(1)"></svg>', NOSTD);
await run('math mtext textarea img', '<math><mtext><textarea><img src="x" onerror="alert(1)"></textarea></mtext></math>', NOSTD);
await run('svg style escape (classic mXSS)', '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>"></style></svg>', NOSTD);
await run('abrupt comment', '<!--><img src="x" onerror="alert(1)">-->', NOSTD);
await run('abrupt comment (default)', '<!--><img src="x" onerror="alert(1)">-->');
await run('bogus comment PI', '<?xml ><img src="x" onerror="alert(1)">', NOSTD);
await run('attr value tag breakout', '<a title="</p><img src=x onerror=alert(1)>">x</a>', NOSTD);
await run('noscript img', '<noscript><img src="x" onerror="alert(1)"></noscript>', NOSTD);
await run('template nested svg', '<svg><template><img src="x" onerror="alert(1)"></template></svg>', NOSTD);
await run('iframe srcdoc entity', '<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe>', NOSTD);
await run('form action javascript', '<form action="javascript:alert(1)"><button formaction="javascript:alert(2)">go</button></form>', NOSTD);
await run('img onerror slash separator', '<img/src="x"/onerror="alert(1)">', NOSTD);
await run('uppercase handler', '<IMG SRC="x" ONERROR="alert(1)">', NOSTD);
await run('fencedframe', '<fencedframe src="https://attacker.example/"></fencedframe>', NOSTD);
await run('portal', '<portal src="https://attacker.example/"></portal>', NOSTD);

writeFileSync('/home/alexi/git/defuddle/experiments/jev/research/results/security-map/probe-results-jsdom.json', JSON.stringify(results, null, 2));
const flagged = results.filter(r => r.hits.length);
console.log(`\n\nSUMMARY: ${results.length} probes, ${flagged.length} with oracle hits:`);
for (const r of flagged) console.log(` - ${r.name} ${JSON.stringify(r.options)} -> ${r.hits.join(' | ')}`);
