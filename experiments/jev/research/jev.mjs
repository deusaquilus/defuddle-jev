// Minimal Jev (TypeSafe System One) client for experiments.
// RULES: never print, log, or write process.env.JEV_API_KEY anywhere. Run scripts with
//   bash -ic 'node /path/to/script.mjs'   (the key is exported in ~/.bashrc, interactive only)
// Usage:
//   import { systemOne, usageTotals } from '/home/alexi/git/defuddle/experiments/jev/research/jev.mjs';
//   const r = await systemOne({ state, questions, model: 'jev-1.14.0' });
//   r.answers.<key>.noul / .choice / .confidence / .probabilities ; r.usage.input_tokens
import { setTimeout as sleep } from 'node:timers/promises';

const ENDPOINT = process.env.JEV_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
const PRICE_PER_M_INPUT = 0.042;

const totals = { calls: 0, input_tokens: 0, output_tokens: 0, errors: 0, latencies: [] };

export function usageTotals() {
	const lat = [...totals.latencies].sort((a, b) => a - b);
	const pct = p => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null);
	return {
		calls: totals.calls,
		errors: totals.errors,
		input_tokens: totals.input_tokens,
		output_tokens: totals.output_tokens,
		est_cost_usd: +(totals.input_tokens / 1e6 * PRICE_PER_M_INPUT).toFixed(6),
		latency_ms: { p50: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: lat[lat.length - 1] ?? null, n: lat.length },
	};
}

/**
 * POST /v1/systemone. Retries 429/529 with backoff. Throws on other errors with the
 * response body (never includes the key). Returns the parsed JSON plus `latency_ms`.
 */
export async function systemOne({ state, questions, model = 'jev-1.14.0', headers = {}, maxRetries = 4 }) {
	const key = process.env.JEV_API_KEY;
	if (!key) throw new Error('JEV_API_KEY not set — run under: bash -ic \'node script.mjs\'');
	const body = JSON.stringify({ model, state, questions });
	let attempt = 0;
	for (;;) {
		const t0 = performance.now();
		let res;
		try {
			res = await fetch(ENDPOINT, {
				method: 'POST',
				headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', ...headers },
				body,
			});
		} catch (e) {
			if (attempt++ < maxRetries) { await sleep(500 * 2 ** attempt); continue; }
			totals.errors++;
			throw e;
		}
		const latency = performance.now() - t0;
		if (res.status === 429 || res.status === 529 || res.status === 503) {
			if (attempt++ < maxRetries) { await sleep(500 * 2 ** attempt); continue; }
		}
		const text = await res.text();
		if (!res.ok) {
			totals.errors++;
			const err = new Error(`Jev HTTP ${res.status}: ${text.slice(0, 500)}`);
			err.status = res.status;
			err.body = text;
			throw err;
		}
		const json = JSON.parse(text);
		totals.calls++;
		totals.latencies.push(latency);
		totals.input_tokens += json.usage?.input_tokens ?? 0;
		totals.output_tokens += json.usage?.output_tokens ?? 0;
		json.latency_ms = Math.round(latency);
		return json;
	}
}

/** Run many requests with bounded concurrency. items: array; fn: item => Promise. */
export async function mapConcurrent(items, fn, concurrency = 8) {
	const out = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const i = next++;
			try { out[i] = await fn(items[i], i); } catch (e) { out[i] = { error: String(e.message || e) }; }
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
	return out;
}

/** Rough token estimate for budgeting before sending (chars/3.5 for HTML, chars/4 for prose). */
export function estimateTokens(text, isHtml = false) {
	return Math.ceil(text.length / (isHtml ? 3.5 : 4));
}
