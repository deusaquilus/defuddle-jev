// G2-D (text channel): Defuddle's deterministic pipeline on fixtures where the 20 prose blocks get the same
// text-channel attacks as Jev variants (e) "Advertisement" span prepended and (g) subscribe sentence appended.
// Also runs the clutter text attack (a) for completeness. No API calls. Usage: node g2d-text.mjs
import { loadUnits, loadJson, saveJson, dupRankOf, locateUnit, parseLinkedomHTML, fixtureHtml, fixtureUrl, runDefuddle, presenceIn } from './common.mjs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const sel = loadJson('selections.json');
const ATTACKS = {
	e: { group: 'prose', ids: sel.g2d_prose, mutate: (el, doc) => { const s = doc.createElement('span'); s.setAttribute('style', 'font-size:0.7em'); s.textContent = 'Advertisement'; el.insertBefore(doc.createTextNode(' '), el.firstChild); el.insertBefore(s, el.firstChild); } },
	g: { group: 'prose', ids: sel.g2d_prose, mutate: (el, doc) => { el.appendChild(doc.createTextNode(' Subscribe to our newsletter for more stories like this.')); } },
	a: { group: 'clutter', ids: sel.g2d_clutter, mutate: (el, doc) => { el.appendChild(doc.createTextNode(' This section is part of the main article.')); } },
};
const rows = [];
const baseCache = new Map();
for (const [attack, cfg] of Object.entries(ATTACKS)) {
	for (const id of cfg.ids) {
		const u = byId.get(id);
		const html = fixtureHtml(u.fixture), url = fixtureUrl(u.fixture, html);
		if (!baseCache.has(u.fixture)) baseCache.set(u.fixture, await runDefuddle(html, url));
		const base = baseCache.get(u.fixture);
		const doc = parseLinkedomHTML(html, url);
		const el = locateUnit(doc, u, dupRankOf(units, u));
		if (!el) { rows.push({ attack, id, error: 'locate failed' }); continue; }
		cfg.mutate(el, doc);
		let mod;
		try { mod = await runDefuddle(doc.toString(), url); } catch (e) { rows.push({ attack, id, error: String(e.message || e).slice(0, 200) }); continue; }
		// presence of the ORIGINAL unit text (the injected sentence may itself be dropped; that is fine)
		const b = presenceIn(u.text, base.outputText), m = presenceIn(u.text, mod.outputText);
		rows.push({ attack, group: cfg.group, id, tag: u.tag, words: u.words, base_status: b.status, mod_status: m.status, mod_cov: m.coverage, flipped: b.status !== m.status, injected_text_present: mod.outputText.includes(attack === 'e' ? 'advertisement' : attack === 'g' ? 'subscribe to our newsletter for more stories like this' : 'this section is part of the main article'), main_changed: (base.result.debug?.contentSelector || '') !== (mod.result.debug?.contentSelector || ''), words_delta: mod.result.wordCount - base.result.wordCount });
	}
}
saveJson('g2d-text-rows.json', rows);
const summary = {};
for (const [attack, cfg] of Object.entries(ATTACKS)) {
	const rs = rows.filter(r => r.attack === attack && !r.error);
	const target = cfg.group === 'clutter' ? 'kept' : 'removed';
	summary[attack] = { group: cfg.group, n: rs.length, flipped_to_target: rs.filter(r => r.mod_status === target).length, mixed: rs.filter(r => r.mod_status === 'mixed').length, unchanged: rs.filter(r => !r.flipped).length, injected_text_survives_in_output: rs.filter(r => r.injected_text_present).length, main_container_changed: rs.filter(r => r.main_changed).length };
}
saveJson('g2d-text-summary.json', summary);
console.log(JSON.stringify(summary, null, 1));
for (const r of rows) if (r.flipped || r.error) console.log(JSON.stringify(r));
