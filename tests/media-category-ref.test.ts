import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaCategoryRef } from '../src/media-category-ref.js';
import { MediaCategoryItem } from '../src/models/media-category-item.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const listResponse = {
  draw: 0,
  recordsTotal: 3,
  recordsFiltered: 3,
  accessLevel: 20,
  mediaRows: [
    {
      id: 10749,
      status: 0,
      language: 'smxx',
      name: 'Cliffs',
      description: 'A cliff photo',
      version: '1.0',
      fileName: 'cliffs.jpeg',
      fileSize: 56995,
      mediaTypeName: 'Image',
      binaryLanguage: 'smxx',
      numberOfVariants: 0,
      lastModified: 1659088315000,
    },
    {
      id: 270,
      status: 1,
      language: 'smxx',
      name: 'brick-med.jpg',
      description: 'Brick',
      version: '1.0',
      fileName: 'brick-med.jpg',
      fileSize: 90715,
      mediaTypeName: 'Image',
      binaryLanguage: 'smxx',
      numberOfVariants: 0,
      lastModified: 1452699355000,
    },
    {
      id: 500,
      status: 0,
      language: 'en',
      name: 'document.pdf',
      description: '',
      version: '2.0',
      fileName: 'document.pdf',
      fileSize: 120000,
      mediaTypeName: 'Document',
      binaryLanguage: 'en',
      numberOfVariants: 1,
      lastModified: 0,
    },
  ],
};

describe('MediaCategoryRef', () => {
  let http: HttpClient;
  let ref: MediaCategoryRef;

  beforeEach(() => {
    http = mockHttpClient();
    ref = new MediaCategoryRef(http, 367, 'en');
  });

  describe('get()', () => {
    const rawCategory = {
      id: 367,
      parent: 366,
      name: 'Parallax Images',
      description: 'Parallax Images',
      status: 0,
      lastModified: 1452619968000,
      path: 'Media Library &raquo; Categorised &raquo; Sample Site &raquo; Images &raquo; Parallax Images',
    };

    it('calls GET /mediacategory/{id}/{language}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawCategory);

      await ref.get();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
      expect(callArgs.path).toBe('/mediacategory/367/en');
    });

    it('returns a MediaCategoryItem', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawCategory);

      const cat = await ref.get();
      expect(cat).toBeInstanceOf(MediaCategoryItem);
    });

    it('maps fields correctly', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawCategory);

      const cat = await ref.get();
      expect(cat.id).toBe(367);
      expect(cat.name).toBe('Parallax Images');
      expect(cat.parentId).toBe(366);
      expect(cat.lastModified).toEqual(new Date(1452619968000));
    });

    it('decodes &raquo; in path', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawCategory);

      const cat = await ref.get();
      expect(cat.path).toContain('»');
      expect(cat.path).not.toContain('&raquo;');
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawCategory);

      await ref.get({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toBe('/mediacategory/367/fr');
    });

    it('handles null parent', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...rawCategory, parent: null });

      const cat = await ref.get();
      expect(cat.parentId).toBeNull();
    });

    it('handles missing lastModified', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...rawCategory, lastModified: 0 });

      const cat = await ref.get();
      expect(cat.lastModified).toBeNull();
    });
  });

  describe('subcategories()', () => {
    it('calls GET /hierarchy/{id}/{language}/subsections', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        children: [
          { id: 367, name: 'Parallax Images', lastModified: 1452619968000, sortLock: 'TOP' },
          { id: 368, name: 'Homepage Slides', lastModified: 1452676008000, sortLock: 'TOP' },
        ],
        sortType: 0,
      });

      const subs = await ref.subcategories();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
      expect(callArgs.path).toContain('/hierarchy/367/en/subsections');
    });

    it('returns mapped subcategory objects with Date lastModified', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        children: [
          { id: 367, name: 'Parallax Images', lastModified: 1452619968000, sortLock: 'TOP' },
        ],
        sortType: 0,
      });

      const subs = await ref.subcategories();
      expect(subs).toHaveLength(1);
      expect(subs[0].id).toBe(367);
      expect(subs[0].name).toBe('Parallax Images');
      expect(subs[0].lastModified).toBeInstanceOf(Date);
      expect(subs[0].lastModified!.getTime()).toBe(1452619968000);
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ children: [], sortType: 0 });

      await ref.subcategories({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toContain('/hierarchy/367/fr/subsections');
    });

    it('returns empty array when no children', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ children: [], sortType: 0 });

      const subs = await ref.subcategories();
      expect(subs).toEqual([]);
    });
  });

  describe('update()', () => {
    const fullCategory = {
      id: 367, parent: 366, name: 'Parallax Images', description: 'Parallax Images',
      status: 0, lastModified: 1452619968000, channels: [], userIDs: [],
    };

    it('fetches current category, PUTs with updated name, and returns MediaCategoryItem', async () => {
      let putBody: unknown = null;
      let getCalls = 0;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/mediacategory/367/en') {
          getCalls++;
          return getCalls > 1 ? { ...fullCategory, name: 'Updated Name' } : fullCategory;
        }
        if (opts.method === 'PUT' && opts.path === '/mediacategory/367/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.update({ name: 'Updated Name' });

      const body = putBody as Record<string, unknown>;
      expect(body.name).toBe('Updated Name');
      expect(body.id).toBe(367); // preserved
      expect(body.channels).toEqual([]); // preserved
      expect(result.id).toBe(367);
      expect(result.name).toBe('Updated Name');
    });

    it('sends PUT to /mediacategory/{id}/{language}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET') return fullCategory;
        if (opts.method === 'PUT') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.update({ name: 'New Name' });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect((putCall![0] as { path: string }).path).toBe('/mediacategory/367/en');
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediacategory/367/fr') return fullCategory;
        if (opts.method === 'PUT' && opts.path === '/mediacategory/367/fr') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.update({ name: 'Nouveau Nom' }, { language: 'fr' });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect((putCall![0] as { path: string }).path).toBe('/mediacategory/367/fr');
    });

    it('throws when name is empty', async () => {
      await expect(ref.update({ name: '' })).rejects.toThrow('Media category name is required');
    });

    it('throws when name is whitespace', async () => {
      await expect(ref.update({ name: '   ' })).rejects.toThrow('Media category name is required');
    });
  });

  describe('delete()', () => {
    it('calls DELETE /mediacategory/{id}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await ref.delete();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('DELETE');
      expect(callArgs.path).toBe('/mediacategory/367');
    });
  });

  describe('purge()', () => {
    it('calls POST /hierarchy/purge with category ID as string', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await ref.purge();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.path).toBe('/hierarchy/purge');
      expect(callArgs.body).toEqual({
        languageCode: 'en',
        contentIds: ['367'],
      });
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await ref.purge({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.body.languageCode).toBe('fr');
    });
  });

  describe('move()', () => {
    it('sends MOVE /mediacategory/{categoryId}/{newParentId}/{language} with empty body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await ref.move(7737);

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('MOVE');
      expect(callArgs.path).toBe('/mediacategory/367/7737/en');
      expect(callArgs.body).toEqual({});
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await ref.move(7737, { language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toBe('/mediacategory/367/7737/fr');
    });
  });

  describe('addCategory()', () => {
    const createdCategory = {
      id: 8439,
      parent: 367,
      name: 'Example Category',
      status: 0,
      lastModified: 1776204967564,
      path: 'Media Library &raquo; Images &raquo; Example Category',
    };

    it('calls POST /mediacategory/{language} with correct body', async () => {
      (http.request as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createdCategory)  // POST create
        .mockResolvedValueOnce(createdCategory);  // GET for returned item

      await ref.addCategory({ name: 'Example Category' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.path).toBe('/mediacategory/en');
      expect(callArgs.body.parent).toBe('367');
      expect(callArgs.body.name).toBe('Example Category');
    });

    it('sends parent as string', async () => {
      (http.request as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createdCategory)
        .mockResolvedValueOnce(createdCategory);

      await ref.addCategory({ name: 'Test' });

      const body = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0].body;
      expect(typeof body.parent).toBe('string');
    });

    it('returns a MediaCategoryItem for the created child', async () => {
      (http.request as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createdCategory)
        .mockResolvedValueOnce(createdCategory);

      const child = await ref.addCategory({ name: 'Example Category' });

      expect(child).toBeInstanceOf(MediaCategoryItem);
      expect(child.id).toBe(8439);
      expect(child.name).toBe('Example Category');
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createdCategory)
        .mockResolvedValueOnce(createdCategory);

      await ref.addCategory({ name: 'Test' }, { language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toBe('/mediacategory/fr');
    });

    it('throws when name is empty', async () => {
      await expect(ref.addCategory({ name: '' })).rejects.toThrow('Media category name is required');
    });

    it('throws when name is whitespace', async () => {
      await expect(ref.addCategory({ name: '   ' })).rejects.toThrow('Media category name is required');
    });

    it('sends default fields in body', async () => {
      (http.request as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(createdCategory)
        .mockResolvedValueOnce(createdCategory);

      await ref.addCategory({ name: 'Test' });

      const body = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0].body;
      expect(body.status).toBe('0');
      expect(body.workflow).toBe('-2');
      expect(body.show).toBe(false);
      expect(body.eForm).toBe(false);
      expect(body.archive).toBe(false);
      expect(body.description).toBe('');
      expect(body['output-uri']).toBe('');
    });
  });

  describe('list()', () => {
    it('calls POST /media/category/{id}/{language}/list with form-encoded body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(listResponse);

      await ref.list();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.path).toContain('/media/category/367/en/list');
      expect(callArgs.path).toContain('showPending=true');
      expect(callArgs.path).toContain('showUntranslated=true');
      expect(callArgs.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
      expect(typeof callArgs.body).toBe('string');
    });

    it('returns mapped media items with friendly fields', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(listResponse);

      const items = await ref.list();

      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({
        id: 10749,
        name: 'Cliffs',
        description: 'A cliff photo',
        fileName: 'cliffs.jpeg',
        fileSize: '55.7 KB',
        mediaType: 'Image',
        language: 'smxx',
        version: '1.0',
        status: 'approved',
        lastModified: new Date(1659088315000),
      });
    });

    it('maps status codes to friendly strings', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(listResponse);

      const items = await ref.list();

      expect(items[0].status).toBe('approved');
      expect(items[1].status).toBe('pending');
    });

    it('returns lastModified as null when 0', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(listResponse);

      const items = await ref.list();

      expect(items[2].lastModified).toBeNull();
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...listResponse, mediaRows: [] });

      await ref.list({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toContain('/media/category/367/fr/list');
    });

    it('returns empty array when no media rows', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        draw: 0, recordsTotal: 0, recordsFiltered: 0, accessLevel: 20, mediaRows: [],
      });

      const items = await ref.list();
      expect(items).toEqual([]);
    });

    it('handles missing mediaRows gracefully', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        draw: 0, recordsTotal: 0, recordsFiltered: 0, accessLevel: 20,
      });

      const items = await ref.list();
      expect(items).toEqual([]);
    });

    it('sends DataTables form body with start=0 and length=10000', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ...listResponse, mediaRows: [] });

      await ref.list();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const body = callArgs.body as string;
      const params = new URLSearchParams(body);
      expect(params.get('start')).toBe('0');
      expect(params.get('length')).toBe('10000');
      expect(params.get('order[0][column]')).toBe('5');
      expect(params.get('order[0][dir]')).toBe('desc');
    });

    it('uses binaryLanguage for the language field', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(listResponse);

      const items = await ref.list();

      expect(items[0].language).toBe('smxx');
      expect(items[2].language).toBe('en');
    });

    it('maps mediaTypeName to mediaType', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(listResponse);

      const items = await ref.list();

      expect(items[0].mediaType).toBe('Image');
      expect(items[2].mediaType).toBe('Document');
    });
  });
});
