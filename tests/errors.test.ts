import { describe, it, expect } from 'vitest';
import { T4ApiError } from '../src/errors.js';

describe('T4ApiError', () => {
  const params = {
    statusCode: 404,
    statusText: 'Not Found',
    responseBody: { error: 'missing' },
    requestUrl: 'https://example.com/api/content',
    requestMethod: 'GET',
  };

  it('sets all readonly properties correctly', () => {
    const err = new T4ApiError(params);
    expect(err.statusCode).toBe(404);
    expect(err.statusText).toBe('Not Found');
    expect(err.responseBody).toEqual({ error: 'missing' });
    expect(err.requestUrl).toBe('https://example.com/api/content');
    expect(err.requestMethod).toBe('GET');
  });

  it('message includes method, URL, status code, and status text', () => {
    const err = new T4ApiError(params);
    expect(err.message).toContain('GET');
    expect(err.message).toContain('https://example.com/api/content');
    expect(err.message).toContain('404');
    expect(err.message).toContain('Not Found');
  });

  it('name is T4ApiError', () => {
    const err = new T4ApiError(params);
    expect(err.name).toBe('T4ApiError');
  });

  it('is an instance of Error', () => {
    const err = new T4ApiError(params);
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves the original error as cause when provided', () => {
    const originalError = new Error('connection refused');
    const err = new T4ApiError({ ...params, cause: originalError });
    expect(err.cause).toBe(originalError);
  });

  it('has no cause when not provided', () => {
    const err = new T4ApiError(params);
    expect(err.cause).toBeUndefined();
  });
});
