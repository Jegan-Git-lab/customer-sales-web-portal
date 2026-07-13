import { trackDataverseThrottle } from '../telemetry.js';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls `fn` and retries on HTTP 429 (Dataverse service-protection limits),
 * honoring the Retry-After header when present, with exponential backoff
 * as a fallback. Throws after `maxAttempts`.
 *
 * @param {() => Promise<Response>} fn - performs one fetch/axios call, returns a Response-like object
 * @param {{ maxAttempts?: number, label?: string }} opts
 */
export async function withDataverseRetry(fn, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 5;
  const label = opts.label ?? 'dataverse';

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fn();

    if (response.status !== 429) {
      return response;
    }

    if (attempt === maxAttempts) {
      throw new Error(`${label}: exceeded max retries after repeated 429s`);
    }

    const retryAfterHeader = response.headers?.get?.('retry-after');
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : 2 ** attempt;

    trackDataverseThrottle(label, retryAfterSeconds);
    console.warn(`[dataverse] 429 on ${label}, attempt ${attempt}/${maxAttempts}, waiting ${retryAfterSeconds}s`);

    await sleep(retryAfterSeconds * 1000);
  }

  throw new Error(`${label}: retry loop exited unexpectedly`);
}
