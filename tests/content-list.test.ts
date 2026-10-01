import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentResource } from '../src/resources/content-resource.js';
import { ContentList } from '../src/models/content-list.js';
import { HttpClient } from '../src/http-client.js';
import { ContentDTO } from '../src/types.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const SECTION_ID = 8461;

function dto(id: number, name: string): ContentDTO {
  return {
    id,
    contentTypeID: 44,
    name,
    language: 'en',
    status: 1,
    elements: {},
    version: 1,
    owner: { id: 0, type: 'USER' },
    channels: [1],
  };
}

/** Builds the /contents response for a given ordered set of items. */
function contentsResponse(items: Array<{ id: number; name: string }>) {
  return {
    children: items.map((item, i) => ({
      id: 1000 + i,
      content: dto(item.id, item.name),
      printSequence: i + 1,
      sortLock: 'UNLOCKED',
    })),
    sortType: 0,
  };
}

const DEFAULT_ITEMS = [
  { id: 11922, name: 'Alpha' },
  { id: 11923, name: 'Bravo' },
  { id: 11924, name: 'Charlie' },
];

/** Returns the index PUT calls that were made, in order. */
function indexCalls(http: HttpClient): Array<{ contentId: number; index: number }> {
  return (http.request as ReturnType<typeof vi.fn>).mock.calls
    .map((c: unknown[]) => c[0] as { method: string; path: string; body?: { id: number; index: number } })
    .filter((o) => o.method === 'PUT' && /\/contents\/\d+\/index$/.test(o.path))
    .map((o) => ({ contentId: o.body!.id, index: o.body!.index }));
}

describe('ContentList', () => {
  let http: HttpClient;
  let resource: ContentResource;

  beforeEach(() => {
    http = mockHttpClient();
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(
      async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/contents')) {
          return contentsResponse(DEFAULT_ITEMS);
        }
        if (opts.method === 'PUT' && /\/contents\/\d+\/index$/.test(opts.path)) {
          return undefined;
        }
        throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
      },
    );
    resource = new ContentResource(http, SECTION_ID, 'en');
  });

  describe('list()', () => {
    it('returns a ContentList that is also an Array', async () => {
      const list = await resource.list();
      expect(list).toBeInstanceOf(ContentList);
      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(3);
      expect(list[0].id).toBe(11922);
      expect(list.map((i) => i.id)).toEqual([11922, 11923, 11924]);
    });

    it('array methods return plain arrays (Symbol.species)', async () => {
      const list = await resource.list();
      const filtered = list.filter((i) => i.id > 11922);
      expect(filtered).not.toBeInstanceOf(ContentList);
      expect(Array.isArray(filtered)).toBe(true);
    });
  });

  describe('reorder() — target computation (0-based wire index)', () => {
    it('position is 1-based and sent 0-based', async () => {
      const list = await resource.list();
      await list.reorder(11924, { position: 1 });
      expect(indexCalls(http)).toEqual([{ contentId: 11924, index: 0 }]);
      expect(list.map((i) => i.id)).toEqual([11924, 11922, 11923]);
    });

    it('position: 2 moves to the second slot', async () => {
      const list = await resource.list();
      await list.reorder(11924, { position: 2 });
      expect(indexCalls(http)).toEqual([{ contentId: 11924, index: 1 }]);
      expect(list.map((i) => i.id)).toEqual([11922, 11924, 11923]);
    });

    it("to: 'first' moves to index 0", async () => {
      const list = await resource.list();
      await list.reorder(11923, { to: 'first' });
      expect(indexCalls(http)).toEqual([{ contentId: 11923, index: 0 }]);
      expect(list.map((i) => i.id)).toEqual([11923, 11922, 11924]);
    });

    it("to: 'last' moves to the end", async () => {
      const list = await resource.list();
      await list.reorder(11922, { to: 'last' });
      expect(indexCalls(http)).toEqual([{ contentId: 11922, index: 2 }]);
      expect(list.map((i) => i.id)).toEqual([11923, 11924, 11922]);
    });

    it('before: references a sibling position', async () => {
      const list = await resource.list();
      // Move Charlie before Alpha → index 0
      await list.reorder(11924, { before: 11922 });
      expect(indexCalls(http)).toEqual([{ contentId: 11924, index: 0 }]);
      expect(list.map((i) => i.id)).toEqual([11924, 11922, 11923]);
    });

    it('after: references a sibling position', async () => {
      const list = await resource.list();
      // Move Alpha after Bravo. Without Alpha: [Bravo(0), Charlie(1)] → after Bravo = index 1
      await list.reorder(11922, { after: 11923 });
      expect(indexCalls(http)).toEqual([{ contentId: 11922, index: 1 }]);
      expect(list.map((i) => i.id)).toEqual([11923, 11922, 11924]);
    });

    it('clamps an out-of-range position to the last slot', async () => {
      const list = await resource.list();
      await list.reorder(11922, { position: 99 });
      expect(indexCalls(http)).toEqual([{ contentId: 11922, index: 2 }]);
      expect(list.map((i) => i.id)).toEqual([11923, 11924, 11922]);
    });
  });

  describe('reorder() — validation', () => {
    it('throws when the content ID is not in the section', async () => {
      const list = await resource.list();
      await expect(list.reorder(99999, { position: 1 })).rejects.toThrow(
        /not in section 8461/,
      );
    });

    it('throws when no option is provided', async () => {
      const list = await resource.list();
      await expect(list.reorder(11922, {})).rejects.toThrow(
        /exactly one of: position, before, after, or to/,
      );
    });

    it('throws when more than one option is provided', async () => {
      const list = await resource.list();
      await expect(
        list.reorder(11922, { position: 1, to: 'last' }),
      ).rejects.toThrow(/exactly one of/);
    });

    it('throws when position is not a positive integer', async () => {
      const list = await resource.list();
      await expect(list.reorder(11922, { position: 0 })).rejects.toThrow(
        /positive integer/,
      );
    });

    it('throws when before references an unknown sibling', async () => {
      const list = await resource.list();
      await expect(list.reorder(11922, { before: 55555 })).rejects.toThrow(
        /not in section 8461/,
      );
    });

    it('throws when before references the moved item itself', async () => {
      const list = await resource.list();
      await expect(list.reorder(11922, { before: 11922 })).rejects.toThrow(
        /cannot reference the item being moved/,
      );
    });

    it('makes no API call when validation fails', async () => {
      const list = await resource.list();
      (http.request as ReturnType<typeof vi.fn>).mockClear();
      await expect(list.reorder(99999, { position: 1 })).rejects.toThrow();
      expect(indexCalls(http)).toHaveLength(0);
    });
  });

  describe('setOrder()', () => {
    it('issues one PUT per item, in ascending index order', async () => {
      const list = await resource.list();
      await list.setOrder([11924, 11922, 11923]);
      expect(indexCalls(http)).toEqual([
        { contentId: 11924, index: 0 },
        { contentId: 11922, index: 1 },
        { contentId: 11923, index: 2 },
      ]);
    });

    it('updates the in-memory order to match', async () => {
      const list = await resource.list();
      await list.setOrder([11923, 11924, 11922]);
      expect(list.map((i) => i.id)).toEqual([11923, 11924, 11922]);
    });

    it('throws when an ID is missing from the input', async () => {
      const list = await resource.list();
      await expect(list.setOrder([11922, 11923])).rejects.toThrow(
        /missing: 11924/,
      );
    });

    it('throws when an unknown ID is included', async () => {
      const list = await resource.list();
      await expect(
        list.setOrder([11922, 11923, 11924, 77777]),
      ).rejects.toThrow(/not in section 8461: 77777/);
    });

    it('throws when a duplicate ID is included', async () => {
      const list = await resource.list();
      await expect(
        list.setOrder([11922, 11922, 11923]),
      ).rejects.toThrow(/duplicate content ID/);
    });

    it('makes no API call when validation fails', async () => {
      const list = await resource.list();
      (http.request as ReturnType<typeof vi.fn>).mockClear();
      await expect(list.setOrder([11922])).rejects.toThrow();
      expect(indexCalls(http)).toHaveLength(0);
    });
  });
});
