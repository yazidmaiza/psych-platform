/**
 * Utility: withRetry + isTransientError
 *
 * Shared exponential-backoff retry wrapper used across the chat pipeline.
 * Previously duplicated in chatRoute.js and GenerateEmpatheticResponse.js —
 * extracted here so both files stay in sync.
 *
 * Usage:
 *   const { withRetry, isTransientError } = require('../utils/withRetry');
 *
 *   const result = await withRetry(
 *     () => someApiCall(),
 *     { maxAttempts: 3, baseDelayMs: 1000, factor: 2 },
 *     'MyOperation.label'
 *   );
 */

const RETRY_DEFAULTS = { maxAttempts: 3, baseDelayMs: 1000, factor: 2 };

/**
 * Returns true for errors that are transient (safe to retry):
 *   - HTTP 429 (rate limit)
 *   - HTTP 5xx (server error)
 *   - Network-level errors (ECONNRESET, ETIMEDOUT, etc.)
 *
 * Returns false for permanent failures (4xx except 429, bad input, etc.)
 * so we don't waste retry budget on unrecoverable errors.
 */
function isTransientError(err) {
  const status = err?.response?.status || err?.status || err?.statusCode;
  if (status) {
    if (status === 429) return true;
    if (status >= 500) return true;
    return false;
  }
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('econnreset')   ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout')    ||
    msg.includes('network')      ||
    msg.includes('timeout')      ||
    msg.includes('socket hang up')
  );
}

/**
 * Runs `fn` up to `maxAttempts` times with exponential backoff.
 * Only retries on transient errors. Throws immediately on permanent failures.
 *
 * @param {Function} fn          - Async function to retry
 * @param {object}   opts        - { maxAttempts, baseDelayMs, factor }
 * @param {string}   label       - Human-readable label for log messages
 * @returns {Promise<*>}
 */
async function withRetry(fn, opts = {}, label = 'operation') {
  const { maxAttempts, baseDelayMs, factor } = { ...RETRY_DEFAULTS, ...opts };
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientError(err)) {
        console.error(`[Retry] ${label} failed permanently on attempt ${attempt}:`, err.message);
        throw err;
      }
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(factor, attempt - 1);
      console.warn(`[Retry] ${label} attempt ${attempt} failed (transient). Retrying in ${delay}ms…`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`[Retry] ${label} exhausted all ${maxAttempts} attempts.`);
  throw lastError;
}

module.exports = { withRetry, isTransientError };
