// Full analysis of the block-classification experiment under two ground truths:
//   GT-A "orig": labels from blocks.jsonl (the builder's output; includes label artifacts from glued textContent)
//   GT-B "corr": labels-corrected.jsonl (whitespace-correct match vs Defuddle output + expected Markdown; 'mixed' excluded)
// No API calls. Run: node analyze2.mjs  -> analysis2.json, analysis2-stdout.txt, top40-*.json, disagreements-*.json
import { loadUnits, loadRaw, subsampleIds, DIR, shuffled, rng } from './common.mjs';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const units = loadUnits();
const byId = new Map(units.map(u => [u.id, u]));
const corr = new Map(readFileSync(`${DIR}/labels-corrected.jsonl`, 'utf8').trim().split('\n').map(l => JSON.parse(l)).map(r => [r.id, r]));
const judgments = existsSync(`${DIR}/judgments.json`) ? JSON.parse(readFileSync(`${DIR}/judgments.json`, 'utf8')) : {};
const sub = subsampleIds(units);
const r3 = v => (v === null || v === undefined || Number.isNaN(v)) ? null : +v.toFixed(3);
const pct = v => (v === null || v === undefined) ? 'n/a' : (100 * v).toFixed(1) + '%';
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
function md(headers, rowsArr) { log('| ' + headers.join(' | ') + ' |'); log('|' + headers.map(() => '---').join('|') + '|'); for (const r of rowsArr) log('| ' + r.map(v => v === null || v === undefined ? 'n/a' : String(v)).join(' | ') + ' |'); log(''); }

// ---------- rows ----------
function rows(variant, gt) {
	return loadRaw(variant).filter(r => !r.error && typeof r.p_keep === 'number').map(r => {
		const u = byId.get(r.id); const c = corr.get(r.id);
		const label = gt === 'corr' ? c.label_corr : u.label;
		return { ...r, u, c, label, y: label === 'removed' ? 1 : 0, p: r.p_keep, policy: gt === 'corr' ? c.policy : (u.hints.is_title || u.hints.looks_byline || u.hints.looks_date) };
	}).filter(r => r.label !== 'mixed');
}
// Convention: predicted KEPT iff p_keep >= t; predicted REMOVED iff p_keep < t.
const predRemovedAt = (r, t) => (r.p < t ? 1 : 0);

// ---------- metrics ----------
function prfPred(rs, predFn, positive = 'removed') {
	let tp = 0, fp = 0, fn = 0, tn = 0, n = 0; const P = positive === 'removed' ? 1 : 0;
	for (const r of rs) { const pr = predFn(r); if (pr === null) continue; n++; if (pr === P && r.y === P) tp++; else if (pr === P && r.y !== P) fp++; else if (pr !== P && r.y === P) fn++; else tn++; }
	const precision = tp + fp ? tp / (tp + fp) : 0, recall = tp + fn ? tp / (tp + fn) : 0;
	const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
	return { n, tp, fp, fn, tn, precision: r3(precision), recall: r3(recall), f1: r3(f1), accuracy: n ? r3((tp + tn) / n) : null };
}
const prf = (rs, t, positive) => prfPred(rs, r => predRemovedAt(r, t), positive);
function auroc(rs) {
	const s = rs.map(r => ({ s: 1 - r.p, y: r.y })).sort((a, b) => a.s - b.s);
	const ranks = new Array(s.length); let i = 0;
	while (i < s.length) { let j = i; while (j + 1 < s.length && s[j + 1].s === s[i].s) j++; const avg = (i + j + 2) / 2; for (let k = i; k <= j; k++) ranks[k] = avg; i = j + 1; }
	let n1 = 0, n0 = 0, sumR = 0; s.forEach((x, k) => { if (x.y === 1) { n1++; sumR += ranks[k]; } else n0++; });
	if (!n1 || !n0) return null; return (sumR - n1 * (n1 + 1) / 2) / (n1 * n0);
}
function eceKeep(rs, bins = 10) {
	const b = Array.from({ length: bins }, () => ({ n: 0, sumP: 0, kept: 0 }));
	for (const r of rs) { const i = Math.min(bins - 1, Math.floor(r.p * bins)); b[i].n++; b[i].sumP += r.p; b[i].kept += 1 - r.y; }
	let e = 0; const table = [];
	b.forEach((x, i) => { const name = `${(i / bins).toFixed(1)}-${((i + 1) / bins).toFixed(1)}`; if (!x.n) { table.push({ bin: name, n: 0 }); return; } const mp = x.sumP / x.n, fk = x.kept / x.n; e += x.n / rs.length * Math.abs(mp - fk); table.push({ bin: name, n: x.n, mean_p_keep: r3(mp), frac_kept: r3(fk), gap: r3(fk - mp) }); });
	return { ece: r3(e), table };
}
function eceConf(rs, bins = 10) {
	const b = Array.from({ length: bins }, () => ({ n: 0, sumC: 0, correct: 0 }));
	for (const r of rs) { const c = Math.max(r.p, 1 - r.p); const correct = predRemovedAt(r, 0.5) === r.y ? 1 : 0; const i = Math.min(bins - 1, Math.floor((c - 0.5) / 0.5 * bins)); b[i].n++; b[i].sumC += c; b[i].correct += correct; }
	let e = 0; for (const x of b) if (x.n) e += x.n / rs.length * Math.abs(x.sumC / x.n - x.correct / x.n);
	return r3(e);
}
const BANDS = [[0.8, 1.01, '0.8-1.0'], [0.6, 0.8, '0.6-0.8'], [0.4, 0.6, '0.4-0.6'], [0, 0.4, '0.0-0.4']];
function bandRow(name, b, total) {
	const err = b.filter(r => predRemovedAt(r, 0.5) !== r.y).length;
	const sayRemove = b.filter(r => r.p < 0.5), sayKeep = b.filter(r => r.p >= 0.5);
	const wrongRemove = sayRemove.filter(r => r.y === 0).length, wrongKeep = sayKeep.filter(r => r.y === 1).length;
	return { band: name, n: b.length, coverage: r3(b.length / total), accuracy: b.length ? r3(1 - err / b.length) : null, errors: err,
		says_remove: sayRemove.length, wrong_remove_content_loss: wrongRemove, precision_remove: sayRemove.length ? r3(1 - wrongRemove / sayRemove.length) : null,
		says_keep: sayKeep.length, wrong_keep_clutter_leak: wrongKeep, precision_keep: sayKeep.length ? r3(1 - wrongKeep / sayKeep.length) : null };
}
function bands(rs) {
	const res = BANDS.map(([lo, hi, name]) => bandRow(name, rs.filter(r => { const m = Math.abs(2 * r.p - 1); return m >= lo && m < hi; }), rs.length));
	for (const [name, f] of [['|2p-1|>=0.9', r => Math.abs(2 * r.p - 1) >= 0.9 - 1e-9], ['|2p-1|>=0.94', r => Math.abs(2 * r.p - 1) >= 0.94 - 1e-9], ['|2p-1|>=0.98', r => Math.abs(2 * r.p - 1) >= 0.98 - 1e-9]]) res.push(bandRow(name, rs.filter(f), rs.length));
	return res;
}
function bestThreshold(rs) {
	const cands = [...new Set(rs.map(r => r.p))].sort((a, b) => a - b);
	const ts = [0.0001]; for (let i = 0; i + 1 < cands.length; i++) ts.push((cands[i] + cands[i + 1]) / 2); ts.push(1.0001);
	let best = { t: 0.5, f1: -1 };
	for (const t of ts) { const m = prf(rs, t, 'removed'); if (m.f1 > best.f1 + 1e-9) best = { t, f1: m.f1 }; }
	return best;
}
function splitHalves(rs, byFixture, seed = 7) {
	if (!byFixture) { const sh = shuffled(rs, seed); const h = Math.floor(sh.length / 2); return [sh.slice(0, h), sh.slice(h)]; }
	const fx = shuffled([...new Set(rs.map(r => r.fixture))], seed); const half = new Set(fx.slice(0, Math.floor(fx.length / 2)));
	return [rs.filter(r => half.has(r.fixture)), rs.filter(r => !half.has(r.fixture))];
}
function tuned(rs, byFixture) {
	const [A, B] = splitHalves(rs, byFixture);
	const tA = bestThreshold(A), tB = bestThreshold(B);
	const evalB = prf(B, tA.t), evalA = prf(A, tB.t);
	const cross = new Map(); for (const r of A) cross.set(r.id, tB.t); for (const r of B) cross.set(r.id, tA.t);
	return { split: byFixture ? 'by fixture' : 'by unit', foldA: { train_n: A.length, train_t: r3(tA.t), train_f1: r3(tA.f1), test_n: B.length, test: evalB }, foldB: { train_n: B.length, train_t: r3(tB.t), train_f1: r3(tB.f1), test_n: A.length, test: evalA }, mean_test_f1_removed: r3((evalA.f1 + evalB.f1) / 2), mean_test_accuracy: r3((evalA.accuracy + evalB.accuracy) / 2), crossT: cross };
}
// cluster bootstrap by fixture (units within a page are correlated)
function bootstrap(rs, reps = 1000, seed = 11) {
	const byFx = new Map(); for (const r of rs) { if (!byFx.has(r.fixture)) byFx.set(r.fixture, []); byFx.get(r.fixture).push(r); }
	const fx = [...byFx.keys()]; const R = rng(seed);
	const acc = [], f1 = [], au = [], cov8 = [], acc8 = [];
	for (let i = 0; i < reps; i++) {
		const s = []; for (let k = 0; k < fx.length; k++) s.push(...byFx.get(fx[Math.floor(R() * fx.length)]));
		const m = prf(s, 0.5); acc.push(m.accuracy); f1.push(m.f1); au.push(auroc(s));
		const b = s.filter(r => Math.abs(2 * r.p - 1) >= 0.8); cov8.push(b.length / s.length); acc8.push(b.length ? 1 - b.filter(r => predRemovedAt(r, 0.5) !== r.y).length / b.length : null);
	}
	const ci = a => { const v = a.filter(x => x !== null).sort((x, y) => x - y); return [r3(v[Math.floor(0.025 * v.length)]), r3(v[Math.floor(0.975 * v.length)])]; };
	return { reps, clusters: fx.length, acc05_ci95: ci(acc), f1_removed05_ci95: ci(f1), auroc_ci95: ci(au), band08_coverage_ci95: ci(cov8), band08_accuracy_ci95: ci(acc8) };
}
const CONTENT_KINDS = new Set(['article_body', 'heading', 'media_or_figure', 'code_or_table', 'footnotes_or_references']);
const wordsBucket = u => u.words <= 5 ? '3-5' : u.words <= 15 ? '6-15' : u.words <= 50 ? '16-50' : u.words <= 100 ? '51-100' : '101-300';

function fullReport(key, rs, label) {
	log(`\n## ${label} (n=${rs.length}, removed=${rs.filter(r => r.y).length}, kept=${rs.filter(r => !r.y).length})`);
	const res = { n: rs.length, removed: rs.filter(r => r.y).length, kept: rs.filter(r => !r.y).length };
	res.at05 = { removed_pos: prf(rs, 0.5, 'removed'), kept_pos: prf(rs, 0.5, 'kept') };
	const tu = tuned(rs, false), tf = tuned(rs, true);
	res.tuned_unit_split = { ...tu, crossT: undefined }; res.tuned_fixture_split = { ...tf, crossT: undefined };
	const predTuned = r => predRemovedAt(r, tu.crossT.get(r.id));
	const predTunedFx = r => predRemovedAt(r, tf.crossT.get(r.id));
	res.tuned_crossfit_full = { unit_split: { removed_pos: prfPred(rs, predTuned, 'removed'), kept_pos: prfPred(rs, predTuned, 'kept') }, fixture_split: { removed_pos: prfPred(rs, predTunedFx, 'removed'), kept_pos: prfPred(rs, predTunedFx, 'kept') } };
	res.auroc = r3(auroc(rs));
	const e = eceKeep(rs); res.ece_pkeep = e.ece; res.ece_confidence = eceConf(rs); res.reliability = e.table;
	res.bands = bands(rs);
	res.bootstrap = bootstrap(rs);
	log('Threshold convention: predicted KEPT iff p_keep >= t. Positive class for P/R/F1 = removed unless stated.');
	const T = res.tuned_crossfit_full;
	md(['metric', 'at t=0.5', `tuned cross-fit, unit split (tA=${tu.foldA.train_t}, tB=${tu.foldB.train_t})`, `tuned cross-fit, fixture split (tA=${tf.foldA.train_t}, tB=${tf.foldB.train_t})`], [
		['accuracy', res.at05.removed_pos.accuracy, T.unit_split.removed_pos.accuracy, T.fixture_split.removed_pos.accuracy],
		['removed: precision', res.at05.removed_pos.precision, T.unit_split.removed_pos.precision, T.fixture_split.removed_pos.precision],
		['removed: recall', res.at05.removed_pos.recall, T.unit_split.removed_pos.recall, T.fixture_split.removed_pos.recall],
		['removed: F1', res.at05.removed_pos.f1, T.unit_split.removed_pos.f1, T.fixture_split.removed_pos.f1],
		['kept: precision', res.at05.kept_pos.precision, T.unit_split.kept_pos.precision, T.fixture_split.kept_pos.precision],
		['kept: recall', res.at05.kept_pos.recall, T.unit_split.kept_pos.recall, T.fixture_split.kept_pos.recall],
		['kept: F1', res.at05.kept_pos.f1, T.unit_split.kept_pos.f1, T.fixture_split.kept_pos.f1],
		['confusion tp/fp/fn/tn (removed=pos)', `${res.at05.removed_pos.tp}/${res.at05.removed_pos.fp}/${res.at05.removed_pos.fn}/${res.at05.removed_pos.tn}`, `${T.unit_split.removed_pos.tp}/${T.unit_split.removed_pos.fp}/${T.unit_split.removed_pos.fn}/${T.unit_split.removed_pos.tn}`, `${T.fixture_split.removed_pos.tp}/${T.fixture_split.removed_pos.fp}/${T.fixture_split.removed_pos.fn}/${T.fixture_split.removed_pos.tn}`],
	]);
	log(`AUROC=${res.auroc}  ECE(P(keep), 10 bins)=${res.ece_pkeep}  ECE(confidence)=${res.ece_confidence}`);
	log(`Cluster bootstrap (by fixture, ${res.bootstrap.reps} reps, ${res.bootstrap.clusters} clusters) 95% CI: acc@0.5 ${JSON.stringify(res.bootstrap.acc05_ci95)}, F1 removed@0.5 ${JSON.stringify(res.bootstrap.f1_removed05_ci95)}, AUROC ${JSON.stringify(res.bootstrap.auroc_ci95)}, band>=0.8 coverage ${JSON.stringify(res.bootstrap.band08_coverage_ci95)}, band>=0.8 accuracy ${JSON.stringify(res.bootstrap.band08_accuracy_ci95)}`);
	log(`Tuned (unit split): foldA t=${tu.foldA.train_t} (train F1 ${tu.foldA.train_f1}) -> test F1 ${tu.foldA.test.f1} acc ${tu.foldA.test.accuracy}; foldB t=${tu.foldB.train_t} (train F1 ${tu.foldB.train_f1}) -> test F1 ${tu.foldB.test.f1} acc ${tu.foldB.test.accuracy}; mean test F1 ${tu.mean_test_f1_removed}, mean test acc ${tu.mean_test_accuracy}`);
	log(`Tuned (fixture split): foldA t=${tf.foldA.train_t} -> test F1 ${tf.foldA.test.f1} acc ${tf.foldA.test.accuracy}; foldB t=${tf.foldB.train_t} -> test F1 ${tf.foldB.test.f1} acc ${tf.foldB.test.accuracy}; mean test F1 ${tf.mean_test_f1_removed}, mean test acc ${tf.mean_test_accuracy}`);
	log('Reliability (P(keep) bins):');
	md(['bin p_keep', 'n', 'mean p_keep', 'frac kept', 'gap'], res.reliability.map(x => [x.bin, x.n, x.mean_p_keep, x.frac_kept, x.gap]));
	log('Confidence bands |2p-1| (decision at 0.5). "content loss" = Jev says remove but unit is kept; "clutter leak" = Jev says keep but unit is removed:');
	md(['band', 'n', 'coverage', 'accuracy', 'errors', 'says remove', 'wrong (content loss)', 'precision(remove)', 'says keep', 'wrong (clutter leak)', 'precision(keep)'], res.bands.map(b => [b.band, b.n, pct(b.coverage), b.accuracy === null ? null : pct(b.accuracy), b.errors, b.says_remove, b.wrong_remove_content_loss, b.precision_remove, b.says_keep, b.wrong_keep_clutter_leak, b.precision_keep]));
	// subsets
	const subsets = { 'all': rs, 'excl. policy (title/byline/date)': rs.filter(r => !r.policy), 'excl. extractor fixtures': rs.filter(r => !r.u.extractor), 'excl. both': rs.filter(r => !r.policy && !r.u.extractor) };
	res.subsets = {}; const subRows = [];
	for (const [name, ss] of Object.entries(subsets)) {
		const a = prf(ss, 0.5, 'removed'), k = prf(ss, 0.5, 'kept'), t = prfPred(ss, predTuned, 'removed'), tk = prfPred(ss, predTuned, 'kept'); const b = bands(ss)[0];
		res.subsets[name] = { n: ss.length, removed: ss.filter(r => r.y).length, acc05: a.accuracy, p_removed05: a.precision, r_removed05: a.recall, f1_removed05: a.f1, f1_kept05: k.f1, acc_tuned: t.accuracy, f1_removed_tuned: t.f1, f1_kept_tuned: tk.f1, auroc: r3(auroc(ss)), ece: eceKeep(ss).ece, band08_coverage: b.coverage, band08_accuracy: b.accuracy, band08_content_loss: b.wrong_remove_content_loss, band08_clutter_leak: b.wrong_keep_clutter_leak };
		subRows.push([name, ss.length, ss.filter(r => r.y).length, a.accuracy, a.precision, a.recall, a.f1, k.f1, t.accuracy, t.f1, r3(auroc(ss)), eceKeep(ss).ece, pct(b.coverage), b.accuracy, b.wrong_remove_content_loss, b.wrong_keep_clutter_leak]);
	}
	log('Subsets:');
	md(['subset', 'n', 'removed', 'acc@0.5', 'P rem', 'R rem', 'F1 removed@0.5', 'F1 kept@0.5', 'acc tuned', 'F1 removed tuned', 'AUROC', 'ECE', 'cov >=0.8', 'acc in band', 'band content-loss errs', 'band clutter-leak errs'], subRows);
	const group = (keyFn, title, onlyRemoved = false) => {
		const g = new Map(); for (const r of rs) { if (onlyRemoved && !r.y) continue; const k = keyFn(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
		const arr = [...g.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, v]) => { const err05 = v.filter(r => predRemovedAt(r, 0.5) !== r.y).length, errT = v.filter(r => predTuned(r) !== r.y).length; const b = v.filter(r => Math.abs(2 * r.p - 1) >= 0.8); return { key: k, n: v.length, removed: v.filter(r => r.y).length, acc05: r3(1 - err05 / v.length), acc_tuned: r3(1 - errT / v.length), errors05: err05, mean_p_keep: r3(v.reduce((s, r) => s + r.p, 0) / v.length), band08_n: b.length, band08_errors: b.filter(r => predRemovedAt(r, 0.5) !== r.y).length }; });
		log(title); md(['group', 'n', 'removed', 'acc@0.5', 'acc tuned', 'errors@0.5', 'mean p_keep', 'n in band>=0.8', 'errors in band'], arr.map(x => [x.key, x.n, x.removed, x.acc05, x.acc_tuned, x.errors05, x.mean_p_keep, x.band08_n, x.band08_errors]));
		return arr;
	};
	res.by_removal_step = group(r => r.u.hints.removal_step || 'unmatched (no debug removal record)', 'By removal_step (label=removed only; acc = recall):', true);
	res.by_tag = group(r => r.u.tag, 'By tag:');
	res.by_words = group(r => wordsBucket(r.u), 'By words bucket:');
	res.by_words_label = group(r => wordsBucket(r.u) + ' / ' + r.label, 'By words bucket x label:');
	res.by_extractor = group(r => r.u.extractor || 'none', 'By extractor:');
	// kind vs label
	const kinds = [...new Set(rs.map(r => r.kind))].sort();
	const kt = kinds.map(k => { const v = rs.filter(r => r.kind === k); return { kind: k, n: v.length, kept: v.filter(r => !r.y).length, removed: v.filter(r => r.y).length, frac_removed: r3(v.filter(r => r.y).length / v.length), mean_p_keep: r3(v.reduce((s, r) => s + r.p, 0) / v.length), mean_kind_conf: r3(v.reduce((s, r) => s + r.kind_confidence, 0) / v.length) }; });
	log('Kind (choice) vs label:'); md(['kind', 'n', 'label kept', 'label removed', 'frac removed', 'mean p_keep', 'mean kind confidence'], kt.map(x => [x.kind, x.n, x.kept, x.removed, x.frac_removed, x.mean_p_keep, x.mean_kind_conf]));
	const kindPred = r => (CONTENT_KINDS.has(r.kind) ? 0 : 1);
	const kindAcc = prfPred(rs, kindPred, 'removed');
	const agree = rs.filter(r => kindPred(r) === predRemovedAt(r, 0.5)); const agreeAcc = prfPred(agree, kindPred, 'removed');
	const disagree = rs.filter(r => kindPred(r) !== predRemovedAt(r, 0.5));
	const otherRows = rs.filter(r => r.kind === 'other');
	res.kind = { table: kt, kind_derived_keep_accuracy: kindAcc.accuracy, kind_derived_f1_removed: kindAcc.f1, agreement_with_noul05: r3(agree.length / rs.length), accuracy_when_agree: agreeAcc.accuracy, n_agree: agree.length, n_disagree: disagree.length, noul_accuracy_when_disagree: r3(disagree.filter(r => predRemovedAt(r, 0.5) === r.y).length / Math.max(1, disagree.length)), kind_accuracy_when_disagree: r3(disagree.filter(r => kindPred(r) === r.y).length / Math.max(1, disagree.length)), other_n: otherRows.length, other_kept: otherRows.filter(r => !r.y).length };
	log(`Kind-derived keep (content kinds => keep): accuracy ${kindAcc.accuracy}, F1 removed ${kindAcc.f1}. Agreement with noul@0.5: ${r3(agree.length / rs.length)}; accuracy when both agree: ${agreeAcc.accuracy} (n=${agree.length}); when they disagree (n=${disagree.length}) noul right ${res.kind.noul_accuracy_when_disagree}, kind right ${res.kind.kind_accuracy_when_disagree}. kind=other: n=${otherRows.length} (kept ${otherRows.filter(r => !r.y).length}).`);
	// page level
	const casc = m => r => (Math.abs(2 * r.p - 1) >= m - 1e-9 ? predRemovedAt(r, 0.5) : null);
	const byFx = new Map(); for (const r of rs) { if (!byFx.has(r.fixture)) byFx.set(r.fixture, []); byFx.get(r.fixture).push(r); }
	const fns = { 'at 0.5': r => predRemovedAt(r, 0.5), 'tuned (cross-fit, unit split)': predTuned, 'cascade |2p-1|>=0.8 else defer': casc(0.8), 'cascade |2p-1|>=0.9 else defer': casc(0.9), 'cascade |2p-1|>=0.94 else defer': casc(0.94), 'cascade |2p-1|>=0.98 else defer': casc(0.98) };
	res.page_level = {}; const pl = [];
	for (const [name, fn] of Object.entries(fns)) {
		const counts = []; let decided = 0, loss = 0, leak = 0;
		for (const [fx, v] of byFx) { let d = 0, l = 0; for (const r of v) { const p = fn(r); if (p !== null) { decided++; if (p !== r.y) { d++; if (p === 1) { l++; loss++; } else leak++; } } } counts.push({ fixture: fx, units: v.length, disagreements: d, content_loss: l }); }
		const n = counts.length; const z = counts.filter(c => c.disagreements === 0).length, le1 = counts.filter(c => c.disagreements <= 1).length, zl = counts.filter(c => c.content_loss === 0).length;
		res.page_level[name] = { fixtures: n, zero: z, le1, frac_zero: r3(z / n), frac_le1: r3(le1 / n), zero_content_loss: zl, frac_zero_content_loss: r3(zl / n), total_disagreements: counts.reduce((s, c) => s + c.disagreements, 0), content_loss_units: loss, clutter_leak_units: leak, units_decided_by_jev: decided, frac_units_decided: r3(decided / rs.length), worst: counts.sort((a, b) => b.disagreements - a.disagreements).slice(0, 8) };
		pl.push([name, n, z, pct(z / n), le1, pct(le1 / n), zl, pct(zl / n), res.page_level[name].total_disagreements, loss, leak, pct(decided / rs.length)]);
	}
	log('Page-level (per fixture) disagreements with ground truth:');
	md(['mode', 'fixtures', '0 disagreements', 'frac 0', '<=1', 'frac <=1', '0 content-loss', 'frac', 'total disagreements', 'content-loss units', 'clutter-leak units', 'units decided by Jev'], pl);
	log('Worst fixtures at 0.5: ' + res.page_level['at 0.5'].worst.map(w => `${w.fixture} (${w.disagreements}/${w.units})`).join(', '));
	log('Worst fixtures under cascade 0.8: ' + res.page_level['cascade |2p-1|>=0.8 else defer'].worst.map(w => `${w.fixture} (${w.disagreements}/${w.units})`).join(', '));
	// cost/latency
	const lat = rs.map(r => r.latency_ms).sort((a, b) => a - b); const q = p => lat[Math.min(lat.length - 1, Math.floor(p * lat.length))];
	const tok = rs.reduce((s, r) => s + (r.usage?.input_tokens || 0), 0);
	res.cost = { calls: rs.length, input_tokens: tok, output_tokens: rs.reduce((s, r) => s + (r.usage?.output_tokens || 0), 0), est_cost_usd: +(tok / 1e6 * 0.042).toFixed(4), tokens_per_call: Math.round(tok / rs.length), latency_ms: { p50: q(0.5), p90: q(0.9), p99: q(0.99), max: lat[lat.length - 1] }, model: [...new Set(rs.map(r => r.model))] };
	log(`Cost: ${rs.length} calls, ${tok} input tokens (${Math.round(tok / rs.length)}/call), est $${res.cost.est_cost_usd}; latency ms p50=${q(0.5)} p90=${q(0.9)} p99=${q(0.99)} max=${lat[lat.length - 1]}; model=${res.cost.model.join(',')}`);
	res.predTuned = predTuned;
	return res;
}

const out = {};
for (const gt of ['orig', 'corr']) {
	log(`\n\n# ===== GROUND TRUTH: ${gt === 'orig' ? 'GT-A original labels (blocks.jsonl)' : 'GT-B corrected labels (labels-corrected.jsonl, mixed excluded)'} =====`);
	const v1 = rows('v1', gt), v2 = rows('v2', gt), v3 = rows('v3', gt);
	const v1sub = v1.filter(r => sub.has(r.id));
	const o = out[gt] = {};
	o.v1 = fullReport('v1', v1, `V1: state = block HTML, all units [${gt}]`);
	o.v1_sub = fullReport('v1', v1sub, `V1 restricted to the V2/V3 subsample [${gt}]`);
	o.v2 = fullReport('v2', v2, `V2: state = block text only (subsample) [${gt}]`);
	o.v3 = fullReport('v3', v3, `V3: state = JSON {page_title, page_url, block_html} (subsample) [${gt}]`);
	// comparison + ensemble on common subsample
	log(`\n## Variant comparison on the common subsample [${gt}]`);
	const m1 = new Map(v1sub.map(r => [r.id, r])), m2 = new Map(v2.map(r => [r.id, r])), m3 = new Map(v3.map(r => [r.id, r]));
	const common = [...sub].filter(id => m1.has(id) && m2.has(id) && m3.has(id));
	const ens = common.map(id => { const a = m1.get(id), b = m2.get(id), c = m3.get(id); return { ...a, p: (a.p + b.p + c.p) / 3 }; });
	const ens13 = common.map(id => { const a = m1.get(id), c = m3.get(id); return { ...a, p: (a.p + c.p) / 2 }; });
	const pair = (A, B, name) => { let agree = 0, dp = 0, flipsConf = 0; for (const id of common) { const a = A.get(id), b = B.get(id); if (predRemovedAt(a, 0.5) === predRemovedAt(b, 0.5)) agree++; dp += Math.abs(a.p - b.p); if (Math.abs(2 * a.p - 1) >= 0.8 && Math.abs(2 * b.p - 1) >= 0.8 && predRemovedAt(a, 0.5) !== predRemovedAt(b, 0.5)) flipsConf++; } return { pair: name, n: common.length, agreement_at_05: r3(agree / common.length), mean_abs_dp: r3(dp / common.length), confident_contradictions: flipsConf }; };
	o.pairs = [pair(m1, m2, 'V1 vs V2'), pair(m1, m3, 'V1 vs V3'), pair(m2, m3, 'V2 vs V3')];
	md(['pair', 'n', 'agreement@0.5', 'mean |dp|', 'both confident (>=0.8) but contradict'], o.pairs.map(p => [p.pair, p.n, p.agreement_at_05, p.mean_abs_dp, p.confident_contradictions]));
	const cmp = [['V1 html', v1sub], ['V2 text', v2], ['V3 json+context', v3], ['mean(V1,V2,V3)', ens], ['mean(V1,V3)', ens13]].map(([name, rs]) => { const a = prf(rs, 0.5, 'removed'), k = prf(rs, 0.5, 'kept'); const b = bands(rs)[0]; const tu = tuned(rs, false); const tf = tuned(rs, true); return { name, n: rs.length, acc05: a.accuracy, p_removed: a.precision, r_removed: a.recall, f1_removed: a.f1, f1_kept: k.f1, auroc: r3(auroc(rs)), ece: eceKeep(rs).ece, band08_cov: b.coverage, band08_acc: b.accuracy, band08_content_loss: b.wrong_remove_content_loss, band08_clutter_leak: b.wrong_keep_clutter_leak, tuned_unit_f1: tu.mean_test_f1_removed, tuned_unit_acc: tu.mean_test_accuracy, tuned_fx_f1: tf.mean_test_f1_removed, tuned_fx_acc: tf.mean_test_accuracy }; });
	md(['variant', 'n', 'acc@0.5', 'P removed', 'R removed', 'F1 removed', 'F1 kept', 'AUROC', 'ECE', 'cov >=0.8', 'acc in band', 'band content-loss', 'band clutter-leak', 'tuned test F1 (unit split)', 'tuned test acc', 'tuned test F1 (fixture split)', 'tuned test acc'], cmp.map(c => [c.name, c.n, c.acc05, c.p_removed, c.r_removed, c.f1_removed, c.f1_kept, c.auroc, c.ece, pct(c.band08_cov), c.band08_acc, c.band08_content_loss, c.band08_clutter_leak, c.tuned_unit_f1, c.tuned_unit_acc, c.tuned_fx_f1, c.tuned_fx_acc]));
	o.comparison = cmp;
	// disagreement lists
	const errs = v1.filter(r => predRemovedAt(r, 0.5) !== r.y).map(r => ({ id: r.id, fixture: r.fixture, path: r.u.path, tag: r.u.tag, words: r.u.words, label: r.label, label_orig: r.u.label, label_corr: r.c.label_corr, p_keep: r.p, kind: r.kind, kind_conf: r.kind_confidence, err_mag: r.y ? r.p : 1 - r.p, band: Math.abs(2 * r.p - 1) >= 0.8 ? '>=0.8' : Math.abs(2 * r.p - 1) >= 0.6 ? '0.6-0.8' : Math.abs(2 * r.p - 1) >= 0.4 ? '0.4-0.6' : '<0.4', extractor: r.u.extractor, removal_step: r.u.hints.removal_step, removal_reason: r.u.hints.removal_reason, removal_selector: r.u.hints.removal_selector, policy: r.policy, is_title: r.c.is_title, in_landmark: r.u.hints.in_landmark, snippet: r.u.text.slice(0, 160), judgment: judgments[r.id] || (gt === 'orig' && r.c.label_corr !== r.u.label ? (r.c.label_corr === 'mixed' ? 'label artifact/mixed [auto]' : 'jev-right (label artifact) [auto: corrected label agrees with Jev]') : r.c.is_title ? 'policy (title) [auto]' : r.u.extractor ? 'policy (page-type) [auto]' : r.policy ? 'policy (byline/date) [auto]' : 'unjudged (below 0.8 band)') })).sort((a, b) => b.err_mag - a.err_mag || a.id.localeCompare(b.id));
	o.v1_disagreements_count = errs.length;
	o.v1_top40 = errs.slice(0, 40);
	writeFileSync(`${DIR}/disagreements-${gt}.json`, JSON.stringify(errs, null, 1));
	writeFileSync(`${DIR}/top40-${gt}.json`, JSON.stringify(o.v1_top40, null, 1));
	log(`\n## Top 40 V1 disagreements [${gt}] (most confident first; total ${errs.length})`);
	for (const [i, e] of errs.slice(0, 40).entries()) log(`${i + 1}. [${e.label}${e.label_orig !== e.label_corr ? ` (orig=${e.label_orig}, corr=${e.label_corr})` : ''}] p_keep=${e.p_keep} kind=${e.kind} | ${e.fixture} | ${e.tag} ${e.path.slice(0, 80)} | w=${e.words} | step=${e.removal_step || '-'} reason=${e.removal_reason || '-'} | "${e.snippet}" | judgment: ${e.judgment || 'TBD'}`);
	const jd = {}; for (const e of errs) { const j = e.judgment ? e.judgment.split(':')[0].trim() : 'unjudged'; jd[j] = (jd[j] || 0) + 1; }
	o.judgment_counts_all_disagreements = jd;
	const jd40 = {}; for (const e of errs.slice(0, 40)) { const j = e.judgment ? e.judgment.split(':')[0].trim() : 'unjudged'; jd40[j] = (jd40[j] || 0) + 1; }
	o.judgment_counts_top40 = jd40;
	log('Judgment counts (top 40): ' + JSON.stringify(jd40) + '  (all disagreements): ' + JSON.stringify(jd));
	const conf = errs.filter(e => e.band === '>=0.8');
	const jdc = {}; for (const e of conf) { const j = e.judgment.split(':')[0].trim(); jdc[j] = (jdc[j] || 0) + 1; }
	const genuine = conf.filter(e => /^defuddle-right/.test(e.judgment)).length, ambiguous = conf.filter(e => /^ambiguous/.test(e.judgment)).length;
	const bandN = v1.filter(r => Math.abs(2 * r.p - 1) >= 0.8).length;
	o.confident_band_disagreements = { n: conf.length, band_n: bandN, by_judgment: jdc, genuine_jev_errors: genuine, ambiguous, genuine_error_rate_in_band: r3(genuine / bandN), genuine_plus_ambiguous_rate_in_band: r3((genuine + ambiguous) / bandN), content_loss_genuine: conf.filter(e => /^defuddle-right/.test(e.judgment) && e.label === 'kept').length };
	log(`Confident band (|2p-1|>=0.8) disagreements: ${conf.length} of ${bandN} units; by judgment ${JSON.stringify(jdc)}; genuine Jev errors ${genuine} (${pct(genuine / bandN)} of band), ambiguous ${ambiguous}; genuine content-loss ${o.confident_band_disagreements.content_loss_genuine}`);
}
// repeat run (independent of GT)
const v1 = rows('v1', 'orig'), v1r = rows('v1r', 'orig');
if (v1r.length) {
	log('\n## Repeat run: V1 vs V1-repeat (same state, questions, model)');
	const m1 = new Map(v1.map(r => [r.id, r])), mr = new Map(v1r.map(r => [r.id, r]));
	const ids = [...mr.keys()].filter(id => m1.has(id));
	let dps = [], flips05 = 0, kindFlips = 0, confFlips = 0, bandChanges = 0, identical = 0;
	for (const id of ids) { const a = m1.get(id), b = mr.get(id); const d = Math.abs(a.p - b.p); dps.push(d); if (d === 0) identical++; if (predRemovedAt(a, 0.5) !== predRemovedAt(b, 0.5)) flips05++; if (a.kind !== b.kind) kindFlips++; const ca = Math.abs(2 * a.p - 1) >= 0.8, cb = Math.abs(2 * b.p - 1) >= 0.8; if (ca !== cb) bandChanges++; if (ca && cb && predRemovedAt(a, 0.5) !== predRemovedAt(b, 0.5)) confFlips++; }
	dps.sort((x, y) => x - y);
	out.repeat = { n: ids.length, identical_p: identical, frac_identical: r3(identical / ids.length), mean_abs_dp: r3(dps.reduce((s, x) => s + x, 0) / ids.length), p90_abs_dp: r3(dps[Math.floor(0.9 * ids.length)]), max_abs_dp: r3(dps[ids.length - 1]), frac_dp_gt_0_05: r3(dps.filter(x => x > 0.05).length / ids.length), decision_flips_at_05: flips05, frac_flips_05: r3(flips05 / ids.length), kind_choice_flips: kindFlips, frac_kind_flips: r3(kindFlips / ids.length), confident_band_membership_changes: bandChanges, confident_contradictions: confFlips };
	log(JSON.stringify(out.repeat));
}
// label correction summary
out.relabel = JSON.parse(readFileSync(`${DIR}/relabel-summary.json`, 'utf8'));
const clean = JSON.parse(JSON.stringify(out, (k, v) => (typeof v === 'function' ? undefined : v)));
writeFileSync(`${DIR}/analysis2.json`, JSON.stringify(clean, null, 1));
writeFileSync(`${DIR}/analysis2-stdout.txt`, lines.join('\n'));
console.log('\nwrote analysis2.json, analysis2-stdout.txt, disagreements-*.json, top40-*.json');
