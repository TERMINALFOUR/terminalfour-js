import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaResource } from '../src/resources/media-resource.js';
import { MediaItem } from '../src/models/media-item.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const rawMediaResponse = {
  id: 10928,
  name: 'Cat',
  description: 'A cat running through grass',
  language: 'smxx',
  status: 0,
  version: '1.0',
  fileName: 'cat-image.jpg',
  mediaSize: 29359,
  typeName: 'Image',
  mediaURL: 'https://example.com/download/10928',
  thumbnailURL: 'https://example.com/thumbnail/10928',
  mediaPath: 'Media Library &raquo; Images &raquo; Cats',
  binaryLanguage: 'smxx',
  categories: [366],
  lastModifiedBy: 0,
  elements: {
    'Name#1:1': 'Cat',
    'Description#2:1': 'A cat running through grass',
    'MediaType#3:13': 1,
    'Media#4:4': { preferredFilename: 'cat-image.jpg' },
    'Thumbnail#5:4': { preferredFilename: 'thumb.jpg' },
    'Photo Credit#14:1': 'Jane Smith',
    'keywords#9:1': 'cat, animal',
    'variantname#10:1': '',
    'variantdimensions#12:1': '',
    'binarylanguage#13:1': 'smxx',
    'variant#8:13': 0,
    'syntax#11:13': 0,
  },
  contentType: {
    contentTypeElements: [
      { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1 },
      { id: 2, name: 'Description', alias: 'Description', type: 1, sequence: 2 },
      { id: 3, name: 'MediaType', alias: 'MediaType', type: 13, sequence: 3 },
      { id: 4, name: 'Media', alias: 'Media', type: 4, sequence: 4 },
      { id: 5, name: 'Thumbnail', alias: 'Thumbnail', type: 4, sequence: 5 },
      { id: 14, name: 'Photo Credit', alias: 'Photo Credit', type: 1, sequence: 7 },
      { id: 9, name: 'keywords', alias: 'keywords', type: 1, sequence: 8 },
      { id: 10, name: 'variantname', alias: 'variantname', type: 1, sequence: 9 },
      { id: 11, name: 'syntax', alias: 'syntax', type: 13, sequence: 10 },
      { id: 12, name: 'variantdimensions', alias: 'variantdimensions', type: 1, sequence: 11 },
      { id: 13, name: 'binarylanguage', alias: 'binarylanguage', type: 1, sequence: 12 },
      { id: 8, name: 'variant', alias: 'variant', type: 13, sequence: 6 },
    ],
  },
};

const mediaTypes = [
  { id: 1, name: 'Image', permittedExtensions: 'gif,jpg,jpeg', permittedExtensionsFormatted: ['gif', 'jpg', 'jpeg'], binary: true },
  { id: 2, name: 'Microsoft Office Document', permittedExtensions: 'doc,xls', permittedExtensionsFormatted: ['doc', 'xls'], binary: true },
  { id: 4, name: 'CSS Stylesheet File', permittedExtensions: 'css', permittedExtensionsFormatted: ['css'], binary: false },
];

const rawCssMedia = {
  id: 4635,
  name: 'screen.css',
  description: 'CSS for Digital Signage',
  language: 'smxx',
  status: 0,
  version: '10.0',
  fileName: 'screen.css',
  mediaSize: 3248,
  typeName: 'CSS Stylesheet File',
  mediaURL: 'https://example.com/download/4635',
  thumbnailURL: '',
  mediaPath: 'Media Library &raquo; CSS',
  binaryLanguage: 'smxx',
  categories: [355],
  lastModifiedBy: 0,
  syntax: 2,
  text: '* { box-sizing: border-box; }',
  elements: {
    'Name#1:1': 'screen.css',
    'Description#2:1': 'CSS for Digital Signage',
    'MediaType#3:13': 4,
    'Media#4:4': { preferredFilename: 'screen.css' },
    'Thumbnail#5:4': null,
    'Photo Credit#14:1': '',
    'keywords#9:1': '',
    'variantname#10:1': '',
    'variantdimensions#12:1': '',
    'binarylanguage#13:1': 'smxx',
    'variant#8:13': 0,
    'syntax#11:13': 2,
  },
  contentType: rawMediaResponse.contentType,
};

describe('MediaResource', () => {
  let http: HttpClient;
  let resource: MediaResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new MediaResource(http, 'en');
  });

  describe('get()', () => {
    function setupGetMocks() {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });
    }

    it('returns a MediaItem instance', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      expect(item).toBeInstanceOf(MediaItem);
    });

    it('defaults to language smxx', async () => {
      setupGetMocks();
      await resource.get(10928);
      const paths = (http.request as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => (c[0] as { path: string }).path,
      );
      expect(paths).toContain('/media/10928/smxx');
    });

    it('maps top-level fields correctly', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      expect(item.id).toBe(10928);
      expect(item.name).toBe('Cat');
      expect(item.description).toBe('A cat running through grass');
      expect(item.fileName).toBe('cat-image.jpg');
      expect(item.fileSize).toBe('28.7 KB');
      expect(item.mediaType).toBe('Image');
      expect(item.mediaTypeId).toBe(1);
      expect(item.language).toBe('smxx');
      expect(item.version).toBe('1.0');
      expect(item.status).toBe('approved');
      expect(item.downloadUrl).toBe('https://example.com/download/10928');
      expect(item.thumbnailUrl).toBe('https://example.com/thumbnail/10928');
      expect(item.categories).toEqual([366]);
    });

    it('decodes &raquo; in path', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      expect(item.path).toBe('Media Library » Images » Cats');
    });

    it('exposes user-editable fields (Photo Credit, keywords)', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      expect(item.fields['Photo Credit']).toBe('Jane Smith');
      expect(item.fields['keywords']).toBe('cat, animal');
    });

    it('excludes internal elements from fields', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      const fieldNames = Object.keys(item.fields).map((n) => n.toLowerCase());
      expect(fieldNames).not.toContain('name');
      expect(fieldNames).not.toContain('description');
      expect(fieldNames).not.toContain('media');
      expect(fieldNames).not.toContain('thumbnail');
      expect(fieldNames).not.toContain('mediatype');
      expect(fieldNames).not.toContain('variant');
      expect(fieldNames).not.toContain('binarylanguage');
      expect(fieldNames).not.toContain('syntax');
    });

    it('resolves media type name from typeName field', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      expect(item.mediaType).toBe('Image');
    });

    it('falls back to mediaType map when typeName is missing', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/10928/smxx') return { ...rawMediaResponse, typeName: undefined };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const item = await resource.get(10928);
      expect(item.mediaType).toBe('Image');
    });

    it('caches mediaType map across calls', async () => {
      setupGetMocks();
      await resource.get(10928);
      await resource.get(10928);

      const mediaTypeCalls = (http.request as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: unknown[]) => (c[0] as { path: string }).path === '/mediaType',
      );
      expect(mediaTypeCalls).toHaveLength(1);
    });

    it('does not expose _httpClient or _rawData in enumerable properties', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      const keys = Object.keys(item);
      expect(keys).not.toContain('_httpClient');
      expect(keys).not.toContain('_rawData');
      expect(keys).not.toContain('_fieldKeyMap');
    });

    it('has file property defaulting to null', async () => {
      setupGetMocks();
      const item = await resource.get(10928);
      expect(item.file).toBeNull();
    });
  });

  describe('MediaItem.save()', () => {
    function setupSaveMocks() {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.path === '/mediaType') return mediaTypes;
        if (opts.path.includes('/media/category/')) return undefined;
        throw new Error(`Unexpected: ${opts.path}`);
      });
    }

    it('sends multipart POST to /media/category/{categoryId}/{language}/{mediaId}', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      item.name = 'Updated Cat';
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { path: string; method: string };
          return o.method === 'POST' && o.path.includes('/media/category/');
        },
      );
      expect(postCall).toBeDefined();
      const opts = postCall![0] as { path: string; multipart: boolean; formData: FormData };
      expect(opts.path).toBe('/media/category/366/smxx/10928');
      expect(opts.multipart).toBe(true);
      expect(opts.formData).toBeInstanceOf(FormData);
    });

    it('includes name, description, type, elements in form data', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      item.name = 'Updated Cat';
      item.description = 'Updated description';
      item.fields['Photo Credit'] = 'New Credit';
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('name')).toBe('Updated Cat');
      expect(fd.get('description')).toBe('Updated description');
      expect(fd.get('type')).toBe('1');
      expect(fd.get('mediaID')).toBe('10928');

      const elements = JSON.parse(fd.get('elements') as string);
      expect(elements['Photo Credit#14:1']).toBe('New Credit');
    });

    it('does not include file fields when file is null', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('file')).toBeNull();
      expect(fd.get('fileName')).toBeNull();
      expect(fd.get('version')).toBe('1.0'); // unchanged
    });

    it('includes file and bumps version when file is set', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      item.file = new Blob(['test'], { type: 'image/png' });
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('file')).toBeInstanceOf(Blob);
      expect(fd.get('version')).toBe('2.0'); // bumped
    });

    it('derives filename from { file, filename } input', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      item.file = { file: new Blob(['test']), filename: 'custom.png' };
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('fileName')).toBe('custom.png');
    });

    it('resets file to null after save', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      item.file = new Blob(['test']);
      await item.save();
      expect(item.file).toBeNull();
    });

    it('sends categories in form data', async () => {
      setupSaveMocks();
      const item = await resource.get(10928);
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.getAll('categories')).toEqual(['366']);
    });

    it('throws when no category is assigned', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/10928/smxx') return { ...rawMediaResponse, categories: [] };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const item = await resource.get(10928);
      await expect(item.save()).rejects.toThrow('no category assigned');
    });
  });

  describe('update()', () => {
    it('fetches, applies changes, and saves', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.path === '/mediaType') return mediaTypes;
        if (opts.path.includes('/media/category/')) return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const item = await resource.update(10928, {
        name: 'Updated Name',
        description: 'Updated desc',
        fields: { 'Photo Credit': 'New Credit' },
      });

      expect(item.name).toBe('Updated Name');
      expect(item.description).toBe('Updated desc');
      expect(item.fields['Photo Credit']).toBe('New Credit');

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      expect(postCall).toBeDefined();
    });

    it('accepts file for replacement', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.path === '/mediaType') return mediaTypes;
        if (opts.path.includes('/media/category/')) return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const item = await resource.update(10928, {
        file: new Blob(['test']),
      });

      expect(item.file).toBeNull(); // reset after save
    });
  });

  describe('create()', () => {
    function setupCreateMocks(newId = 11793) {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'POST' && opts.path === '/media') return newId;
        if (opts.path === `/media/${newId}/smxx`) return { ...rawMediaResponse, id: newId };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });
    }

    it('sends multipart POST to /media and returns a MediaItem', async () => {
      setupCreateMocks();

      const item = await resource.create({
        file: { file: new Blob(['test'], { type: 'image/jpeg' }), filename: 'cat-image.jpg' },
        name: 'A new Cat Image',
        category: 391,
        description: 'A cute cat',
      });

      expect(item).toBeInstanceOf(MediaItem);
      expect(item.id).toBe(11793);
    });

    it('auto-detects media type from file extension', async () => {
      let formData: FormData | null = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; formData?: FormData }) => {
        if (opts.method === 'POST' && opts.path === '/media') { formData = opts.formData!; return 11793; }
        if (opts.path === '/media/11793/smxx') return { ...rawMediaResponse, id: 11793 };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        file: { file: new Blob(['test']), filename: 'photo.jpg' },
        name: 'Photo',
        category: 391,
      });

      expect(formData!.get('type')).toBe('1'); // Image
      expect(formData!.get('syntaxType')).toBe('0'); // binary
    });

    it('auto-detects syntax type for non-binary media', async () => {
      let formData: FormData | null = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; formData?: FormData }) => {
        if (opts.method === 'POST' && opts.path === '/media') { formData = opts.formData!; return 11793; }
        if (opts.path === '/media/11793/smxx') return { ...rawCssMedia, id: 11793 };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        file: { file: new Blob(['* { color: red; }']), filename: 'styles.css' },
        name: 'Styles',
        category: 355,
      });

      expect(formData!.get('type')).toBe('4'); // CSS Stylesheet File
      expect(formData!.get('syntaxType')).toBe('2'); // css
      expect(formData!.get('file')).toBeInstanceOf(Blob); // always sent as file on create
      expect(formData!.get('fileName')).toBe('styles.css');
    });

    it('sends binary file for binary media types', async () => {
      let formData: FormData | null = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; formData?: FormData }) => {
        if (opts.method === 'POST' && opts.path === '/media') { formData = opts.formData!; return 11793; }
        if (opts.path === '/media/11793/smxx') return { ...rawMediaResponse, id: 11793 };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        file: { file: new Blob(['binary']), filename: 'photo.jpg' },
        name: 'Photo',
        category: 391,
      });

      expect(formData!.get('file')).toBeInstanceOf(Blob);
      expect(formData!.get('fileName')).toBe('photo.jpg');
    });

    it('allows explicit mediaTypeId override', async () => {
      let formData: FormData | null = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; formData?: FormData }) => {
        if (opts.method === 'POST' && opts.path === '/media') { formData = opts.formData!; return 11793; }
        if (opts.path === '/media/11793/smxx') return { ...rawMediaResponse, id: 11793 };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        file: { file: new Blob(['test']), filename: 'video.mp4' },
        name: 'Video',
        category: 391,
        mediaTypeId: 11,
      });

      expect(formData!.get('type')).toBe('11');
    });

    it('throws when extension does not match any media type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        file: { file: new Blob(['test']), filename: 'file.xyz' },
        name: 'Unknown',
        category: 391,
      })).rejects.toThrow('Cannot determine media type for extension "xyz"');
    });

    it('throws when name is empty', async () => {
      await expect(resource.create({
        file: new Blob(['test']),
        name: '',
        category: 391,
      })).rejects.toThrow('Media name is required');
    });

    it('throws when category is missing', async () => {
      await expect(resource.create({
        file: new Blob(['test']),
        name: 'Test',
        category: 0,
      })).rejects.toThrow('Media category is required');
    });

    it('sends categories and language in form data', async () => {
      let formData: FormData | null = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; formData?: FormData }) => {
        if (opts.method === 'POST' && opts.path === '/media') { formData = opts.formData!; return 11793; }
        if (opts.path === '/media/11793/smxx') return { ...rawMediaResponse, id: 11793 };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        file: { file: new Blob(['test']), filename: 'photo.jpg' },
        name: 'Photo',
        category: 391,
      });

      expect(formData!.get('categories')).toBe('391');
      expect(formData!.get('language')).toBe('smxx');
      expect(formData!.get('binaryLanguage')).toBe('smxx');
    });
  });

  describe('delete()', () => {
    it('auto-selects category when media is in one category', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.method === 'GET' && opts.path === '/mediaType') return mediaTypes;
        if (opts.method === 'DELETE' && opts.path === '/media/category/366/id/10928/smxx') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.delete(10928);

      const deleteCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
      expect((deleteCall![0] as { path: string }).path).toBe('/media/category/366/id/10928/smxx');
    });

    it('uses explicit categoryId when provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await resource.delete(10928, { categoryId: 355 });

      expect(http.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/media/category/355/id/10928/smxx',
      });
    });

    it('throws when media is in multiple categories and no categoryId provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/10928/smxx') return { ...rawMediaResponse, categories: [366, 355] };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.delete(10928)).rejects.toThrow(
        'Media 10928 belongs to multiple categories (366, 355)',
      );
    });

    it('throws when media has no categories', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/10928/smxx') return { ...rawMediaResponse, categories: [] };
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.delete(10928)).rejects.toThrow(
        'Cannot delete media 10928 — it has no category assigned.',
      );
    });
  });

  describe('purge()', () => {
    it('calls POST /content/purge with media ID as string', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      await resource.purge(11794);

      expect(http.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/content/purge',
        body: {
          languageCode: 'en',
          contentIds: ['11794'],
        },
      });
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
      await resource.purge(11794, { language: 'fr' });

      expect(http.request).toHaveBeenCalledWith({
        method: 'POST',
        path: '/content/purge',
        body: {
          languageCode: 'fr',
          contentIds: ['11794'],
        },
      });
    });
  });

  describe('non-binary media (CSS/JS)', () => {
    function setupCssMocks() {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/4635/smxx') return rawCssMedia;
        if (opts.path === '/mediaType') return mediaTypes;
        if (opts.path.includes('/media/category/')) return undefined;
        throw new Error(`Unexpected: ${opts.path}`);
      });
    }

    it('exposes text content via content property', async () => {
      setupCssMocks();
      const item = await resource.get(4635);
      expect(item.content).toBe('* { box-sizing: border-box; }');
    });

    it('exposes syntaxType as friendly name', async () => {
      setupCssMocks();
      const item = await resource.get(4635);
      expect(item.syntaxType).toBe('css');
    });

    it('has content: null and syntaxType: null for binary media', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.path === '/mediaType') return mediaTypes;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const item = await resource.get(10928);
      expect(item.content).toBeNull();
      expect(item.syntaxType).toBeNull();
    });

    it('save() sends syntaxType resolved from friendly name', async () => {
      setupCssMocks();
      const item = await resource.get(4635);
      item.content = '* { color: red; }';
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('text')).toBe('* { color: red; }');
      expect(fd.get('syntaxType')).toBe('2');
    });

    it('save() does not send file/fileName for non-binary media', async () => {
      setupCssMocks();
      const item = await resource.get(4635);
      item.content = 'updated';
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('file')).toBeNull();
      expect(fd.get('fileName')).toBeNull();
    });

    it('save() does not bump version for non-binary media', async () => {
      setupCssMocks();
      const item = await resource.get(4635);
      item.content = 'updated';
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('version')).toBe('10.0'); // unchanged
    });

    it('save() sends syntaxType 0 for binary media', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/10928/smxx') return rawMediaResponse;
        if (opts.path === '/mediaType') return mediaTypes;
        if (opts.path.includes('/media/category/')) return undefined;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const item = await resource.get(10928);
      await item.save();

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST' && (c[0] as { path: string }).path.includes('/media/category/'),
      );
      const fd = (postCall![0] as { formData: FormData }).formData;
      expect(fd.get('syntaxType')).toBe('0');
    });
  });
});
