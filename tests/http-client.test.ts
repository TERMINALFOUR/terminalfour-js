import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpClient } from '../src/http-client.js';
import { T4ApiError } from '../src/errors.js';

describe('HttpClient', () => {
  const baseUrl = 'https://api.example.com';
  const apiToken = 'test-token-123';
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient(baseUrl, apiToken);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchOk(body: unknown) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(body != null ? JSON.stringify(body) : ''),
    });
  }

  function mockFetchError(status: number, statusText: string, body?: unknown, retryAfter?: string) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status,
      statusText,
      headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) },
      json: () => Promise.resolve(body ?? {}),
      text: () => Promise.resolve(''),
    });
  }

  it('prepends baseUrl to path', async () => {
    mockFetchOk({ ok: true });
    await client.request({ method: 'GET', path: '/content/123' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://api.example.com/content/123',
      expect.anything(),
    );
  });

  it('sets Authorization header with apiToken', async () => {
    mockFetchOk({});
    await client.request({ method: 'GET', path: '/test' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers.Authorization).toBe('test-token-123');
  });

  it('sets Content-Type to application/json;charset=UTF-8 for non-multipart', async () => {
    mockFetchOk({});
    await client.request({ method: 'GET', path: '/test' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers['Content-Type']).toBe('application/json;charset=UTF-8');
  });

  it('serializes body as JSON', async () => {
    mockFetchOk({});
    const body = { name: 'test', value: 42 };
    await client.request({ method: 'POST', path: '/test', body });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].body).toBe(JSON.stringify(body));
  });

  it('sets the default SDK User-Agent header when one is provided', async () => {
    const uaClient = new HttpClient(baseUrl, apiToken, undefined, 'Terminalfour-JS-SDK/1.2.0');
    mockFetchOk({});
    await uaClient.request({ method: 'GET', path: '/test' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers['User-Agent']).toBe('Terminalfour-JS-SDK/1.2.0');
  });

  it('does not set a User-Agent header when none is provided', async () => {
    mockFetchOk({});
    await client.request({ method: 'GET', path: '/test' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers['User-Agent']).toBeUndefined();
  });

  it('applies the SDK User-Agent to multipart upload requests', async () => {
    const uaClient = new HttpClient(baseUrl, apiToken, undefined, 'Terminalfour-JS-SDK/1.2.0');
    mockFetchOk({});
    const formData = new FormData();
    formData.append('file', 'data');
    await uaClient.request({ method: 'POST', path: '/upload', multipart: true, formData });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers['User-Agent']).toBe('Terminalfour-JS-SDK/1.2.0');
    // Content-Type must still be left to the runtime for multipart
    expect(callArgs[1].headers['Content-Type']).toBeUndefined();
  });

  it('does not allow a per-request header to override the SDK User-Agent', async () => {
    const uaClient = new HttpClient(baseUrl, apiToken, undefined, 'Terminalfour-JS-SDK/1.2.0');
    mockFetchOk({});
    await uaClient.request({
      method: 'GET',
      path: '/test',
      headers: { 'User-Agent': 'Sneaky/9.9' },
    });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].headers['User-Agent']).toBe('Terminalfour-JS-SDK/1.2.0');
  });

  it('passes FormData directly for multipart without Content-Type header', async () => {
    mockFetchOk({});
    const formData = new FormData();
    formData.append('file', 'data');
    await client.request({ method: 'POST', path: '/upload', multipart: true, formData });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].body).toBe(formData);
    expect(callArgs[1].headers['Content-Type']).toBeUndefined();
  });

  it('passes an AbortSignal when timeoutMs is set', async () => {
    mockFetchOk({});
    await client.request({ method: 'COPY', path: '/dup', timeoutMs: 600000 });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].signal).toBeInstanceOf(AbortSignal);
  });

  it('does not pass a signal when timeoutMs is omitted', async () => {
    mockFetchOk({});
    await client.request({ method: 'GET', path: '/x' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].signal).toBeUndefined();
  });

  it('wraps a body-read failure on a successful response in a T4ApiError', async () => {
    // Simulates a timeout/stream error mid-body during a long duplicate.
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.reject(new Error('terminated: body timeout')),
    });

    try {
      await client.request({ method: 'COPY', path: '/dup' });
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as T4ApiError;
      expect(err).toBeInstanceOf(T4ApiError);
      // A body-read failure is a transport-level failure with no usable HTTP
      // result, so it must NOT carry the server's 2xx status. statusCode is 0,
      // matching the fetch-rejection (network error) path (issue #39).
      expect(err.statusCode).toBe(0);
      expect(err.statusText).toBe('Response Stream Error');
      expect(err.bodyReadFailed).toBe(true);
      expect(String(err.responseBody)).toMatch(/may have\s+completed the work/);
      // The observed header status (200 here) is recorded in the message for
      // diagnostics, even though statusCode is deliberately 0 (issue #39 review).
      expect(String(err.responseBody)).toMatch(/status 200/);
      expect((err.cause as Error).message).toBe('terminated: body timeout');
    }
  });

  it('throws T4ApiError on non-ok response (4xx)', async () => {
    mockFetchError(404, 'Not Found', { error: 'not found' });
    await expect(client.request({ method: 'GET', path: '/missing' }))
      .rejects.toThrow(T4ApiError);

    try {
      await client.request({ method: 'GET', path: '/missing' });
    } catch (e) {
      const err = e as T4ApiError;
      expect(err.statusCode).toBe(404);
      expect(err.requestUrl).toBe('https://api.example.com/missing');
      expect(err.requestMethod).toBe('GET');
    }
  });

  it('throws T4ApiError on non-ok response (5xx)', async () => {
    mockFetchError(500, 'Internal Server Error');
    await expect(client.request({ method: 'POST', path: '/fail' }))
      .rejects.toThrow(T4ApiError);
  });

  it('throws T4ApiError with statusCode 0 on network error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network failure'));
    try {
      await client.request({ method: 'GET', path: '/offline' });
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as T4ApiError;
      expect(err).toBeInstanceOf(T4ApiError);
      expect(err.statusCode).toBe(0);
      expect(err.statusText).toBe('Network Error');
      // A never-connected network error is distinguishable from a body-read
      // failure: both are statusCode 0, but only the latter sets bodyReadFailed.
      expect(err.bodyReadFailed).toBe(false);
      expect(err.cause).toBeInstanceOf(Error);
      expect((err.cause as Error).message).toBe('Network failure');
    }
  });

  it('falls back to text() when json() throws on error response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: { get: () => null },
      json: () => Promise.reject(new Error('invalid json')),
      text: () => Promise.resolve('raw error text'),
    });

    try {
      await client.request({ method: 'GET', path: '/bad' });
      expect.fail('should have thrown');
    } catch (e) {
      const err = e as T4ApiError;
      expect(err).toBeInstanceOf(T4ApiError);
      expect(err.statusCode).toBe(500);
      expect(err.responseBody).toBe('raw error text');
    }
  });

  it('GET request does not send body (body should be undefined)', async () => {
    mockFetchOk({ ok: true });
    await client.request({ method: 'GET', path: '/test' });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].body).toBeUndefined();
  });

  it('debug logging does not run when T4_DEBUG is not "1"', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    // Ensure T4_DEBUG is not set
    delete process.env.T4_DEBUG;

    mockFetchOk({ ok: true });
    await client.request({ method: 'POST', path: '/test', body: { data: 'value' } });

    // console.log should not have been called with debug prefix
    const debugCalls = consoleSpy.mock.calls.filter(
      (args) => typeof args[0] === 'string' && args[0].includes('[DEBUG]'),
    );
    expect(debugCalls).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  describe('concurrency limiting', () => {
    it('defaults to 10 concurrent requests', async () => {
      // Create a client with default concurrency
      const limitedClient = new HttpClient(baseUrl, apiToken);
      let peakConcurrency = 0;
      let currentConcurrency = 0;

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        currentConcurrency++;
        peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
        // Simulate async work so requests overlap
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrency--;
        return { ok: true, text: () => Promise.resolve('{}') };
      });

      // Fire 20 requests simultaneously
      await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          limitedClient.request({ method: 'GET', path: `/test/${i}` }),
        ),
      );

      expect(peakConcurrency).toBeLessThanOrEqual(10);
      expect(peakConcurrency).toBeGreaterThan(1); // confirms parallelism still works
    });

    it('respects custom concurrency limit', async () => {
      const limitedClient = new HttpClient(baseUrl, apiToken, 2);
      let peakConcurrency = 0;
      let currentConcurrency = 0;

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        currentConcurrency++;
        peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
        await new Promise((r) => setTimeout(r, 10));
        currentConcurrency--;
        return { ok: true, text: () => Promise.resolve('{}') };
      });

      // Fire 6 requests simultaneously
      await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          limitedClient.request({ method: 'GET', path: `/test/${i}` }),
        ),
      );

      expect(peakConcurrency).toBeLessThanOrEqual(2);
      expect(peakConcurrency).toBeGreaterThan(0);
    });

    it('releases slots after errors so subsequent requests proceed', async () => {
      const limitedClient = new HttpClient(baseUrl, apiToken, 1);
      let callCount = 0;

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500, statusText: 'Error', headers: { get: () => null }, json: () => Promise.resolve({}), text: () => Promise.resolve('') };
        }
        return { ok: true, text: () => Promise.resolve('{"ok":true}') };
      });

      // First request fails
      await expect(limitedClient.request({ method: 'GET', path: '/fail' })).rejects.toThrow(T4ApiError);

      // Second request should still work (slot was released)
      const result = await limitedClient.request<{ ok: boolean }>({ method: 'GET', path: '/ok' });
      expect(result).toEqual({ ok: true });
    });
  });
});

describe('HttpClient retry (issue #40)', () => {
  const baseUrl = 'https://api.example.com';
  const apiToken = 'tok';

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** A no-op sleep + fixed random so backoff adds no real delay and is deterministic. */
  const hooks = { sleep: () => Promise.resolve(), random: () => 0.5 };

  const okResponse = (body: unknown = { ok: true }) => ({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
  const errResponse = (status: number, retryAfter?: string) => ({
    ok: false,
    status,
    statusText: 'err',
    headers: { get: (n: string) => (n.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) },
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });

  /** Queues a sequence of fetch outcomes (resolved responses or rejections). */
  const queueFetch = (outcomes: Array<{ value?: unknown; reject?: unknown }>) => {
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    for (const o of outcomes) {
      if (o.reject !== undefined) fetchMock.mockRejectedValueOnce(o.reject);
      else fetchMock.mockResolvedValueOnce(o.value);
    }
  };
  const fetchCalls = () => (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

  it('retries a GET on 503 and succeeds on the second attempt', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, hooks);
    queueFetch([{ value: errResponse(503) }, { value: okResponse({ hi: 1 }) }]);

    const result = await client.request<{ hi: number }>({ method: 'GET', path: '/x' });
    expect(result).toEqual({ hi: 1 });
    expect(fetchCalls()).toBe(2);
  });

  it('retries each configured transient status (429/502/503/504)', async () => {
    for (const status of [429, 502, 503, 504]) {
      vi.restoreAllMocks();
      vi.stubGlobal('fetch', vi.fn());
      const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, hooks);
      queueFetch([{ value: errResponse(status) }, { value: okResponse() }]);
      await client.request({ method: 'GET', path: '/x' });
      expect(fetchCalls()).toBe(2);
    }
  });

  it('retries a GET on a network error (statusCode 0)', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, hooks);
    queueFetch([{ reject: new Error('ECONNRESET') }, { value: okResponse() }]);
    await client.request({ method: 'GET', path: '/x' });
    expect(fetchCalls()).toBe(2);
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, { maxRetries: 2 }, hooks);
    queueFetch([{ value: errResponse(503) }, { value: errResponse(503) }, { value: errResponse(503) }]);

    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchCalls()).toBe(3); // initial + 2 retries
  });

  it('does not retry a non-transient status (500)', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, hooks);
    queueFetch([{ value: errResponse(500) }]);
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ statusCode: 500 });
    expect(fetchCalls()).toBe(1);
  });

  it('does not retry a non-GET method even on 503', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, hooks);
    queueFetch([{ value: errResponse(503) }]);
    await expect(client.request({ method: 'POST', path: '/x', body: {} })).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchCalls()).toBe(1);
  });

  it('does not retry when disabled via retry: false', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, false, hooks);
    queueFetch([{ value: errResponse(503) }]);
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ statusCode: 503 });
    expect(fetchCalls()).toBe(1);
  });

  it('does not retry a body-read failure (ambiguous: server may have acted)', async () => {
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, hooks);
    // ok response whose body read rejects -> bodyReadFailed error, statusCode 0
    queueFetch([{ value: { ok: true, status: 200, text: () => Promise.reject(new Error('stream dropped')) } }]);
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({ bodyReadFailed: true });
    expect(fetchCalls()).toBe(1);
  });

  it('honours Retry-After: uses it as the delay, overriding computed backoff', async () => {
    const delays: number[] = [];
    const client = new HttpClient(baseUrl, apiToken, undefined, undefined, undefined, {
      sleep: (ms: number) => { delays.push(ms); return Promise.resolve(); },
      random: () => 0.5,
    });
    queueFetch([{ value: errResponse(503, '2') }, { value: okResponse() }]);

    await client.request({ method: 'GET', path: '/x' });
    expect(delays).toEqual([2000]); // 2s from Retry-After, not the computed backoff
  });

  it('releases the concurrency slot during backoff so other requests proceed', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    let waited = false;

    const client = new HttpClient(baseUrl, apiToken, 1, undefined, undefined, {
      // The backoff sleep blocks on a gate we control; while it blocks, a second
      // request must still be able to acquire the single slot and run.
      sleep: () => gate,
      random: () => 0.5,
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (String(url).endsWith('/retrying')) {
        return waited ? okResponse({ done: 'retry' }) : errResponse(503);
      }
      return okResponse({ done: 'other' });
    });

    const retrying = client.request<{ done: string }>({ method: 'GET', path: '/retrying' });
    // Let the first attempt fail and enter backoff (blocked on the gate).
    await Promise.resolve();
    await Promise.resolve();

    // A second request should run NOW, while the first is mid-backoff.
    const other = await client.request<{ done: string }>({ method: 'GET', path: '/other' });
    expect(other).toEqual({ done: 'other' });

    // Now let the backoff finish; the retry proceeds and succeeds.
    waited = true;
    release();
    const result = await retrying;
    expect(result).toEqual({ done: 'retry' });
  });
});
