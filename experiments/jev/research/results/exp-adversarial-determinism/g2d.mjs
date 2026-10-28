// G2-D: run Defuddle's deterministic pipeline on fixtures modified with the same attribute attacks as
// Jev variants (d) and (f). No API calls. Usage: node g2d.mjs
import { loadUnits, loadJson, saveJson, dupRankOf, locateUnit, parseLinkedomHTML, fixtureHtml, fixtureUrl, runDefuddle, presenceIn, normalize } from './common.mjs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const sel = loadJson('selections.json');

const ATTACKS = {
	// clutter block -> content-looking class (same string as Jev variant d)
	d: { group: 'clutter', ids: sel.g2d_clutter, mutate: el => { el.setAttribute('class', 'article-body entry-content'); el.removeAttribute('id'); } },
	// same, but also strip class/id from every descendant (stronger attribute-only attack)
	d2: { group: 'clutter', ids: sel.g2d_clutter, mutate: el => { for (const d of el.querySelectorAll('[class],[id]')) { d.removeAttribute('class'); d.removeAttribute('id'); } el.setAttribute('class', 'article-body entry-content'); el.removeAttribute('id'); } },
	// prose block -> clutter-looking class (same string as Jev variant f)
	f: { group: 'prose', ids: sel.g2d_prose, mutate: el => { el.setAttribute('class', 'ad-banner sidebar-widget'); } },
	// prose block -> a class token Defuddle's EXACT_SELECTORS list contains ('.sidebar'), to show a known trigger
	f2: { group: 'prose', ids: sel.g2d_prose, mutate: el => { el.setAttribute('class', 'sidebar'); } },
	// prose block -> a PARTIAL_SELECTORS fragment ('advert')
	f3: { group: 'prose', ids: sel.g2d_prose, mutate: el => { el.setAttribute('class', 'advert-slot'); } },
};

const rows = [];
const baselineCache = new Map();
for (const [attack, cfg] of Object.entries(ATTACKS)) {
	for (const id of cfg.ids) {
		const u = byId.get(id);
		const html = fixtureHtml(u.fixture);
		const url = fixtureUrl(u.fixture, html);
		// baseline on the unmodified fixture (cached per fixture)
		if (!baselineCache.has(u.fixture)) baselineCache.set(u.fixture, await runDefuddle(html, url));
		const base = baselineCache.get(u.fixture);
		const basePres = presenceIn(u.text, base.outputText);
		// modified fixture
		const doc = parseLinkedomHTML(html, url);
		const el = locateUnit(doc, u, dupRankOf(units, u));
		if (!el) { rows.push({ attack, id, error: 'locate failed' }); continue; }
		const origClass = el.getAttribute('class') || '', origId = el.getAttribute('id') || '';
		cfg.mutate(el);
		const modHtml = doc.toString();
		let mod;
		try { mod = await runDefuddle(modHtml, url); } catch (e) { rows.push({ attack, id, error: String(e.message || e).slice(0, 200) }); continue; }
		const modPres = presenceIn(u.text, mod.outputText);
		rows.push({
			attack, group: cfg.group, id, fixture: u.fixture, tag: u.tag, words: u.words, orig_class: origClass.slice(0, 80), orig_id: origId,
			removal_step: u.hints.removal_step, removal_reason: u.hints.removal_reason,
			base_status: basePres.status, base_cov: basePres.coverage, mod_status: modPres.status, mod_cov: modPres.coverage,
			flipped: basePres.status !== modPres.status,
			base_selector: base.result.debug?.contentSelector || '', mod_selector: mod.result.debug?.contentSelector || '',
			base_words: base.result.wordCount, mod_words: mod.result.wordCount,
			main_changed: (base.result.debug?.contentSelector || '') !== (mod.result.debug?.contentSelector || ''),
			text: u.text.slice(0, 90),
		});
	}
}
saveJson('g2d-rows.json', rows);
const summary = {};
for (const [attack, cfg] of Object.entries(ATTACKS)) {
	const rs = rows.filter(r => r.attack === attack && !r.error);
	const base = rs.filter(r => r.base_status === (cfg.group === 'clutter' ? 'removed' : 'kept'));
	const target = cfg.group === 'clutter' ? 'kept' : 'removed';
	summary[attack] = {
		group: cfg.group, n: rs.length, errors: rows.filter(r => r.attack === attack && r.error).length,
		baseline_reproduced: base.length,
		flipped_to_target: rs.filter(r => r.mod_status === target).length,
		flipped_to_mixed: rs.filter(r => r.mod_status === 'mixed').length,
		unchanged: rs.filter(r => !r.flipped).length,
		main_container_changed: rs.filter(r => r.main_changed).length,
		output_words_delta_mean: rs.length ? +(rs.reduce((s, r) => s + (r.mod_words - r.base_words), 0) / rs.length).toFixed(1) : null,
	};
}
saveJson('g2d-summary.json', summary);
console.log(JSON.stringify(summary, null, 1));
for (const r of rows) if (r.flipped || r.error) console.log(JSON.stringify({ a: r.attack, id: r.id, base: r.base_status, mod: r.mod_status, cov: r.mod_cov, main_changed: r.main_changed, sel: r.mod_selector?.slice(0, 40), err: r.error }));
