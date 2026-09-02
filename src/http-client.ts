import { HttpRequestOptions } from './types.js';
import { T4ApiError } from './errors.js';
import { debugWarn } from './utils.js';

/** Default maximum concurrent requests */
const DEFAULT_CONCURRENCY = 10;

/**
 * Internal HTTP client that handles authentication, URL construction,
 * content-type headers, JSON/multipart encoding, error wrapping,
 * and concurrency limiting.
 */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly maxConcurrency: number;
  private inFlight = 0;
  private waitQueue: Array<() => void> = [];

  constructor(baseUrl: string, apiToken: string, concurrency?: number) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
    this.maxConcurrency = concurrency ?? DEFAULT_CONCURRENCY;
  }

  async request<T>(options: HttpRequestOptions): Promise<T> {
    await this.acquireSlot();
    try {
      return await this.executeRequest<T>(options);
    } finally {
      this.releaseSlot();
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
      });
    }

    const text = await response.text();
    if (!text) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      debugWarn(`Response from ${options.method} ${options.path} is not valid JSON, returning raw text`);
      return text as T;
    }
  }
}
