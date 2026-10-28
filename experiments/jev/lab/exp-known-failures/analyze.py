#!/usr/bin/env python3 -I
"""Build report.md from results.jsonl (per-issue table + totals)."""
import json, statistics, collections, sys, os
D = os.path.dirname(os.path.abspath(__file__))
rows = [json.loads(l) for l in open(os.path.join(D, 'results.jsonl')) if l.strip()]
nouls = [r for r in rows if r['type'] == 'noul']
choices = [r for r in rows if r['type'] == 'choice']
usage = json.loads(sys.argv[1]) if len(sys.argv) > 1 else None

# per block: html + text p_keep
blocks = collections.OrderedDict()
for r in nouls:
    b = blocks.setdefault(r['id'], {'issue': r['issue'], 'file': r['file'], 'id': r['id'], 'kind': r['kind'], 'step': r['step'], 'words': r['words'], 'preview': r['preview'], 'truncated': r['truncated']})
    b['p_' + r['variant']] = r['p_keep']
    b['lat_' + r['variant']] = r['latency_ms']
    b['tok_' + r['variant']] = r['input_tokens']

def band(p):
    if p is None: return 'n/a'
    if p >= 0.9: return '>=0.9'
    if p >= 0.7: return '0.7-0.9'
    if p >= 0.5: return '0.5-0.7'
    return '<0.5'

ISSUE_META = {
    460: ('yes (synthetic from issue; live sacred-texts page 403)', 'Whole page body (h1 + 59-word paragraph) removed because wrapper has an h2 "Comments"; hidden chapter list returned instead'),
    445: ('yes (synthetic + live ukhumanrightsblog.com)', 'Everything after a bold "Comment" paragraph: the author\'s analysis/conclusion paragraphs'),
    444: ('yes (synthetic + live legislation.gov.uk)', 'Inline defined term <span id="term-related-claim">related claim</span>; output reads "" means a claim...'),
    441: ('yes (live felixrieseberg.com; output empty, 0 words)', 'Entire 2,100-word post body: div.content[data-date] matched exact [data-date]'),
    428: ('yes (fixture from issue author)', 'Short algorithm instructions / prose containing "register" (6 blocks) removed by scoring'),
    346: ('yes (synthetic from issue; live Claude docs no longer use role=list Steps)', 'Step title + content inside div[role=list] > [data-component-part]'),
    433: ('yes (synthetic from issue)', 'LaTeXML footnote body ("Unique explanation with x^2") inside span.ltx_note_outer'),
    372: ('yes (synthetic from issue)', 'Two in-prose links in <span> wrappers ("our profile", "our other posts") removed as section breadcrumbs'),
    321: ('yes (live mpcjazz.github.io is the minimal repro)', '<section id="tags"> with heading + paragraph removed by exact #tags'),
    408: ('yes (synthetic + live hypr.land)', 'Nested <ul> (x1/x2; fit_into_view, fit expand, inhibit_scroll) removed as "blog metadata list"'),
    252: ('yes (synthetic + live infoq.com)', 'Content links to /author/ pages ("Grady Booch", "Erik Meijer") removed by exact [href*="/author/"]'),
    279: ('yes (live crosslabs.org)', 'Hero image + 26-word caption removed by partial selector hero[_-a-z]'),
    360: ('yes (HTML attached to issue)', '3 x div.with-ad wrappers (373/528/649 words of article body) removed by exact [class$="-ad" i]; article cut after intro'),
    365: ('yes (live freedium; loss = code blocks, issue screenshots not readable here)', 'All code blocks: light copy removed as Tailwind dark:hidden, dark copy removed as .hidden'),
    375: ('yes (live projectorjunkies.com)', '3.4k words (specs + sections) in Tailwind empty:hidden wrappers removed as hidden'),
    257: ('yes (live biorxiv.org; 737 of ~14k words survive)', 'Entire full-text container (13k words) removed by partial selector "tabs-"'),
    134: ('yes (live engine.needle.tools/docs; ground truth ambiguous: docs landing page made of link cards)', 'Learning-path card grid (77 words) by scoring -10; "what\'s new" card by partial card-content'),
    395: ('partially (live Quarto page; table headers confirmed, side-by-side images not investigated)', 'Every <tr class="header"> table header row removed by exact .header:not(.banner)'),
    380: ('yes (synthetic from issue; extractor bug, container test only)', 'Second post of a Reddit listing dropped (Reddit extractor takes first shreddit-post)'),
}

issues = collections.OrderedDict()
for b in blocks.values():
    issues.setdefault(b['issue'], []).append(b)
for c in choices:
    issues.setdefault(c['issue'], [])

def fmt(p): return 'n/a' if p is None else f'{p:.2f}'

lines = []
lines.append('# Would Jev have caught defuddle\'s known, current extraction failures?\n')
lines.append('Model `jev-1.14.0` (pinned; `model` field in every response = `jev-1.14.0`). One Noul per block: "Should this block be kept in a clean reader-mode view of the page\'s main article? ..." (full text in experiment.mjs). State = cleaned outerHTML of the block as it exists in the ORIGINAL page DOM (script/style/svg/iframe stripped, data: URIs and long attribute values truncated, capped at 6000 chars), and separately the block\'s text only. Containers: one Choice per page over candidate elements with an explicit `none_of_these` option.\n')
lines.append(f'Requests: {len(rows)} ({len(nouls)} noul, {len(choices)} choice), errors 0. ' + (f'Input tokens {usage["input_tokens"]:,}, est. cost ${usage["est_cost_usd"]:.4f}, latency p50 {usage["latency_ms"]["p50"]:.0f} ms, p90 {usage["latency_ms"]["p90"]:.0f} ms, max {usage["latency_ms"]["max"]:.0f} ms.' if usage else ''))
lines.append('')
lines.append('Block kinds: **W** = block the issue says was wrongly removed (the bug). **C** = block defuddle removed correctly on the same page (genuine nav/footer/promo/comments/related), used to measure how often a "veto@0.9" rule (keep anything the heuristics want to remove if Jev p_keep >= 0.9) would re-insert clutter. **A** = ambiguous (author bio, title/byline header, parent context); not counted. **K** = clutter defuddle kept (not a removal; shown for information).\n')

# ---------- per-issue table ----------
lines.append('## Per-issue results\n')
lines.append('| issue | reproduced? | what was lost | removal step / reason | Jev p_keep (HTML) on W blocks | p_keep (text) | veto@0.9 fixes it? | veto@0.9 re-inserts clutter (C blocks p>=0.9 / n) | container pick | latency ms (p50 on page) | tokens (page) |')
lines.append('|---|---|---|---|---|---|---|---|---|---|---|')
totals = {'repro': 0, 'confident': 0, 'uncertain': 0, 'agree_bug': 0, 'mixed': 0, 'clutter_reinserted': 0, 'clutter_tested': 0, 'W_blocks': 0, 'W_ge09': 0, 'W_05_09': 0, 'W_lt05': 0, 'W_text_ge09': 0}
issue_summary = {}
for issue, bl in issues.items():
    repro, lost = ISSUE_META.get(issue, ('?', '?'))
    W = [b for b in bl if b['kind'] == 'W']
    C = [b for b in bl if b['kind'] == 'C']
    steps = sorted({b['step'] for b in W if b.get('step')})
    pw = [b['p_html'] for b in W if b.get('p_html') is not None]
    pt = [b['p_text'] for b in W if b.get('p_text') is not None]
    totals['repro'] += 1
    verdict = 'n/a'
    if W:
        totals['W_blocks'] += len(W)
        totals['W_ge09'] += sum(1 for p in pw if p >= 0.9)
        totals['W_05_09'] += sum(1 for p in pw if 0.5 <= p < 0.9)
        totals['W_lt05'] += sum(1 for p in pw if p < 0.5)
        totals['W_text_ge09'] += sum(1 for p in pt if p >= 0.9)
        if all(p >= 0.9 for p in pw): verdict = 'yes (all W blocks >= 0.9)'; totals['confident'] += 1
        elif all(p < 0.5 for p in pw): verdict = 'no (Jev agrees with the removal, < 0.5)'; totals['agree_bug'] += 1
        elif all(p >= 0.5 for p in pw): verdict = 'uncertain (0.5-0.9)'; totals['uncertain'] += 1
        else: verdict = f'mixed ({sum(1 for p in pw if p >= 0.9)}/{len(pw)} >= 0.9, {sum(1 for p in pw if p < 0.5)}/{len(pw)} < 0.5)'; totals['mixed'] += 1
    c_hi = sum(1 for b in C if b.get('p_html') is not None and b['p_html'] >= 0.9)
    totals['clutter_reinserted'] += c_hi; totals['clutter_tested'] += len(C)
    conts = [c for c in choices if c['issue'] == issue]
    cont_txt = []
    for c in conts:
        chosen = c['choice']; sel = next((x['selector'] for x in c['cands'] if x['option'] == chosen), None)
        ok = sel in c['correct']
        cont_txt.append(f"{c['file']}: picked `{chosen}` ({'correct' if ok else 'WRONG' if chosen != 'none_of_these' else 'none_of_these'}; conf {c['confidence']:.2f})")
    lat = [r['latency_ms'] for r in rows if r['issue'] == issue]
    tok = sum(r['input_tokens'] or 0 for r in rows if r['issue'] == issue)
    pw_txt = ', '.join(f"{b['id'].split('-',1)[1]}={fmt(b.get('p_html'))}" for b in W) or '—'
    pt_txt = ', '.join(fmt(b.get('p_text')) for b in W) or '—'
    lines.append(f"| #{issue} | {repro} | {lost} | {'; '.join(steps) or '—'} | {pw_txt} | {pt_txt} | {verdict} | {c_hi}/{len(C)} | {'; '.join(cont_txt) or '—'} | {statistics.median(lat):.0f} | {tok:,} |")
    issue_summary[issue] = dict(verdict=verdict, c_hi=c_hi, nC=len(C))

# ---------- totals ----------
lines.append('\n## Totals\n')
lines.append(f"- Issues reproduced and tested: **{totals['repro']}** (18 with block tests + #380 container-only). Not reproduced / not testable: #13 (noscript fallback of the Discourse thread already contains both posts), #383 (OSM: the text is present; the complaint is lost links inside captions/headings = formatting), #324 (taz.de extracts fine offline; issue is intermittent fetch/bot blocking), #382 (The Verge article was edited; the affiliate link no longer exists in the page), #371 (div flattening = formatting, not removal), #386 shamela.ws (HTTP 403), #336 (formatting, skipped), #360 live and #460 live pages (403; used the issue's attached HTML / snippet instead).")
lines.append(f"- Issues where Jev confidently (p_keep >= 0.9 on every wrongly-removed block, HTML state) sided with the human, i.e. a veto rule would have prevented the bug: **{totals['confident']}**: " + ', '.join(f'#{i}' for i, s in issue_summary.items() if s['verdict'].startswith('yes')) + '.')
lines.append(f"- Issues where Jev was uncertain (all W blocks 0.5-0.9): **{totals['uncertain']}**: " + (', '.join(f'#{i}' for i, s in issue_summary.items() if s['verdict'].startswith('uncertain')) or 'none') + '.')
lines.append(f"- Issues where Jev agreed with the buggy removal (all W blocks < 0.5): **{totals['agree_bug']}**: " + (', '.join(f'#{i}' for i, s in issue_summary.items() if s['verdict'].startswith('no')) or 'none') + '.')
lines.append(f"- Mixed issues (some W blocks >= 0.9, others lower): **{totals['mixed']}**: " + (', '.join(f'#{i} ({s["verdict"]})' for i, s in issue_summary.items() if s['verdict'].startswith('mixed')) or 'none') + '.')
lines.append(f"- Wrongly-removed blocks (W) overall: {totals['W_blocks']}; p_keep >= 0.9: **{totals['W_ge09']}** ({100*totals['W_ge09']/totals['W_blocks']:.0f}%), 0.5-0.9: {totals['W_05_09']}, < 0.5: {totals['W_lt05']}. With text-only state: {totals['W_text_ge09']} >= 0.9 ({100*totals['W_text_ge09']/totals['W_blocks']:.0f}%).")
lines.append(f"- Correctly-removed clutter blocks (C) tested on the same pages: {totals['clutter_tested']}; a veto@0.9 would have wrongly re-inserted **{totals['clutter_reinserted']}** of them ({100*totals['clutter_reinserted']/max(1,totals['clutter_tested']):.0f}%).")
cont_ok = sum(1 for c in choices if next((x['selector'] for x in c['cands'] if x['option'] == c['choice']), None) in c['correct'])
lines.append(f"- Container picks: {cont_ok}/{len(choices)} correct (acceptable = the article element or its body wrapper).")

# bands for C blocks
Cb = [b for b in blocks.values() if b['kind'] == 'C']
bands = collections.Counter(band(b['p_html']) for b in Cb)
lines.append(f"- C-block p_keep (HTML) distribution: " + ', '.join(f'{k}: {v}' for k, v in sorted(bands.items())) + '.')
Wb = [b for b in blocks.values() if b['kind'] == 'W']
bands = collections.Counter(band(b['p_html']) for b in Wb)
lines.append(f"- W-block p_keep (HTML) distribution: " + ', '.join(f'{k}: {v}' for k, v in sorted(bands.items())) + '.')


# ---------- threshold sweep (derived, no new calls) ----------
lines.append('\n## Threshold sweep (same data): what a veto at 0.9 / 0.8 / 0.7 / 0.5 would have done\n')
lines.append('"Issue fixed" = every W block on the issue has p_keep (HTML state) >= threshold; "partially" = at least one. "Clutter re-inserted" = C blocks with p_keep >= threshold (out of 69).')
lines.append('')
lines.append('| threshold | issues fully fixed (of 18) | issues partially fixed | W blocks kept (of 42) | W body-text words recovered (of total W words) | clutter blocks re-inserted (of 69) |')
lines.append('|---|---|---|---|---|---|')
tot_w_words = sum(b['words'] for b in Wb)
for th in (0.9, 0.8, 0.7, 0.6, 0.5):
    full = [i for i, bl in issues.items() if [b for b in bl if b['kind']=='W'] and all(b['p_html'] >= th for b in bl if b['kind']=='W')]
    part = [i for i, bl in issues.items() if [b for b in bl if b['kind']=='W'] and any(b['p_html'] >= th for b in bl if b['kind']=='W') and i not in full]
    wk = [b for b in Wb if b['p_html'] >= th]
    ck = [b for b in Cb if b['p_html'] >= th]
    lines.append(f"| {th} | {len(full)} ({', '.join('#'+str(i) for i in full)}) | {len(part)} ({', '.join('#'+str(i) for i in part)}) | {len(wk)} | {sum(b['words'] for b in wk):,} / {tot_w_words:,} | {len(ck)}" + (f" ({', '.join(b['id'] for b in ck)})" if ck else '') + ' |')
lines.append('')
lines.append('HTML state vs text-only state on W blocks: ' + '; '.join(f"{b['id']} html={fmt(b['p_html'])} text={fmt(b['p_text'])}" for b in Wb if abs((b['p_html'] or 0) - (b['p_text'] or 0)) >= 0.3) + '. (Cases where the HTML attributes themselves, e.g. id="tags" or href="/author/…", pull Jev toward the same error as the regex heuristic.)')

# ---------- block detail ----------
lines.append('\n## Every block (HTML-state p_keep, text-state p_keep)\n')
lines.append('| issue | block | kind | words | step | p_keep HTML | p_keep text | preview |')
lines.append('|---|---|---|---|---|---|---|---|')
for b in blocks.values():
    lines.append(f"| #{b['issue']} | {b['id']} | {b['kind']} | {b['words']}{' (trunc)' if b['truncated'] else ''} | {b.get('step') or ''} | {fmt(b.get('p_html'))} | {fmt(b.get('p_text'))} | {b['preview'][:90].replace('|','/')} |")

# ---------- containers ----------
lines.append('\n## Container choices\n')
lines.append('| issue | page | chosen | confidence | correct? | probabilities |')
lines.append('|---|---|---|---|---|---|')
for c in choices:
    sel = next((x['selector'] for x in c['cands'] if x['option'] == c['choice']), None)
    probs = ', '.join(f'{k}={v:.2f}' for k, v in sorted(c['probabilities'].items(), key=lambda kv: -kv[1]))
    lines.append(f"| #{c['issue']} | {c['file']} | `{c['choice']}` ({sel}) | {c['confidence']:.2f} | {'yes' if sel in c['correct'] else 'no'} (acceptable: {', '.join(c['correct'])}) | {probs} |")

# ---------- notable misses ----------
lines.append('\n## Notable observations\n')
low_W = [b for b in Wb if b['p_html'] < 0.9]
if low_W:
    lines.append('Wrongly-removed blocks where Jev did NOT reach 0.9 (HTML state):')
    for b in low_W: lines.append(f"- #{b['issue']} {b['id']} ({b['words']}w): p_html={fmt(b['p_html'])}, p_text={fmt(b['p_text'])} — \"{b['preview'][:80]}\"")
hi_C = [b for b in Cb if b['p_html'] >= 0.9]
if hi_C:
    lines.append('\nCorrectly-removed clutter that a veto@0.9 would re-insert (HTML state):')
    for b in hi_C: lines.append(f"- #{b['issue']} {b['id']} ({b['words']}w): p_html={fmt(b['p_html'])}, p_text={fmt(b['p_text'])} — \"{b['preview'][:80]}\"")
mid_C = [b for b in Cb if 0.5 <= b['p_html'] < 0.9]
if mid_C:
    lines.append('\nClutter in the uncertain band 0.5-0.9 (would be re-inserted by a 0.5 veto but not a 0.9 veto):')
    for b in mid_C: lines.append(f"- #{b['issue']} {b['id']} ({b['words']}w): p_html={fmt(b['p_html'])}, p_text={fmt(b['p_text'])} — \"{b['preview'][:80]}\"")
Ab = [b for b in blocks.values() if b['kind'] in 'AK']
lines.append('\nAmbiguous / kept-clutter blocks (not counted):')
for b in Ab: lines.append(f"- #{b['issue']} {b['id']} [{b['kind']}] ({b['words']}w): p_html={fmt(b['p_html'])}, p_text={fmt(b['p_text'])} — \"{b['preview'][:80]}\"")

open(os.path.join(D, 'report.md'), 'w').write('\n'.join(lines) + '\n')
print('\n'.join(lines))
