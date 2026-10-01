import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionRef } from '../src/section-ref.js';
import { SubsectionList } from '../src/models/subsection-list.js';
import { HttpClient } from '../src/http-client.js';
import { cacheSectionMirrorStatus } from '../src/utils.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const PARENT_ID = 236;

const DEFAULT_CHILDREN = [
  { id: 297, name: 'Alpha', lastModified: 1_700_000_000_000 },
  { id: 298, name: 'Bravo', lastModified: 1_700_000_000_001 },
  { id: 299, name: 'Charlie', lastModified: 1_700_000_000_002 },
];

function subsectionsResponse(children: Array<{ id: number; name: string; lastModified: number }>) {
  return { children };
}

/** Returns the index PUT calls that were made, in order. */
function indexCalls(http: HttpClient): Array<{ childId: number; index: number }> {
  return (http.request as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => c[0] as { method: string; path: string; body?: { id: number; index: number } })
    .filter((o) => o.method === 'PUT' && /\/subsections\/\d+\/index$/.test(o.path))
    .map((o) => ({ childId: o.body!.id, index: o.body!.index }));
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
        if (opts.method === 'PUT' && /\/subsections\/\d+\/index$/.test(opts.path)) {
          return undefined;
        }
        throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
      },
    );
    // Mark the parent section as a non-mirror so the reorder read-only guard
    // resolves from cache (dedicated mirror tests use a fresh client).
    cacheSectionMirrorStatus(http as unknown as object, PARENT_ID, {});
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

  describe('reorder() — hits the subsections index endpoint', () => {
    it('uses PUT /hierarchy/{parent}/{lang}/subsections/{child}/index', async () => {
      const list = await ref.subsections();
      await list.reorder(299, { position: 1 });
      const call = (http.request as ReturnType<typeof vi.fn>).mock.calls
        .map((c: unknown[]) => c[0] as { method: string; path: string })
        .find((o) => o.method === 'PUT');
      expect(call!.path).toBe('/hierarchy/236/en/subsections/299/index');
    });

    it('position is 1-based and sent 0-based', async () => {
      const list = await ref.subsections();
      await list.reorder(299, { position: 1 });
      expect(indexCalls(http)).toEqual([{ childId: 299, index: 0 }]);
      expect(list.map((s) => s.id)).toEqual([299, 297, 298]);
    });

    it("to: 'last' moves to the end", async () => {
      const list = await ref.subsections();
      await list.reorder(297, { to: 'last' });
      expect(indexCalls(http)).toEqual([{ childId: 297, index: 2 }]);
      expect(list.map((s) => s.id)).toEqual([298, 299, 297]);
    });

    it('before: references a sibling position', async () => {
      const list = await ref.subsections();
      await list.reorder(299, { before: 297 });
      expect(indexCalls(http)).toEqual([{ childId: 299, index: 0 }]);
      expect(list.map((s) => s.id)).toEqual([299, 297, 298]);
    });

    it('after: references a sibling position', async () => {
      const list = await ref.subsections();
      await list.reorder(297, { after: 298 });
      expect(indexCalls(http)).toEqual([{ childId: 297, index: 1 }]);
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
      expect(indexCalls(http)).toHaveLength(0);
    });
  });

  describe('setOrder()', () => {
    it('issues one PUT per child, in ascending index order', async () => {
      const list = await ref.subsections();
      await list.setOrder([299, 297, 298]);
      expect(indexCalls(http)).toEqual([
        { childId: 299, index: 0 },
        { childId: 297, index: 1 },
        { childId: 298, index: 2 },
      ]);
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

  describe('read-only guard when the parent section is a mirror', () => {
    let mirrorHttp: HttpClient;
    let mirrorRef: SectionRef;

    beforeEach(() => {
      mirrorHttp = mockHttpClient();
      (mirrorHttp.request as ReturnType<typeof vi.fn>).mockImplementation(
        async (opts: { method: string; path: string }) => {
          if (opts.method === 'GET' && opts.path.includes('/subsections')) {
            return subsectionsResponse(DEFAULT_CHILDREN);
          }
          if (opts.method === 'GET' && opts.path === `/hierarchy/${PARENT_ID}/en`) {
            return { id: PARENT_ID, name: 'Mirror', parent: 1, mirrorOf: 8817 };
          }
          throw new Error(`Blocked path should not be reached: ${opts.method} ${opts.path}`);
        },
      );
      mirrorRef = new SectionRef(mirrorHttp, PARENT_ID, 'en');
    });

    const err = /Cannot modify section 236: it is a mirror of section 8817/;

    it('reorder() throws and makes no index PUT', async () => {
      const list = await mirrorRef.subsections();
      await expect(list.reorder(297, { position: 1 })).rejects.toThrow(err);
      expect(indexCalls(mirrorHttp)).toHaveLength(0);
    });

    it('setOrder() throws and makes no index PUT', async () => {
      const list = await mirrorRef.subsections();
      await expect(list.setOrder([299, 298, 297])).rejects.toThrow(err);
      expect(indexCalls(mirrorHttp)).toHaveLength(0);
    });
  });
});
