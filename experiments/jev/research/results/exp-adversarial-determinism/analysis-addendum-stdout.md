## G1b later repeat and near-identical perturbations (vs call 1)
| kind | n | mean gap s | mean abs diff | p90 | max | identical to call1 | flips@0.5 | inside 5-call envelope |
|---|---|---|---|---|---|---|---|---|
| identical6 | 150 | 266.456 | 0.009 | 0.02 | 0.1 | 50.0% | 1 | 86.7% |
| ws | 150 | 266.469 | 0.009 | 0.02 | 0.08 | 44.7% | 2 | 86.0% |
| attr | 150 | 266.481 | 0.014 | 0.04 | 0.14 | 38.7% | 1 | 66.0% |
6-call spread: {"n":150,"mean":0.018,"median":0.01,"p90":0.04,"max":0.12,"frac_zero":0.227,"flips_0_5":1}; quantization: {"values_checked":2600,"not_multiple_of_0_01":0,"distinct_values":97}

## G2 prose flip rate by block length (Jev)
| variant | 20-40 words | 40-80 | 80-150 | 150-400 | p | div |
|---|---|---|---|---|---|---|
| e | 88.9% (n=36) | 84.1% (n=44) | 50.0% (n=12) | 37.5% (n=8) | 85.7% (n=84) | 37.5% (n=16) |
| f | 83.3% (n=36) | 84.1% (n=44) | 58.3% (n=12) | 62.5% (n=8) | 83.3% (n=84) | 56.3% (n=16) |
| g | 97.2% (n=36) | 97.7% (n=44) | 66.7% (n=12) | 50.0% (n=8) | 92.9% (n=84) | 75.0% (n=16) |
Defuddle deterministic pipeline, text-channel attacks: {"e":{"group":"prose","n":20,"flipped_to_target":0,"mixed":0,"unchanged":20,"injected_text_survives_in_output":17,"main_container_changed":0},"g":{"group":"prose","n":20,"flipped_to_target":1,"mixed":0,"unchanged":19,"injected_text_survives_in_output":16,"main_container_changed":0},"a":{"group":"clutter","n":20,"flipped_to_target":0,"mixed":0,"unchanged":20,"injected_text_survives_in_output":3,"main_container_changed":0}}; flips: [{"attack":"g","id":"general--tailwind-hidden-blog-index#3","mod_status":"removed","words":23}]

## G4 extra
{
 "removed_units_confidently_wrong_p_ge_0_8": {
  "alone_marked": 5,
  "parent": 9,
  "grandparent": 9,
  "body": 8
 },
 "kept_units_confidently_wrong_p_le_0_2": {
  "alone_marked": 0,
  "parent": 0,
  "grandparent": 0,
  "body": 0
 },
 "mean_p_removed_by_level": {
  "alone_marked": 0.258,
  "parent": 0.298,
  "grandparent": 0.3,
  "body": 0.309
 },
 "mean_p_kept_by_level": {
  "alone_marked": 0.895,
  "parent": 0.867,
  "grandparent": 0.873,
  "body": 0.886
 },
 "removed_flipped_to_keep_at_body": [
  {
   "id": "gmail--mail.google.com-mail-u-0-thread#9",
   "p_alone": 0.43,
   "p_parent": 0.87,
   "p_body": 0.88,
   "body_tokens": 2862,
   "step": null,
   "text": "Download Add to Drive Save to Photos"
  },
  {
   "id": "footnotes--maggieappleton.com-xanadu-patterns#38",
   "p_alone": 0.34,
   "p_parent": 0.83,
   "p_body": 0.61,
   "body_tokens": 8762,
   "step": null,
   "text": "Digital Gardening A Brief History & Ethos of the Digital Garden A newl"
  },
  {
   "id": "footnotes--wikipedia-references#3",
   "p_alone": 0.1,
   "p_parent": 0.59,
   "p_body": 0.6,
   "body_tokens": 1547,
   "step": "removeByContentPattern",
   "text": "Related topic A Related topic B"
  },
  {
   "id": "gmail--mail.google.com-mail-u-0-thread#12",
   "p_alone": 0.36,
   "p_parent": 0.42,
   "p_body": 0.74,
   "body_tokens": 2863,
   "step": null,
   "text": "Booked — see you Tuesday. --Jane Doe · Example Corp · +1 555 0100"
  },
  {
   "id": "gmail--mail.google.com-mail-u-0-thread#4",
   "p_alone": 0.42,
   "p_parent": 0.51,
   "p_body": 0.55,
   "body_tokens": 2863,
   "step": null,
   "text": "On Wed, May 13, 2026 at 11:02 PM Alex Rivera <alex@example.com> wrote:"
  }
 ],
 "kept_flipped_to_remove_at_body": [],
 "body_truncated_accuracy": {
  "truncated": {
   "n": 37,
   "acc": 0.946
  },
  "not_truncated": {
   "n": 63,
   "acc": 0.81
  }
 }
}

## G3 examples
{
 "largest_order_shift": [
  {
   "id": "extractor--chatgpt-post-thought-content#1",
   "label": "kept",
   "keep": 0.52,
   "clutter": 0.13,
   "ch": 0.41,
   "chr": 0.75,
   "text": "Start with a simple checklist before choosing the location.",
   "d": 0.34
  },
  {
   "id": "general--12gramsofcarbon.com-p-ilyas-30-papers-to-carmack-vlaes#44",
   "label": "kept",
   "keep": 0.64,
   "clutter": 0.07,
   "ch": 0.62,
   "chr": 0.93,
   "text": "I think this paper is also just a fascinating look into how ",
   "d": 0.31
  },
  {
   "id": "content-patterns--live-blog-metadata#1",
   "label": "kept",
   "keep": 0.62,
   "clutter": 0.26,
   "ch": 0.43,
   "chr": 0.7,
   "text": "Breaking News Live Updates: Major Development Lorem ipsum do",
   "d": 0.27
  },
  {
   "id": "math--equation-table-mathml#2",
   "label": "kept",
   "keep": 0.7,
   "clutter": 0.24,
   "ch": 0.52,
   "chr": 0.77,
   "text": "The expressions appear in order, with each equation occurrin",
   "d": 0.25
  },
  {
   "id": "code-blocks--chroma-linenums#5",
   "label": "removed",
   "keep": 0.67,
   "clutter": 0.48,
   "ch": 0.25,
   "chr": 0.49,
   "text": "1 2 3 4 5 6 7",
   "d": 0.24
  },
  {
   "id": "footnotes--maggieappleton.com-xanadu-patterns#64",
   "label": "removed",
   "keep": 0.69,
   "clutter": 0.34,
   "ch": 0.47,
   "chr": 0.7,
   "text": "\"parallel pages, visibly connected\" pic.twitter.com/JyhsFHz6",
   "d": 0.23
  }
 ],
 "worst_coherence": [
  {
   "id": "general--wikipedia#30",
   "label": "kept",
   "keep": 0.9,
   "clutter": 0.59,
   "ch": 0.86,
   "chr": 0.94,
   "text": "Morrison, Sara (May 18, 2023). \"Inside Obsidian's thriving p",
   "d": 0.49
  },
  {
   "id": "extractor--chatgpt-post-thought-content#3",
   "label": "kept",
   "keep": 0.56,
   "clutter": 0.08,
   "ch": 0.67,
   "chr": 0.88,
   "text": "Pick a nearby park, check the weather, and choose food that ",
   "d": 0.36
  },
  {
   "id": "extractor--chatgpt-post-thought-content#1",
   "label": "kept",
   "keep": 0.52,
   "clutter": 0.13,
   "ch": 0.41,
   "chr": 0.75,
   "text": "Start with a simple checklist before choosing the location.",
   "d": 0.35
  },
  {
   "id": "comments--mastodon.social-@user-12345678#7",
   "label": "kept",
   "keep": 0.18,
   "clutter": 0.51,
   "ch": 0.06,
   "chr": 0.15,
   "text": "@alice Impressive project. How does it handle edge cases?",
   "d": 0.31
  },
  {
   "id": "general--12gramsofcarbon.com-p-ilyas-30-papers-to-carmack-vlaes#44",
   "label": "kept",
   "keep": 0.64,
   "clutter": 0.07,
   "ch": 0.62,
   "chr": 0.93,
   "text": "I think this paper is also just a fascinating look into how ",
   "d": 0.29
  },
  {
   "id": "footnotes--inline-footnote-span#0",
   "label": "kept",
   "keep": 0.85,
   "clutter": 0.44,
   "ch": 0.47,
   "chr": 0.62,
   "text": "You can pick any recent paper and have no idea what is going",
   "d": 0.29
  }
 ],
 "noul_mid_band_count": 24,
 "choice_mid_band_count": 24,
 "choice_prob_at_extremes": {
  "keep_eq_1": 0,
  "keep_eq_0": 32,
  "rev_keep_eq_1": 9,
  "rev_keep_eq_0": 20
 }
}
