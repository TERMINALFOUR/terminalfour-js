import { RetryConfig, ResolvedRetryConfig } from './types.js';
import { T4ApiError } from './errors.js';

/** SDK default retry configuration (issue #40). Conservative, enabled by default. */
export const DEFAULT_RETRY_CONFIG: ResolvedRetryConfig = {
  maxRetries: 2,
  retryOn: [429, 502, 503, 504],
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  respectRetryAfter: true,
};

/**
 * Resolves a user-supplied retry setting into a complete config.
 *
 * `false` (or `maxRetries: 0`) disables retry. A partial object merges over the
 * SDK defaults. `undefined` yields the defaults (retry is on by default).
 */
export function resolveRetryConfig(retry: RetryConfig | false | undefined): ResolvedRetryConfig {
  if (retry === false) {
    return { ...DEFAULT_RETRY_CONFIG, maxRetries: 0 };
  }
  if (!retry) {
    return { ...DEFAULT_RETRY_CONFIG };
  }
  return {
    maxRetries: retry.maxRetries ?? DEFAULT_RETRY_CONFIG.maxRetries,
    retryOn: retry.retryOn ?? DEFAULT_RETRY_CONFIG.retryOn,
    baseDelayMs: retry.baseDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelayMs,
    maxDelayMs: retry.maxDelayMs ?? DEFAULT_RETRY_CONFIG.maxDelayMs,
    respectRetryAfter: retry.respectRetryAfter ?? DEFAULT_RETRY_CONFIG.respectRetryAfter,
  };
}

/**
 * Computes the backoff delay (ms) for a zero-based retry attempt using
 * exponential backoff with **full jitter**: a uniform random value in
 * `[0, min(maxDelayMs, baseDelayMs × 2^attempt)]`. Full jitter spreads retries
 * out to avoid a thundering herd.
 *
 * `random` is injectable for deterministic tests; it defaults to `Math.random`.
 */
export function computeBackoff(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  random: () => number = Math.random,
): number {
  const exponential = baseDelayMs * 2 ** attempt;
  const capped = Math.min(maxDelayMs, exponential);
  return Math.floor(random() * capped);
}

/**
 * Parses a `Retry-After` header value into a delay in milliseconds, or returns
 * `undefined` when absent or unparseable.
 *
 * Supports both forms defined by the HTTP spec: delta-seconds (e.g. `"120"`)
 * and an HTTP-date (e.g. `"Wed, 21 Oct 2026 07:28:00 GMT"`), the latter computed
 * relative to `now`. A date in the past yields `0`. Never returns a negative
 * value.
 *
 * `now` is injectable for deterministic tests; it defaults to `Date.now()`.
 */
export function parseRetryAfter(value: string | null | undefined, now: number = Date.now()): number | undefined {
  if (value == null) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;

  // delta-seconds form (a non-negative integer)
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  // HTTP-date form
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return undefined;
  return Math.max(0, dateMs - now);
}

/**
 * Decides whether a failed GET request should be retried, given the error and
 * the resolved config. Only called for GET requests, so method idempotency is
 * already guaranteed by the caller.
 *
 * Retries when the error is a `T4ApiError` that is either:
 * - a network-layer failure (`statusCode: 0`) that is **not** a body-read
 *   failure — a `bodyReadFailed` error means the server already sent headers and
 *   may have acted, so it is never retried; or
 * - a response whose status code is in `retryOn`.
 *
 * Any non-`T4ApiError` (e.g. a programming error) is not retried.
 */
export function isRetryableError(error: unknown, config: ResolvedRetryConfig): boolean {
  if (!(error instanceof T4ApiError)) return false;
  if (error.bodyReadFailed) return false;
  if (error.statusCode === 0) return true;
  return config.retryOn.includes(error.statusCode);
}

/**
 * Extracts the `Retry-After` delay (ms) from a retryable `T4ApiError` when
 * `respectRetryAfter` is enabled, clamped to `maxDelayMs`. Returns `undefined`
 * when the header is absent/unparseable or the feature is disabled, so the
 * caller falls back to computed backoff.
 *
 * The header is read from `error.retryAfter`, which `HttpClient` captures from
 * the response at throw time.
 */
export function retryAfterDelay(
  error: unknown,
  config: ResolvedRetryConfig,
  now: number = Date.now(),
): number | undefined {
  if (!config.respectRetryAfter) return undefined;
  if (!(error instanceof T4ApiError)) return undefined;
  const parsed = parseRetryAfter(error.retryAfter, now);
  if (parsed === undefined) return undefined;
  return Math.min(parsed, config.maxDelayMs);
}
