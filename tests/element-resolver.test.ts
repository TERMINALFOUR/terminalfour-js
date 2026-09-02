import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElementResolver, TemplateElement, ResolveContext } from '../src/element-resolver.js';
import { HttpClient } from '../src/http-client.js';
import { TypeRegistry } from '../src/type-registry.js';
import { ELEMENT_TYPES } from './helpers.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

function makeElement(overrides: Partial<TemplateElement> & { type: number }): TemplateElement {
  return {
    id: 1,
    name: 'Test',
    alias: 'Test',
    sequence: 1,
    listId: 0,
    ...overrides,
  };
}

const sizeList = {
  id: 1,
  items: [
    { id: 1, name: 'Large', value: 'large', listId: 1, sublist: 0 },
    { id: 2, name: 'Small', value: 'small', listId: 1, sublist: 0 },
  ],
};

const cascadingOuterList = {
  id: 75,
  items: [
    { id: 311, name: 'Soccer', value: 'soccer', listId: 75, sublist: 74 },
  ],
};

const soccerTeamsList = {
  id: 74,
  items: [
    { id: 309, name: 'Liverpool', value: 'liverpool', listId: 74, sublist: 0 },
  ],
};

function setupListMock(http: HttpClient) {
  (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
    if (opts.path === '/type/') return ELEMENT_TYPES;
    if (opts.path.startsWith('/list/1/')) return sizeList;
    if (opts.path.startsWith('/list/75/')) return cascadingOuterList;
    if (opts.path.startsWith('/list/74/')) return soccerTeamsList;
    throw new Error(`Unexpected list request: ${opts.path}`);
  });
}

describe('ElementResolver', () => {
  let http: HttpClient;
  let resolver: ElementResolver;

  beforeEach(() => {
    http = mockHttpClient();
    setupListMock(http);
    const typeRegistry = new TypeRegistry(http);
    resolver = new ElementResolver(http, 'en', typeRegistry);
  });

  describe('resolveValue', () => {
    it('Type 1 (Plain Text): passes through', async () => {
      const el = makeElement({ type: 1 });
      expect(await resolver.resolveValue('hello', el, 'en')).toBe('hello');
    });

    it('Type 3 (HTML): passes through when no sslink anchors', async () => {
      const el = makeElement({ type: 3 });
      expect(await resolver.resolveValue('<p>hi</p>', el, 'en')).toBe('<p>hi</p>');
    });

    it('Type 3 (HTML): reverts existing sslink anchor to T4 tag', async () => {
      const el = makeElement({ type: 3 });
      const html = '<p>See <a href="#" data-t4-sslink="39" data-section-id="233">courses</a> here.</p>';
      const result = await resolver.resolveValue(html, el, 'en');
      expect(result).toBe('<p>See <t4 type="sslink" sslink_id="39"/> here.</p>');
    });

    it('Type 3 (HTML): reverts multiple sslink anchors', async () => {
      const el = makeElement({ type: 3 });
      const html = '<p><a href="#" data-t4-sslink="10" data-section-id="100">first</a> and <a href="#" data-t4-sslink="20" data-section-id="200" data-content-id="50">second</a></p>';
      const result = await resolver.resolveValue(html, el, 'en');
      expect(result).toBe('<p><t4 type="sslink" sslink_id="10"/> and <t4 type="sslink" sslink_id="20"/></p>');
    });

    it('Type 3 (HTML): creates new SS record for data-t4-sslink="new"', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/hierarchy/233/en') return { path: 'Home &raquo; Courses', name: 'Courses' };
        if (opts.method === 'PUT' && opts.path === '/ssl') return { id: 42 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 3 });
      const context: ResolveContext = { fromSectionId: 10, fromContentId: 100 };
      const html = '<p><a href="#" data-t4-sslink="new" data-section-id="233">courses</a></p>';
      const result = await resolver.resolveValue(html, el, 'en', undefined, context);
      expect(result).toBe('<p><t4 type="sslink" sslink_id="42"/></p>');

      // Verify the PUT /ssl call was made correctly
      const sslCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string; path: string }).method === 'PUT' && (c[0] as { path: string }).path === '/ssl',
      );
      expect(sslCall).toBeDefined();
      const body = (sslCall![0] as { body: Record<string, unknown> }).body;
      expect(body.fromSection).toBe(10);
      expect(body.fromContent).toBe(100);
      expect(body.toSection).toBe(233);
      expect(body.toContent).toBe(0);
      expect(body.linkText).toBe('courses');
    });

    it('Type 3 (HTML): creates new SS record with content target', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/hierarchy/300/en') return { path: 'Home &raquo; News', name: 'News' };
        if (opts.method === 'PUT' && opts.path === '/ssl') return { id: 55 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 3 });
      const context: ResolveContext = { fromSectionId: 10, fromContentId: 100 };
      const html = '<p><a href="#" data-t4-sslink="new" data-section-id="300" data-content-id="456">Article</a></p>';
      const result = await resolver.resolveValue(html, el, 'en', undefined, context);
      expect(result).toBe('<p><t4 type="sslink" sslink_id="55"/></p>');

      const sslCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string; path: string }).method === 'PUT' && (c[0] as { path: string }).path === '/ssl',
      );
      const body = (sslCall![0] as { body: Record<string, unknown> }).body;
      expect(body.toSection).toBe(300);
      expect(body.toContent).toBe(456);
      expect(body.linkText).toBe('Article');
    });

    it('Type 3 (HTML): creates new SS record when data-t4-sslink is omitted entirely', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/hierarchy/500/en') return { path: 'Home &raquo; About', name: 'About' };
        if (opts.method === 'PUT' && opts.path === '/ssl') return { id: 77 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 3 });
      const context: ResolveContext = { fromSectionId: 10, fromContentId: 100 };
      const html = '<p><a href="#" data-section-id="500" data-content-id="123">Read more</a></p>';
      const result = await resolver.resolveValue(html, el, 'en', undefined, context);
      expect(result).toBe('<p><t4 type="sslink" sslink_id="77"/></p>');
    });

    it('Type 3 (HTML): uses data-linktext over inner text when present', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/hierarchy/500/en') return { path: 'Home &raquo; About', name: 'About' };
        if (opts.method === 'PUT' && opts.path === '/ssl') return { id: 80 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 3 });
      const context: ResolveContext = { fromSectionId: 10, fromContentId: 100 };
      const html = '<p><a href="#" data-section-id="500" data-linktext="actual link text">Display text</a></p>';
      const result = await resolver.resolveValue(html, el, 'en', undefined, context);
      expect(result).toBe('<p><t4 type="sslink" sslink_id="80"/></p>');

      const sslCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string; path: string }).method === 'PUT' && (c[0] as { path: string }).path === '/ssl',
      );
      const body = (sslCall![0] as { body: Record<string, unknown> }).body;
      expect(body.linkText).toBe('actual link text');
    });

    it('Type 3 (HTML): sends empty linkText when data-linktext="" is explicitly set', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/hierarchy/500/en') return { path: 'Home &raquo; About', name: 'About' };
        if (opts.method === 'PUT' && opts.path === '/ssl') return { id: 81 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 3 });
      const context: ResolveContext = { fromSectionId: 10, fromContentId: 100 };
      const html = '<p><a href="#" data-section-id="500" data-linktext="">Dummy display text</a></p>';
      const result = await resolver.resolveValue(html, el, 'en', undefined, context);
      expect(result).toBe('<p><t4 type="sslink" sslink_id="81"/></p>');

      const sslCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string; path: string }).method === 'PUT' && (c[0] as { path: string }).path === '/ssl',
      );
      const body = (sslCall![0] as { body: Record<string, unknown> }).body;
      expect(body.linkText).toBe('');
    });

    it('Type 5 (Date): Date object → timestamp', async () => {
      const el = makeElement({ type: 5 });
      const d = new Date('2024-01-15T00:00:00Z');
      expect(await resolver.resolveValue(d, el, 'en')).toBe(d.getTime());
    });

    it('Type 5 (Date): number → pass through', async () => {
      const el = makeElement({ type: 5 });
      expect(await resolver.resolveValue(1700000000000, el, 'en')).toBe(1700000000000);
    });

    it('Type 5 (Date): string → parsed timestamp', async () => {
      const el = makeElement({ type: 5 });
      const result = await resolver.resolveValue('2024-01-15T00:00:00Z', el, 'en');
      expect(result).toBe(new Date('2024-01-15T00:00:00Z').getTime());
    });

    it('Type 7 (Select Box): friendly name → "listId:itemId"', async () => {
      const el = makeElement({ type: 7, listId: 1 });
      expect(await resolver.resolveValue('Large', el, 'en')).toBe('1:1');
    });

    it('Type 9 (Radio Button): friendly name → "listId:itemId"', async () => {
      const el = makeElement({ type: 9, listId: 1 });
      expect(await resolver.resolveValue('Small', el, 'en')).toBe('1:2');
    });

    it('Type 6 (Checkbox): array of names → "listId:id1,id2"', async () => {
      const el = makeElement({ type: 6, listId: 1 });
      expect(await resolver.resolveValue(['Large', 'Small'], el, 'en')).toBe('1:1,2');
    });

    it('Type 8 (Multiple Select): array of names → "listId:id1,id2"', async () => {
      const el = makeElement({ type: 8, listId: 1 });
      expect(await resolver.resolveValue(['Large', 'Small'], el, 'en')).toBe('1:1,2');
    });

    it('Type 15 (Multi-Select): array of names → "listId:id1;listId:id2"', async () => {
      const el = makeElement({ type: 15, listId: 1 });
      expect(await resolver.resolveValue(['Large', 'Small'], el, 'en')).toBe('1:1;1:2');
    });

    it('Type 10 (Cascading List): array of names → "listId1:id1, listId2:id2"', async () => {
      const el = makeElement({ type: 10, listId: 75 });
      expect(await resolver.resolveValue(['Soccer', 'Liverpool'], el, 'en')).toBe('75:311, 74:309');
    });

    it('Type 11 (Media): number → string', async () => {
      const el = makeElement({ type: 11 });
      expect(await resolver.resolveValue(42, el, 'en')).toBe('42');
    });

    it('Type 11 (Media): inline upload object → creates media and returns ID string', async () => {
      const mockCreateFn = vi.fn().mockResolvedValue(12345);
      const tr = new TypeRegistry(http);
      const resolverWithMedia = new ElementResolver(http, 'en', tr, mockCreateFn);

      const el = makeElement({ type: 11 });
      const result = await resolverWithMedia.resolveValue(
        { file: new Blob(['test']), name: 'Test Image', category: 391 },
        el,
        'en',
      );

      expect(result).toBe('12345');
      expect(mockCreateFn).toHaveBeenCalledWith({
        file: expect.any(Blob),
        name: 'Test Image',
        category: 391,
      });
    });

    it('Type 11 (Media): inline upload throws when no mediaCreateFn', async () => {
      const el = makeElement({ type: 11 });
      await expect(
        resolver.resolveValue(
          { file: new Blob(['test']), name: 'Test', category: 391 },
          el,
          'en',
        ),
      ).rejects.toThrow('Inline media upload is not available');
    });

    it('Type 12 (Decimal): passes through', async () => {
      const el = makeElement({ type: 12 });
      expect(await resolver.resolveValue(3.14, el, 'en')).toBe(3.14);
    });

    it('Type 13 (Whole Number): passes through', async () => {
      const el = makeElement({ type: 13 });
      expect(await resolver.resolveValue(99, el, 'en')).toBe(99);
    });

    it('Type 16 (Content Owner): number → string', async () => {
      const el = makeElement({ type: 16 });
      expect(await resolver.resolveValue(7, el, 'en')).toBe('7');
    });

    it('Type 17 (Group Select): array → comma-separated string', async () => {
      const el = makeElement({ type: 17 });
      expect(await resolver.resolveValue([10, 20, 30], el, 'en')).toBe('10,20,30');
    });

    it('Type 18 (Keyword Selector): complex OR/AND → formatted string', async () => {
      const el = makeElement({ type: 18, listId: 1 });
      const input = {
        or: ['Large', 'Custom', { and: ['Large', 'Small'] }],
      };
      expect(await resolver.resolveValue(input, el, 'en')).toBe('1:1,Custom,1:1&&1:2');
    });
  });

  describe('getList', () => {
    it('caches results', async () => {
      await resolver.getList(1, 'en');
      await resolver.getList(1, 'en');
      expect(http.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveItemName', () => {
    it('passes through "listId:itemId" format', async () => {
      const el = makeElement({ type: 7, listId: 1 });
      expect(await resolver.resolveValue('1:2', el, 'en')).toBe('1:2');
    });
  });

  describe('File/Image upload (types 2 and 4)', () => {
    it('Type 2 (Image): uploads file and returns element value', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'abc123', name: 'photo.jpg' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 9, type: 2 });
      const result = await resolver.resolveValue(
        { file: new Blob(['data']), filename: 'photo.jpg' },
        el,
        'en',
      );

      expect(result).toEqual({
        existingFile: false,
        code: 'abc123',
        preferredFilename: 'photo.jpg',
      });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/upload/',
      )![0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.path).toBe('/upload/');
      expect(callArgs.multipart).toBe(true);
      expect(callArgs.formData).toBeInstanceOf(FormData);
    });

    it('Type 4 (File): uploads file and returns element value', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'xyz789', name: 'doc.pdf' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 8, type: 4 });
      const result = await resolver.resolveValue(
        { file: new Blob(['pdf data']), filename: 'doc.pdf' },
        el,
        'en',
      );

      expect(result).toEqual({
        existingFile: false,
        code: 'xyz789',
        preferredFilename: 'doc.pdf',
      });
    });

    it('passes through value that already has a code property', async () => {
      const el = makeElement({ type: 2 });
      const existing = { existingFile: false, code: 'existing123', preferredFilename: 'old.jpg' };
      const result = await resolver.resolveValue(existing, el, 'en');
      expect(result).toEqual(existing);
    });

    it('passes through non-FileInput values', async () => {
      const el = makeElement({ type: 4 });
      const result = await resolver.resolveValue(42, el, 'en');
      expect(result).toBe(42);
    });

    it('sends elementID in the FormData', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'test', name: 'file.txt' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 42, type: 4 });
      await resolver.resolveValue(
        { file: new Blob(['data']), filename: 'file.txt' },
        el,
        'en',
      );

      const uploadCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/upload/',
      )!;
      const callArgs = uploadCall[0];
      const formData = callArgs.formData as FormData;
      expect(formData.get('elementID')).toBe('42');
      expect(formData.get('filename')).toBe('file.txt');
    });

    it('accepts a file path string and derives filename', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'path123', name: 'example.txt' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 5, type: 4 });
      const result = await resolver.resolveValue(
        { file: './tests/fixtures/example.txt' },
        el,
        'en',
      );

      expect(result).toEqual({
        existingFile: false,
        code: 'path123',
        preferredFilename: 'example.txt',
      });

      const uploadCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/upload/',
      )!;
      const formData = uploadCall[0].formData as FormData;
      expect(formData.get('filename')).toBe('example.txt');
    });

    it('uses explicit filename over derived path filename', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'custom', name: 'custom-name.txt' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 5, type: 4 });
      await resolver.resolveValue(
        { file: new Blob(['data']), filename: 'custom-name.txt' },
        el,
        'en',
      );

      const uploadCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/upload/',
      )!;
      const formData = uploadCall[0].formData as FormData;
      expect(formData.get('filename')).toBe('custom-name.txt');
    });

    it('wraps a bare string path as FileInput for file/image types', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'bare', name: 'example.csv' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 3, type: 2 });
      const result = await resolver.resolveValue('./tests/fixtures/example.csv', el, 'en');

      expect(result).toEqual({
        existingFile: false,
        code: 'bare',
        preferredFilename: 'example.csv',
      });
    });

    it('fetches file from HTTPS URL', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['remote data'])),
      }));

      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'url123', name: 'remote-image.jpg' };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const el = makeElement({ id: 9, type: 2 });
      const result = await resolver.resolveValue(
        'https://example.com/images/remote-image.jpg',
        el, 'en',
      );

      expect(result).toEqual({
        existingFile: false,
        code: 'url123',
        preferredFilename: 'remote-image.jpg',
      });

      vi.restoreAllMocks();
    });

    it('derives filename from URL path', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['data'])),
      }));

      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/upload/') return { code: 'x', name: 'photo.png' };
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const el = makeElement({ id: 3, type: 4 });
      await resolver.resolveValue(
        { file: 'https://cdn.example.com/assets/photo.png' },
        el, 'en',
      );

      const uploadCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/upload/',
      )!;
      expect(uploadCall[0].formData.get('filename')).toBe('photo.png');

      vi.restoreAllMocks();
    });

    it('throws on failed URL fetch', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }));

      const el = makeElement({ id: 3, type: 2 });
      await expect(resolver.resolveValue(
        'https://example.com/missing.jpg',
        el, 'en',
      )).rejects.toThrow('Failed to fetch file from https://example.com/missing.jpg: 404 Not Found');

      vi.restoreAllMocks();
    });
  });

  describe('Section/Content Link (type 14)', () => {
    const context: ResolveContext = { fromSectionId: 100, fromContentId: -12345 };

    it('creates SS record for section link and returns T4 tag', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/hierarchy/237/')) return { path: 'Home &raquo; Research', name: 'Research' };
        if (opts.method === 'PUT' && opts.path === '/ssl') return { id: 5 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 14 });
      const result = await resolver.resolveValue(
        { sectionId: 237, linkText: 'Research' },
        el, 'en', undefined, context,
      );

      expect(result).toBe('<t4 sslink_id="5" type="sslink" />');
    });

    it('uses section name as linkText when not provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/hierarchy/237/')) return { path: 'Home &raquo; Research', name: 'Research' };
        if (opts.method === 'PUT' && opts.path === '/ssl') {
          const body = opts.body as { linkText: string };
          expect(body.linkText).toBe('Research');
          return { id: 6 };
        }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 14 });
      await resolver.resolveValue(
        { sectionId: 237 },
        el, 'en', undefined, context,
      );
    });

    it('creates SS record for content link with contentId', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/hierarchy/233/')) return { path: 'Home &raquo; Blog', name: 'Blog' };
        if (opts.path.startsWith('/content/233/171/')) return { name: 'My Article' };
        if (opts.method === 'PUT' && opts.path === '/ssl') {
          const body = opts.body as { toContent: number; linkText: string };
          expect(body.toContent).toBe(171);
          expect(body.linkText).toBe('My Article');
          return { id: 7 };
        }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 14 });
      const result = await resolver.resolveValue(
        { sectionId: 233, contentId: 171 },
        el, 'en', undefined, context,
      );

      expect(result).toBe('<t4 sslink_id="7" type="sslink" />');
    });

    it('passes through existing T4 tag strings', async () => {
      const el = makeElement({ type: 14 });
      const tag = '<t4 sslink_id="2" type="sslink" />';
      const result = await resolver.resolveValue(tag, el, 'en', undefined, context);
      expect(result).toBe(tag);
    });

    it('sends correct fromSection and fromContent in SS payload', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/hierarchy/237/')) return { path: 'Home', name: 'Home' };
        if (opts.method === 'PUT' && opts.path === '/ssl') {
          const body = opts.body as { fromSection: number; fromContent: number };
          expect(body.fromSection).toBe(100);
          expect(body.fromContent).toBe(-12345);
          return { id: 8 };
        }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const el = makeElement({ type: 14 });
      await resolver.resolveValue(
        { sectionId: 237 },
        el, 'en', undefined, context,
      );
    });
  });

  describe('resolveDate edge cases', () => {
    it('returns 0 for invalid input (object)', async () => {
      const el = makeElement({ type: 5 });
      expect(await resolver.resolveValue({}, el, 'en')).toBe(0);
    });

    it('returns 0 for null', async () => {
      const el = makeElement({ type: 5 });
      expect(await resolver.resolveValue(null, el, 'en')).toBe(0);
    });

    it('returns 0 for undefined', async () => {
      const el = makeElement({ type: 5 });
      expect(await resolver.resolveValue(undefined, el, 'en')).toBe(0);
    });
  });

  describe('checkbox with single value (not array)', () => {
    it('still resolves correctly', async () => {
      const el = makeElement({ type: 6, listId: 1 });
      expect(await resolver.resolveValue('Large', el, 'en')).toBe('1:1');
    });
  });

  describe('keyword selector with plain string', () => {
    it('passes through', async () => {
      const el = makeElement({ type: 18, listId: 1 });
      expect(await resolver.resolveValue('already formatted', el, 'en')).toBe('already formatted');
    });
  });

  describe('group select with single value (not array)', () => {
    it('converts to string', async () => {
      const el = makeElement({ type: 17 });
      expect(await resolver.resolveValue(42, el, 'en')).toBe('42');
    });
  });

  describe('cascading list with already-formatted values', () => {
    it('passes through "listId:itemId" values', async () => {
      const el = makeElement({ type: 10, listId: 75 });
      expect(await resolver.resolveValue(['75:311', '74:309'], el, 'en')).toBe('75:311, 74:309');
    });
  });

  describe('list item name matching is case-insensitive', () => {
    it('resolves "large" (lowercase) to "1:1"', async () => {
      const el = makeElement({ type: 7, listId: 1 });
      expect(await resolver.resolveValue('large', el, 'en')).toBe('1:1');
    });

    it('resolves "LARGE" (uppercase) to "1:1"', async () => {
      const el = makeElement({ type: 7, listId: 1 });
      expect(await resolver.resolveValue('LARGE', el, 'en')).toBe('1:1');
    });

    it('checkbox case-insensitive: ["large", "small"] → "1:1,2"', async () => {
      const el = makeElement({ type: 6, listId: 1 });
      expect(await resolver.resolveValue(['large', 'small'], el, 'en')).toBe('1:1,2');
    });
  });

  describe('invalid list value validation', () => {
    it('Select Box throws with valid options listed', async () => {
      const el = makeElement({ type: 7, listId: 1, name: 'Size', alias: 'Size' });
      await expect(resolver.resolveValue('Medium', el, 'en'))
        .rejects.toThrow('Invalid list value "Medium" for field "Size". Valid options are: "Large", "Small"');
    });

    it('Radio Button throws with valid options listed', async () => {
      const el = makeElement({ type: 9, listId: 1, name: 'Pick', alias: 'Pick' });
      await expect(resolver.resolveValue('Huge', el, 'en'))
        .rejects.toThrow('Invalid list value "Huge" for field "Pick"');
    });

    it('Checkbox throws for any invalid item in array', async () => {
      const el = makeElement({ type: 6, listId: 1, name: 'Options', alias: 'Options' });
      await expect(resolver.resolveValue(['Large', 'Invalid'], el, 'en'))
        .rejects.toThrow('Invalid list value "Invalid" for field "Options"');
    });

    it('Multiple Select throws for invalid item', async () => {
      const el = makeElement({ type: 8, listId: 1, name: 'Multi', alias: 'Multi' });
      await expect(resolver.resolveValue(['Nope'], el, 'en'))
        .rejects.toThrow('Invalid list value "Nope" for field "Multi"');
    });

    it('Multi-Select throws for invalid item', async () => {
      const el = makeElement({ type: 15, listId: 1, name: 'MS', alias: 'MS' });
      await expect(resolver.resolveValue(['Large', 'Bad'], el, 'en'))
        .rejects.toThrow('Invalid list value "Bad" for field "MS"');
    });

    it('Cascading List throws for invalid item at any level', async () => {
      const el = makeElement({ type: 10, listId: 75, name: 'Cascade', alias: 'Cascade' });
      await expect(resolver.resolveValue(['Soccer', 'NonExistent'], el, 'en'))
        .rejects.toThrow('Invalid cascading list value "NonExistent" for field "Cascade"');
    });

    it('Keyword Selector allows free text (does not throw)', async () => {
      const el = makeElement({ type: 18, listId: 1, name: 'KW', alias: 'KW' });
      const result = await resolver.resolveValue(
        { or: ['Large', 'FreeTextValue'] },
        el, 'en',
      );
      expect(result).toBe('1:1,FreeTextValue');
    });
  });
});
