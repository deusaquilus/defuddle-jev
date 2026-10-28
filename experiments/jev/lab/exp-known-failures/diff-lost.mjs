// Usage: node diff-lost.mjs <html-file> <out-json> [minWords=6] [maxShow=40]
// Lists text-bearing source elements (p, h1-h6, li, td, th, figcaption, blockquote, pre, dt, dd)
// whose text is missing from defuddle's output content, with ancestor chain and the removal record (if any).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const [file, outJson, minWordsArg = '6', maxShowArg = '40'] = process.argv.slice(2);
const minWords = +minWordsArg, maxShow = +maxShowArg;
const out = JSON.parse(fs.readFileSync(outJson, 'utf8'));
const norm = s => (s || '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\\([_*#`\[\]])/g, '$1').trim();
const alnum = s => norm(s).toLowerCase().replace(/[^a-z0-9\u00c0-\uffff]+/g, '');
const outText = alnum((out.content || '').replace(/<[^>]+>/g, ' '));
const doc = parseLinkedomHTML(fs.readFileSync(file, 'utf8'), out.url);
for (const el of Array.from(doc.querySelectorAll('script,style,noscript,template,svg'))) el.remove();
const sel = 'p,h1,h2,h3,h4,h5,h6,li,td,th,figcaption,blockquote,pre,dt,dd';
const seen = new Set();
const missing = [];
let total = 0, totalWords = 0, missingWords = 0;
for (const el of Array.from(doc.querySelectorAll(sel))) {
	const t = norm(el.textContent);
	const wc = t ? t.split(' ').length : 0;
	if (wc < minWords) continue;
	// skip if an ancestor in the same set already counted (avoid double counting li>p etc)
	let anc = el.parentElement, skip = false;
	while (anc) { if (seen.has(anc)) { skip = true; break; } anc = anc.parentElement; }
	if (skip) continue;
	seen.add(el);
	total++; totalWords += wc;
	const probe = t.length > 80 ? t.slice(0, 80) : t;
	const aprobe = alnum(probe).slice(0, 60);
	if (aprobe.length < 8 || outText.includes(aprobe)) continue;
	missingWords += wc;
	const chain = [];
	let a = el;
	for (let i = 0; a && i < 6; i++) {
		const cls = (a.getAttribute && a.getAttribute('class')) ? '.' + a.getAttribute('class').trim().split(/\s+/).slice(0, 3).join('.') : '';
		const id = (a.getAttribute && a.getAttribute('id')) ? '#' + a.getAttribute('id') : '';
		chain.unshift(a.tagName.toLowerCase() + id + cls);
		a = a.parentElement;
	}
	const rem = (out.removals || []).find(r => r.text && norm(r.text).length > 10 && (norm(r.text).startsWith(probe.slice(0, 40)) || probe.startsWith(norm(r.text).slice(0, 40))));
	missing.push({ words: wc, chain: chain.join(' > '), text: t.slice(0, 140), removal: rem ? `${rem.step} | ${rem.reason} | ${rem.selector || ''}` : null });
}
console.log(`source blocks: ${total} (${totalWords} words); missing: ${missing.length} (${missingWords} words); output words: ${out.wordCount}`);
for (const m of missing.slice(0, maxShow)) console.log(`- [${m.words}w] ${m.chain}\n    "${m.text}"\n    removal: ${m.removal}`);
if (missing.length > maxShow) console.log(`... ${missing.length - maxShow} more`);
