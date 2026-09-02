import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentResource } from '../src/resources/content-resource.js';
import { HttpClient } from '../src/http-client.js';
import { ContentDTO } from '../src/types.js';
import { ELEMENT_TYPES } from './helpers.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const mockTemplate = {
  contentType: {
    id: 44,
    contentTypeElements: [
      { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1, listId: 0, maxSize: 80 },
      { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 2, listId: 0, maxSize: 200 },
      { id: 10, name: 'Select Box', alias: 'Select Box', type: 7, sequence: 3, listId: 1 },
    ],
  },
  channels: [1, 3],
  canPublishNow: true,
  canSaveAndApprove: true,
};

const mockRawContentType = {
  id: 44,
  contentTypeElements: [
    { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1, listId: 0 },
    { id: 2, name: 'Title', alias: 'My Title', type: 1, sequence: 2, listId: 0 },
    { id: 10, name: 'Select Box', alias: 'Select Box', type: 7, sequence: 3, listId: 1 },
  ],
};

const sizeList = { id: 1, items: [{ id: 1, name: 'Large', value: 'large', listId: 1, sublist: 0 }] };

const createdDTO: ContentDTO = {
  id: 999,
  contentTypeID: 44,
  name: 'New Item',
  language: 'en',
  status: 1,
  elements: { 'Name#1:1': 'New Item', 'Title#2:1': 'Hello', 'Select Box#10:7': '1:1' },
  version: 1,
  owner: { id: 0, type: 'USER' },
  channels: [1, 3],
};

function setupMocks(http: HttpClient) {
  (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
    if (opts.path === '/type/') return ELEMENT_TYPES;
    if (opts.path === '/content/type/44/233') return mockTemplate;
    if (opts.path === '/contenttype/44') return mockRawContentType;
    if (opts.path.startsWith('/list/1/')) return sizeList;
    if (opts.method === 'POST' && opts.path.startsWith('/content/233/en')) return createdDTO;
    if (opts.method === 'POST' && /^\/content\/233\/\d+\/en$/.test(opts.path)) return { ...createdDTO, name: 'Updated Item' };
    if (opts.method === 'GET' && opts.path.includes('/contents')) return { children: [{ id: createdDTO.id, content: createdDTO, printSequence: 1, sortLock: 'UNLOCKED' }], sortType: 0 };
    if (opts.method === 'GET' && /^\/content\/233\/\d+\/en$/.test(opts.path)) return createdDTO;
    if (opts.method === 'DELETE') return undefined;
    throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
  });
}

describe('ContentResource', () => {
  let http: HttpClient;
  let resource: ContentResource;

  beforeEach(() => {
    http = mockHttpClient();
    setupMocks(http);
    resource = new ContentResource(http, 233, 'en');
  });

  describe('create()', () => {
    it('builds element keys using element.id (key format Name#id:type)', async () => {
      await resource.create({ type: 44, name: 'New Item', fields: { 'Select Box': 'Large' } });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      expect(createCall).toBeDefined();
      const body = (createCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // Key should use element id=10, not sequence=3
      expect(body.elements).toHaveProperty('Select Box#10:7');
      expect(body.elements).not.toHaveProperty('Select Box#3:7');
    });

    it('matches fields by alias (My Title alias maps to Title element)', async () => {
      await resource.create({ type: 44, name: 'New Item', fields: { 'My Title': 'Hello' } });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // Should map to Title#2:1 because alias 'My Title' matches element 'Title'
      expect(body.elements).toHaveProperty('Title#2:1', 'Hello');
    });

    it('generates a negative content ID', async () => {
      await resource.create({ type: 44, name: 'New Item', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { id: number } }).body;
      expect(body.id).toBeLessThan(0);
    });

    it('maps status draft → 3', async () => {
      await resource.create({ type: 44, name: 'X', fields: {}, status: 'draft' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(3);
    });

    it('maps status pending → 1', async () => {
      await resource.create({ type: 44, name: 'X', fields: {}, status: 'pending' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(1);
    });

    it('maps status approved → 0', async () => {
      await resource.create({ type: 44, name: 'X', fields: {}, status: 'approved' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(0);
    });

    it('maps status inactive → 2', async () => {
      await resource.create({ type: 44, name: 'X', fields: {}, status: 'inactive' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(2);
    });

    it('defaults to pending (status 1) when no status provided', async () => {
      await resource.create({ type: 44, name: 'X', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(1);
    });

    it('sends full body with channels, owner, excludedMirrorSectionIds', async () => {
      await resource.create({ type: 44, name: 'X', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: Record<string, unknown> }).body;
      expect(body.channels).toEqual([1, 3]);
      expect(body.owner).toEqual({ id: 0, type: 'USER' });
      expect(body.excludedMirrorSectionIds).toEqual([]);
      expect(body.canPublishNow).toBe(true);
      expect(body.canSaveAndApprove).toBe(true);
      expect(body).toHaveProperty('publishDate', null);
      expect(body).toHaveProperty('expiryDate', null);
      expect(body).toHaveProperty('reviewDate', null);
      expect(body).toHaveProperty('archiveSection', null);
    });

    it('sends publishDate, expiryDate, reviewDate as timestamps when provided', async () => {
      await resource.create({
        type: 44, name: 'X', fields: {},
        publishDate: new Date('2025-07-01T00:00:00Z'),
        expiryDate: '2025-12-31T00:00:00Z',
        reviewDate: 1756684800000,
      });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: Record<string, unknown> }).body;
      expect(body.publishDate).toBe(new Date('2025-07-01T00:00:00Z').getTime());
      expect(body.expiryDate).toBe(new Date('2025-12-31T00:00:00Z').getTime());
      expect(body.reviewDate).toBe(1756684800000);
    });

    it('sends null dates when not provided', async () => {
      await resource.create({ type: 44, name: 'X', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: Record<string, unknown> }).body;
      expect(body.publishDate).toBeNull();
      expect(body.expiryDate).toBeNull();
      expect(body.reviewDate).toBeNull();
    });

    it('sends archiveSection when provided', async () => {
      await resource.create({ type: 44, name: 'X', fields: {}, archiveSection: 500 });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: Record<string, unknown> }).body;
      expect(body.archiveSection).toBe(500);
    });

    it('sends null archiveSection when not provided', async () => {
      await resource.create({ type: 44, name: 'X', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: Record<string, unknown> }).body;
      expect(body.archiveSection).toBeNull();
    });

    it('sends owner ID when provided', async () => {
      await resource.create({ type: 44, name: 'X', fields: {}, owner: 38 });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { owner: { id: number; type: string } } }).body;
      expect(body.owner).toEqual({ id: 38, type: 'USER' });
    });

    it('defaults owner to 0 when not provided', async () => {
      await resource.create({ type: 44, name: 'X', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { owner: { id: number; type: string } } }).body;
      expect(body.owner).toEqual({ id: 0, type: 'USER' });
    });

    it('passes ResolveContext to resolver (fromSectionId set)', async () => {
      // The context is used internally for SS links. We verify the contentId is negative
      // and sectionId matches by checking the create call's body.id and the section in the path.
      await resource.create({ type: 44, name: 'X', fields: {} });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { id: number } }).body;
      // The context.fromContentId should equal the body.id (negative)
      expect(body.id).toBeLessThan(0);
      // The path includes sectionId 233 which is context.fromSectionId
      const opts = createCall![0] as { path: string };
      expect(opts.path).toContain('233');
    });

    it('throws descriptive error when field name does not match any element', async () => {
      await expect(
        resource.create({ type: 44, name: 'Bad Item', fields: { 'Nonexistent Field': 'value' } }),
      ).rejects.toThrow('Unknown field "Nonexistent Field"');
    });

    it('includes valid field names in the error message', async () => {
      await expect(
        resource.create({ type: 44, name: 'Bad Item', fields: { 'Nope': 'value' } }),
      ).rejects.toThrow('Valid fields are:');
    });

    it('throws when field value exceeds maxSize', async () => {
      const longTitle = 'x'.repeat(201);
      await expect(
        resource.create({ type: 44, name: 'Test', fields: { 'Title': longTitle } }),
      ).rejects.toThrow('exceeds max size: 201 characters (max 200)');
    });

    it('allows field value within maxSize', async () => {
      const okTitle = 'x'.repeat(200);
      await resource.create({ type: 44, name: 'Test', fields: { 'Title': okTitle } });
      // Should not throw
    });
  });

  describe('getTemplate()', () => {
    it('merges alias from raw content type', async () => {
      // After create, the returned ContentItem should use the merged alias 'My Title'
      const item = await resource.create({ type: 44, name: 'New Item', fields: { 'My Title': 'Hello' } });
      // The field should be keyed by alias 'My Title' (merged from raw content type)
      expect(item.fields).toHaveProperty('My Title');
    });

    it('merges listId from raw content type', async () => {
      // The Select Box element should have listId=1 merged from raw content type
      // We verify by passing a friendly name that requires list resolution
      await resource.create({ type: 44, name: 'X', fields: { 'Select Box': 'Large' } });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/en';
        },
      );
      const body = (createCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // 'Large' should have been resolved to '1:1' using listId=1
      expect(body.elements['Select Box#10:7']).toBe('1:1');
    });

    it('caches results (second call does not re-fetch)', async () => {
      await resource.create({ type: 44, name: 'First', fields: {} });
      await resource.create({ type: 44, name: 'Second', fields: {} });

      // Count calls to the template and contenttype endpoints
      const templateCalls = (http.request as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: unknown[]) => {
          const o = c[0] as { path: string };
          return o.path === '/content/type/44/233' || o.path === '/contenttype/44';
        },
      );
      // Should be exactly 2 (one template + one contenttype), not 4
      expect(templateCalls.length).toBe(2);
    });
  });

  describe('list()', () => {
    it('calls GET /hierarchy/{section}/{language}/contents', async () => {
      await resource.list();

      const listCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'GET' && o.path.includes('/contents');
        },
      );
      expect(listCall).toBeDefined();
      const opts = listCall![0] as { path: string };
      expect(opts.path).toContain('/hierarchy/233/en/contents');
    });
  });

  describe('get()', () => {
    it('calls GET /content/{section}/{id}/{language}', async () => {
      await resource.get(999);

      const getCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'GET' && o.path === '/content/233/999/en';
        },
      );
      expect(getCall).toBeDefined();
    });
  });

  describe('update()', () => {
    it('fetches existing content before posting', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const getCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'GET' && o.path === '/content/233/999/en';
        },
      );
      expect(getCall).toBeDefined();
    });

    it('sends full body with existing content merged', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      expect(postCall).toBeDefined();
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.id).toBe(999);
      expect(body.contentTypeID).toBe(44);
      expect(body.channels).toEqual([1, 3]);
      expect(body.canPublishNow).toBe(true);
      expect(body.canSaveAndApprove).toBe(true);
      expect(body).toHaveProperty('publishDate');
      expect(body).toHaveProperty('expiryDate');
      expect(body).toHaveProperty('reviewDate');
      expect(body.excludedMirrorSectionIds).toEqual([]);
    });

    it('sends sectionIDs as only the current section', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { sectionIDs: number[] } }).body;
      expect(body.sectionIDs).toEqual([233]);
    });

    it('resolves friendly field names to element keys', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { elements: Record<string, unknown> } }).body;
      expect(body.elements['Title#2:1']).toBe('Changed');
    });

    it('preserves existing elements not in the update', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // Select Box was in the original DTO and should still be there
      expect(body.elements['Select Box#10:7']).toBe('1:1');
    });

    it('updates the name when provided', async () => {
      await resource.update(999, { name: 'Renamed', fields: {} });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { name: string; elements: Record<string, unknown> } }).body;
      expect(body.name).toBe('Renamed');
      expect(body.elements['Name#1:1']).toBe('Renamed');
    });

    it('keeps existing name when not provided', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { name: string } }).body;
      expect(body.name).toBe('New Item');
    });

    it('maps status when provided', async () => {
      await resource.update(999, { fields: {}, status: 'approved' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(0);
    });

    it('defaults to pending (status 1) when no status provided', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(1);
    });

    it('defaults to pending even when existing content is approved', async () => {
      // Override the GET to return approved content (status 0)
      const approvedDTO = { ...createdDTO, status: 0 };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/content/type/44/233') return mockTemplate;
        if (opts.path === '/contenttype/44') return mockRawContentType;
        if (opts.path.startsWith('/list/1/')) return sizeList;
        if (opts.method === 'GET' && /^\/content\/233\/\d+\/en$/.test(opts.path)) return approvedDTO;
        if (opts.method === 'POST' && /^\/content\/233\/\d+\/en$/.test(opts.path)) return approvedDTO;
        throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
      });

      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(1); // pending, not 0 (approved)
    });

    it('resolves list values in updated fields', async () => {
      await resource.update(999, { fields: { 'Select Box': 'Large' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { elements: Record<string, unknown> } }).body;
      expect(body.elements['Select Box#10:7']).toBe('1:1');
    });

    it('sends date overrides as timestamps', async () => {
      await resource.update(999, {
        fields: {},
        publishDate: new Date('2025-07-01T00:00:00Z'),
        expiryDate: '2025-12-31T00:00:00Z',
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.publishDate).toBe(new Date('2025-07-01T00:00:00Z').getTime());
      expect(body.expiryDate).toBe(new Date('2025-12-31T00:00:00Z').getTime());
    });

    it('clears dates when explicitly set to null', async () => {
      await resource.update(999, { fields: {}, publishDate: null });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.publishDate).toBeNull();
    });

    it('preserves existing dates when not provided', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      // createdDTO has no publishDate, so it should be null
      expect(body.publishDate).toBeNull();
    });

    it('sends archiveSection when provided', async () => {
      await resource.update(999, { fields: {}, archiveSection: 500 });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.archiveSection).toBe(500);
    });

    it('clears archiveSection when set to null', async () => {
      await resource.update(999, { fields: {}, archiveSection: null });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.archiveSection).toBeNull();
    });

    it('sends owner ID when provided', async () => {
      await resource.update(999, { fields: {}, owner: 38 });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { owner: { id: number; type: string } } }).body;
      expect(body.owner).toEqual({ id: 38, type: 'USER' });
    });

    it('preserves existing owner when not provided', async () => {
      await resource.update(999, { fields: { Title: 'Changed' } });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/233/999/en';
        },
      );
      const body = (postCall![0] as { body: { owner: { id: number; type: string } } }).body;
      // createdDTO has owner { id: 0, type: 'USER' }
      expect(body.owner).toEqual({ id: 0, type: 'USER' });
    });
  });

  describe('delete()', () => {
    it('calls DELETE /content/{section}/{id}/{language}', async () => {
      await resource.delete(999);

      const deleteCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'DELETE' && o.path === '/content/233/999/en';
        },
      );
      expect(deleteCall).toBeDefined();
    });
  });

  describe('approveAll()', () => {
    it('fetches content, filters pending, and sends APPROVE with their IDs', async () => {
      const contentsResponse = {
        children: [
          { id: 1, content: { id: 11766, status: 1 }, printSequence: 1, sortLock: 'UNLOCKED' },
          { id: 2, content: { id: 11767, status: 0 }, printSequence: 2, sortLock: 'UNLOCKED' },
          { id: 3, content: { id: 11805, status: 1 }, printSequence: 3, sortLock: 'UNLOCKED' },
          { id: 4, content: { id: 11806, status: 3 }, printSequence: 4, sortLock: 'UNLOCKED' },
        ],
        sortType: 0,
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/contents')) return contentsResponse;
        if (opts.method === 'APPROVE') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const count = await resource.approveAll();

      expect(count).toBe(2);
      const approveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'APPROVE',
      );
      expect(approveCall).toBeDefined();
      const body = (approveCall![0] as { body: { ids: number[]; fastTrack: string } }).body;
      expect(body.ids).toEqual([11766, 11805]);
      expect(body.fastTrack).toBe('workflow');
      expect((approveCall![0] as { path: string }).path).toBe('/content/en');
    });

    it('returns 0 and skips APPROVE when no pending content', async () => {
      const contentsResponse = {
        children: [
          { id: 1, content: { id: 100, status: 0 }, printSequence: 1, sortLock: 'UNLOCKED' },
        ],
        sortType: 0,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(contentsResponse);

      const count = await resource.approveAll();

      expect(count).toBe(0);
      expect((http.request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1); // only the GET
    });

    it('uses language override', async () => {
      const contentsResponse = {
        children: [
          { id: 1, content: { id: 100, status: 1 }, printSequence: 1, sortLock: 'UNLOCKED' },
        ],
        sortType: 0,
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
        if (opts.method === 'GET') return contentsResponse;
        if (opts.method === 'APPROVE') return undefined;
        throw new Error('Unexpected');
      });

      await resource.approveAll({ language: 'fr' });

      const approveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'APPROVE',
      );
      expect((approveCall![0] as { path: string }).path).toBe('/content/fr');
    });
  });
});
