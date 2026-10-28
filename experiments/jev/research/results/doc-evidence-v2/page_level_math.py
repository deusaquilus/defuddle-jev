# Page/decision-level arithmetic from numbers in the Jev docs. Pure math, no API.
# Assumption: block decisions on one page are independent (stated; real errors are
# likely correlated, which changes the numbers but not the orders of magnitude).
import csv, math, sys

bands = [
 ("Banking77 overall (independent, OpenRouter)", 0.810),
 ("AG News zero-shot (jgrep, community)", 0.866),
 ("SMS spam F1 (jgrep, community)", 0.91),
 ("Noul soft accuracy (Porcedda, independent)", 0.918),
 ("p=1.0 band, 1819 decisions/102 errors (Du et al.)", 1-102/1819),
 ("confidence>=0.99 band on Banking77 (independent)", 0.963),
 ("option-wise Nouls at 0.90 threshold (Du et al.)", 0.970),
 ("pi-warden '<1%' error above 0.8 (self-reported production)", 0.99),
 ("hypothetical 99.9%", 0.999),
 ("target 99.99%", 0.9999),
]
Ns = [10, 20, 50, 100]
rows = []
for label, p in bands:
    r = {"label": label, "per_decision_acc": round(p, 5)}
    for N in Ns:
        r[f"P(page all-correct) N={N}"] = round(p**N, 5)
    r["expected errors/page N=50"] = round(50*(1-p), 2)
    r["errors per 10k decisions"] = round(10000*(1-p), 1)
    rows.append(r)

req = []
for T in (0.99, 0.999, 0.9999):
    r = {"page_target": T}
    for N in Ns:
        r[f"required per-decision acc N={N}"] = round(T**(1/N), 7)
    req.append(r)

# Fixture-suite reproducibility: a fixture is byte-identical across two runs only if
# no decision flips. Flip rates from docs: 12% chosen-option change (Yang et al.);
# jgrep 22/150 = 14.7% questions moved (<=0.03) -- but a flip only matters if it
# crosses the code threshold, so also show optimistic flip rates.
flip_rates = [("Yang et al. 12% chosen-option change", 0.12),
              ("optimistic: 1% cross-threshold flips", 0.01),
              ("very optimistic: 0.1% cross-threshold flips", 0.001),
              ("0.01% flips", 0.0001)]
suite = []
for label, f in flip_rates:
    for N in (10, 50):
        p_fix_stable = (1-f)**N
        suite.append({"flip_rate_label": label, "decisions_per_fixture": N,
                      "P(fixture identical on rerun)": round(p_fix_stable, 5),
                      "expected failing fixtures of 226": round(226*(1-p_fix_stable), 2),
                      "P(all 226 fixtures identical)": f"{p_fix_stable**226:.3e}"})

# Cascade arithmetic using Banking77 bands: >=0.99 covers 58% at 96.3%;
# remainder goes to defuddle's existing heuristics with unknown accuracy h.
casc = []
for h in (0.80, 0.90, 0.95, 0.99):
    casc.append({"heuristic_acc_on_remaining_42%": h,
                 "overall_acc": round(0.58*0.963 + 0.42*h, 4)})

# Cost per page at $0.042/M input tokens, state billed once per request
cost = []
for tok in (500, 2000, 5000, 10000, 32000, 64000):
    cost.append({"state_tokens": tok, "usd_per_page": f"{tok*0.042/1e6:.6f}",
                 "share_of_defuddle.md_$0.003_price_%": round(100*tok*0.042/1e6/0.003, 2)})

def dump(name, rs):
    with open(f"/home/alexi/git/defuddle/experiments/jev/research/results/doc-evidence-v2/{name}.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rs[0].keys())); w.writeheader(); w.writerows(rs)
    print(f"== {name}")
    for r in rs: print(r)

dump("page_level_accuracy", rows)
dump("required_per_decision_accuracy", req)
dump("fixture_suite_reproducibility", suite)
dump("cascade_banking77_bands", casc)
dump("cost_per_page", cost)
# Rule of three: 95% upper bound on error rate after n/n successes
print("== rule-of-three 95% upper error bound for n/n successes:",
      {n: round(3/n, 4) for n in (7, 34, 40, 150, 1819, 15346)})
