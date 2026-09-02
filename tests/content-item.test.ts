import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentItem, createContentItem } from '../src/models/content-item.js';
import { HttpClient } from '../src/http-client.js';
import { ElementResolver, TemplateElement } from '../src/element-resolver.js';
import { TypeRegistry } from '../src/type-registry.js';
import { ContentDTO } from '../src/types.js';
import { ELEMENT_TYPES } from './helpers.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const sizeList = {
  id: 1,
  items: [
    { id: 1, name: 'Large', value: 'large', listId: 1, sublist: 0 },
    { id: 2, name: 'Small', value: 'small', listId: 1, sublist: 0 },
  ],
};

const contentDTO: ContentDTO = {
  id: 100,
  contentTypeID: 44,
  name: 'Test',
  language: 'en',
  status: 1,
  elements: {
    'Title#2:1': 'Hello',
    'Name#1:1': 'Test',
    'Radio#12:9': '1:1',
  },
  version: 1,
  owner: { id: 0, type: 'USER' },
  channels: [1],
};

const templateElements: TemplateElement[] = [
  { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1, listId: 0 },
  { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 2, listId: 0 },
  { id: 12, name: 'Radio', alias: 'Radio', type: 9, sequence: 3, listId: 1 },
];

describe('ContentItem', () => {
  let http: HttpClient;
  let resolver: ElementResolver;
  let typeRegistry: TypeRegistry;

  beforeEach(() => {
    http = mockHttpClient();
    // Mock list fetches for the resolver
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path.startsWith('/list/1/')) return sizeList;
      throw new Error(`Unexpected request: ${opts.path}`);
    });
    typeRegistry = new TypeRegistry(http);
    resolver = new ElementResolver(http, 'en', typeRegistry);
  });

  describe('constructor', () => {
    it('sets readonly properties from ContentDTO', () => {
      const item = new ContentItem(contentDTO, http, 10);
      expect(item.id).toBe(100);
      expect(item.name).toBe('Test');
      expect(item.contentTypeID).toBe(44);
      expect(item.language).toBe('en');
      expect(item.status).toBe('pending');
      expect(item.version).toBe(1);
      expect(item.archiveSection).toBeNull();
    });

    it('reads archiveSection from DTO', () => {
      const dto: ContentDTO = { ...contentDTO, archiveSection: 236 };
      const item = new ContentItem(dto, http, 10);
      expect(item.archiveSection).toBe(236);
    });
  });

  describe('_init', () => {
    it('parses element keys into friendly names using alias', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      expect(item.fields).toHaveProperty('Name');
      expect(item.fields).toHaveProperty('Title');
      expect(item.fields).toHaveProperty('Radio');
    });

    it('sorts fields by template element sequence', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      const keys = Object.keys(item.fields);
      expect(keys).toEqual(['Name', 'Title', 'Radio']);
    });

    it('reverse-resolves list values to friendly names', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      // Radio type 9 with value "1:1" should resolve to "Large"
      expect(item.fields.Radio).toBe('Large');
    });
  });

  describe('toRawElements', () => {
    it('converts friendly names back to raw keys', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      // Modify a field
      item.fields.Title = 'Updated';

      // Trigger save to test raw element conversion
      const updatedDTO: ContentDTO = {
        ...contentDTO,
        elements: { 'Title#2:1': 'Updated', 'Name#1:1': 'Test', 'Radio#12:9': '1:1' },
        version: 2,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path.includes('/content/'),
      );
      expect(saveCall).toBeDefined();
      const body = (saveCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // Raw keys should be used
      expect(body.elements).toHaveProperty('Title#2:1');
      expect(body.elements).toHaveProperty('Name#1:1');
      expect(body.elements).toHaveProperty('Radio#12:9');
    });
  });

  describe('save()', () => {
    it('sends POST with full body and raw element keys', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);

      const updatedDTO: ContentDTO = { ...contentDTO, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      expect(saveCall).toBeDefined();
      const opts = saveCall![0] as { method: string; path: string; body: Record<string, unknown> };
      expect(opts.method).toBe('POST');
      expect(opts.path).toBe('/content/10/100/en');
      expect(opts.body.id).toBe(100);
      expect(opts.body.contentTypeID).toBe(44);
      expect(opts.body.channels).toEqual([1]);
      expect(opts.body.canPublishNow).toBe(true);
      expect(opts.body.canSaveAndApprove).toBe(true);
      expect(opts.body.excludedMirrorSectionIds).toEqual([]);
    });

    it('sends updated name in body and Name element', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      item.name = 'Renamed Content';

      const updatedDTO: ContentDTO = { ...contentDTO, name: 'Renamed Content', version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      const body = (saveCall![0] as { body: { name: string; elements: Record<string, unknown> } }).body;
      expect(body.name).toBe('Renamed Content');
      expect(body.elements['Name#1:1']).toBe('Renamed Content');
    });

    it('sends updated status as numeric code', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      item.status = 'approved';

      const updatedDTO: ContentDTO = { ...contentDTO, status: 0, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      const body = (saveCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(0);
    });

    it('defaults to pending (status 1) when status not explicitly changed', async () => {
      // contentDTO has status: 1 (pending), but even if it were approved,
      // save() should default to pending unless developer sets status
      const approvedDTO: ContentDTO = { ...contentDTO, status: 0 };
      const item = await createContentItem(approvedDTO, http, 10, resolver, templateElements, typeRegistry);
      // Don't touch item.status — leave it as 'approved' from the DTO

      const updatedDTO: ContentDTO = { ...contentDTO, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      const body = (saveCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(1); // pending, not 0 (approved)
    });

    it('updates local state from response', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);

      const updatedDTO: ContentDTO = {
        ...contentDTO,
        name: 'Updated Name',
        version: 2,
        status: 0,
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      expect(item.name).toBe('Updated Name');
      expect(item.version).toBe(2);
      expect(item.status).toBe('approved');
    });

    it('preserves field order after save', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);

      const updatedDTO: ContentDTO = { ...contentDTO, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const keys = Object.keys(item.fields);
      expect(keys).toEqual(['Name', 'Title', 'Radio']);
    });

    it('sends archiveSection from mutable property', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      item.archiveSection = 236;

      const updatedDTO: ContentDTO = { ...contentDTO, version: 2, archiveSection: 236 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (saveCall![0] as { body: { archiveSection: number | null } }).body;
      expect(body.archiveSection).toBe(236);
      expect(item.archiveSection).toBe(236);
    });

    it('sends sectionIDs as only the current section', async () => {
      const dtoWithMultipleSections: ContentDTO = { ...contentDTO, sectionIDs: [10, 20, 30] };
      const item = await createContentItem(dtoWithMultipleSections, http, 10, resolver, templateElements, typeRegistry);

      const updatedDTO: ContentDTO = { ...contentDTO, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (saveCall![0] as { body: { sectionIDs: number[] } }).body;
      expect(body.sectionIDs).toEqual([10]);
    });

    it('re-resolves list values on dirty fields (friendly name → API format)', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      // Radio was reverse-resolved to "Large" on read. Change it to "Small".
      expect(item.fields.Radio).toBe('Large');
      item.fields.Radio = 'Small';

      const updatedDTO: ContentDTO = { ...contentDTO, elements: { ...contentDTO.elements, 'Radio#12:9': '1:2' }, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      const body = (saveCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // Should be resolved to "1:2" (listId:itemId), NOT the friendly name "Small"
      expect(body.elements['Radio#12:9']).toBe('1:2');
    });

    it('leaves untouched fields in their original raw format', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      // Only change Title (plain text), leave Radio untouched
      item.fields.Title = 'New Title';

      const updatedDTO: ContentDTO = { ...contentDTO, elements: { ...contentDTO.elements, 'Title#2:1': 'New Title' }, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.save();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      const body = (saveCall![0] as { body: { elements: Record<string, unknown> } }).body;
      // Radio should still be in raw API format from the original DTO
      expect(body.elements['Radio#12:9']).toBe('1:1');
      expect(body.elements['Title#2:1']).toBe('New Title');
    });
  });

  describe('approve()', () => {
    it('saves with approved status (code 0)', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);

      const updatedDTO: ContentDTO = { ...contentDTO, status: 0, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.approve();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      expect(saveCall).toBeDefined();
      const body = (saveCall![0] as { body: { status: number } }).body;
      expect(body.status).toBe(0);
    });

    it('updates local status to approved after save', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      expect(item.status).toBe('pending');

      const updatedDTO: ContentDTO = { ...contentDTO, status: 0, version: 2 };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.approve();

      expect(item.status).toBe('approved');
    });

    it('throws if content is already approved', async () => {
      const approvedDTO: ContentDTO = { ...contentDTO, status: 0 };
      const item = await createContentItem(approvedDTO, http, 10, resolver, templateElements, typeRegistry);
      expect(item.status).toBe('approved');

      await expect(item.approve()).rejects.toThrow('Content item 100 is already approved.');
    });

    it('includes field changes made before approve()', async () => {
      const item = await createContentItem(contentDTO, http, 10, resolver, templateElements, typeRegistry);
      item.fields.Title = 'Updated Title';

      const updatedDTO: ContentDTO = {
        ...contentDTO,
        status: 0,
        version: 2,
        elements: { ...contentDTO.elements, 'Title#2:1': 'Updated Title' },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(updatedDTO);

      await item.approve();

      const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const opts = c[0] as { method: string; path: string };
          return opts.method === 'POST' && opts.path.includes('/content/');
        },
      );
      const body = (saveCall![0] as { body: { status: number; elements: Record<string, unknown> } }).body;
      expect(body.status).toBe(0);
      expect(body.elements['Title#2:1']).toBe('Updated Title');
    });
  });
});

describe('ContentItem – additional coverage', () => {
  let http: HttpClient;
  let resolver: ElementResolver;
  let typeRegistry: TypeRegistry;

  beforeEach(() => {
    http = mockHttpClient();
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path.startsWith('/list/1/')) return sizeList;
      if (opts.path.startsWith('/list/75/')) return {
        id: 75,
        items: [{ id: 311, name: 'Soccer', value: 'soccer', listId: 75, sublist: 74 }],
      };
      if (opts.path.startsWith('/list/74/')) return {
        id: 74,
        items: [{ id: 309, name: 'Liverpool', value: 'liverpool', listId: 74, sublist: 0 }],
      };
      throw new Error(`Unexpected request: ${opts.path}`);
    });
    typeRegistry = new TypeRegistry(http);
    resolver = new ElementResolver(http, 'en', typeRegistry);
  });

  describe('_init without template elements', () => {
    it('removes fields property when no template elements (list/summary view)', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Title#2:1': 'Hello' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const item = await createContentItem(dto, http, 10, resolver, null, typeRegistry);
      expect(item.fields).toBeUndefined();
      expect('fields' in item).toBe(false);
    });

    it('includes status in JSON output for summary items', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const item = await createContentItem(dto, http, 10, resolver, null, typeRegistry);
      const json = JSON.parse(JSON.stringify(item));
      expect(json.status).toBe('approved');
      expect(json.id).toBe(1);
      expect(json.name).toBe('Test');
      expect(json.fields).toBeUndefined();
    });
  });

  describe('_init without resolver', () => {
    it('skips list resolution (radio value stays as raw)', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Radio#12:9': '1:1' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 12, name: 'Radio', alias: 'Radio', type: 9, sequence: 1, listId: 1 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, null);
      expect(item.fields.Radio).toBe('1:1');
    });
  });

  describe('checkbox reverse resolution', () => {
    it('"1:1, 2" (with space) → ["Large", "Small"]', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Check#5:6': '1:1, 2' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 5, name: 'Check', alias: 'Check', type: 6, sequence: 1, listId: 1 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);
      expect(item.fields.Check).toEqual(['Large', 'Small']);
    });
  });

  describe('multi-select reverse resolution', () => {
    it('"1:1;1:2" → ["Large", "Small"]', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Multi#6:15': '1:1;1:2' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 6, name: 'Multi', alias: 'Multi', type: 15, sequence: 1, listId: 1 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);
      expect(item.fields.Multi).toEqual(['Large', 'Small']);
    });
  });

  describe('cascading list reverse resolution', () => {
    it('"75:311, 74:309" → ["Soccer", "Liverpool"]', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Cascade#7:10': '75:311, 74:309' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 7, name: 'Cascade', alias: 'Cascade', type: 10, sequence: 1, listId: 75 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);
      expect(item.fields.Cascade).toEqual(['Soccer', 'Liverpool']);
    });
  });

  describe('keyword selector reverse resolution', () => {
    it('"1:1,Custom,1:1&&1:2" → { or: ["Large", "Custom", { and: ["Large", "Small"] }] }', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'KW#8:18': '1:1,Custom,1:1&&1:2' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 8, name: 'KW', alias: 'KW', type: 18, sequence: 1, listId: 1 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);
      expect(item.fields.KW).toEqual({
        or: ['Large', 'Custom', { and: ['Large', 'Small'] }],
      });
    });
  });

  describe('SS link reverse resolution', () => {
    it('resolves T4 tag to friendly object with path', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/ssl/1/en/10/100') return {
          id: 1, toSection: 233, toContent: 0,
          linkText: 'Blog Section',
          path: 'Home &raquo; samplesite.terminalfour.com &raquo; Home',
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Link#17:14': '<t4 sslink_id="1" type="sslink" />' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 17, name: 'Link', alias: 'Link', type: 14, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Link).toEqual({
        sectionId: 233,
        linkText: 'Blog Section',
        path: 'Home » samplesite.terminalfour.com » Home',
      });
    });

    it('includes contentId for content links', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/ssl/2/en/10/100') return {
          id: 2, toSection: 233, toContent: 171,
          linkText: 'My Article',
          path: 'Home &raquo; Blog &raquo; My Article',
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Link#17:14': '<t4 sslink_id="2" type="sslink" />' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 17, name: 'Link', alias: 'Link', type: 14, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Link).toEqual({
        sectionId: 233,
        contentId: 171,
        linkText: 'My Article',
        path: 'Home » Blog » My Article',
      });
    });

    it('returns raw tag if SS lookup fails', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path.startsWith('/ssl/')) throw new Error('Not found');
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Link#17:14': '<t4 sslink_id="99" type="sslink" />' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 17, name: 'Link', alias: 'Link', type: 14, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Link).toBe('<t4 sslink_id="99" type="sslink" />');
    });
  });

  describe('HTML SS link resolution (read)', () => {
    it('resolves T4 sslink tags in HTML to anchor elements', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/ssl/39/en/10/100') return {
          id: 39, toSection: 233, toContent: 0,
          linkText: 'courses cover',
          path: 'Home &raquo; Courses',
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Body#3:3': '<p>These <t4 type="sslink" sslink_id="39"/> a range of subjects.</p>' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 3, name: 'Body', alias: 'Body', type: 3, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Body).toBe('<p>These <a href="#" data-t4-sslink="39" data-section-id="233" data-linktext="courses cover">courses cover</a> a range of subjects.</p>');
    });

    it('resolves multiple T4 sslink tags in one HTML field', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/ssl/10/en/10/100') return {
          id: 10, toSection: 100, toContent: 0,
          linkText: 'first link',
          path: 'Home',
        };
        if (opts.path === '/ssl/20/en/10/100') return {
          id: 20, toSection: 200, toContent: 50,
          linkText: 'second link',
          path: 'Home &raquo; Blog',
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Body#3:3': '<p>See <t4 type="sslink" sslink_id="10"/> and <t4 sslink_id="20" type="sslink" /></p>' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 3, name: 'Body', alias: 'Body', type: 3, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Body).toBe('<p>See <a href="#" data-t4-sslink="10" data-section-id="100" data-linktext="first link">first link</a> and <a href="#" data-t4-sslink="20" data-section-id="200" data-content-id="50" data-linktext="second link">second link</a></p>');
    });

    it('includes data-content-id when SS link has a content target', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path === '/ssl/5/en/10/100') return {
          id: 5, toSection: 300, toContent: 456,
          linkText: 'Article Title',
          path: 'Home &raquo; News',
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Body#3:3': '<p><t4 type="sslink" sslink_id="5"/></p>' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 3, name: 'Body', alias: 'Body', type: 3, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Body).toBe('<p><a href="#" data-t4-sslink="5" data-section-id="300" data-content-id="456" data-linktext="Article Title">Article Title</a></p>');
    });

    it('leaves HTML unchanged when no sslink tags present', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Body#3:3': '<p>Just plain HTML</p>' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 3, name: 'Body', alias: 'Body', type: 3, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Body).toBe('<p>Just plain HTML</p>');
    });

    it('preserves original tag when SS link resolution fails', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/list/')) return sizeList;
        if (opts.path.startsWith('/ssl/')) throw new Error('Not found');
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Body#3:3': '<p>Link: <t4 type="sslink" sslink_id="999"/></p>' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 3, name: 'Body', alias: 'Body', type: 3, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Body).toBe('<p>Link: <t4 type="sslink" sslink_id="999"/></p>');
    });
  });

  describe('Content Owner reverse resolution', () => {
    it('resolves user ID to user object', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/user/38') return {
          id: 38, username: 't4.admin', firstName: 'Admin', lastName: 'User', emailAddress: 'admin@example.com', authLevel: 0,
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Owner#18:16': '38' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 18, name: 'Owner', alias: 'Content Owner', type: 16, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields['Content Owner']).toEqual({
        id: 38,
        type: 'admin',
        username: 't4.admin',
        firstName: 'Admin',
        lastName: 'User',
        emailAddress: 'admin@example.com',
      });
    });

    it('returns raw value if user lookup fails', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/user/')) throw new Error('Not found');
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Owner#18:16': '999' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 18, name: 'Owner', alias: 'Content Owner', type: 16, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields['Content Owner']).toBe('999');
    });

    it('returns raw value for zero/empty owner', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Owner#18:16': '0' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 18, name: 'Owner', alias: 'Content Owner', type: 16, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields['Content Owner']).toBe('0');
    });
  });

  describe('Group Select reverse resolution', () => {
    const mockGroups = [
      { id: 1, name: 'Sample Site', groupChildren: [] },
      { id: 31, name: 'CSV Redirects', groupChildren: [
        { id: 41, name: 'Other Sub Group', groupChildren: [] },
        { id: 34, name: 'Sub Group', groupChildren: [
          { id: 40, name: 'Sub-Sub Group', groupChildren: [] },
        ] },
      ] },
    ];

    it('resolves comma-separated IDs to array of group objects', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/group/topLevelGroups') return mockGroups;
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Groups#19:17': '41,34,40' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 19, name: 'Groups', alias: 'Group Select', type: 17, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields['Group Select']).toEqual([
        { id: 41, name: 'Other Sub Group', selected: true },
        { id: 34, name: 'Sub Group', selected: true },
        { id: 40, name: 'Sub-Sub Group', selected: true },
      ]);
    });

    it('handles nested groups in the tree', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/group/topLevelGroups') return mockGroups;
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Groups#19:17': '40' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 19, name: 'Groups', alias: 'Group Select', type: 17, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields['Group Select']).toEqual([
        { id: 40, name: 'Sub-Sub Group', selected: true },
      ]);
    });
  });

  describe('save() preserves local fields on failure', () => {
    it('fields remain unchanged when save rejects', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Title#2:1': 'Original' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);
      item.fields.Title = 'Modified';

      // Mock save to reject
      (http.request as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Server error'));

      await expect(item.save()).rejects.toThrow('Server error');
      // Fields should still have the modified value (not reverted)
      expect(item.fields.Title).toBe('Modified');
    });

    it('throws descriptive error when saving with an unknown field name', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Title#2:1': 'Hello' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      // Set a field that doesn't exist on the content type
      item.fields['Nonexistent'] = 'bad value';

      await expect(item.save()).rejects.toThrow('Unknown field "Nonexistent"');
      await expect(item.save()).rejects.toThrow('Valid fields are:');
    });

    it('throws when saving a field value that exceeds maxSize', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Title#2:1': 'Hello' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 2, name: 'Title', alias: 'Title', type: 1, sequence: 1, listId: 0, maxSize: 10 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      item.fields['Title'] = 'This is way too long for the field';

      await expect(item.save()).rejects.toThrow('exceeds max size');
      await expect(item.save()).rejects.toThrow('max 10');
    });
  });

  describe('file size formatting', () => {
    it('formats bytes for small files', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'File#8:4': { code: 'abc', preferredFilename: 'test.txt', fileSize: 512, existingFile: false } },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 8, name: 'File', alias: 'File', type: 4, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, typeRegistry);
      expect((item.fields.File as Record<string, unknown>).fileSize).toBe('512 B');
    });

    it('formats KB for medium files', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Image#9:2': { code: 'abc', preferredFilename: 'photo.jpg', fileSize: 15360, existingFile: false } },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 9, name: 'Image', alias: 'Image', type: 2, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, typeRegistry);
      expect((item.fields.Image as Record<string, unknown>).fileSize).toBe('15.0 KB');
    });

    it('formats MB for large files', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'File#8:4': { code: 'abc', preferredFilename: 'video.mp4', fileSize: 5242880, existingFile: false } },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 8, name: 'File', alias: 'File', type: 4, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, typeRegistry);
      expect((item.fields.File as Record<string, unknown>).fileSize).toBe('5.0 MB');
    });

    it('formats 0 bytes', async () => {
      const dto: ContentDTO = {
        id: 1, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'File#8:4': { code: '', preferredFilename: null, fileSize: 0, existingFile: false } },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 8, name: 'File', alias: 'File', type: 4, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, typeRegistry);
      expect((item.fields.File as Record<string, unknown>).fileSize).toBe('0 B');
    });
  });

  describe('file download link', () => {
    it('adds downloadLink from download endpoint', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/download/file/100/en/1/8') return {
          name: 'test.txt',
          fileLocation: 'https://example.com/download/file/abc/100/en/1.0/8',
        };
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'File#8:4': { code: 'abc', preferredFilename: 'test.txt', fileSize: 1024, existingFile: false } },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 8, name: 'File', alias: 'File', type: 4, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, typeRegistry);

      const file = item.fields.File as Record<string, unknown>;
      expect(file.downloadLink).toBe('https://example.com/download/file/abc/100/en/1.0/8');
      expect(file.fileSize).toBe('1.0 KB');
    });

    it('skips downloadLink when file has no code (empty)', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'File#8:4': { code: '', preferredFilename: null, fileSize: 0, existingFile: false } },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 8, name: 'File', alias: 'File', type: 4, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, null, elems, typeRegistry);

      const file = item.fields.File as Record<string, unknown>;
      expect(file.downloadLink).toBeUndefined();
    });
  });

  describe('Media reverse resolution', () => {
    const mediaResponse = {
      id: 10928,
      name: 'Cat Photo',
      fileName: 'cat-image.jpg',
      description: 'A cat running through grass',
      typeName: 'Image',
      mediaURL: 'https://example.com/download/media/10928',
      mediaPath: 'Media Library &raquo; Images &raquo; Cats\n',
      mediaSize: 29359,
      elements: {
        'Media#4:4': { lastModified: 1710170149908, preferredFilename: 'cat-image.jpg' },
      },
    };

    it('resolves media ID to enriched object', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/media/10928/en') return mediaResponse;
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Media#7:11': '10928' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 7, name: 'Media', alias: 'Media', type: 11, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      const media = item.fields.Media as Record<string, unknown>;
      expect(media.id).toBe(10928);
      expect(media.name).toBe('Cat Photo');
      expect(media.filename).toBe('cat-image.jpg');
      expect(media.description).toBe('A cat running through grass');
      expect(media.mediaType).toBe('Image');
      expect(media.downloadLink).toBe('https://example.com/download/media/10928');
      expect(media.path).toBe('Media Library » Images » Cats');
      expect(media.fileSize).toBe('28.7 KB');
    });

    it('returns lastModified as Date object', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/media/10928/en') return mediaResponse;
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Media#7:11': '10928' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 7, name: 'Media', alias: 'Media', type: 11, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      const media = item.fields.Media as Record<string, unknown>;
      expect(media.lastModified).toBeInstanceOf(Date);
      expect((media.lastModified as Date).getTime()).toBe(1710170149908);
    });

    it('falls back to raw ID when media fetch fails', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path.startsWith('/media/')) throw new Error('Not found');
        throw new Error(`Unexpected request: ${opts.path}`);
      });

      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Media#7:11': '10928' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 7, name: 'Media', alias: 'Media', type: 11, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Media).toBe(10928);
    });

    it('returns raw value for empty media string', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: { 'Media#7:11': '' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const elems: TemplateElement[] = [
        { id: 7, name: 'Media', alias: 'Media', type: 11, sequence: 1, listId: 0 },
      ];
      const item = await createContentItem(dto, http, 10, resolver, elems, typeRegistry);

      expect(item.fields.Media).toBe('');
    });
  });

  describe('duplicate()', () => {
    it('duplicates to same section with (1) suffix', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test Content Item', language: 'en',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const contentsResponse = {
        children: [
          { content: { name: 'Test Content Item' } },
        ],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.method === 'GET' && opts.path.includes('/contents')) return contentsResponse;
        if (opts.method === 'COPY') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const item = await createContentItem(dto, http, 10, resolver, templateElements, typeRegistry);
      await item.duplicate();

      const copyCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'COPY',
      );
      expect(copyCall).toBeDefined();
      const body = (copyCall![0] as { body: { source: number; destination: number; contents: Record<string, Array<{ name: string }>> } }).body;
      expect(body.source).toBe(10);
      expect(body.destination).toBe(10);
      expect(body.contents['100'][0].name).toBe('Test Content Item (1)');
    });

    it('increments suffix when (1) already exists', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test Content Item', language: 'en',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const contentsResponse = {
        children: [
          { content: { name: 'Test Content Item' } },
          { content: { name: 'Test Content Item (1)' } },
        ],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.method === 'GET' && opts.path.includes('/contents')) return contentsResponse;
        if (opts.method === 'COPY') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const item = await createContentItem(dto, http, 10, resolver, templateElements, typeRegistry);
      await item.duplicate();

      const copyCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'COPY',
      );
      const body = (copyCall![0] as { body: { contents: Record<string, Array<{ name: string }>> } }).body;
      expect(body.contents['100'][0].name).toBe('Test Content Item (2)');
    });

    it('duplicates to different section with original name', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test Content Item', language: 'en',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.method === 'COPY') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const item = await createContentItem(dto, http, 10, resolver, templateElements, typeRegistry);
      await item.duplicate(500);

      const copyCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'COPY',
      );
      const body = (copyCall![0] as { body: { source: number; destination: number; contents: Record<string, Array<{ name: string }>> } }).body;
      expect(body.source).toBe(10);
      expect(body.destination).toBe(500);
      expect(body.contents['100'][0].name).toBe('Test Content Item');
      // Should NOT fetch the contents list
      const contentsCalls = (http.request as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c: unknown[]) => (c[0] as { path: string }).path.includes('/contents'),
      );
      expect(contentsCalls).toHaveLength(0);
    });

    it('uses the item language in the COPY request', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'fr',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
        if (opts.method === 'COPY') return undefined;
        return ELEMENT_TYPES;
      });

      const item = await createContentItem(dto, http, 10, resolver, templateElements, typeRegistry);
      await item.duplicate(500);

      const copyCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'COPY',
      );
      expect((copyCall![0] as { path: string }).path).toBe('/content/fr');
      const body = (copyCall![0] as { body: { contents: Record<string, Array<{ language: string }>> } }).body;
      expect(body.contents['100'][0].language).toBe('fr');
    });
  });

  describe('move()', () => {
    it('sends MOVE /content/{language} with source, destination, and contents', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'en',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
        if (opts.method === 'MOVE') return undefined;
        return ELEMENT_TYPES;
      });

      const item = await createContentItem(dto, http, 10, resolver, templateElements, typeRegistry);
      await item.move(500);

      const moveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'MOVE',
      );
      expect(moveCall).toBeDefined();
      const body = (moveCall![0] as { body: { source: number; destination: number; contents: Record<string, unknown[]> } }).body;
      expect(body.source).toBe(10);
      expect(body.destination).toBe(500);
      expect(body.contents).toEqual({ '100': [] });
      expect((moveCall![0] as { path: string }).path).toBe('/content/en');
    });

    it('uses the item language in the MOVE request', async () => {
      const dto: ContentDTO = {
        id: 100, contentTypeID: 44, name: 'Test', language: 'fr',
        status: 0, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
        if (opts.method === 'MOVE') return undefined;
        return ELEMENT_TYPES;
      });

      const item = await createContentItem(dto, http, 10, resolver, templateElements, typeRegistry);
      await item.move(500);

      const moveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'MOVE',
      );
      expect((moveCall![0] as { path: string }).path).toBe('/content/fr');
    });
  });
});
