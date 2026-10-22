import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RETRY_CONFIG,
  resolveRetryConfig,
  computeBackoff,
  parseRetryAfter,
  isRetryableError,
  retryAfterDelay,
} from '../src/retry.js';
import { T4ApiError } from '../src/errors.js';

const apiError = (over: Partial<ConstructorParameters<typeof T4ApiError>[0]> = {}) =>
  new T4ApiError({
    statusCode: 503,
    statusText: 'Service Unavailable',
    responseBody: null,
    requestUrl: 'https://x/y',
    requestMethod: 'GET',
    ...over,
  });

describe('resolveRetryConfig', () => {
  it('returns the defaults when given undefined', () => {
    expect(resolveRetryConfig(undefined)).toEqual(DEFAULT_RETRY_CONFIG);
  });

  it('disables retry (maxRetries 0) when given false', () => {
    expect(resolveRetryConfig(false).maxRetries).toBe(0);
  });

  it('merges a partial over the defaults', () => {
    const resolved = resolveRetryConfig({ maxRetries: 5, baseDelayMs: 100 });
    expect(resolved.maxRetries).toBe(5);
    expect(resolved.baseDelayMs).toBe(100);
    expect(resolved.retryOn).toEqual(DEFAULT_RETRY_CONFIG.retryOn);
    expect(resolved.maxDelayMs).toBe(DEFAULT_RETRY_CONFIG.maxDelayMs);
    expect(resolved.respectRetryAfter).toBe(true);
  });

  it('honours an explicit maxRetries: 0 as disabled', () => {
    expect(resolveRetryConfig({ maxRetries: 0 }).maxRetries).toBe(0);
  });
});

describe('computeBackoff (full jitter)', () => {
  it('returns a value in [0, base*2^attempt] below the cap', () => {
    // random=1 would give the full window; floor keeps it < window.
    expect(computeBackoff(0, 500, 10_000, () => 0)).toBe(0);
    expect(computeBackoff(0, 500, 10_000, () => 0.998)).toBe(499);  // window 500
    expect(computeBackoff(1, 500, 10_000, () => 0.999)).toBe(999);  // window 1000
    expect(computeBackoff(2, 500, 10_000, () => 0.999)).toBe(1998); // window 2000
  });

  it('clamps the window to maxDelayMs', () => {
    // base*2^5 = 16000, capped to 10000; random=0.5 -> 5000
    expect(computeBackoff(5, 500, 10_000, () => 0.5)).toBe(5000);
  });
});

describe('parseRetryAfter', () => {
  it('parses delta-seconds to milliseconds', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses an HTTP-date relative to now', () => {
    const now = Date.parse('2026-10-22T07:28:00Z');
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT', now)).toBe(0); // in the past -> 0
    expect(parseRetryAfter('Thu, 22 Oct 2026 07:28:30 GMT', now)).toBe(30_000);
  });

  it('returns undefined for absent or unparseable values', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('not a date')).toBeUndefined();
  });

  it('never returns a negative value', () => {
    const now = Date.parse('2026-10-22T07:28:00Z');
    expect(parseRetryAfter('Mon, 01 Jan 2001 00:00:00 GMT', now)).toBe(0);
  });
});

describe('isRetryableError', () => {
  const cfg = DEFAULT_RETRY_CONFIG;

  it('retries a configured status code', () => {
    expect(isRetryableError(apiError({ statusCode: 503 }), cfg)).toBe(true);
    expect(isRetryableError(apiError({ statusCode: 429 }), cfg)).toBe(true);
    expect(isRetryableError(apiError({ statusCode: 502 }), cfg)).toBe(true);
    expect(isRetryableError(apiError({ statusCode: 504 }), cfg)).toBe(true);
  });

  it('retries a network-layer failure (statusCode 0)', () => {
    expect(isRetryableError(apiError({ statusCode: 0, statusText: 'Network Error' }), cfg)).toBe(true);
  });

  it('does NOT retry a body-read failure even though statusCode is 0', () => {
    expect(isRetryableError(apiError({ statusCode: 0, bodyReadFailed: true }), cfg)).toBe(false);
  });

  it('does not retry a non-configured status code', () => {
    expect(isRetryableError(apiError({ statusCode: 500 }), cfg)).toBe(false);
    expect(isRetryableError(apiError({ statusCode: 404 }), cfg)).toBe(false);
    expect(isRetryableError(apiError({ statusCode: 400 }), cfg)).toBe(false);
  });

  it('does not retry a non-T4ApiError', () => {
    expect(isRetryableError(new Error('boom'), cfg)).toBe(false);
    expect(isRetryableError('nope', cfg)).toBe(false);
  });
});

describe('retryAfterDelay', () => {
  const cfg = DEFAULT_RETRY_CONFIG;

  it('returns the header delay when present and respected', () => {
    expect(retryAfterDelay(apiError({ retryAfter: '5' }), cfg)).toBe(5000);
  });

  it('clamps the header delay to maxDelayMs', () => {
    expect(retryAfterDelay(apiError({ retryAfter: '999' }), cfg)).toBe(cfg.maxDelayMs);
  });

  it('returns undefined when respectRetryAfter is false', () => {
    expect(retryAfterDelay(apiError({ retryAfter: '5' }), { ...cfg, respectRetryAfter: false })).toBeUndefined();
  });

  it('returns undefined when there is no Retry-After header', () => {
    expect(retryAfterDelay(apiError({ retryAfter: undefined }), cfg)).toBeUndefined();
  });

  it('returns undefined for a non-T4ApiError', () => {
    expect(retryAfterDelay(new Error('x'), cfg)).toBeUndefined();
  });
});
