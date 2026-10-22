/**
 * Error class for T4 API errors.
 * Thrown when the API returns a non-ok HTTP response or a network error occurs.
 */
export class T4ApiError extends Error {
  readonly statusCode: number;
  readonly statusText: string;
  readonly responseBody: unknown;
  readonly requestUrl: string;
  readonly requestMethod: string;
  /**
   * True when `fetch` returned response headers but reading the response body
   * then failed (e.g. the stream dropped or timed out mid-body). In this case
   * `statusCode` is 0 — the server's header status is deliberately discarded
   * because it is not a usable HTTP outcome — and the server-side operation
   * may still have completed. Callers should check this flag (rather than
   * string-matching `statusText`) before blindly retrying a write.
   */
  readonly bodyReadFailed: boolean;
  /**
   * The raw `Retry-After` response header value, when the response carried one
   * (typically on a 429 or 503). Captured so the retry layer (issue #40) can
   * honour it without re-reading the response. `undefined` when absent or for
   * network-layer failures that produced no response.
   */
  readonly retryAfter?: string;

  constructor(params: {
    statusCode: number;
    statusText: string;
    responseBody: unknown;
    requestUrl: string;
    requestMethod: string;
    /** The original error that caused this API error (e.g. network failure). */
    cause?: Error;
    /** Set when response headers arrived but the body read failed. */
    bodyReadFailed?: boolean;
    /** Raw `Retry-After` header value from the response, if present. */
    retryAfter?: string;
  }) {
    const message = `T4 API error: ${params.requestMethod} ${params.requestUrl} responded with ${params.statusCode} ${params.statusText}`;
    super(message, params.cause ? { cause: params.cause } : undefined);
    this.name = 'T4ApiError';
    this.statusCode = params.statusCode;
    this.statusText = params.statusText;
    this.responseBody = params.responseBody;
    this.requestUrl = params.requestUrl;
    this.requestMethod = params.requestMethod;
    this.bodyReadFailed = params.bodyReadFailed ?? false;
    this.retryAfter = params.retryAfter;
  }
}
