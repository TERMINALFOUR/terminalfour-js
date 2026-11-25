import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeRegistry } from '../src/type-registry.js';
import { HttpClient } from '../src/http-client.js';
import { invalidateAllCaches } from '../src/utils.js';
import { ELEMENT_TYPES } from './helpers.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

type RecordedCall = {
  method: string;
  path: string;
  body?: Record<string, unknown>;
};

/**
 * Returns the response for the nth call to a path: call 1 gets responses[0],
 * call 2 gets responses[1], and later calls repeat the last entry.
 */
const nth = <T>(responses: T[], n: number): T =>
  responses[Math.min(n, responses.length - 1)];

const fetchesOf = (calls: RecordedCall[], path: string) =>
  calls.filter((c) => c.path === path);

describe('TypeRegistry cache invalidation', () => {
  let http: HttpClient;
  let registry: TypeRegistry;

  beforeEach(() => {
    invalidateAllCaches();
    http = mockHttpClient();
    registry = new TypeRegistry(http);
  });

  function mockTypes(responses: unknown[]): RecordedCall[] {
    const calls: RecordedCall[] = [];
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(
      async (req: RecordedCall) => {
        calls.push(req);
        if (req.method === 'GET' && req.path === '/type/') {
          return nth(responses, fetchesOf(calls, '/type/').length - 1);
        }
        throw new Error(`Unexpected: ${req.method} ${req.path}`);
      },
    );
    return calls;
  }

  it('re-fetches GET /type/ after invalidateAllCaches()', async () => {
    const ELEMENT_TYPES_V2 = ELEMENT_TYPES.map((t) =>
      t.id === 1 ? { ...t, name: 'Text' } : t,
    );
    const calls = mockTypes([ELEMENT_TYPES, ELEMENT_TYPES_V2]);

    expect(await registry.getNameById(1)).toBe('Plain Text');

    invalidateAllCaches();

    expect(await registry.getNameById(1)).toBe('Text');
    expect(fetchesOf(calls, '/type/')).toHaveLength(2);
  });
});
