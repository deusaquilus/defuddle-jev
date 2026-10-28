#!/bin/bash
# Interleave G1 passes with the other experiments so repeat calls are minutes apart.
cd /home/alexi/git/defuddle/experiments/jev/research/results/exp-adversarial-determinism
for step in "g1.mjs A" "g2.mjs" "g1.mjs B" "g3.mjs" "g1.mjs C" "g4.mjs" "g1.mjs D"; do
  echo "=== $(date -Is) START $step"
  bash -ic "node $step" 2>&1 | grep -v -i "authorization\|bearer"
  echo "=== $(date -Is) END $step"
done
echo "=== ALL DONE $(date -Is)"
