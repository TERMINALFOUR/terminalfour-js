import { HttpRequestOptions, RetryConfig, ResolvedRetryConfig } from './types.js';
import { T4ApiError } from './errors.js';
import { debugWarn, sleep } from './utils.js';
import { resolveRetryConfig, computeBackoff, isRetryableError, retryAfterDelay } from './retry.js';

/** Default maximum concurrent requests */
const DEFAULT_CONCURRENCY = 10;

/** Injectable collaborators for deterministic testing of backoff timing. */
export interface HttpClientHooks {
  /** Sleep function (defaults to the shared `sleep`, which honours fake timers). */
  sleep?: (ms: number) => Promise<void>;
  /** Random source in `[0, 1)` for jitter (defaults to `Math.random`). */
  random?: () => number;
}

/**
 * Internal HTTP client that handles authentication, URL construction,
 * content-type headers, JSON/multipart encoding, error wrapping,
 * concurrency limiting, and transient-failure retry with backoff.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly maxConcurrency: number;
  private readonly userAgent?: string;
  private readonly retryConfig: ResolvedRetryConfig;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private inFlight = 0;
  private waitQueue: Array<() => void> = [];

  constructor(
    baseUrl: string,
    apiToken: string,
    concurrency?: number,
    userAgent?: string,
    retry?: RetryConfig | false,
    hooks?: HttpClientHooks,
  ) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
    this.maxConcurrency = concurrency ?? DEFAULT_CONCURRENCY;
    this.userAgent = userAgent;
    this.retryConfig = resolveRetryConfig(retry);
    this.sleep = hooks?.sleep ?? sleep;
    this.random = hooks?.random ?? Math.random;
  }

  /**
   * Executes a request, retrying transient failures with exponential backoff
   * (issue #40). Only GET requests are retried; every other method is attempted
   * exactly once. Each attempt holds a concurrency slot only while it is in
   * flight — the slot is released during a backoff sleep and re-acquired for the
   * next attempt, so a waiting retry never starves other requests.
   */
  async request<T>(options: HttpRequestOptions): Promise<T> {
    const canRetry = options.method === 'GET' && this.retryConfig.maxRetries > 0;

    for (let attempt = 0; ; attempt++) {
      await this.acquireSlot();
      let result: T;
      try {
        result = await this.executeRequest<T>(options);
      } catch (error) {
        // The slot is still held here; release it on every exit path below
        // before returning control (so a backoff sleep holds no capacity).
        const willRetry =
          canRetry && attempt < this.retryConfig.maxRetries && isRetryableError(error, this.retryConfig);
        this.releaseSlot();
        if (!willRetry) throw error;

        // Prefer a Retry-After delay when present; otherwise exponential backoff.
        const delay =
          retryAfterDelay(error, this.retryConfig) ??
          computeBackoff(attempt, this.retryConfig.baseDelayMs, this.retryConfig.maxDelayMs, this.random);
        debugWarn(
          `Retrying ${options.method} ${options.path} after transient failure ` +
          `(attempt ${attempt + 1}/${this.retryConfig.maxRetries}); waiting ${delay}ms`,
          error,
        );
        await this.sleep(delay);
        continue;
      }
      this.releaseSlot();
      return result;
    }
  }

  /** Waits until a concurrency slot is available */
  private acquireSlot(): Promise<void> {
    if (this.inFlight < this.maxConcurrency) {
      this.inFlight++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.inFlight++;
        resolve();
      });
    });
  }

  /** Releases a concurrency slot and wakes the next waiter */
  private releaseSlot(): void {
    this.inFlight--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  private async executeRequest<T>(options: HttpRequestOptions): Promise<T> {
    const url = this.baseUrl + options.path;
    const headers: Record<string, string> = {
      Authorization: this.apiToken,
      Accept: 'application/json',
      ...options.headers,
    };

    // The SDK User-Agent is set after the per-request header spread so it can
    // never be overridden by a caller — the SDK identity and version must
    // always be present for server-side diagnostics. Applies to every request,
    // including multipart uploads.
    if (this.userAgent) {
      headers['User-Agent'] = this.userAgent;
    }

    let body: string | FormData | undefined;

    if (options.multipart && options.formData) {
      // Let the runtime set Content-Type with the correct boundary
      body = options.formData;
    } else if (options.headers?.['Content-Type']?.includes('x-www-form-urlencoded') && typeof options.body === 'string') {
      // Form-encoded body — pass through as-is, Content-Type already set in headers
      body = options.body;
    } else {
      headers['Content-Type'] = 'application/json;charset=UTF-8';
      if (options.body !== undefined) {
        body = JSON.stringify(options.body);
      }
    }

    let response: Response;
    try {
      // Debug logging when T4_DEBUG env var is set
      if (typeof process !== 'undefined' && process.env?.T4_DEBUG === '1') {
        console.log(`\n[DEBUG] ${options.method} ${url}`);
        if (body && typeof body === 'string') {
          console.log('[DEBUG] Body:', body.substring(0, 3000));
        }
      }

      response = await fetch(url, {
        method: options.method,
        headers,
        body,
        ...(options.timeoutMs !== undefined && { signal: AbortSignal.timeout(options.timeoutMs) }),
      });
    } catch (error) {
      throw new T4ApiError({
        statusCode: 0,
        statusText: 'Network Error',
        responseBody: error instanceof Error ? error.message : String(error),
        requestUrl: url,
        requestMethod: options.method,
        cause: error instanceof Error ? error : undefined,
      });
    }

    if (!response.ok) {
      let responseBody: unknown;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text().catch(() => null);
      }

      throw new T4ApiError({
        statusCode: response.status,
        statusText: response.statusText,
        responseBody,
        requestUrl: url,
        requestMethod: options.method,
        retryAfter: response.headers.get('Retry-After') ?? undefined,
      });
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw this.bodyReadError(error, url, options.method, response.status);
    }

    if (!text) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      debugWarn(`Response from ${options.method} ${options.path} is not valid JSON, returning raw text`);
      return text as T;
    }
  }

  /**
   * Builds the error thrown when `fetch` returned response headers but reading
   * the response body then failed — e.g. a timeout or dropped connection during
   * a long, intermittently-silent streamed response such as section duplication.
   *
   * This is a transport-level failure with no usable HTTP outcome, so it is
   * reported like the `fetch`-rejection (`Network Error`) path rather than the
   * server's header status:
   *
   * - `statusCode` is `0`, never `response.status`. The header status (often
   *   `200`) must not surface on a thrown error, or a caller branching on
   *   `statusCode` cannot tell a "failed 200" from a real success.
   * - `statusText` is `'Response Stream Error'`, distinct from the
   *   fetch-rejection path's `'Network Error'`.
   * - `bodyReadFailed` is `true` so callers can tell this apart from a
   *   never-connected network error. Because the headers already arrived, the
   *   server-side operation may have completed, so a blind retry could
   *   duplicate work — the `responseBody` message warns about this and records
   *   the observed header status (`headerStatus`) for diagnostics.
   */
  private bodyReadError(error: unknown, url: string, method: string, headerStatus: number): T4ApiError {
    return new T4ApiError({
      statusCode: 0,
      statusText: 'Response Stream Error',
      bodyReadFailed: true,
      responseBody:
        'The request succeeded but reading the response body failed ' +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        `The server responded with status ${headerStatus} before the body read failed, so ` +
        'for long operations such as section duplication the server may have ' +
        'completed the work regardless — check before retrying to avoid duplicates.',
      requestUrl: url,
      requestMethod: method,
      cause: error instanceof Error ? error : undefined,
    });
  }
}
