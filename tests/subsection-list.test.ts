import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionRef } from '../src/section-ref.js';
import { SubsectionList } from '../src/models/subsection-list.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const PARENT_ID = 236;

const DEFAULT_CHILDREN = [
  { id: 297, name: 'Alpha', lastModified: 1_700_000_000_000 },
  { id: 298, name: 'Bravo', lastModified: 1_700_000_000_001 },
  { id: 299, name: 'Charlie', lastModified: 1_700_000_000_002 },
];

function subsectionsResponse(children: Array<{ id: number; name: string; lastModified: number }>, sortType = 0) {
  return { children, sortType };
}

/**
 * Returns the bulk reorder PUT payloads made, in order. Each is the full
 * `[{ id, index }]` body sent to `PUT /hierarchy/{parent}/{lang}/subsections`.
 */
function bulkCalls(http: HttpClient): Array<Array<{ id: number; index: number }>> {
  return (http.request as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => c[0] as { method: string; path: string; body?: Array<{ id: number; index: number }> })
    .filter((o) => o.method === 'PUT' && /\/subsections$/.test(o.path))
    .map((o) => o.body!);
}

/** The IDs, in order, from the single bulk PUT expected for one reorder/setOrder. */
function singleBulkOrder(http: HttpClient): number[] {
  const calls = bulkCalls(http);
  expect(calls).toHaveLength(1);
  calls[0].forEach((entry, i) => expect(entry.index).toBe(i));
  return calls[0].map((e) => e.id);
}

describe('SubsectionList', () => {
  let http: HttpClient;
  let ref: SectionRef;

  beforeEach(() => {
    http = mockHttpClient();
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(
      async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/subsections')) {
          return subsectionsResponse(DEFAULT_CHILDREN);
        }
        if (opts.method === 'PUT' && /\/subsections$/.test(opts.path)) {
          return undefined;
        }
        throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
      },
    );
    ref = new SectionRef(http, PARENT_ID, 'en');
  });

  describe('subsections()', () => {
    it('returns a SubsectionList that is also an Array', async () => {
      const list = await ref.subsections();
      expect(list).toBeInstanceOf(SubsectionList);
      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(3);
      expect(list[0]).toMatchObject({ id: 297, name: 'Alpha' });
      expect(list[0].lastModified).toBeInstanceOf(Date);
      expect(list.map((s) => s.id)).toEqual([297, 298, 299]);
    });

    it('array methods return plain arrays (Symbol.species)', async () => {
      const list = await ref.subsections();
      const names = list.filter((s) => s.id > 297);
      expect(names).not.toBeInstanceOf(SubsectionList);
      expect(Array.isArray(names)).toBe(true);
    });
  });

  describe('reorder() — sends the full order to the bulk subsections endpoint', () => {
    it('uses PUT /hierarchy/{parent}/{lang}/subsections', async () => {
      const list = await ref.subsections();
      await list.reorder(299, { position: 1 });
      const call = (http.request as ReturnType<typeof vi.fn>).mock.calls
        .map((c: unknown[]) => c[0] as { method: string; path: string })
        .find((o) => o.method === 'PUT');
      expect(call!.path).toBe('/hierarchy/236/en/subsections');
    });

    it('position is 1-based; the full new order is persisted once', async () => {
      const list = await ref.subsections();
      await list.reorder(299, { position: 1 });
      expect(singleBulkOrder(http)).toEqual([299, 297, 298]);
      expect(list.map((s) => s.id)).toEqual([299, 297, 298]);
    });

    it("to: 'last' moves to the end", async () => {
      const list = await ref.subsections();
      await list.reorder(297, { to: 'last' });
      expect(singleBulkOrder(http)).toEqual([298, 299, 297]);
      expect(list.map((s) => s.id)).toEqual([298, 299, 297]);
    });

    it('before: references a sibling position', async () => {
      const list = await ref.subsections();
      await list.reorder(299, { before: 297 });
      expect(singleBulkOrder(http)).toEqual([299, 297, 298]);
      expect(list.map((s) => s.id)).toEqual([299, 297, 298]);
    });

    it('after: references a sibling position', async () => {
      const list = await ref.subsections();
      await list.reorder(297, { after: 298 });
      expect(singleBulkOrder(http)).toEqual([298, 297, 299]);
      expect(list.map((s) => s.id)).toEqual([298, 297, 299]);
    });

    it('throws when the section ID is not a child', async () => {
      const list = await ref.subsections();
      await expect(list.reorder(99999, { position: 1 })).rejects.toThrow(
        /section 99999: it is not in section 236/,
      );
    });

    it('throws when more than one option is provided', async () => {
      const list = await ref.subsections();
      await expect(list.reorder(297, { position: 1, to: 'last' })).rejects.toThrow(
        /exactly one of/,
      );
    });

    it('makes no API call when validation fails', async () => {
      const list = await ref.subsections();
      (http.request as ReturnType<typeof vi.fn>).mockClear();
      await expect(list.reorder(99999, { position: 1 })).rejects.toThrow();
      expect(bulkCalls(http)).toHaveLength(0);
    });
  });

  describe('setOrder()', () => {
    it('persists the full order in a single bulk request', async () => {
      const list = await ref.subsections();
      await list.setOrder([299, 297, 298]);
      expect(singleBulkOrder(http)).toEqual([299, 297, 298]);
      expect(list.map((s) => s.id)).toEqual([299, 297, 298]);
    });

    it('throws when an ID is missing from the input', async () => {
      const list = await ref.subsections();
      await expect(list.setOrder([297, 298])).rejects.toThrow(/missing: 299/);
    });

    it('throws when an unknown ID is included', async () => {
      const list = await ref.subsections();
      await expect(list.setOrder([297, 298, 299, 777])).rejects.toThrow(
        /not in section 236: 777/,
      );
    });

    it('throws when a duplicate ID is included', async () => {
      const list = await ref.subsections();
      await expect(list.setOrder([297, 297, 298])).rejects.toThrow(
        /duplicate section ID/,
      );
    });
  });

  describe('auto-sorted parent (sortType guard)', () => {
    beforeEach(() => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(
        async (opts: { method: string; path: string }) => {
          if (opts.method === 'GET' && opts.path.includes('/subsections')) {
            return subsectionsResponse(DEFAULT_CHILDREN, 2); // 2 = an automatic sort
          }
          if (opts.method === 'PUT' && /\/subsections$/.test(opts.path)) {
            return undefined;
          }
          throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
        },
      );
    });

    it('reorder() refuses and makes no PUT', async () => {
      const list = await ref.subsections();
      (http.request as ReturnType<typeof vi.fn>).mockClear();
      await expect(list.reorder(299, { position: 1 })).rejects.toThrow(
        /Cannot reorder section in section 236.*automatic sort \(sortType 2\)/,
      );
      expect(bulkCalls(http)).toHaveLength(0);
    });

    it('setOrder() refuses and makes no PUT', async () => {
      const list = await ref.subsections();
      (http.request as ReturnType<typeof vi.fn>).mockClear();
      await expect(list.setOrder([299, 297, 298])).rejects.toThrow(
        /automatic sort \(sortType 2\)/,
      );
      expect(bulkCalls(http)).toHaveLength(0);
    });
  });
});
