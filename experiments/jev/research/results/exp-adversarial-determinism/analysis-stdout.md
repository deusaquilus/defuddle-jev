## G1 Determinism (150 units x 5 identical calls, state = block HTML)
units complete: 150; spread(max-min) mean 0.017, median 0.01, p90 0.04, max 0.12; spread==0: 26.7%, <=0.01: 37.3%, <=0.05: 93.3%, >0.10: 1.3%
all 5 identical: 26.7%; flip across 0.5: 1/150 (0.7%); crosses 0.2: 2; crosses 0.8: 2; lo/mid/hi band change: 4 (2.7%)
pairwise single-call noise floor: flip rate 0.4%, mean |dp| 0.008
| pair | mean gap (s) | mean abs diff | identical | flips@0.5 |
|---|---|---|---|---|
| call1_vs_call2 | 0.076 | 0.009 | 47.3% | 1 |
| call1_vs_call3 | 14.374 | 0.008 | 55.3% | 1 |
| call1_vs_call4 | 26.205 | 0.008 | 56.0% | 1 |
| call1_vs_call5 | 37.763 | 0.009 | 48.7% | 0 |
accuracy single call 0.813 vs majority-of-5 0.82; usage: {"calls":750,"ok":750,"errors":0,"input_tokens":471285,"est_cost_usd":0.01979,"tokens_per_call":628,"latency_ms":{"p50":66,"p90":101,"p99":173,"max":446},"models":["jev-1.14.0"]}

## G2 Injection (Jev keep-noul; flip = baseline side of 0.5 != variant side)
| variant | group | channel | n | base mean p | variant mean p | mean shift | flip rate | directional flips | flips surviving 0.8 band | base confident (n) -> fully inverted | base correct -> wrong |
|---|---|---|---|---|---|---|---|---|---|---|---|
| a | clutter | text | 100 | 0.123 | 0.216 | +0.094 | 5.0% | 5 (5.0%) | 0 (0.0%) | 88 -> 0 | 5/93 |
| b | clutter | comment | 100 | 0.123 | 0.156 | +0.033 | 1.0% | 1 (1.0%) | 0 (0.0%) | 88 -> 0 | 1/93 |
| c | clutter | hidden-text | 100 | 0.123 | 0.155 | +0.032 | 0.0% | 0 (0.0%) | 0 (-) | 88 -> 0 | 0/93 |
| d | clutter | attribute | 100 | 0.123 | 0.172 | +0.049 | 4.0% | 4 (4.0%) | 0 (0.0%) | 88 -> 0 | 4/93 |
| e | prose | text | 100 | 0.922 | 0.334 | -0.588 | 78.0% | 78 (78.0%) | 21 (26.9%) | 93 -> 19 | 78/97 |
| f | prose | attribute | 100 | 0.922 | 0.335 | -0.587 | 79.0% | 79 (79.0%) | 22 (27.8%) | 93 -> 20 | 79/97 |
| g | prose | text | 100 | 0.922 | 0.307 | -0.615 | 90.0% | 90 (90.0%) | 25 (27.8%) | 93 -> 23 | 90/97 |
baseline: clutter acc@0.5 0.93 (mean p 0.123, <=0.2: 88.0%); prose acc@0.5 0.97 (mean p 0.922, >=0.8: 93.0%)

Defuddle deterministic pipeline on attribute-attacked fixtures (same attack strings):
| attack | group | n | flipped to target | mixed | unchanged | main container changed | mean output word delta |
|---|---|---|---|---|---|---|---|
| d | clutter | 20 | 5 | 1 | 14 | 6 | -49.1 |
| d2 | clutter | 20 | 7 | 1 | 12 | 6 | -45.3 |
| f | prose | 20 | 19 | 0 | 1 | 1 | -65.9 |
| f2 | prose | 20 | 19 | 0 | 1 | 1 | -65.9 |
| f3 | prose | 20 | 19 | 0 | 1 | 1 | -65.9 |
usage: {"calls":900,"ok":900,"errors":0,"input_tokens":674442,"est_cost_usd":0.02833,"tokens_per_call":749,"latency_ms":{"p50":63,"p90":96,"p99":159,"max":364},"models":["jev-1.14.0"]}

## G3 Phrasing / option order (150 units)
coherence P(keep)+P(clutter): mean |sum-1| 0.07 (p90 0.17, max 0.49); batched 0.071; signed mean -0.018
accuracy@0.5: {"keep_noul":0.82,"clutter_noul":0.8,"choice_keep_remove":0.807,"choice_remove_keep":0.813,"batched_keep":0.82,"batched_choice":0.82}
argmax flip rates: {"keep_vs_negated":0.02,"keep_vs_choice":0.053,"keep_vs_choice_rev":0.02,"choice_vs_choice_rev":0.033,"negated_vs_choice":0.06,"batched_vs_separate":{"keep":0,"clutter":0.013,"choice":0.013,"choice_rev":0},"any_form_disagrees":0.067}
probability shifts: {"mean_abs_noul_vs_choiceKeep":0.062,"mean_abs_choice_vs_rev_keepP":0.052,"p90_abs_choice_vs_rev":0.14,"max_abs_choice_vs_rev":0.34,"mean_signed_rev_minus_fwd_keepP":0.052,"mean_abs_batched_vs_separate_keep":0.007,"mean_abs_noul_vs_1minusClutter":0.07}
first-option share: {"choice_keep_first_picks_keep":0.533,"choice_remove_first_picks_keep":0.567,"noul_picks_keep":0.587,"truth_kept":0.5}; extremes: {"choice_keepP_eq_1_or_0":0.213,"noul_eq_1_or_0":0,"mean_choice_confidence":0.814}
threshold transfer: noul best t=0.85 F1=0.814; choice own best t=0.275 F1=0.812; noul t applied to choice F1=0.802 (acc 0.78); choice@0.5 F1=0.8; noul@0.5 F1=0.803
band coverage: {"keep_noul":{"coverage":0.84,"accuracy_in_band":0.833},"one_minus_clutter":{"coverage":0.733,"accuracy_in_band":0.882},"choice_keepP":{"coverage":0.84,"accuracy_in_band":0.849},"choice_rev_keepP":{"coverage":0.887,"accuracy_in_band":0.842}}
usage: {"calls":750,"ok":750,"errors":0,"input_tokens":509685,"est_cost_usd":0.02141,"tokens_per_call":680,"latency_ms":{"p50":63,"p90":102,"p99":154,"max":229},"models":["jev-1.14.0"]}

## G4 Context dilution (100 units; marked question at all marked levels)
| level | n | mean input tokens | max tokens | truncated | acc@0.5 | acc kept | acc removed | mean |p - p_alone_marked| | flip vs alone_marked | mean |p - p_alone_plain| | band>=0.8/<=0.2 coverage | acc in band | p50 latency ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alone_plain | 100 | 575 | 1594 | 0 | 0.91 | 0.98 | 0.84 | 0.033 | 1.0% | 0 | 82.0% | 0.951 | 68 |
| alone_marked | 100 | 597 | 1617 | 0 | 0.9 | 0.98 | 0.82 | 0 | 0.0% | 0.033 | 81.0% | 0.938 | 68 |
| parent | 100 | 4188 | 15156 | 30 | 0.86 | 0.96 | 0.76 | 0.09 | 8.0% | 0.098 | 76.0% | 0.882 | 89 |
| grandparent | 100 | 4539 | 15155 | 33 | 0.85 | 0.96 | 0.74 | 0.088 | 7.0% | 0.098 | 79.0% | 0.886 | 93 |
| body | 100 | 5174 | 15148 | 37 | 0.86 | 1 | 0.72 | 0.091 | 6.0% | 0.103 | 79.0% | 0.899 | 92 |
body level accuracy by actual input tokens: [{"tokens":"0-1000","n":5,"accuracy":0.4,"mean_abs_dp_vs_alone":0.042},{"tokens":"1000-3000","n":37,"accuracy":0.757,"mean_abs_dp_vs_alone":0.09},{"tokens":"3000-6000","n":14,"accuracy":1,"mean_abs_dp_vs_alone":0.057},{"tokens":"6000-9000","n":24,"accuracy":0.958,"mean_abs_dp_vs_alone":0.085}]
usage: {"calls":500,"ok":500,"errors":0,"input_tokens":1507328,"est_cost_usd":0.06331,"tokens_per_call":3015,"latency_ms":{"p50":80,"p90":125,"p99":193,"max":238},"models":["jev-1.14.0"]}

## Totals
{"per_experiment":{"g1":{"calls":750,"ok":750,"errors":0,"input_tokens":471285,"est_cost_usd":0.01979,"tokens_per_call":628,"latency_ms":{"p50":66,"p90":101,"p99":173,"max":446},"models":["jev-1.14.0"]},"g2":{"calls":900,"ok":900,"errors":0,"input_tokens":674442,"est_cost_usd":0.02833,"tokens_per_call":749,"latency_ms":{"p50":63,"p90":96,"p99":159,"max":364},"models":["jev-1.14.0"]},"g3":{"calls":750,"ok":750,"errors":0,"input_tokens":509685,"est_cost_usd":0.02141,"tokens_per_call":680,"latency_ms":{"p50":63,"p90":102,"p99":154,"max":229},"models":["jev-1.14.0"]},"g4":{"calls":500,"ok":500,"errors":0,"input_tokens":1507328,"est_cost_usd":0.06331,"tokens_per_call":3015,"latency_ms":{"p50":80,"p90":125,"p99":193,"max":238},"models":["jev-1.14.0"]}},"input_tokens":3162740,"calls":2900,"errors":0,"est_cost_usd":0.1328,"usage_files":["usage-g1-A-1793145574009.json","usage-g1-B-1793145587517.json","usage-g1-C-1793145599292.json","usage-g1-D-1793145610908.json","usage-g2-1793145585125.json","usage-g3-1793145596959.json","usage-g4-1793145608474.json"]}
