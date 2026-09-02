import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Handlebars, HandlebarsItem, HandlebarsContentResource } from '../src/handlebars.js';
import { HttpClient } from '../src/http-client.js';
import { ContentDTO } from '../src/types.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

// ── Helpers config ──
const HELPERS_SECTION_ID = 7777;
const HELPERS_CONTENT_TYPE_ID = 298;

const helpersConfigSectionResponse = {
  options: [{ name: 'handlebars.helpersSectionId', type: 'integer', value: '7777' }],
};
const helpersConfigContentTypeResponse = {
  options: [{ name: 'handlebars.helpersContentTypeId', type: 'integer', value: '298' }],
};
const helpersTemplateResponse = {
  contentType: {
    id: HELPERS_CONTENT_TYPE_ID,
    contentTypeElements: [
      { id: 1, name: 'Name', type: 1, sequence: 1 },
      { id: 5, name: 'Function Code', type: 3, sequence: 2 },
    ],
  },
  channels: [1],
};

// ── Partials config ──
const PARTIALS_SECTION_ID = 8888;
const PARTIALS_CONTENT_TYPE_ID = 299;

const partialsConfigSectionResponse = {
  options: [{ name: 'handlebars.partialsSectionId', type: 'integer', value: '8888' }],
};
const partialsConfigContentTypeResponse = {
  options: [{ name: 'handlebars.partialsContentTypeId', type: 'integer', value: '299' }],
};
const partialsTemplateResponse = {
  contentType: {
    id: PARTIALS_CONTENT_TYPE_ID,
    contentTypeElements: [
      { id: 1, name: 'Name', type: 1, sequence: 1 },
      { id: 6, name: 'Code', type: 3, sequence: 2 },
    ],
  },
  channels: [1],
};

// ── Shared DTOs ──
const helperDTO: ContentDTO = {
  id: 100,
  contentTypeID: HELPERS_CONTENT_TYPE_ID,
  name: 'formatDate',
  language: 'en',
  status: 0,
  elements: {
    'Name#1:1': 'formatDate',
    'Function Code#5:3': 'module.exports = function(date) { return date; }',
  },
  version: 1,
  owner: { id: 0, type: 'USER' },
  channels: [1],
  lastModified: 1700000000000,
};

const partialDTO: ContentDTO = {
  id: 200,
  contentTypeID: PARTIALS_CONTENT_TYPE_ID,
  name: 'header',
  language: 'en',
  status: 0,
  elements: {
    'Name#1:1': 'header',
    'Code#6:3': '<header><h1>{{title}}</h1></header>',
  },
  version: 1,
  owner: { id: 0, type: 'USER' },
  channels: [1],
  lastModified: 1700000001000,
};

function setupMocks(http: HttpClient) {
  (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
    // ── Helpers config ──
    if (opts.method === 'POST' && opts.path === '/config/handlebars.helpersSectionId') return helpersConfigSectionResponse;
    if (opts.method === 'POST' && opts.path === '/config/handlebars.helpersContentTypeId') return helpersConfigContentTypeResponse;
    if (opts.path === `/content/type/${HELPERS_CONTENT_TYPE_ID}/${HELPERS_SECTION_ID}`) return helpersTemplateResponse;

    // ── Partials config ──
    if (opts.method === 'POST' && opts.path === '/config/handlebars.partialsSectionId') return partialsConfigSectionResponse;
    if (opts.method === 'POST' && opts.path === '/config/handlebars.partialsContentTypeId') return partialsConfigContentTypeResponse;
    if (opts.path === `/content/type/${PARTIALS_CONTENT_TYPE_ID}/${PARTIALS_SECTION_ID}`) return partialsTemplateResponse;

    // ── Helpers content ──
    if (opts.method === 'GET' && opts.path.includes(`/hierarchy/${HELPERS_SECTION_ID}/en/contents`)) {
      return { children: [{ id: helperDTO.id, content: helperDTO, printSequence: 1, sortLock: 'UNLOCKED' }], sortType: 0 };
    }
    if (opts.method === 'GET' && opts.path === `/content/${HELPERS_SECTION_ID}/100/en`) return helperDTO;
    if (opts.method === 'POST' && opts.path === `/content/${HELPERS_SECTION_ID}/en`) return helperDTO;
    if (opts.method === 'POST' && opts.path === `/content/${HELPERS_SECTION_ID}/100/en`) {
      const body = opts.body as Record<string, unknown>;
      return { ...helperDTO, name: body.name, elements: body.elements, version: 2, lastModified: 1700000002000 };
    }

    // ── Partials content ──
    if (opts.method === 'GET' && opts.path.includes(`/hierarchy/${PARTIALS_SECTION_ID}/en/contents`)) {
      return { children: [{ id: partialDTO.id, content: partialDTO, printSequence: 1, sortLock: 'UNLOCKED' }], sortType: 0 };
    }
    if (opts.method === 'GET' && opts.path === `/content/${PARTIALS_SECTION_ID}/200/en`) return partialDTO;
    if (opts.method === 'POST' && opts.path === `/content/${PARTIALS_SECTION_ID}/en`) return partialDTO;
    if (opts.method === 'POST' && opts.path === `/content/${PARTIALS_SECTION_ID}/200/en`) {
      const body = opts.body as Record<string, unknown>;
      return { ...partialDTO, name: body.name, elements: body.elements, version: 2, lastModified: 1700000003000 };
    }

    // ── Delete / Purge ──
    if (opts.method === 'DELETE') return undefined;
    if (opts.method === 'POST' && opts.path === '/content/purge') return undefined;

    throw new Error(`Unexpected request: ${opts.method} ${opts.path}`);
  });
}

describe('Handlebars', () => {
  let http: HttpClient;
  let handlebars: Handlebars;

  beforeEach(() => {
    http = mockHttpClient();
    setupMocks(http);
    handlebars = new Handlebars(http);
  });

  it('exposes helpers and partials resources', () => {
    expect(handlebars.helpers).toBeInstanceOf(HandlebarsContentResource);
    expect(handlebars.partials).toBeInstanceOf(HandlebarsContentResource);
  });

  it('always uses language "en" regardless of client default', async () => {
    // Even though no defaultLanguage is passed, all API calls should use 'en'
    await handlebars.helpers.list();

    const contentCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { path: string }).path.includes('/contents'),
    );
    expect(contentCall).toBeDefined();
    expect((contentCall![0] as { path: string }).path).toContain('/en/');
  });

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  describe('helpers', () => {
    describe('list()', () => {
      it('returns helper summaries', async () => {
        const helpers = await handlebars.helpers.list();
        expect(helpers).toHaveLength(1);
        expect(helpers[0]).toEqual({
          id: 100,
          name: 'formatDate',
          lastModified: new Date(1700000000000),
        });
      });

      it('fetches the section ID from the config endpoint', async () => {
        await handlebars.helpers.list();
        expect(http.request).toHaveBeenCalledWith({
          method: 'POST',
          path: '/config/handlebars.helpersSectionId',
          body: {},
        });
      });

      it('caches the section ID on subsequent calls', async () => {
        await handlebars.helpers.list();
        await handlebars.helpers.list();
        const configCalls = (http.request as ReturnType<typeof vi.fn>).mock.calls.filter(
          (c: unknown[]) => (c[0] as { path: string }).path === '/config/handlebars.helpersSectionId',
        );
        expect(configCalls).toHaveLength(1);
      });
    });

    describe('get()', () => {
      it('returns a mutable HandlebarsItem by ID', async () => {
        const helper = await handlebars.helpers.get(100);
        expect(helper).toBeInstanceOf(HandlebarsItem);
        expect(helper.id).toBe(100);
        expect(helper.name).toBe('formatDate');
        expect(helper.code).toBe('module.exports = function(date) { return date; }');
        expect(helper.lastModified).toEqual(new Date(1700000000000));
      });

      it('resolves by name when a string is passed', async () => {
        const helper = await handlebars.helpers.get('formatDate');
        expect(helper.id).toBe(100);
        expect(helper.name).toBe('formatDate');
      });

      it('throws if name is not found', async () => {
        await expect(handlebars.helpers.get('nonexistent')).rejects.toThrow(
          'Helper "nonexistent" not found',
        );
      });
    });

    describe('create()', () => {
      it('creates a helper with approved status', async () => {
        const helper = await handlebars.helpers.create({
          name: 'newHelper',
          code: 'module.exports = function(date) { return date; }',
        });
        expect(helper).toBeInstanceOf(HandlebarsItem);

        const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${HELPERS_SECTION_ID}/en`;
          },
        );
        const body = (createCall![0] as { body: Record<string, unknown> }).body;
        expect(body.status).toBe(0);
        expect(body.canPublishNow).toBe(true);
        expect(body.canSaveAndApprove).toBe(true);
      });

      it('resolves element keys from the template', async () => {
        await handlebars.helpers.create({ name: 'test', code: 'code' });
        const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${HELPERS_SECTION_ID}/en`;
          },
        );
        const body = (createCall![0] as { body: { elements: Record<string, unknown> } }).body;
        expect(body.elements['Name#1:1']).toBe('test');
        expect(body.elements['Function Code#5:3']).toBe('code');
      });

      it('throws if name is empty', async () => {
        await expect(handlebars.helpers.create({ name: '', code: 'code' })).rejects.toThrow('Helper name is required');
      });

      it('throws if code is empty', async () => {
        await expect(handlebars.helpers.create({ name: 'test', code: '' })).rejects.toThrow('Helper code is required');
      });

      it('throws if a helper with the same name already exists', async () => {
        await expect(handlebars.helpers.create({ name: 'formatDate', code: 'code' })).rejects.toThrow(
          'A helper named "formatDate" already exists (ID: 100)',
        );
      });
    });

    describe('update()', () => {
      it('fetches existing by ID, merges changes, and saves with approved status', async () => {
        const helper = await handlebars.helpers.update(100, { name: 'newName', code: 'new code' });
        expect(helper).toBeInstanceOf(HandlebarsItem);
        expect(helper.name).toBe('newName');

        const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${HELPERS_SECTION_ID}/100/en`;
          },
        );
        const body = (saveCall![0] as { body: Record<string, unknown> }).body;
        expect(body.status).toBe(0);
      });

      it('accepts a name string to resolve the item', async () => {
        const helper = await handlebars.helpers.update('formatDate', { code: 'updated code' });
        expect(helper).toBeInstanceOf(HandlebarsItem);
      });

      it('only updates provided fields', async () => {
        await handlebars.helpers.update(100, { code: 'updated code' });
        const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${HELPERS_SECTION_ID}/100/en`;
          },
        );
        const body = (saveCall![0] as { body: { name: string } }).body;
        expect(body.name).toBe('formatDate');
      });
    });

    describe('delete()', () => {
      it('sends DELETE by ID', async () => {
        await handlebars.helpers.delete(100);
        expect(http.request).toHaveBeenCalledWith({
          method: 'DELETE',
          path: `/content/${HELPERS_SECTION_ID}/100/en`,
        });
      });

      it('resolves by name', async () => {
        await handlebars.helpers.delete('formatDate');
        expect(http.request).toHaveBeenCalledWith({
          method: 'DELETE',
          path: `/content/${HELPERS_SECTION_ID}/100/en`,
        });
      });
    });

    describe('purge()', () => {
      it('sends POST to /content/purge by ID', async () => {
        await handlebars.helpers.purge(100);
        expect(http.request).toHaveBeenCalledWith({
          method: 'POST',
          path: '/content/purge',
          body: { languageCode: 'en', contentIds: ['100'] },
        });
      });

      it('resolves by name', async () => {
        await handlebars.helpers.purge('formatDate');
        expect(http.request).toHaveBeenCalledWith({
          method: 'POST',
          path: '/content/purge',
          body: { languageCode: 'en', contentIds: ['100'] },
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PARTIALS
  // ═══════════════════════════════════════════════════════════

  describe('partials', () => {
    describe('list()', () => {
      it('returns partial summaries', async () => {
        const partials = await handlebars.partials.list();
        expect(partials).toHaveLength(1);
        expect(partials[0]).toEqual({
          id: 200,
          name: 'header',
          lastModified: new Date(1700000001000),
        });
      });

      it('fetches the section ID from the partials config endpoint', async () => {
        await handlebars.partials.list();
        expect(http.request).toHaveBeenCalledWith({
          method: 'POST',
          path: '/config/handlebars.partialsSectionId',
          body: {},
        });
      });

      it('caches the section ID on subsequent calls', async () => {
        await handlebars.partials.list();
        await handlebars.partials.list();
        const configCalls = (http.request as ReturnType<typeof vi.fn>).mock.calls.filter(
          (c: unknown[]) => (c[0] as { path: string }).path === '/config/handlebars.partialsSectionId',
        );
        expect(configCalls).toHaveLength(1);
      });
    });

    describe('get()', () => {
      it('returns a mutable HandlebarsItem by ID', async () => {
        const partial = await handlebars.partials.get(200);
        expect(partial).toBeInstanceOf(HandlebarsItem);
        expect(partial.id).toBe(200);
        expect(partial.name).toBe('header');
        expect(partial.code).toBe('<header><h1>{{title}}</h1></header>');
        expect(partial.lastModified).toEqual(new Date(1700000001000));
      });

      it('resolves by name when a string is passed', async () => {
        const partial = await handlebars.partials.get('header');
        expect(partial.id).toBe(200);
        expect(partial.name).toBe('header');
      });

      it('throws if name is not found', async () => {
        await expect(handlebars.partials.get('nonexistent')).rejects.toThrow(
          'Partial "nonexistent" not found',
        );
      });
    });

    describe('create()', () => {
      it('creates a partial with approved status', async () => {
        const partial = await handlebars.partials.create({
          name: 'newPartial',
          code: '<header><h1>{{title}}</h1></header>',
        });
        expect(partial).toBeInstanceOf(HandlebarsItem);

        const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${PARTIALS_SECTION_ID}/en`;
          },
        );
        const body = (createCall![0] as { body: Record<string, unknown> }).body;
        expect(body.status).toBe(0);
      });

      it('resolves element keys from the partials template', async () => {
        await handlebars.partials.create({ name: 'footer', code: '<footer/>' });
        const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${PARTIALS_SECTION_ID}/en`;
          },
        );
        const body = (createCall![0] as { body: { elements: Record<string, unknown> } }).body;
        expect(body.elements['Name#1:1']).toBe('footer');
        expect(body.elements['Code#6:3']).toBe('<footer/>');
      });

      it('throws if name is empty', async () => {
        await expect(handlebars.partials.create({ name: '', code: 'code' })).rejects.toThrow('Partial name is required');
      });

      it('throws if code is empty', async () => {
        await expect(handlebars.partials.create({ name: 'test', code: '' })).rejects.toThrow('Partial code is required');
      });

      it('throws if a partial with the same name already exists', async () => {
        await expect(handlebars.partials.create({ name: 'header', code: 'code' })).rejects.toThrow(
          'A partial named "header" already exists (ID: 200)',
        );
      });
    });

    describe('update()', () => {
      it('fetches existing by ID, merges changes, and saves with approved status', async () => {
        const partial = await handlebars.partials.update(200, { name: 'newHeader', code: '<header>new</header>' });
        expect(partial).toBeInstanceOf(HandlebarsItem);
        expect(partial.name).toBe('newHeader');

        const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${PARTIALS_SECTION_ID}/200/en`;
          },
        );
        const body = (saveCall![0] as { body: Record<string, unknown> }).body;
        expect(body.status).toBe(0);
      });

      it('accepts a name string to resolve the item', async () => {
        const partial = await handlebars.partials.update('header', { code: 'updated' });
        expect(partial).toBeInstanceOf(HandlebarsItem);
      });

      it('only updates provided fields', async () => {
        await handlebars.partials.update(200, { code: 'updated' });
        const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${PARTIALS_SECTION_ID}/200/en`;
          },
        );
        const body = (saveCall![0] as { body: { name: string } }).body;
        expect(body.name).toBe('header');
      });
    });

    describe('delete()', () => {
      it('sends DELETE by ID', async () => {
        await handlebars.partials.delete(200);
        expect(http.request).toHaveBeenCalledWith({
          method: 'DELETE',
          path: `/content/${PARTIALS_SECTION_ID}/200/en`,
        });
      });

      it('resolves by name', async () => {
        await handlebars.partials.delete('header');
        expect(http.request).toHaveBeenCalledWith({
          method: 'DELETE',
          path: `/content/${PARTIALS_SECTION_ID}/200/en`,
        });
      });
    });

    describe('purge()', () => {
      it('sends POST to /content/purge by ID', async () => {
        await handlebars.partials.purge(200);
        expect(http.request).toHaveBeenCalledWith({
          method: 'POST',
          path: '/content/purge',
          body: { languageCode: 'en', contentIds: ['200'] },
        });
      });

      it('resolves by name', async () => {
        await handlebars.partials.purge('header');
        expect(http.request).toHaveBeenCalledWith({
          method: 'POST',
          path: '/content/purge',
          body: { languageCode: 'en', contentIds: ['200'] },
        });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════
  // HandlebarsItem (shared model)
  // ═══════════════════════════════════════════════════════════

  describe('HandlebarsItem', () => {
    let http: HttpClient;

    beforeEach(() => {
      http = mockHttpClient();
      setupMocks(http);
    });

    describe('save() — helper', () => {
      it('sends the full body with approved status and updates internal state', async () => {
        const item = new HandlebarsItem(helperDTO, http, HELPERS_SECTION_ID, 'en', 'function code');
        item.name = 'updatedName';
        item.code = 'updated code';

        await item.save();

        const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${HELPERS_SECTION_ID}/100/en`;
          },
        );
        const body = (saveCall![0] as { body: Record<string, unknown> }).body;
        expect(body.status).toBe(0);
        expect(body.name).toBe('updatedName');
        expect((body.elements as Record<string, unknown>)['Function Code#5:3']).toBe('updated code');
        expect((body.elements as Record<string, unknown>)['Name#1:1']).toBe('updatedName');
        expect(item.lastModified).toEqual(new Date(1700000002000));
      });
    });

    describe('save() — partial', () => {
      it('sends the full body with approved status using Code element', async () => {
        const item = new HandlebarsItem(partialDTO, http, PARTIALS_SECTION_ID, 'en', 'code');
        item.name = 'updatedHeader';
        item.code = '<header>updated</header>';

        await item.save();

        const saveCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => {
            const o = c[0] as { method: string; path: string };
            return o.method === 'POST' && o.path === `/content/${PARTIALS_SECTION_ID}/200/en`;
          },
        );
        const body = (saveCall![0] as { body: Record<string, unknown> }).body;
        expect(body.status).toBe(0);
        expect((body.elements as Record<string, unknown>)['Code#6:3']).toBe('<header>updated</header>');
        expect((body.elements as Record<string, unknown>)['Name#1:1']).toBe('updatedHeader');
      });
    });

    it('extracts code from elements on construction (helper)', () => {
      const item = new HandlebarsItem(helperDTO, http, HELPERS_SECTION_ID, 'en', 'function code');
      expect(item.code).toBe('module.exports = function(date) { return date; }');
    });

    it('extracts code from elements on construction (partial)', () => {
      const item = new HandlebarsItem(partialDTO, http, PARTIALS_SECTION_ID, 'en', 'code');
      expect(item.code).toBe('<header><h1>{{title}}</h1></header>');
    });

    it('handles missing code element gracefully', () => {
      const dto: ContentDTO = { ...helperDTO, elements: { 'Name#1:1': 'test' } };
      const item = new HandlebarsItem(dto, http, HELPERS_SECTION_ID, 'en', 'function code');
      expect(item.code).toBe('');
    });

    it('throws when multiple items share the same name on get()', async () => {
      // Override the list response to return duplicates
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'POST' && opts.path === '/config/handlebars.helpersSectionId') return helpersConfigSectionResponse;
        if (opts.method === 'GET' && opts.path.includes(`/hierarchy/${HELPERS_SECTION_ID}/en/contents`)) {
          return {
            children: [
              { id: 100, content: { ...helperDTO, id: 100 }, printSequence: 1, sortLock: 'UNLOCKED' },
              { id: 101, content: { ...helperDTO, id: 101 }, printSequence: 2, sortLock: 'UNLOCKED' },
            ],
            sortType: 0,
          };
        }
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const resource = new HandlebarsContentResource(http, {
        sectionIdConfigPath: '/config/handlebars.helpersSectionId',
        sectionIdOptionName: 'handlebars.helpersSectionId',
        contentTypeIdConfigPath: '/config/handlebars.helpersContentTypeId',
        contentTypeIdOptionName: 'handlebars.helpersContentTypeId',
        codeElementName: 'function code',
        displayName: 'Helper',
      });

      await expect(resource.get('formatDate')).rejects.toThrow(
        'Multiple helpers found with name "formatDate" (IDs: 100, 101). Use an ID instead.',
      );
    });
  });
});
