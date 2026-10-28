// Usage: node clutter-candidates.mjs <html-file> <out-json>  -- outermost clutter-looking containers absent from output
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { parseLinkedomHTML } = require('/home/alexi/git/defuddle/dist/utils/linkedom-compat.js');
const [file, outJson] = process.argv.slice(2);
const out = JSON.parse(fs.readFileSync(outJson, 'utf8'));
const alnum = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const outText = alnum(out.content.replace(/<[^>]+>/g, ' '));
const doc = parseLinkedomHTML(fs.readFileSync(file, 'utf8'), out.url);
for (const el of Array.from(doc.querySelectorAll('script,style,noscript,template,svg'))) el.remove();
const SEL = 'header,nav,footer,aside,[class*="share"],[class*="comment"],[id*="comment"],[class*="related"],[class*="subscribe"],[class*="newsletter"],[class*="cookie"],[class*="promo"],[class*="sidebar"],[class*="widget"],[class*="menu"],[class*="modal"],[class*="social"],[class*="breadcrumb"],[class*="toc"],[id*="toc"],[class*="author"],[class*="byline"],[class*="recent"],[class*="more-"],[class*="footer"],[class*="banner"],[class*="signup"],[class*="login"],[class*="tag"]';
const els = Array.from(doc.querySelectorAll(SEL));
const picked = [];
for (const el of els) {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const w = text ? text.split(' ').length : 0;
  if (w < 4 || w > 600) continue;
  if (picked.some(p => p.contains(el))) continue;
  const probe = alnum(text).slice(0, 50);
  if (!probe || outText.includes(probe)) continue; // still present -> not removed
  picked.push(el);
}
picked.sort((a, b) => b.textContent.length - a.textContent.length);
for (const el of picked.slice(0, 18)) {
  const cls = el.getAttribute('class') || '', id = el.getAttribute('id') || '';
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  console.log(`- ${el.tagName.toLowerCase()}${id ? '#' + id : ''}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 3).join('.') : ''} [${text.split(' ').length}w] "${text.slice(0, 110)}"`);
}
