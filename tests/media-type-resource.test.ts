import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaTypeResource, MediaType } from '../src/resources/media-type-resource.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const rawListResponse = [
  {
    id: 1, name: 'Image', permittedExtensions: 'gif,jpg,jpeg,png', parseForTagsEnabled: false, maxSize: 0, binary: true,
    formats: [
      { mediaTypeID: 1, mediaLayout: 'image/*', default: false },
      { mediaTypeID: 1, mediaLayout: 'image/normal', default: true },
    ],
    permittedExtensionsFormatted: ['gif', 'jpg', 'jpeg', 'png'],
    defaultFormat: { mediaLayout: 'image/normal', default: true },
  },
  {
    id: 4, name: 'CSS Stylesheet File', permittedExtensions: 'css', parseForTagsEnabled: true, maxSize: 5120, binary: false,
    formats: [
      { mediaTypeID: 4, mediaLayout: 'css/*', default: true },
    ],
    permittedExtensionsFormatted: ['css'],
    defaultFormat: { mediaLayout: 'css/*', default: true },
  },
];

const rawGetResponse = {
  id: 1, name: 'Image', permittedExtensions: 'gif,jpg,jpeg,png', enableParseForTags: false, maxSize: 0,
  formatters: [
    { mediaTypeID: 1, mediaLayout: 'image/*', isDefault: false },
    { mediaTypeID: 1, mediaLayout: 'image/normal', isDefault: true },
  ],
  isBinary: true,
};

const rawGetCssResponse = {
  id: 4, name: 'CSS Stylesheet File', permittedExtensions: 'css', enableParseForTags: true, maxSize: 5120,
  formatters: [
    { mediaTypeID: 4, mediaLayout: 'css/*', isDefault: true },
  ],
  isBinary: false,
};

describe('MediaTypeResource', () => {
  let http: HttpClient;
  let resource: MediaTypeResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new MediaTypeResource(http);
  });

  describe('list()', () => {
    it('returns mapped MediaType instances from the list endpoint', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const types = await resource.list();

      expect(types).toHaveLength(2);
      expect(types[0]).toBeInstanceOf(MediaType);
      expect(types[0].id).toBe(1);
      expect(types[0].name).toBe('Image');
      expect(types[0].extensions).toEqual(['gif', 'jpg', 'jpeg', 'png']);
      expect(types[0].binary).toBe(true);
      expect(types[0].parseForTags).toBe(false);
      expect(types[0].maxSize).toBeNull();
      expect(types[0].layouts).toEqual([
        { name: 'image/*', default: false },
        { name: 'image/normal', default: true },
      ]);
      expect(types[0].defaultLayout).toBe('image/normal');
    });

    it('formats maxSize as friendly string when non-zero', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const types = await resource.list();
      expect(types[1].maxSize).toBe('5.0 KB');
    });
  });

  describe('get()', () => {
    it('returns a mutable MediaType from the detail endpoint', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawGetResponse);

      const mt = await resource.get(1);

      expect(mt).toBeInstanceOf(MediaType);
      expect(mt.id).toBe(1);
      expect(mt.name).toBe('Image');
      expect(mt.extensions).toEqual(['gif', 'jpg', 'jpeg', 'png']);
      expect(mt.binary).toBe(true);
      expect(mt.parseForTags).toBe(false);
      expect(mt.maxSize).toBeNull();
      expect(mt.layouts).toEqual([
        { name: 'image/*', default: false },
        { name: 'image/normal', default: true },
      ]);
      expect(mt.defaultLayout).toBe('image/normal');
    });

    it('formats maxSize when non-zero', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawGetCssResponse);

      const mt = await resource.get(4);
      expect(mt.maxSize).toBe('5.0 KB');
      expect(mt.parseForTags).toBe(true);
      expect(mt.binary).toBe(false);
    });
  });

  describe('MediaType.save()', () => {
    it('sends PUT with correctly formatted body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/1') return rawGetResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/1') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.get(1);
      mt.name = 'Image Renamed';
      mt.extensions = ['gif', 'jpg', 'png', 'webp'];
      await mt.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = (putCall![0] as { body: Record<string, unknown> }).body;
      expect(body.name).toBe('Image Renamed');
      expect(body.permittedExtensions).toBe('gif,jpg,png,webp');
      expect(body.isBinary).toBe(true);
      expect(body.enableParseForTags).toBe(false);
      expect(body.maxSize).toBe('0');
      expect(body.formatters).toEqual([
        { isDefault: false, mediaLayout: 'image/*' },
        { isDefault: true, mediaLayout: 'image/normal' },
      ]);
    });

    it('syncs defaultLayout into layouts array on save', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/1') return rawGetResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/1') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.get(1);
      mt.defaultLayout = 'image/*';
      await mt.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { formatters: Array<{ isDefault: boolean; mediaLayout: string }> } }).body;
      expect(body.formatters.find((f) => f.mediaLayout === 'image/*')!.isDefault).toBe(true);
      expect(body.formatters.find((f) => f.mediaLayout === 'image/normal')!.isDefault).toBe(false);
    });

    it('converts friendly maxSize string to bytes', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/4') return rawGetCssResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/4') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.get(4);
      mt.maxSize = '2 MB';
      await mt.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { maxSize: string } }).body;
      expect(body.maxSize).toBe(String(2 * 1024 * 1024));
    });

    it('sends maxSize 0 when set to null (unlimited)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/4') return rawGetCssResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/4') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.get(4);
      mt.maxSize = null;
      await mt.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { maxSize: string } }).body;
      expect(body.maxSize).toBe('0');
    });

    it('throws if binary is set to true while parseForTags is already true', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/4') return rawGetCssResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.get(4);
      mt.binary = true;
      // parseForTags is still true from the original data — should throw
      await expect(mt.save()).rejects.toThrow('parseForTags cannot be true when binary is true');
    });

    it('throws if binary is true and parseForTags is explicitly true', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawGetResponse);

      const mt = await resource.get(1);
      mt.parseForTags = true; // binary is already true
      await expect(mt.save()).rejects.toThrow('parseForTags cannot be true when binary is true');
    });

    it('throws if no layout is set as default', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawGetResponse);

      const mt = await resource.get(1);
      mt.defaultLayout = ''; // clear it
      mt.layouts = [{ name: 'image/*', default: false }];
      await expect(mt.save()).rejects.toThrow('At least one layout must be set as default');
    });
  });

  describe('update()', () => {
    it('fetches, merges, and saves (immutable pattern)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/1') return rawGetResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/1') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.update(1, { name: 'Image Updated', extensions: ['jpg', 'png'] });

      expect(mt.name).toBe('Image Updated');
      expect(mt.extensions).toEqual(['jpg', 'png']);

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
    });

    it('accepts numeric maxSize (bytes)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/1') return rawGetResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/1') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.update(1, { maxSize: 10240 });
      expect(mt.maxSize).toBe('10.0 KB');
    });

    it('accepts string maxSize (friendly)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/1') return rawGetResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/1') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.update(1, { maxSize: '5 MB' });
      expect(mt.maxSize).toBe('5 MB');
    });

    it('accepts null maxSize (unlimited)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/mediaType/4') return rawGetCssResponse;
        if (opts.method === 'PUT' && opts.path === '/mediaType/4') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.update(4, { maxSize: null });
      expect(mt.maxSize).toBeNull();
    });
  });

  describe('create()', () => {
    it('sends POST and re-fetches to get real ID', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'POST' && opts.path === '/mediaType') return { id: 0, name: 'New Type' };
        if (opts.method === 'GET' && opts.path === '/mediaType/') return [
          ...rawListResponse,
          {
            id: 12, name: 'New Type', permittedExtensions: 'foo,bar', parseForTagsEnabled: false, maxSize: 2048, binary: true,
            formats: [{ mediaTypeID: 12, mediaLayout: 'application/*', default: true }],
            permittedExtensionsFormatted: ['foo', 'bar'],
          },
        ];
        if (opts.method === 'GET' && opts.path === '/mediaType/12') return {
          id: 12, name: 'New Type', permittedExtensions: 'foo,bar', enableParseForTags: false, maxSize: 2048, isBinary: true,
          formatters: [{ mediaTypeID: 12, mediaLayout: 'application/*', isDefault: true }],
        };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.create({
        name: 'New Type',
        extensions: ['foo', 'bar'],
        binary: true,
        maxSize: '2 KB',
        layouts: [{ name: 'application/*', default: true }],
      });

      expect(mt.id).toBe(12);
      expect(mt.name).toBe('New Type');
      expect(mt.extensions).toEqual(['foo', 'bar']);
      expect(mt.maxSize).toBe('2.0 KB');
      expect(mt.binary).toBe(true);

      // Verify POST body
      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.name).toBe('New Type');
      expect(body.permittedExtensions).toBe('foo,bar');
      expect(body.maxSize).toBe('2048');
      expect(body.isBinary).toBe(true);
      expect(body.enableParseForTags).toBe(false);
    });

    it('syncs defaultLayout into layouts on create', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'POST' && opts.path === '/mediaType') return { id: 0, name: 'Video' };
        if (opts.method === 'GET' && opts.path === '/mediaType/') return [
          { id: 13, name: 'Video', permittedExtensions: 'mp4', parseForTagsEnabled: false, maxSize: 0, binary: true,
            formats: [{ mediaTypeID: 13, mediaLayout: 'video/*', default: false }, { mediaTypeID: 13, mediaLayout: 'video/looping', default: true }],
            permittedExtensionsFormatted: ['mp4'] },
        ];
        if (opts.method === 'GET' && opts.path === '/mediaType/13') return {
          id: 13, name: 'Video', permittedExtensions: 'mp4', enableParseForTags: false, maxSize: 0, isBinary: true,
          formatters: [{ mediaTypeID: 13, mediaLayout: 'video/*', isDefault: false }, { mediaTypeID: 13, mediaLayout: 'video/looping', isDefault: true }],
        };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        name: 'Video',
        extensions: ['mp4'],
        binary: true,
        layouts: [{ name: 'video/*', default: false }, { name: 'video/looping', default: false }],
        defaultLayout: 'video/looping',
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: { formatters: Array<{ isDefault: boolean; mediaLayout: string }> } }).body;
      expect(body.formatters.find((f) => f.mediaLayout === 'video/looping')!.isDefault).toBe(true);
      expect(body.formatters.find((f) => f.mediaLayout === 'video/*')!.isDefault).toBe(false);
    });

    it('throws if name is empty', async () => {
      await expect(resource.create({
        name: '', extensions: ['jpg'], binary: true,
        layouts: [{ name: 'image/*', default: true }],
      })).rejects.toThrow('name is required');
    });

    it('throws if no extensions', async () => {
      await expect(resource.create({
        name: 'Test', extensions: [], binary: true,
        layouts: [{ name: 'image/*', default: true }],
      })).rejects.toThrow('At least one file extension');
    });

    it('throws if no layouts', async () => {
      await expect(resource.create({
        name: 'Test', extensions: ['jpg'], binary: true,
        layouts: [],
      })).rejects.toThrow('At least one layout');
    });

    it('throws if no default layout', async () => {
      await expect(resource.create({
        name: 'Test', extensions: ['jpg'], binary: true,
        layouts: [{ name: 'image/*', default: false }],
      })).rejects.toThrow('At least one layout must be set as default');
    });

    it('throws if binary with parseForTags', async () => {
      await expect(resource.create({
        name: 'Test', extensions: ['jpg'], binary: true, parseForTags: true,
        layouts: [{ name: 'image/*', default: true }],
      })).rejects.toThrow('parseForTags cannot be true when binary is true');
    });

    it('forces parseForTags to false for binary types even if not explicitly set', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'POST' && opts.path === '/mediaType') return { id: 0, name: 'Bin' };
        if (opts.method === 'GET' && opts.path === '/mediaType/') return [
          { id: 14, name: 'Bin', permittedExtensions: 'bin', parseForTagsEnabled: false, maxSize: 0, binary: true,
            formats: [{ mediaTypeID: 14, mediaLayout: 'path/*', default: true }],
            permittedExtensionsFormatted: ['bin'] },
        ];
        if (opts.method === 'GET' && opts.path === '/mediaType/14') return {
          id: 14, name: 'Bin', permittedExtensions: 'bin', enableParseForTags: false, maxSize: 0, isBinary: true,
          formatters: [{ mediaTypeID: 14, mediaLayout: 'path/*', isDefault: true }],
        };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const mt = await resource.create({
        name: 'Bin', extensions: ['bin'], binary: true,
        layouts: [{ name: 'path/*', default: true }],
      });
      expect(mt.parseForTags).toBe(false);
    });
  });
});
