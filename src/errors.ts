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

  constructor(params: {
    statusCode: number;
    statusText: string;
    responseBody: unknown;
    requestUrl: string;
    requestMethod: string;
    /** The original error that caused this API error (e.g. network failure). */
    cause?: Error;
  }) {
    const message = `T4 API error: ${params.requestMethod} ${params.requestUrl} responded with ${params.statusCode} ${params.statusText}`;
    super(message, params.cause ? { cause: params.cause } : undefined);
    this.name = 'T4ApiError';
    this.statusCode = params.statusCode;
    this.statusText = params.statusText;
    this.responseBody = params.responseBody;
    this.requestUrl = params.requestUrl;
    this.requestMethod = params.requestMethod;
  }
}
