import { describe, it, expect, vi, beforeEach } from 'vitest';
import { T4Client } from '../src/t4-client.js';
import { HttpClient } from '../src/http-client.js';
import { ELEMENT_TYPES } from './helpers.js';

/**
 * Regression tests for cache sharing across sections.
 *
 * Previously every `t4.section(id)` built a fresh ContentResource with its own
 * TypeRegistry and template cache, so traversing the hierarchy re-fetched
 * `GET /type/`, `GET /contenttype/{id}`, and `GET /content/type/{ct}/{section}`
 * on every hop. These tests assert those are fetched once and reused.
 */
describe('content cache sharing across sections', () => {
  const config = { baseUrl: 'https://api.example.com', apiToken: 'token-123' };

  // A minimal content type 71 with a Name + Title (both Plain Text) — no list
  // fields, so the only network calls are the ones under test.
  const contentTypeDef = {
    id: 71,
    contentTypeElements: [
      { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1, listId: 0 },
      { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 2, listId: 0 },
    ],
  };

  const sectionTemplate = {
    contentType: {
      id: 71,
      contentTypeElements: [
        { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1, listId: 0 },
        { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 2, listId: 0 },
      ],
    },
    channels: [1],
    canPublishNow: true,
    canSaveAndApprove: true,
  };

  const contentDTO = (sectionId: number, id: number) => ({
    id,
    contentTypeID: 71,
    name: `Item ${id}`,
    language: 'en',
    status: 1,
    elements: { 'Name#1:1': `Item ${id}`, 'Title#2:1': 'Hello' },
    version: 1,
    owner: { id: 0, type: 'USER' },
    channels: [1],
    sectionIDs: [sectionId],
  });

  let client: T4Client;
  let http: HttpClient;

  beforeEach(() => {
    client = new T4Client(config);
    http = (client as unknown as { httpClient: HttpClient }).httpClient;
    (http.request as unknown) = vi.fn(async (opts: { method: string; path: string }) => {
      const { path } = opts;
      if (path === '/type/') return ELEMENT_TYPES;
      if (path === '/contenttype/71') return contentTypeDef;
      // /content/type/71/{section}
      const tMatch = path.match(/^\/content\/type\/71\/(\d+)$/);
      if (tMatch) return sectionTemplate;
      // /content/{section}/{id}/{lang}
      const cMatch = path.match(/^\/content\/(\d+)\/(\d+)\/en$/);
      if (cMatch) return contentDTO(Number(cMatch[1]), Number(cMatch[2]));
      throw new Error(`Unexpected request: ${opts.method} ${path}`);
    });
  });

  const countCalls = (predicate: (path: string) => boolean) =>
    (http.request as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => predicate((c[0] as { path: string }).path),
    ).length;

  it('fetches GET /type/ only once across content ops in multiple sections', async () => {
    await client.section(2777).content.get(8730);
    await client.section(2778).content.get(8732);
    await client.section(2779).content.get(8734);

    expect(countCalls((p) => p === '/type/')).toBe(1);
  });

  it('fetches GET /contenttype/{id} only once for the same content type across sections', async () => {
    await client.section(2777).content.get(8730);
    await client.section(2778).content.get(8732);
    await client.section(2779).content.get(8734);

    expect(countCalls((p) => p === '/contenttype/71')).toBe(1);
  });

  it('fetches the section template once per section (section-specific), reused on revisit', async () => {
    await client.section(2777).content.get(8730);
    await client.section(2778).content.get(8732);
    // Revisit 2777 via a new section() call — should reuse the shared cache
    await client.section(2777).content.get(8731);

    expect(countCalls((p) => p === '/content/type/71/2777')).toBe(1);
    expect(countCalls((p) => p === '/content/type/71/2778')).toBe(1);
  });

  it('clearCache() forces a re-fetch of /type/ and content type definition', async () => {
    await client.section(2777).content.get(8730);
    expect(countCalls((p) => p === '/type/')).toBe(1);
    expect(countCalls((p) => p === '/contenttype/71')).toBe(1);

    client.clearCache();

    await client.section(2778).content.get(8732);
    expect(countCalls((p) => p === '/type/')).toBe(2);
    expect(countCalls((p) => p === '/contenttype/71')).toBe(2);
  });

  it('invalidates the cached content type definition after a content type update', async () => {
    // A fuller content type object for the contentTypes.get() path used by update()
    const fullCt71 = {
      id: 71,
      name: 'Article',
      alias: 'Article',
      description: '',
      type: 10,
      minAuthLevel: 2,
      workflow: 0,
      enableDirectEdit: true,
      sharedGroups: [],
      contentTypeElements: [
        { id: 1, name: 'Name', alias: 'Name', description: '', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, shown: true },
        { id: 2, name: 'Title', alias: 'Title', description: '', type: 1, maxSize: 200, compulsory: false, listId: 0, sequence: 2, shown: true },
      ],
    };

    // Extend the mock to also serve the htmlEditor lookup and accept the PUT
    (http.request as unknown) = vi.fn(async (opts: { method: string; path: string }) => {
      const { method, path } = opts;
      if (path === '/type/') return ELEMENT_TYPES;
      if (path === '/htmlEditor') return [];
      if (method === 'GET' && path === '/contenttype/71') return fullCt71;
      if (method === 'PUT' && path === '/contenttype/71') return undefined;
      const tMatch = path.match(/^\/content\/type\/71\/(\d+)$/);
      if (tMatch) return sectionTemplate;
      const cMatch = path.match(/^\/content\/(\d+)\/(\d+)\/en$/);
      if (cMatch) return contentDTO(Number(cMatch[1]), Number(cMatch[2]));
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    // Prime the cache: this content.get() caches content type 71's definition
    await client.section(2777).content.get(8730);
    expect(countCalls((p) => p === '/contenttype/71')).toBeGreaterThanOrEqual(1);

    // Update the content type — this must invalidate the cached definition.
    await client.contentTypes.update(71, { description: 'changed' });

    // Measure AFTER the update completes (update itself does its own get), so we
    // isolate whether the *subsequent content read* re-fetches the definition.
    const afterUpdate = countCalls((p) => p === '/contenttype/71');

    // A subsequent content read must re-fetch the definition, not serve stale.
    // Without invalidation this read would hit the still-warm cache and add 0.
    await client.section(2778).content.get(8732);

    expect(countCalls((p) => p === '/contenttype/71')).toBe(afterUpdate + 1);
  });
});
