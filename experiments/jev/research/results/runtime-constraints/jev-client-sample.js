// Minimal decision-model client of the shape DefuddleOptions.decisionModel would need.
// Measures the bundle cost of adding such a client; not wired into the repo.
export async function decide(opts, state, questions) {
  const { endpoint = 'https://api.typesafe.ai/v1/systemone', model = 'jev-1.14.0', apiKey, fetch: f = globalThis.fetch, timeoutMs = 1500, cache } = opts;
  const body = JSON.stringify({ model, state, questions });
  const key = cache ? await cacheKey(model, body) : null;
  if (key && cache.has(key)) return cache.get(key);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await f(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: 'Bearer ' + apiKey } : {}) },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error('decision model HTTP ' + res.status);
    const json = await res.json();
    if (!json || typeof json !== 'object' || typeof json.answers !== 'object') throw new Error('bad decision response');
    const out = {};
    for (const [k, a] of Object.entries(json.answers)) {
      if (!a || typeof a !== 'object') continue;
      const p = typeof a.noul === 'number' ? a.noul : (a.probabilities && typeof a.probabilities === 'object' ? a.probabilities : null);
      if (p !== null) out[k] = p;
    }
    if (key) cache.set(key, out);
    return out;
  } finally {
    clearTimeout(timer);
  }
}
async function cacheKey(model, body) {
  const data = new TextEncoder().encode(model + '\n' + body);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}
