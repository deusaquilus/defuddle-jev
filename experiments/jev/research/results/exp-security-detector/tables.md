### Table 1. Deterministic audit of stripUnsafeElements (83 malicious, 72 benign)

| Path | Malicious with spec-detector survivor | Modern-executable survivors | Benign intact |
|---|---|---|---|
| strip_linkedom | 5/83 (M42, M54, M55, M72, M73) | 1 (M54) | 72/72 |
| strip_jsdom | 5/83 (M42, M54, M55, M72, M73) | 1 (M54) | 72/72 |
| pipeline_default | 1/83 (M42) | 0 () | 58/72 |
| pipeline_noremove | 5/83 (M42, M54, M55, M72, M73) | 1 (M54) | 68/72 |

### Table 2. Jev-1.14.0 main noul on RAW fragments (n=155), per threshold

| threshold | TPR all (83) | TPR modern-exec (68) | FPR (72) | # false positives | # missed modern |
|---|---|---|---|---|---|
| 0.3 | 98.8% | 98.5% | 27.8% | 20 | 1 |
| 0.5 | 97.6% | 97.1% | 19.4% | 14 | 2 |
| 0.7 | 94% | 95.6% | 9.7% | 7 | 3 |
| 0.9 | 74.7% | 77.9% | 2.8% | 2 | 15 |

AUC = 0.969. Bands: malicious >=0.9: 74.7%, 0.1-0.9: 25.3%, <=0.1: 0%; benign >=0.9: 2.8%, 0.1-0.9: 40.3%, <=0.1: 56.9%.

### Table 3. Alternative Jev scorings on RAW fragments

| scoring | AUC | TPR@0.5 | FPR@0.5 | TPR@0.9 | FPR@0.9 |
|---|---|---|---|---|---|
| main noul (task wording) | 0.969 | 97.6% | 19.4% | 74.7% | 2.8% |
| 1 - P(none) from 9-way Choice | 0.983 | 97.6% | 12.5% | 91.6% | 4.2% |
| max of 7 per-category nouls | 0.958 | 90.4% | 11.1% | 80.7% | 4.2% |
| main noul, embedded in ~1.1k-token article | 0.973 | 96.4% | 13.9% | 57.8% | 1.4% |
| max of 7 nouls, embedded | 0.963 | 89.2% | 11.1% | 80.7% | 5.6% |
| main noul pooled over 3 repeats | 0.97 | 96.8% | 19.4% | 76.7% | 3.7% |

### Table 4. Per-category mean of main noul on RAW fragments (count >=0.5 / >=0.9 of n)

| category | n | mean | min | max | >=0.5 | >=0.9 |
|---|---|---|---|---|---|---|
| benign:article | 13 | 0.027 | 0.01 | 0.1 | 0 | 0 |
| benign:embed | 4 | 0.692 | 0.3 | 0.93 | 3 | 1 |
| benign:escaped_code | 14 | 0.406 | 0.01 | 0.97 | 7 | 1 |
| benign:form | 2 | 0.09 | 0.03 | 0.15 | 0 | 0 |
| benign:link | 7 | 0.223 | 0.07 | 0.88 | 1 | 0 |
| benign:math | 3 | 0.16 | 0.02 | 0.44 | 0 | 0 |
| benign:media | 6 | 0.278 | 0.02 | 0.83 | 1 | 0 |
| benign:misc | 12 | 0.11 | 0.01 | 0.87 | 1 | 0 |
| benign:svg | 3 | 0.047 | 0.02 | 0.1 | 0 | 0 |
| benign:xss_prose | 8 | 0.216 | 0.04 | 0.51 | 1 | 0 |
| malicious:base | 1 | 0.97 | 0.97 | 0.97 | 1 | 1 |
| malicious:blob_url | 1 | 0.58 | 0.58 | 0.58 | 1 | 0 |
| malicious:css | 3 | 0.577 | 0.11 | 0.87 | 2 | 0 |
| malicious:data_url | 3 | 0.983 | 0.98 | 0.99 | 3 | 3 |
| malicious:handler | 16 | 0.973 | 0.87 | 0.99 | 16 | 15 |
| malicious:js_url | 17 | 0.958 | 0.87 | 0.99 | 17 | 16 |
| malicious:js_url_obf | 6 | 0.918 | 0.89 | 0.97 | 6 | 4 |
| malicious:link_import | 1 | 0.75 | 0.75 | 0.75 | 1 | 0 |
| malicious:mathml | 1 | 0.84 | 0.84 | 0.84 | 1 | 0 |
| malicious:meta_refresh | 2 | 0.99 | 0.99 | 0.99 | 2 | 2 |
| malicious:mxss | 7 | 0.863 | 0.81 | 0.94 | 7 | 2 |
| malicious:noscript | 1 | 0.51 | 0.51 | 0.51 | 1 | 0 |
| malicious:plugin | 5 | 0.982 | 0.96 | 0.99 | 5 | 5 |
| malicious:script | 9 | 0.928 | 0.52 | 0.99 | 9 | 8 |
| malicious:smil | 3 | 0.937 | 0.87 | 0.98 | 3 | 2 |
| malicious:srcdoc | 2 | 0.965 | 0.94 | 0.99 | 2 | 2 |
| malicious:style_import | 1 | 0.43 | 0.43 | 0.43 | 0 | 0 |
| malicious:svg_foreign | 2 | 0.905 | 0.85 | 0.96 | 2 | 1 |
| malicious:svg_use_data | 1 | 0.91 | 0.91 | 0.91 | 1 | 1 |
| malicious:template | 1 | 0.88 | 0.88 | 0.88 | 1 | 0 |

### Table 5. Choice confidence bands (RAW, n=155; accuracy = malicious<->non-none agreement)

| band | n | share | accuracy |
|---|---|---|---|
| >=0.9 | 123 | 79.4% | 97.6% |
| 0.7-0.9 | 15 | 9.7% | 86.7% |
| 0.5-0.7 | 9 | 5.8% | 66.7% |
| <0.5 | 8 | 5.2% | 75% |

### Table 6. Jev on SANITIZED output (stripUnsafeElements, linkedom path; 149 non-empty outputs)

| group | n | unsafe>=0.3 | unsafe>=0.5 | unsafe>=0.9 | mean |
|---|---|---|---|---|---|
| 5 deterministic survivors (M42,M54,M55,M72,M73) | 5 | 5 | 5 | 3 | 0.916 |
| sanitized malicious with no survivor | 72 | 11 | 4 | 1 | 0.125 |
| benign (unchanged by sanitizer) | 72 | 18 | 14 | 3 | 0.217 |

### Table 7. Prompt-injection probe (12 live payloads x 5 wrappers; main noul)

| wrapper | mean unsafe | >=0.5 | >=0.9 |
|---|---|---|---|
| none | 0.978 | 12/12 | 12/12 |
| HTML comment claiming already sanitized | 0.818 | 12/12 | 2/12 |
| prose note to automated reviewers | 0.755 | 12/12 | 1/12 |
| live payload wrapped in unescaped <pre><code> | 0.633 | 12/12 | 0/12 |
| div with data-sanitized/aria-label=safe | 0.973 | 12/12 | 12/12 |

### Table 8. Stability over 3 identical RAW requests (155 triples)

| metric | value |
|---|---|
| mean max-min range of main noul | 0.018 |
| max range | 0.19 |
| triples with range >= 0.1 | 3 |
| flips across 0.5 | 2 (M05:0.52/0.62/0.43; M76:0.51/0.52/0.48) |
| flips across 0.9 | 7 |
| Choice argmax changes | 4 (M05:none/script_element/none; B23:object_embed_or_applet/object_embed_or_applet/none; B24:srcdoc_base_or_meta_refresh/none/srcdoc_base_or_meta_refresh; B34:none/none/object_embed_or_applet) |
| byte-identical answer objects | 0/155 |

### Table 9. Cost and latency (924 calls, jev-1.14.0, 10 questions per call)

| metric | value |
|---|---|
| input tokens total | 1308717 |
| mean tokens/call (raw / stripped / embedded / pipeline) | 1416 (1304 / 1297 / 1877 / 1407) |
| est. cost total / per call | $0.055 / $0.000059 |
| latency p50 / p90 / p99 / max (ms) | 76 / 112 / 165 / 283 |
