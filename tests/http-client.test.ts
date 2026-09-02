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

  function mockFetchError(status: number, statusText: string, body?: unknown) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status,
      statusText,
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

  it('passes FormData directly for multipart without Content-Type header', async () => {
    mockFetchOk({});
    const formData = new FormData();
    formData.append('file', 'data');
    await client.request({ method: 'POST', path: '/upload', multipart: true, formData });
    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].body).toBe(formData);
    expect(callArgs[1].headers['Content-Type']).toBeUndefined();
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
      expect(err.cause).toBeInstanceOf(Error);
      expect((err.cause as Error).message).toBe('Network failure');
    }
  });

  it('falls back to text() when json() throws on error response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
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
          return { ok: false, status: 500, statusText: 'Error', json: () => Promise.resolve({}), text: () => Promise.resolve('') };
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
