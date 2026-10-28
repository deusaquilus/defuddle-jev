# Would Jev have caught defuddle's known, current extraction failures?

Model `jev-1.14.0` (pinned; `model` field in every response = `jev-1.14.0`). One Noul per block: "Should this block be kept in a clean reader-mode view of the page's main article? ..." (full text in experiment.mjs). State = cleaned outerHTML of the block as it exists in the ORIGINAL page DOM (script/style/svg/iframe stripped, data: URIs and long attribute values truncated, capped at 6000 chars), and separately the block's text only. Containers: one Choice per page over candidate elements with an explicit `none_of_these` option.

Requests: 252 (238 noul, 14 choice), errors 0. Input tokens 182,851, est. cost $0.0077, latency p50 65 ms, p90 106 ms, max 631 ms.

Block kinds: **W** = block the issue says was wrongly removed (the bug). **C** = block defuddle removed correctly on the same page (genuine nav/footer/promo/comments/related), used to measure how often a "veto@0.9" rule (keep anything the heuristics want to remove if Jev p_keep >= 0.9) would re-insert clutter. **A** = ambiguous (author bio, title/byline header, parent context); not counted. **K** = clutter defuddle kept (not a removal; shown for information).

## Per-issue results

| issue | reproduced? | what was lost | removal step / reason | Jev p_keep (HTML) on W blocks | p_keep (text) | veto@0.9 fixes it? | veto@0.9 re-inserts clutter (C blocks p>=0.9 / n) | container pick | latency ms (p50 on page) | tokens (page) |
|---|---|---|---|---|---|---|---|---|---|---|
| #460 | yes (synthetic from issue; live sacred-texts page 403) | Whole page body (h1 + 59-word paragraph) removed because wrapper has an h2 "Comments"; hidden chapter list returned instead | scoreAndRemove score:-10 | body=0.36 | 0.50 | no (Jev agrees with the removal, < 0.5) | 0/1 | 460-synth.html: picked `main` (correct; conf 0.45) | 128 | 3,913 |
| #445 | yes (synthetic + live ukhumanrightsblog.com) | Everything after a bold "Comment" paragraph: the author's analysis/conclusion paragraphs | removeByContentPattern boilerplate text; removeByContentPattern trailing non-content | comment-label=0.08, p2=0.89, p1=0.93, p1=0.96, comment-label=0.08, p2=0.96 | 0.08, 0.82, 0.88, 0.92, 0.08, 0.92 | mixed (3/6 >= 0.9, 2/6 < 0.5) | 0/8 | 445-synth.html: picked `article` (correct; conf 0.52); 445.html: picked `article_article` (correct; conf 0.78) | 68 | 23,647 |
| #444 | yes (synthetic + live legislation.gov.uk) | Inline defined term <span id="term-related-claim">related claim</span>; output reads "" means a claim... | removeBySelector partial (?<!h[1-6]-)related | term=0.20, term=0.17 | 0.13, 0.14 | no (Jev agrees with the removal, < 0.5) | 0/6 | — | 60 | 8,465 |
| #441 | yes (live felixrieseberg.com; output empty, 0 words) | Entire 2,100-word post body: div.content[data-date] matched exact [data-date] | removeBySelector exact [data-date] | body=0.87 | 0.95 | uncertain (0.5-0.9) | 0/4 | 441.html: picked `article_post_tag_claude` (correct; conf 0.44) | 65 | 10,002 |
| #428 | yes (fixture from issue author) | Short algorithm instructions / prose containing "register" (6 blocks) removed by scoring | scoreAndRemove score:-10 | algo-1=0.79, algo-2=0.93, heading=0.85, init=0.71, cash=0.76, output=0.41 | 0.44, 0.73, 0.66, 0.65, 0.67, 0.33 | mixed (1/6 >= 0.9, 1/6 < 0.5) | 0/6 | — | 62 | 9,482 |
| #346 | yes (synthetic from issue; live Claude docs no longer use role=list Steps) | Step title + content inside div[role=list] > [data-component-part] | no removal record (lost in standardizeContent) | steps=0.61 | 0.62 | uncertain (0.5-0.9) | 0/0 | — | 60 | 800 |
| #433 | yes (synthetic from issue) | LaTeXML footnote body ("Unique explanation with x^2") inside span.ltx_note_outer | no removal record (footnote standardization) | footnote=0.89 | 0.51 | uncertain (0.5-0.9) | 0/0 | — | 68 | 842 |
| #372 | yes (synthetic from issue) | Two in-prose links in <span> wrappers ("our profile", "our other posts") removed as section breadcrumbs | removeByContentPattern section breadcrumb | span-samesite=0.14, span-offsite=0.21 | 0.11, 0.30 | no (Jev agrees with the removal, < 0.5) | 0/0 | — | 89 | 1,554 |
| #321 | yes (live mpcjazz.github.io is the minimal repro) | <section id="tags"> with heading + paragraph removed by exact #tags | removeBySelector exact #tags | tags-section=0.11 | 0.89 | no (Jev agrees with the removal, < 0.5) | 0/0 | — | 84 | 784 |
| #408 | yes (synthetic + live hypr.land) | Nested <ul> (x1/x2; fit_into_view, fit expand, inhibit_scroll) removed as "blog metadata list" | removeByContentPattern blog metadata list | nested-list=0.58, nested-list=0.38 | 0.54, 0.20 | mixed (0/2 >= 0.9, 1/2 < 0.5) | 0/3 | 408.html: picked `article_mx_auto_mt_navbar` (correct; conf 0.74) | 93 | 8,814 |
| #252 | yes (synthetic + live infoq.com) | Content links to /author/ pages ("Grady Booch", "Erik Meijer") removed by exact [href*="/author/"] | removeBySelector exact [href*="/author/"] | link-1=0.14, link-2=0.11, link-1=0.13, link-2=0.13 | 0.52, 0.34, 0.54, 0.31 | no (Jev agrees with the removal, < 0.5) | 0/8 | 252.html: picked `article_article_grid` (correct; conf 0.50) | 67 | 18,018 |
| #279 | yes (live crosslabs.org) | Hero image + 26-word caption removed by partial selector hero[_-a-z] | removeBySelector partial hero[_\-a-z] | hero=0.83 | 0.51 | uncertain (0.5-0.9) | 0/5 | 279.html: picked `div_blog_post_wrap` (correct; conf 0.59) | 72 | 7,913 |
| #360 | yes (HTML attached to issue) | 3 x div.with-ad wrappers (373/528/649 words of article body) removed by exact [class$="-ad" i]; article cut after intro | (inner article text of withad-1); removeBySelector exact [class$="-ad" i] | withad-1=0.83, withad-2=0.75, bq-1=0.96, withad-3=0.80 | 0.93, 0.95, 0.94, 0.92 | uncertain (0.5-0.9) | 0/8 | 360a.html: picked `article_pt_4_post_97284` (correct; conf 0.50) | 61 | 24,424 |
| #365 | yes (live freedium; loss = code blocks, issue screenshots not readable here) | All code blocks: light copy removed as Tailwind dark:hidden, dark copy removed as .hidden | removeHiddenElements class:dark:hidden | code-1=0.86, code-2=0.87, code-3=0.85 | 0.62, 0.60, 0.60 | uncertain (0.5-0.9) | 0/3 | 365.html: picked `article_overflow_hidden_bg_white` (correct; conf 0.64) | 64 | 11,553 |
| #375 | yes (live projectorjunkies.com) | 3.4k words (specs + sections) in Tailwind empty:hidden wrappers removed as hidden | removeHiddenElements class:empty:hidden | specs=0.97, section-2=0.86 | 0.92, 0.75 | uncertain (0.5-0.9) | 0/5 | 375.html: picked `article_post_11847_post_11847_post` (correct; conf 0.50) | 61 | 16,731 |
| #257 | yes (live biorxiv.org; 737 of ~14k words survive) | Entire full-text container (13k words) removed by partial selector "tabs-" | removeBySelector partial tabs- | tabs-container=0.83 | 0.94 | uncertain (0.5-0.9) | 0/4 | 257.html: picked `div_article_fulltext_view` (correct; conf 0.59) | 63 | 15,774 |
| #134 | yes (live engine.needle.tools/docs; ground truth ambiguous: docs landing page made of link cards) | Learning-path card grid (77 words) by scoring -10; "what's new" card by partial card-content | removeBySelector partial card-content; scoreAndRemove score:-10 (card grid) | whats-new-card=0.17, path-cards=0.23 | 0.41, 0.11 | no (Jev agrees with the removal, < 0.5) | 0/4 | 134.html: picked `div_content` (correct; conf 0.60) | 61 | 8,109 |
| #395 | partially (live Quarto page; table headers confirmed, side-by-side images not investigated) | Every <tr class="header"> table header row removed by exact .header:not(.banner) | removeBySelector exact .header:not(.banner) | thead-row-1=0.90, thead-row-2=0.92 | 0.63, 0.72 | yes (all W blocks >= 0.9) | 0/4 | 395.html: picked `main_quarto_document_content_content_pag` (correct; conf 0.82) | 57 | 11,393 |
| #380 | yes (synthetic from issue; extractor bug, container test only) | Second post of a Reddit listing dropped (Reddit extractor takes first shreddit-post) | — | — | — | n/a | 0/0 | 380-synth.html: picked `main` (correct; conf 0.68) | 53 | 633 |

## Totals

- Issues reproduced and tested: **19** (18 with block tests + #380 container-only). Not reproduced / not testable: #13 (noscript fallback of the Discourse thread already contains both posts), #383 (OSM: the text is present; the complaint is lost links inside captions/headings = formatting), #324 (taz.de extracts fine offline; issue is intermittent fetch/bot blocking), #382 (The Verge article was edited; the affiliate link no longer exists in the page), #371 (div flattening = formatting, not removal), #386 shamela.ws (HTTP 403), #336 (formatting, skipped), #360 live and #460 live pages (403; used the issue's attached HTML / snippet instead).
- Issues where Jev confidently (p_keep >= 0.9 on every wrongly-removed block, HTML state) sided with the human, i.e. a veto rule would have prevented the bug: **1**: #395.
- Issues where Jev was uncertain (all W blocks 0.5-0.9): **8**: #441, #346, #433, #279, #360, #365, #375, #257.
- Issues where Jev agreed with the buggy removal (all W blocks < 0.5): **6**: #460, #444, #372, #321, #252, #134.
- Mixed issues (some W blocks >= 0.9, others lower): **3**: #445 (mixed (3/6 >= 0.9, 2/6 < 0.5)), #428 (mixed (1/6 >= 0.9, 1/6 < 0.5)), #408 (mixed (0/2 >= 0.9, 1/2 < 0.5)).
- Wrongly-removed blocks (W) overall: 42; p_keep >= 0.9: **8** (19%), 0.5-0.9: 18, < 0.5: 16. With text-only state: 9 >= 0.9 (21%).
- Correctly-removed clutter blocks (C) tested on the same pages: 69; a veto@0.9 would have wrongly re-inserted **0** of them (0%).
- Container picks: 14/14 correct (acceptable = the article element or its body wrapper).
- C-block p_keep (HTML) distribution: 0.5-0.7: 1, <0.5: 68.
- W-block p_keep (HTML) distribution: 0.5-0.7: 2, 0.7-0.9: 16, <0.5: 16, >=0.9: 8.

## Threshold sweep (same data): what a veto at 0.9 / 0.8 / 0.7 / 0.5 would have done

"Issue fixed" = every W block on the issue has p_keep (HTML state) >= threshold; "partially" = at least one. "Clutter re-inserted" = C blocks with p_keep >= threshold (out of 69).

| threshold | issues fully fixed (of 18) | issues partially fixed | W blocks kept (of 42) | W body-text words recovered (of total W words) | clutter blocks re-inserted (of 69) |
|---|---|---|---|---|---|
| 0.9 | 1 (#395) | 4 (#445, #428, #360, #375) | 8 | 1,752 / 19,043 | 0 |
| 0.8 | 7 (#441, #433, #279, #365, #375, #257, #395) | 3 (#445, #428, #360) | 20 | 18,282 / 19,043 | 0 |
| 0.7 | 8 (#441, #433, #279, #360, #365, #375, #257, #395) | 2 (#445, #428) | 24 | 18,826 / 19,043 | 0 |
| 0.6 | 9 (#441, #346, #433, #279, #360, #365, #375, #257, #395) | 2 (#445, #428) | 25 | 18,828 / 19,043 | 1 (365-toc) |
| 0.5 | 9 (#441, #346, #433, #279, #360, #365, #375, #257, #395) | 3 (#445, #428, #408) | 26 | 18,829 / 19,043 | 1 (365-toc) |

HTML state vs text-only state on W blocks: 428-algo-1 html=0.79 text=0.44; 433-footnote html=0.89 text=0.51; 321-tags-section html=0.11 text=0.89; 252s-link-1 html=0.14 text=0.52; 252-link-1 html=0.13 text=0.54; 279-hero html=0.83 text=0.51. (Cases where the HTML attributes themselves, e.g. id="tags" or href="/author/…", pull Jev toward the same error as the regex heuristic.)

## Every block (HTML-state p_keep, text-state p_keep)

| issue | block | kind | words | step | p_keep HTML | p_keep text | preview |
|---|---|---|---|---|---|---|---|
| #460 | 460-body | W | 59 | scoreAndRemove score:-10 | 0.36 | 0.50 | Short pageThe quick brown fox jumps over the lazy dog near the river bank today. The quick |
| #460 | 460-hidden-toc | K | 61 | not removed; became the output via hidden-content retry | 0.22 | 0.31 | ContentsChapter 0 of the long book titleChapter 1 of the long book titleChapter 2 of the l |
| #460 | 460-comments-section | C | 3 | (inside removed div.page) | 0.06 | 0.08 | CommentsNo comments yet. |
| #445 | 445s-comment-label | W | 1 | removeByContentPattern boilerplate text | 0.08 | 0.08 | Comment |
| #445 | 445s-p2 | W | 12 | removeByContentPattern trailing non-content | 0.89 | 0.82 | There are benefits to this approach, but it is not without risks. |
| #445 | 445s-p1 | W | 23 | removeByContentPattern trailing non-content | 0.93 | 0.88 | The court appeared to have little difficulty with the application, but the reasoning raise |
| #445 | 445-p1 | W | 89 | removeByContentPattern trailing non-content | 0.96 | 0.92 | The Court appeared to have little difficulty deciding the Claimant’s application, but it r |
| #445 | 445-comment-label | W | 1 | removeByContentPattern boilerplate text | 0.08 | 0.08 | Comment |
| #445 | 445-p2 | W | 63 | removeByContentPattern trailing non-content | 0.96 | 0.92 | Returning to the conflict in issue, as the Court recorded, Russia retaliated to the sancti |
| #445 | 445-author-line | A | 11 | removeByContentPattern trailing non-content | 0.71 | 0.77 | Marina Wheeler KC is a barrister at 1 Crown Office Row. |
| #445 | 445-comments | C | 119 |  | 0.04 | 0.05 | 1 comment; jeredaw7161d1fa2a says: As you note, the Regulations specifically mention Ukrai |
| #445 | 445-share | C | 23 |  | 0.05 | 0.05 | Share: Email a link to a friend (Opens in new window) Email TweetShare on Tumblr Share on  |
| #445 | 445-categories-widget | C | 222 |  | 0.06 | 0.07 | CategoriesCategories Select Category adoption BLOG POSTS 1COR Blog news Case law Case comm |
| #445 | 445-footer | C | 97 |  | 0.06 | 0.07 | Free subscription About Convention rights Articles index Article 10 Article 11 Article 12  |
| #445 | 445-recent-comments | C | 55 |  | 0.06 | 0.09 | Recent comments Geert Van Calster on Strasbourg Court dismisses cha…hrupdateadmin on Do oa |
| #445 | 445-header | C | 21 |  | 0.05 | 0.08 | UK Human Rights Blog - 1 Crown Office Row Home Free subscription About Convention rights I |
| #445 | 445-email-updates | C | 48 |  | 0.06 | 0.08 | Free email updatesThe UK Human Rights Blog is moving to Substack. From 19th October, all n |
| #444 | 444s-term | W | 2 | removeBySelector partial (?<!h[1-6]-)related | 0.20 | 0.13 | related claim |
| #445 | 445-cookie | C | 45 |  | 0.03 | 0.04 | We use cookies to enhance your browsing experience. If you continue to use our website we  |
| #444 | 444-term | W | 2 | removeBySelector partial (?<!h[1-6]-)related | 0.17 | 0.14 | related claim |
| #444 | 444-term-parent-p | A | 15 | (parent paragraph, kept; context only) | 0.82 | 0.64 | “related claim” means a claim for damages in respect of personal injury which is made— |
| #444 | 444-timeline-help | C | 94 |  | 0.47 | 0.42 | This timeline shows the different points in time where a change occurred. The dates will c |
| #444 | 444-breadcrumb | C | 15 |  | 0.06 | 0.11 | You are here:UK Public General Acts2015 c. 2 PART 3 Civil proceedings relating to...Sectio |
| #444 | 444-header | C | 1 |  | 0.06 | 0.12 | legislation.gov.ukhttps://www.nationalarchives.gov.ukCymraeg |
| #444 | 444-footer | C | 54 |  | 0.08 | 0.16 | All content is available under the Open Government Licence v3.0 except where otherwise sta |
| #444 | 444-subnav | C | 6 |  | 0.09 | 0.22 | Table of ContentsContentExplanatory NotesImpact AssessmentsMore Resources |
| #444 | 444-help | C | 65 |  | 0.22 | 0.26 | Changes to LegislationRevised legislation carried on this site may not be fully up to date |
| #441 | 441-footer-bio | C | 60 |  | 0.06 | 0.13 | — END — Felix Rieseberg I'm an EM at Anthropic, where I've so far led engineering for Clau |
| #441 | 441-body | W | 2132 (trunc) | removeBySelector exact [data-date] | 0.87 | 0.95 | I work on Claude. It's an interesting experience: Every day I learn about yet another feat |
| #441 | 441-site-header | C | 4 |  | 0.06 | 0.16 | Felix Rieseberg AboutWorkPostsOnline HI-FIAUTO |
| #441 | 441-player | C | 8 |  | 0.16 | 0.22 | ▶︎ PLAY0:00:00↑ ↓ SCROLL · ← → SECTIONS |
| #441 | 441-more-posts | C | 16 |  | 0.08 | 0.10 | MORE POSTS Newer Hunger beats tenure: Advice for junior engineers Older Made by mechanical |
| #441 | 441-post-header | A | 21 |  | 0.15 | 0.13 | TYPESET 13 October 2026claude8 MIN How to be more ambitious: A tutorial for humans with mo |
| #428 | 428-algo-1 | W | 6 | scoreAndRemove score:-10 | 0.79 | 0.44 | Apply DD and output register AA. |
| #428 | 428-algo-2 | W | 8 | scoreAndRemove score:-10 | 0.93 | 0.73 | Apply U†P†U^\dagger P^\dagger to the received register BB. |
| #428 | 428-heading | W | 3 | scoreAndRemove score:-10 | 0.85 | 0.66 | Quantum register operations |
| #428 | 428-init | W | 5 | scoreAndRemove score:-10 | 0.71 | 0.65 | Initialize the register before decoding. |
| #428 | 428-cash | W | 5 | scoreAndRemove score:-10 | 0.76 | 0.67 | Use the cash register carefully. |
| #428 | 428-output | W | 5 | scoreAndRemove score:-10 | 0.41 | 0.33 | The register now contains output. |
| #428 | 428-signup-1 | C | 5 |  | 0.09 | 0.08 | Register now for free access. |
| #428 | 428-signup-2 | C | 4 |  | 0.07 | 0.09 | Please register to continue. |
| #428 | 428-signup-3 | C | 5 |  | 0.09 | 0.08 | Register an account to proceed. |
| #428 | 428-nav-register | C | 4 |  | 0.06 | 0.24 | Account access Register Y |
| #428 | 428-signup-4 | C | 4 |  | 0.07 | 0.06 | Sign up for updates. |
| #428 | 428b-register-updates | C | 3 |  | 0.08 | 0.08 | Register for updates |
| #346 | 346-steps | W | 2 | no removal record (lost in standardizeContent) | 0.61 | 0.62 | Title Content |
| #433 | 433-footnote | W | 5 | no removal record (footnote standardization) | 0.89 | 0.51 | 11 Unique explanation with x2. |
| #372 | 372-span-samesite | W | 3 | removeByContentPattern section breadcrumb | 0.14 | 0.11 | our other posts |
| #372 | 372-span-offsite | W | 2 | removeByContentPattern section breadcrumb | 0.21 | 0.30 | our profile |
| #321 | 321-tags-section | W | 4 | removeBySelector exact #tags | 0.11 | 0.89 | Content heading Content paragraph. |
| #408 | 408s-nested-list | W | 1 | removeByContentPattern blog metadata list | 0.58 | 0.54 | x1x2 |
| #408 | 408-nested-list | W | 4 | removeByContentPattern blog metadata list | 0.38 | 0.20 | fit_into_view fit expand inhibit_scroll |
| #408 | 408-footer | C | 67 |  | 0.07 | 0.10 | Exclusive sponsor Humans Vaxry [ Lead Developer ] Fufexan [ Supporting Developer ] NotAShe |
| #408 | 408-header | C | 13 |  | 0.05 | 0.08 | Get started Wiki Forums Account Hall of fame News Plugins Support us Install |
| #408 | 408-more-news | C | 39 |  | 0.09 | 0.12 | More news May 18, 2026 5th Ricing Competition starts now! May 9, 2026 Hyprland 0.55 is her |
| #252 | 252s-link-1 | W | 2 | removeBySelector exact [href*="/author/"] | 0.14 | 0.52 | Grady Booch |
| #252 | 252s-link-2 | W | 2 | removeBySelector exact [href*="/author/"] | 0.11 | 0.34 | Erik Meijer |
| #252 | 252-link-1 | W | 2 | removeBySelector exact [href*="/author/"] | 0.13 | 0.54 | Grady Booch |
| #252 | 252-link-2 | W | 2 | removeBySelector exact [href*="/author/"] | 0.13 | 0.31 | Erik Meijer |
| #252 | 252-footer | C | 479 |  | 0.06 | 0.07 | Development Developers Reporting Double-Digit Weekly Time Savings from AI Fell from 68% to |
| #252 | 252-topnav | C | 398 |  | 0.07 | 0.10 | Development Java Kotlin .Net C# Swift Go Rust JavaScript Featured in Development Accelerat |
| #252 | 252-related | C | 75 |  | 0.05 | 0.08 | Related Editorial Popular across InfoQ Google Optimizes Agent Development Kit's 200K-Line  |
| #252 | 252-from-topic | C | 22 |  | 0.06 | 0.10 | This content is in the Architecture topic Related Topics: Architecture & Design Strange Lo |
| #252 | 252-subscribe | C | 50 |  | 0.06 | 0.06 | InfoQ Software Architects' Newsletter A monthly overview of things you need to know as an  |
| #252 | 252-login-modal | C | 80 |  | 0.05 | 0.06 | Unlock the full InfoQ experience Unlock the full InfoQ experience by logging in! Stay upda |
| #252 | 252-related-vendor | C | 41 |  | 0.07 | 0.10 | Related Sponsors AI's Physical Constraints: How AI Rewired the Data Center Related Sponsor |
| #252 | 252-promo | C | 19 |  | 0.06 | 0.11 | QCon AI Boston (July 8-9, 2027): Agents. Context. Evals. Security. See how other teams mak |
| #279 | 279-hero | W | 26 | removeBySelector partial hero[_\-a-z] | 0.83 | 0.51 | A depiction of artificial cybernetic entity encompassing diverse layers and forms of life. |
| #279 | 279-authorbio | C | 179 |  | 0.13 | 0.19 | About the AuthorOlaf Witkowski is a Leader of Technological Change and an Ambassador for C |
| #279 | 279-site-notice | C | 51 |  | 0.38 | 0.56 | Historical archive: Cross Labs, Cross Compass’s former Kyoto research institute, closed on |
| #279 | 279-footer | C | 17 |  | 0.05 | 0.08 | Cross Labs — Historical Research ArchiveEXPLOREABOUTRESEARCHTEAMBLOGPODCASTjournalCONNECTE |
| #279 | 279-byline | C | 5 |  | 0.05 | 0.06 | By Olaf Witkowski/January 4, 2025 |
| #279 | 279-navbar | C | 52 |  | 0.08 | 0.44 | ABOUTRESEARCHTEAMBLOGJOURNAL Historical archive: Cross Labs, Cross Compass’s former Kyoto  |
| #360 | 360-withad-1 | W | 373 | removeBySelector exact [class$="-ad" i] | 0.83 | 0.93 | So what’s up? Ryan Murphy has hardly become ratings poison, of course. And despite his out |
| #360 | 360-withad-2 | W | 528 | removeBySelector exact [class$="-ad" i] | 0.75 | 0.95 | In fact, as my colleague Julia Alexander noted yesterday, Disney+/Hulu still leans more th |
| #360 | 360-bq-1 | W | 373 | (inner article text of withad-1) | 0.96 | 0.94 | So what’s up? Ryan Murphy has hardly become ratings poison, of course. And despite his out |
| #360 | 360-withad-3 | W | 649 | removeBySelector exact [class$="-ad" i] | 0.80 | 0.92 | Which Brings Us Back to Murphy… Despite the cuts to its overall content output, Disney has |
| #360 | 360-main-nav | C | 542 |  | 0.05 | 0.06 | Washington Johnson Crisis Comms & Trump’s $400M Silence Marianna Sotomayor A Very MAGA Dip |
| #360 | 360-paywall | C | 34 |  | 0.05 | 0.07 | Member Exclusive Get access to this story Create a free account to preview Puck’s full off |
| #360 | 360-related | C | 39 |  | 0.05 | 0.10 | Julia Alexander • August 5, 2026 The Real Reason YouTube Needs Peacock Eriq Gardner • Augu |
| #360 | 360-subscribe | C | 20 |  | 0.04 | 0.07 | Become a member All of the insider knowledge from our top tier authors, in your inbox. joi |
| #360 | 360-share | C | 17 |  | 0.05 | 0.07 | SHARE Share this article You have 5 gift articles remaining to share this month. Share thi |
| #360 | 360-footer | C | 15 |  | 0.04 | 0.06 | BACK TO TOP Terms Privacy Contact FAQ Careers © 2026 Heat Media All rights reserved. |
| #360 | 360-login | C | 41 |  | 0.07 | 0.05 | Log In Not a member yet? Sign up today Log in with Google Log in with Apple OR USE EMAIL & |
| #360 | 360-upsell | C | 80 |  | 0.04 | 0.06 | Free article unlocked! You are logged into a free account as newsfortim@protonmail.com ENJ |
| #365 | 365-code-1 | W | 41 | removeHiddenElements class:dark:hidden | 0.86 | 0.62 | void RunTerminal(TInstant endTs) { while (Now() < endTs) { auto type = PickTransaction();  |
| #365 | 365-code-2 | W | 38 | removeHiddenElements class:dark:hidden | 0.87 | 0.60 | TxResult RunTx(Input input) { auto tx = Db.BeginTransaction(); auto r1 = tx.Query(sql1).Ge |
| #365 | 365-code-3 | W | 13 | removeHiddenElements class:dark:hidden | 0.85 | 0.60 | auto future = tx.Query(sql1) .Apply([&](auto r1) { // Process r1. return tx.Query(sql2); } |
| #365 | 365-toc | C | 28 |  | 0.60 | 0.78 | 1 TPC-C as a Perfect Coroutine Workload2 First We Benchmarked the Client3 The Ideal Code I |
| #365 | 365-footer | C | 12 |  | 0.06 | 0.12 | By Freedium. — made with care. About Privacy Terms RSS GitHub Codeberg |
| #365 | 365-nav | C | 7 |  | 0.05 | 0.13 | · Freedium beta 🎉 1.1M Toggle menu |
| #365 | 365-title-header | A | 44 |  | 0.25 | 0.31 | August 20, 2026 Making Coroutines Routine: Building a Scalable TPC-C Client in C++ We star |
| #375 | 375-specs | W | 1173 (trunc) | removeHiddenElements class:empty:hidden | 0.97 | 0.92 | XGIMI Titan Noir Max Specs The XGIMI Titan Noir Max is clearly built as a no-compromise, h |
| #375 | 375-section-2 | W | 113 | removeHiddenElements class:empty:hidden | 0.86 | 0.75 | What is going on with this new SST platform? The XGIMI Titan Noir uses the latest SST DMD  |
| #375 | 375-comment | C | 438 |  | 0.05 | 0.13 | Jarek May 16, 2026 / 5:40 pm Reply Hi, First of all, I just wanted to say a massive thank  |
| #375 | 375-respond | C | 40 |  | 0.05 | 0.05 | Leave a ReplyCancel ReplyYour email address will not be published. Required fields are mar |
| #375 | 375-footer | C | 47 |  | 0.06 | 0.06 | Independent projector reviews, technical articles, screen testing and home cinema tech cov |
| #375 | 375-entry-header | A | 10 |  | 0.07 | 0.20 | XGIMI Titan Noir Max in-depth ReviewTsolas NikosMay 16, 2026Reviews13 Comments |
| #375 | 375-mobile-menu | C | 11 |  | 0.04 | 0.09 | News Projector Reviews Quick Tests Screens Technical Video gallery Contact us |
| #375 | 375-header | C | 13 |  | 0.05 | 0.08 | News Projector Reviews Quick Tests Screens Technical Video gallery Contact us Search Menu |
| #257 | 257-tabs-container | W | 13125 (trunc) | removeBySelector partial tabs- | 0.83 | 0.94 | AbstractPredicting which receptor a phage binds to from genome sequence alone has remained |
| #257 | 257-sidebar | C | 322 (trunc) |  | 0.07 | 0.09 | PreviousNext Posted April 02, 2026. Download PDF Supplementary Material Data/Code Email Th |
| #257 | 257-author-tooltip-0 | C | 45 |  | 0.11 | 0.12 | Lucas Moriniere 1California Institute for Quantitative Biosciences, University of Californ |
| #257 | 257-site-header | C | 12 |  | 0.04 | 0.06 | Home About Submit ALERTS / RSS Search for this keyword Advanced Search |
| #257 | 257-author-tooltip-13 | C | 48 |  | 0.12 | 0.13 | Adam P. Arkin 2Environmental Genomics and Systems Biology Division, Lawrence Berkeley Nati |
| #257 | 257-citation-top | A | 76 (trunc) |  | 0.17 | 0.36 | New Results Enabling the prediction of phage receptor specificity from genome data View OR |
| #134 | 134-whats-new-card | W | 46 | removeBySelector partial card-content | 0.17 | 0.41 | NEWIntroducing: Needle Mesh BakerTurn heavy 3D models into production-ready assets, in you |
| #134 | 134-path-cards | W | 77 | scoreAndRemove score:-10 (card grid) | 0.23 | 0.11 | 🎓 LearningStart with step-by-step tutorialsPerfect for newcomers who want to learn the fun |
| #134 | 134-mobile-sidebar | C | 8 |  | 0.06 | 0.09 | NavigationGetting StartedTutorialsHow-To GuidesExplanationReferenceHelpExtras Ask Needle A |
| #134 | 134-footer | C | 5 |  | 0.06 | 0.07 | ©2026 Needle Tools GmbH–About–Privacy Policy–Sitemap |
| #134 | 134-page-nav | C | 5 |  | 0.07 | 0.23 | Next Getting Started & Installation |
| #134 | 134-testimonial-footer | C | 3 |  | 0.36 | 0.11 | Mike BardeggiaFounder, Pedestrian-X |
| #395 | 395-thead-row-1 | W | 7 | removeBySelector exact .header:not(.banner) | 0.90 | 0.63 | the observation its symbol the observed value |
| #395 | 395-thead-row-2 | W | 16 | removeBySelector exact .header:not(.banner) | 0.92 | 0.72 | which game value deviation from mean (\(X_i - \bar{X}\)) absolute deviation (\(\lvert X_i  |
| #395 | 395-table-1 | A | 42 | (whole table, context) | 0.89 | 0.68 | the observation its symbol the observed value winning margin, game 1 \(X_1\) 56 points win |
| #395 | 395-sidebar | C | 103 |  | 0.06 | 0.48 | Learning Statistics with R Preface Data sets Background A word on statistics 1 Why do we l |
| #395 | 395-margin-toc | C | 158 (trunc) |  | 0.13 | 0.69 | Table of contents 5.1 Measures of central tendency 5.1.1 The mean 5.1.2 Calculating the me |
| #395 | 395-header | C | 5 |  | 0.04 | 0.68 | Working with data5 Descriptive statistics |
| #395 | 395-page-nav | C | 6 |  | 0.08 | 0.55 | 4 R mechanics 6 Drawing graphs |

## Container choices

| issue | page | chosen | confidence | correct? | probabilities |
|---|---|---|---|---|---|
| #460 | 460-synth.html | `main` (main) | 0.45 | yes (acceptable: main > div.page, main) | main=0.56, div_page=0.19, body=0.15, none_of_these=0.09, aside_hidden=0.01 |
| #445 | 445-synth.html | `article` (article) | 0.52 | yes (acceptable: article) | article=0.64, none_of_these=0.20, main=0.11, body=0.05 |
| #445 | 445.html | `article_article` (article.article) | 0.78 | yes (acceptable: article.article) | article_article=0.81, div_content=0.15, div_contant_container=0.02, none_of_these=0.02, div_page=0.00, div_comments_comments_area=0.00, body=0.00 |
| #441 | 441.html | `article_post_tag_claude` (article.post) | 0.44 | yes (acceptable: article.post, div.content.gh-content) | article_post_tag_claude=0.53, div_content_gh_content=0.44, main_app=0.02, none_of_these=0.01, footer_pend=0.00, body_post_template_tag_claude=0.00 |
| #408 | 408.html | `article_mx_auto_mt_navbar` (article) | 0.74 | yes (acceptable: article, div.prose) | article_mx_auto_mt_navbar=0.78, div_prose_prose_slate=0.20, main_mx_auto_flex=0.02, section_mx_auto_mt_72=0.00, body=0.00, none_of_these=0.00 |
| #252 | 252.html | `article_article_grid` (article.article) | 0.50 | yes (acceptable: article.article) | article_article_grid=0.60, main=0.32, section_container_section=0.05, none_of_these=0.03, body=0.00 |
| #279 | 279.html | `div_blog_post_wrap` (div.blog-post-wrap) | 0.59 | yes (acceptable: div.blog-post-wrap) | div_blog_post_wrap=0.67, div_rich_text_element_w_richtext=0.30, body=0.02, none_of_these=0.01, div_authorbio=0.00 |
| #360 | 360a.html | `article_pt_4_post_97284` (article.post) | 0.50 | yes (acceptable: article.post, div.entry-content) | article_pt_4_post_97284=0.58, main_main=0.23, div_relative_text_article_body=0.19, header_main_nav=0.00, body_wp_singular_post_template_default=0.00, none_of_these=0.00 |
| #365 | 365.html | `article_overflow_hidden_bg_white` (article) | 0.64 | yes (acceptable: div.prose, article) | article_overflow_hidden_bg_white=0.71, div_prose_max_w_none=0.19, main_flex_1_w_full=0.09, none_of_these=0.01, body=0.00 |
| #375 | 375.html | `article_post_11847_post_11847_post` (article#post-11847) | 0.50 | yes (acceptable: article#post-11847, div.entry-content) | article_post_11847_post_11847_post=0.60, div_entry_content_is_layout_flow=0.38, main_main_site_main_hfeed=0.02, body_wp_singular_post_template_default=0.00, none_of_these=0.00 |
| #257 | 257.html | `div_article_fulltext_view` (div.article.fulltext-view) | 0.59 | yes (acceptable: div.article.fulltext-view) | div_article_fulltext_view=0.66, div_region_content_grid_28_suffix_1=0.24, div_panel_pane_pane_highwire_panel_tabs_=0.08, body_html_not_front=0.01, none_of_these=0.01, div_sidebar_right_wrapper_grid_10=0.00 |
| #134 | 134.html | `div_content` (div#content) | 0.60 | yes (acceptable: div#content) | div_content=0.70, main_vp_page=0.27, none_of_these=0.02, body=0.01 |
| #380 | 380-synth.html | `main` (main) | 0.68 | yes (acceptable: main) | main=0.76, none_of_these=0.14, shreddit_post=0.09, shreddit_post_2=0.01 |
| #395 | 395.html | `main_quarto_document_content_content_pag` (main#quarto-document-content) | 0.82 | yes (acceptable: main#quarto-document-content) | main_quarto_document_content_content_pag=0.86, div_quarto_content_quarto_container_page=0.13, body_nav_sidebar_floating=0.01, nav_quarto_sidebar_sidebar_collapse=0.00, none_of_these=0.00 |

## Notable observations

Wrongly-removed blocks where Jev did NOT reach 0.9 (HTML state):
- #460 460-body (59w): p_html=0.36, p_text=0.50 — "Short pageThe quick brown fox jumps over the lazy dog near the river bank today."
- #445 445s-comment-label (1w): p_html=0.08, p_text=0.08 — "Comment"
- #445 445s-p2 (12w): p_html=0.89, p_text=0.82 — "There are benefits to this approach, but it is not without risks."
- #445 445-comment-label (1w): p_html=0.08, p_text=0.08 — "Comment"
- #444 444s-term (2w): p_html=0.20, p_text=0.13 — "related claim"
- #444 444-term (2w): p_html=0.17, p_text=0.14 — "related claim"
- #441 441-body (2132w): p_html=0.87, p_text=0.95 — "I work on Claude. It's an interesting experience: Every day I learn about yet an"
- #428 428-algo-1 (6w): p_html=0.79, p_text=0.44 — "Apply DD and output register AA."
- #428 428-heading (3w): p_html=0.85, p_text=0.66 — "Quantum register operations"
- #428 428-init (5w): p_html=0.71, p_text=0.65 — "Initialize the register before decoding."
- #428 428-cash (5w): p_html=0.76, p_text=0.67 — "Use the cash register carefully."
- #428 428-output (5w): p_html=0.41, p_text=0.33 — "The register now contains output."
- #346 346-steps (2w): p_html=0.61, p_text=0.62 — "Title Content"
- #433 433-footnote (5w): p_html=0.89, p_text=0.51 — "11 Unique explanation with x2."
- #372 372-span-samesite (3w): p_html=0.14, p_text=0.11 — "our other posts"
- #372 372-span-offsite (2w): p_html=0.21, p_text=0.30 — "our profile"
- #321 321-tags-section (4w): p_html=0.11, p_text=0.89 — "Content heading Content paragraph."
- #408 408s-nested-list (1w): p_html=0.58, p_text=0.54 — "x1x2"
- #408 408-nested-list (4w): p_html=0.38, p_text=0.20 — "fit_into_view fit expand inhibit_scroll"
- #252 252s-link-1 (2w): p_html=0.14, p_text=0.52 — "Grady Booch"
- #252 252s-link-2 (2w): p_html=0.11, p_text=0.34 — "Erik Meijer"
- #252 252-link-1 (2w): p_html=0.13, p_text=0.54 — "Grady Booch"
- #252 252-link-2 (2w): p_html=0.13, p_text=0.31 — "Erik Meijer"
- #279 279-hero (26w): p_html=0.83, p_text=0.51 — "A depiction of artificial cybernetic entity encompassing diverse layers and form"
- #360 360-withad-1 (373w): p_html=0.83, p_text=0.93 — "So what’s up? Ryan Murphy has hardly become ratings poison, of course. And despi"
- #360 360-withad-2 (528w): p_html=0.75, p_text=0.95 — "In fact, as my colleague Julia Alexander noted yesterday, Disney+/Hulu still lea"
- #360 360-withad-3 (649w): p_html=0.80, p_text=0.92 — "Which Brings Us Back to Murphy… Despite the cuts to its overall content output, "
- #365 365-code-1 (41w): p_html=0.86, p_text=0.62 — "void RunTerminal(TInstant endTs) { while (Now() < endTs) { auto type = PickTrans"
- #365 365-code-2 (38w): p_html=0.87, p_text=0.60 — "TxResult RunTx(Input input) { auto tx = Db.BeginTransaction(); auto r1 = tx.Quer"
- #365 365-code-3 (13w): p_html=0.85, p_text=0.60 — "auto future = tx.Query(sql1) .Apply([&](auto r1) { // Process r1. return tx.Quer"
- #375 375-section-2 (113w): p_html=0.86, p_text=0.75 — "What is going on with this new SST platform? The XGIMI Titan Noir uses the lates"
- #257 257-tabs-container (13125w): p_html=0.83, p_text=0.94 — "AbstractPredicting which receptor a phage binds to from genome sequence alone ha"
- #134 134-whats-new-card (46w): p_html=0.17, p_text=0.41 — "NEWIntroducing: Needle Mesh BakerTurn heavy 3D models into production-ready asse"
- #134 134-path-cards (77w): p_html=0.23, p_text=0.11 — "🎓 LearningStart with step-by-step tutorialsPerfect for newcomers who want to lea"

Clutter in the uncertain band 0.5-0.9 (would be re-inserted by a 0.5 veto but not a 0.9 veto):
- #365 365-toc (28w): p_html=0.60, p_text=0.78 — "1 TPC-C as a Perfect Coroutine Workload2 First We Benchmarked the Client3 The Id"

Ambiguous / kept-clutter blocks (not counted):
- #460 460-hidden-toc [K] (61w): p_html=0.22, p_text=0.31 — "ContentsChapter 0 of the long book titleChapter 1 of the long book titleChapter "
- #445 445-author-line [A] (11w): p_html=0.71, p_text=0.77 — "Marina Wheeler KC is a barrister at 1 Crown Office Row."
- #444 444-term-parent-p [A] (15w): p_html=0.82, p_text=0.64 — "“related claim” means a claim for damages in respect of personal injury which is"
- #441 441-post-header [A] (21w): p_html=0.15, p_text=0.13 — "TYPESET 13 October 2026claude8 MIN How to be more ambitious: A tutorial for huma"
- #365 365-title-header [A] (44w): p_html=0.25, p_text=0.31 — "August 20, 2026 Making Coroutines Routine: Building a Scalable TPC-C Client in C"
- #375 375-entry-header [A] (10w): p_html=0.07, p_text=0.20 — "XGIMI Titan Noir Max in-depth ReviewTsolas NikosMay 16, 2026Reviews13 Comments"
- #257 257-citation-top [A] (76w): p_html=0.17, p_text=0.36 — "New Results Enabling the prediction of phage receptor specificity from genome da"
- #395 395-table-1 [A] (42w): p_html=0.89, p_text=0.68 — "the observation its symbol the observed value winning margin, game 1 \(X_1\) 56 "

## Caveats (read before quoting the numbers)

- Single-shot probabilities, no repeats. Jev is non-deterministic (~0.04 drift per repeat per the brief), so blocks at 0.86-0.89 (#441 body, #365 code, #375 section, #433 footnote) sit on the 0.9 boundary and could land either side on another run.
- Blocks were judged with NO page context, exactly as the brief specified (state = the block alone). Inline fragments (a 2-word <span>, a bare <a>, a nested <ul> of three tokens, a "Comment" label) are unjudgeable in isolation; the <0.5 results on #444/#372/#252/#408/#445-label measure that limitation as much as the model. The one context probe run (#444 parent <p>: 0.82) suggests context would move those, but that was not systematically tested.
- The threshold sweep is post-hoc on the same 18 issues; 0.7 looks optimal here but must be validated on held-out pages before being trusted. The 0.7 band is exactly where the brief says Jev is least reliable.
- "Correct removals" (C blocks, n=69) were chosen by me from each page's nav/footer/promo/comment/modal containers after confirming they are absent from defuddle's output; they are the easy clutter. Borderline clutter (TOC lists, author bios, title/byline headers, site notices) was placed in A/K and is reported separately; the one 0.5-0.9 clutter hit is a TOC list (0.60).
- Six issues were reproduced only on synthetic HTML taken from the issue text (#460, #445-synth, #444-synth, #346, #433, #372, #408-synth, #252-synth, #380); the live pages for #460 and #386 returned 403 and #346's live page no longer contains the offending markup. #395 was only verified for table headers, not the side-by-side images. #365's loss (code blocks via Tailwind dark:hidden) is what the fetched page shows; the issue's screenshots could not be inspected.
- #134's ground truth is genuinely debatable (a docs landing page whose "content" is link cards); Jev's <0.5 there agrees with defuddle and with the Noul's own rule text ("related/recommended links"), so it is arguably not a Jev error.
- Nothing in the repo was modified; all artifacts live in this directory.
