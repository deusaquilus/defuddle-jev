// Usage: node run-defuddle.mjs <html-file> <url> [expectedLost...]
// Runs the compiled Defuddle (debug mode, offline) and prints a JSON summary.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { Defuddle } = require('/home/alexi/git/defuddle/dist/node.js');
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');

const [file, url, ...expected] = process.argv.slice(2);
const html = fs.readFileSync(file, 'utf8');
const doc = parseLinkedomHTML(html, url);
const _log = console.log, _info = console.info, _warn = console.warn, _debug = console.debug, _err = console.error;
console.log = console.info = console.warn = console.debug = console.error = () => {};
const t0 = performance.now();
const result = await Defuddle(doc, url, {
	debug: true,
	fetch: async () => { throw new Error('offline'); },
});
const ms = Math.round(performance.now() - t0);
console.log = _log; console.info = _info; console.warn = _warn; console.debug = _debug; console.error = _err;
const text = (result.content || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const norm = s => s.replace(/\s+/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
const presence = {};
for (const e of expected) presence[e] = norm(text).includes(norm(e));
const out = {
	file, url, ms,
	wordCount: result.wordCount,
	contentSelector: result.debug?.contentSelector,
	extractorType: result.extractorType,
	title: result.title,
	contentChars: (result.content || '').length,
	presence,
	removals: (result.debug?.removals || []).map(r => ({ step: r.step, reason: r.reason, selector: r.selector, text: (r.text || '').slice(0, 160) })),
};
const outFile = process.env.OUT || null;
if (outFile) {
	fs.writeFileSync(outFile, JSON.stringify({ ...out, content: result.content, markdown: null }, null, 1));
}
console.log(JSON.stringify({ ...out, removals: out.removals.length, textPreview: text.slice(0, 300) }, null, 1));
if (process.env.SHOW_REMOVALS) for (const r of out.removals) console.log('  -', r.step, '|', r.reason, '|', r.selector || '', '|', r.text.slice(0, 100));
