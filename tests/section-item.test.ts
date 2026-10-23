import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionItem } from '../src/models/section-item.js';
import { HttpClient } from '../src/http-client.js';
import { invalidateAllCaches } from '../src/utils.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

/**
 * Finds the `PUT /hierarchy/...` section-write call among the mocked requests.
 * `save()` first fetches `GET /validationrule/section` (issue #49), so the PUT
 * is no longer guaranteed to be the first call — locate it by predicate.
 */
function findPut(http: HttpClient): { method: string; path: string; body: Record<string, any> } {
  const calls = (http.request as ReturnType<typeof vi.fn>).mock.calls;
  const put = calls.map((c) => c[0]).find((o) => o.method === 'PUT' && String(o.path).startsWith('/hierarchy/'));
  if (!put) throw new Error('No PUT /hierarchy request was made');
  return put;
}

// The section validation-rules cache is keyed by HttpClient instance and
// respects the global cache epoch. Bump the epoch before each test so a mocked
// rule set from one test never leaks into the next (each test uses a fresh
// mock HttpClient, but belt-and-braces).
beforeEach(() => {
  invalidateAllCaches();
});

const rawSection = {
  id: 233,
  name: 'Home',
  parent: 100,
  show: true,
  status: 0,
  channels: [{ id: 1, pageLayout: 5 }],
};

describe('SectionItem', () => {
  it('sets properties from raw API data', () => {
    const http = mockHttpClient();
    const item = new SectionItem(rawSection, http, 'en');

    expect(item.id).toBe(233);
    expect(item.parentId).toBe(100);
    expect(item.name).toBe('Home');
    expect(item.show).toBe(true);
    expect(item.status).toBe('approved');
  });

  it('maps status codes to friendly strings', () => {
    const http = mockHttpClient();

    expect(new SectionItem({ ...rawSection, status: 0 }, http, 'en').status).toBe('approved');
    expect(new SectionItem({ ...rawSection, status: 1 }, http, 'en').status).toBe('pending');
    expect(new SectionItem({ ...rawSection, status: 2 }, http, 'en').status).toBe('inactive');
  });

  it('mirrorOf and mirrorOfPath are null for a non-mirror section', () => {
    const http = mockHttpClient();
    const item = new SectionItem(rawSection, http, 'en');
    expect(item.mirrorOf).toBeNull();
    expect(item.mirrorOfPath).toBeNull();
  });

  it('exposes mirrorOf and decoded mirrorOfPath for a mirror section', () => {
    const http = mockHttpClient();
    const item = new SectionItem(
      {
        ...rawSection,
        id: 8820,
        mirrorOf: 8817,
        sourceOfMirror: false,
        mirrorOfPath: 'Home &raquo; samplesite.terminalfour.com &raquo; Doc Example',
      },
      http,
      'en',
    );
    expect(item.mirrorOf).toBe(8817);
    expect(item.mirrorOfPath).toBe('Home \u00BB samplesite.terminalfour.com \u00BB Doc Example');
  });

  it('treats mirrorOf of 0 as not a mirror', () => {
    const http = mockHttpClient();
    const item = new SectionItem({ ...rawSection, mirrorOf: 0, mirrorOfPath: '' }, http, 'en');
    expect(item.mirrorOf).toBeNull();
    expect(item.mirrorOfPath).toBeNull();
  });

  it('allows mutable name', () => {
    const http = mockHttpClient();
    const item = new SectionItem(rawSection, http, 'en');

    item.name = 'New Name';
    expect(item.name).toBe('New Name');
  });

  it('allows mutable show', () => {
    const http = mockHttpClient();
    const item = new SectionItem(rawSection, http, 'en');

    item.show = false;
    expect(item.show).toBe(false);
  });

  it('allows mutable status', () => {
    const http = mockHttpClient();
    const item = new SectionItem(rawSection, http, 'en');

    item.status = 'pending';
    expect(item.status).toBe('pending');
  });

  describe('save()', () => {
    it('rejects when name is empty and sends no request', async () => {
      const http = mockHttpClient();

      const item = new SectionItem(rawSection, http, 'en');
      item.name = '';
      await expect(item.save()).rejects.toThrow('Section name is required');

      expect(http.request).not.toHaveBeenCalled();
    });

    it('rejects when name is whitespace-only and sends no request', async () => {
      const http = mockHttpClient();

      const item = new SectionItem(rawSection, http, 'en');
      item.name = '   ';
      await expect(item.save()).rejects.toThrow('Section name is required');

      expect(http.request).not.toHaveBeenCalled();
    });

    it('sends PUT with full section body and updated name', async () => {
      const http = mockHttpClient();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const item = new SectionItem(rawSection, http, 'en');
      item.name = 'Updated';
      await item.save();

      const put = findPut(http);
      expect(put.method).toBe('PUT');
      expect(put.path).toBe('/hierarchy/233/en');
      expect(put.body.name).toBe('Updated');
      expect(put.body.channels).toEqual(rawSection.channels);
    });

    it('maps status back to code on save', async () => {
      const http = mockHttpClient();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const item = new SectionItem(rawSection, http, 'en');
      item.status = 'pending';
      await item.save();

      expect(findPut(http).body.status).toBe('1');
    });

    it('preserves all other section properties', async () => {
      const http = mockHttpClient();
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const item = new SectionItem(rawSection, http, 'en');
      item.show = false;
      await item.save();

      const body = findPut(http).body;
      expect(body.show).toBe(false);
      expect(body.id).toBe(233);
      expect(body.parent).toBe(100);
    });
  });

  describe('customFields', () => {
    it('defaults to null when not provided', () => {
      const http = mockHttpClient();
      const item = new SectionItem(rawSection, http, 'en');
      expect(item.customFields).toBeNull();
    });

    it('stores custom fields when provided', () => {
      const http = mockHttpClient();
      const item = new SectionItem(rawSection, http, 'en', { Title: 'Hello' });
      expect(item.customFields).toEqual({ Title: 'Hello' });
    });

    it('stores null when explicitly passed null', () => {
      const http = mockHttpClient();
      const item = new SectionItem(rawSection, http, 'en', null);
      expect(item.customFields).toBeNull();
    });
  });

  describe('save() with customFields', () => {
    const rawWithMeta = {
      ...rawSection,
      metaData: { id: 42, type: 75, enabled: true, active: true },
    };

    it('should update existing metadata content when customFields change', async () => {
      const http = mockHttpClient();
      const calls: Array<{ method: string; path: string; body?: unknown }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        calls.push(opts);
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.method === 'GET' && opts.path === '/content/233/42/en') {
          return { id: 42, contentTypeID: 75, name: '', elements: { 'Title#2:1': 'Old' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') {
          return { contentType: { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] }, channels: [], canPublishNow: true, canSaveAndApprove: true };
        }
        if (opts.method === 'GET' && opts.path === '/contenttype/75') {
          return { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] };
        }
        if (opts.method === 'POST' && opts.path === '/content/233/42/en') {
          return { id: 42, contentTypeID: 75, name: '', elements: { 'Title#2:1': 'Updated' }, version: 2, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const item = new SectionItem(rawWithMeta, http, 'en', { Title: 'Old' });
      item.customFields!['Title'] = 'Updated';
      await item.save();

      const contentUpdate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/42/en');
      expect(contentUpdate).toBeDefined();
    });

    it('should not update metadata content when customFields are unchanged', async () => {
      const http = mockHttpClient();
      const calls: Array<{ method: string; path: string }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        calls.push(opts);
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        return undefined;
      });

      const item = new SectionItem(rawWithMeta, http, 'en', { Title: 'Same' });
      await item.save();

      const contentCalls = calls.filter((c) => c.path.startsWith('/content'));
      expect(contentCalls).toHaveLength(0);
    });

    it('should create metadata content when metaData.id is 0 and customFields are set', async () => {
      const rawWithMetaNoContent = {
        ...rawSection,
        metaData: { id: 0, type: 75, enabled: true, active: true },
      };
      const http = mockHttpClient();
      const calls: Array<{ method: string; path: string; body?: unknown }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        calls.push(opts);
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') {
          return { contentType: { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] }, channels: [], canPublishNow: true, canSaveAndApprove: true };
        }
        if (opts.method === 'GET' && opts.path === '/contenttype/75') {
          return { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] };
        }
        if (opts.method === 'POST' && opts.path === '/content/233/en') {
          return { id: 999, contentTypeID: 75, name: '', elements: { 'Title#2:1': 'New' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const item = new SectionItem(rawWithMetaNoContent, http, 'en', null);
      item.customFields = { Title: 'New' };
      await item.save();

      const contentCreate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/en');
      expect(contentCreate).toBeDefined();
    });

    it('should set the created metadata content Name to the section name', async () => {
      const rawWithMetaNoContent = {
        ...rawSection,
        metaData: { id: 0, type: 75, enabled: true, active: true },
      };
      const http = mockHttpClient();
      const calls: Array<{ method: string; path: string; body?: unknown }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        calls.push(opts);
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') {
          return { contentType: { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] }, channels: [], canPublishNow: true, canSaveAndApprove: true };
        }
        if (opts.method === 'GET' && opts.path === '/contenttype/75') {
          return { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] };
        }
        if (opts.method === 'POST' && opts.path === '/content/233/en') {
          const body = opts.body as { name: string; elements: Record<string, unknown> };
          return { id: 999, contentTypeID: 75, name: body.name, elements: body.elements, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const item = new SectionItem(rawWithMetaNoContent, http, 'en', null);
      item.customFields = { Title: 'New' };
      await item.save();

      const contentCreate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/en');
      const body = (contentCreate as { body: { name: string; elements: Record<string, unknown> } }).body;
      expect(body.name).toBe('Home');
      expect(body.elements['Name#1:1']).toBe('Home');
    });

    it('should exclude the Name element from customFields after save', async () => {
      const http = mockHttpClient();
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.method === 'GET' && opts.path === '/content/233/42/en') {
          return { id: 42, contentTypeID: 75, name: 'Home', elements: { 'Name#1:1': 'Home', 'Title#2:1': 'Old' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') {
          return { contentType: { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] }, channels: [], canPublishNow: true, canSaveAndApprove: true };
        }
        if (opts.method === 'GET' && opts.path === '/contenttype/75') {
          return { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] };
        }
        if (opts.method === 'POST' && opts.path === '/content/233/42/en') {
          return { id: 42, contentTypeID: 75, name: 'Home', elements: { 'Name#1:1': 'Home', 'Title#2:1': 'Updated' }, version: 2, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const item = new SectionItem(rawWithMeta, http, 'en', { Title: 'Old' });
      item.customFields!['Title'] = 'Updated';
      await item.save();

      expect(item.customFields).not.toHaveProperty('Name');
      expect(item.customFields?.Title).toBe('Updated');
    });

    it('should throw when no metadata type is configured system-wide', async () => {
      const rawNoMeta = { ...rawSection };
      const http = mockHttpClient();
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '0' };
        return undefined;
      });

      const item = new SectionItem(rawNoMeta, http, 'en', null);
      item.customFields = { Title: 'Test' };

      await expect(item.save()).rejects.toThrow('Cannot save customFields');
    });

    it('should fall back to the instance metadata type when the section has none', async () => {
      // rawSection has no metaData, so metaData.type resolves to 0 and the
      // config fallback supplies the content type ID.
      const rawNoMeta = { ...rawSection };
      const http = mockHttpClient();
      const calls: Array<{ method: string; path: string; body?: unknown }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        calls.push(opts);
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '75' };
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') {
          return { contentType: { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] }, channels: [], canPublishNow: true, canSaveAndApprove: true };
        }
        if (opts.method === 'GET' && opts.path === '/contenttype/75') {
          return { id: 75, contentTypeElements: [{ id: 1, name: 'Name', type: 1, sequence: 0 }, { id: 2, name: 'Title', type: 1, sequence: 1 }] };
        }
        if (opts.method === 'POST' && opts.path === '/content/233/en') {
          const body = opts.body as { name: string; elements: Record<string, unknown> };
          return { id: 555, contentTypeID: 75, name: body.name, elements: body.elements, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const item = new SectionItem(rawNoMeta, http, 'en', null);
      item.customFields = { Title: 'Test' };
      await item.save();

      const contentCreate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/en');
      expect(contentCreate).toBeDefined();
      expect(item.customFields?.Title).toBe('Test');
    });

    it('should not persist customFields when they are null', async () => {
      const http = mockHttpClient();
      const calls: Array<{ method: string; path: string }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        calls.push(opts);
        return undefined;
      });

      const item = new SectionItem(rawWithMeta, http, 'en', null);
      await item.save();

      const contentCalls = calls.filter((c) => c.path.startsWith('/content'));
      expect(contentCalls).toHaveLength(0);
    });
  });
});

describe('SectionItem — read-only guard', () => {
  it('save() throws on a mirrored section and makes no write', async () => {
    const http = mockHttpClient();
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      throw new Error('No request should be made');
    });
    const item = new SectionItem(
      { ...rawSection, mirrorOf: 8817 },
      http,
      'en',
    );
    item.name = 'Changed';
    await expect(item.save()).rejects.toThrow(
      /Cannot modify section 233: it is a mirror of section 8817/,
    );
    expect((http.request as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it('save() is allowed on a non-mirror section', async () => {
    const http = mockHttpClient();
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const item = new SectionItem(rawSection, http, 'en');
    item.name = 'Changed';
    await expect(item.save()).resolves.toBeUndefined();
  });
});

describe('SectionItem — length validation (#49)', () => {
  const SECTION_RULES = {
    name: [{ msgTemplate: 'notBlank', required: true }, { msgTemplate: 'maxLength', maxLength: 50 }],
    'file-name': [{ msgTemplate: 'maxLength', maxLength: 50, required: false }],
    'output-uri': [{ msgTemplate: 'maxLength', maxLength: 50, required: false }],
    seo: [{ msgTemplate: 'maxLength', maxLength: 600, required: false }],
  };

  /** Mocks GET /validationrule/section; everything else resolves undefined. */
  function withRules(http: HttpClient, rules: unknown = SECTION_RULES): Array<{ method: string; path: string }> {
    const calls: Array<{ method: string; path: string }> = [];
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      calls.push(opts);
      if (opts.path === '/validationrule/section') return rules;
      return undefined;
    });
    return calls;
  }

  it('rejects an over-length name before writing', async () => {
    const http = mockHttpClient();
    const calls = withRules(http);
    const item = new SectionItem(rawSection, http, 'en');
    item.name = 'x'.repeat(51);

    await expect(item.save()).rejects.toThrow(
      'Section name is too long (51 characters). The maximum is 50.',
    );
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('rejects an over-length filename before writing', async () => {
    const http = mockHttpClient();
    const calls = withRules(http);
    const item = new SectionItem(rawSection, http, 'en');
    item.filename = 'f'.repeat(51);

    await expect(item.save()).rejects.toThrow(
      'Section filename is too long (51 characters). The maximum is 50.',
    );
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('rejects an over-length output URI before writing', async () => {
    const http = mockHttpClient();
    const calls = withRules(http);
    const item = new SectionItem(rawSection, http, 'en');
    item.outputUri = 'o'.repeat(51);

    await expect(item.save()).rejects.toThrow(
      'Section output URI is too long (51 characters). The maximum is 50.',
    );
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('allows values exactly at the limit', async () => {
    const http = mockHttpClient();
    withRules(http);
    const item = new SectionItem(rawSection, http, 'en');
    item.name = 'n'.repeat(50);
    item.filename = 'f'.repeat(50);
    item.outputUri = 'o'.repeat(50);

    await expect(item.save()).resolves.toBeUndefined();
  });

  it('measures length in UTF-16 units (an emoji counts as 2)', async () => {
    const http = mockHttpClient();
    withRules(http);
    const item = new SectionItem(rawSection, http, 'en');
    // 25 emoji = 50 UTF-16 code units — at the limit, allowed.
    item.name = '\u{1F600}'.repeat(25);
    await expect(item.save()).resolves.toBeUndefined();

    // 26 emoji = 52 units — over the limit.
    item.name = '\u{1F600}'.repeat(26);
    await expect(item.save()).rejects.toThrow(
      'Section name is too long (52 characters). The maximum is 50.',
    );
  });

  it('skips validation when the rules fetch fails (server is the backstop)', async () => {
    const http = mockHttpClient();
    const calls: Array<{ method: string; path: string }> = [];
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      calls.push(opts);
      if (opts.path === '/validationrule/section') throw new Error('500');
      return undefined;
    });
    const item = new SectionItem(rawSection, http, 'en');
    item.name = 'x'.repeat(100);

    await expect(item.save()).resolves.toBeUndefined();
    expect(calls.some((c) => c.method === 'PUT')).toBe(true);
  });

  it('skips a field with no maxLength rule', async () => {
    const http = mockHttpClient();
    withRules(http, { name: [{ msgTemplate: 'notBlank', required: true }] });
    const item = new SectionItem(rawSection, http, 'en');
    item.name = 'x'.repeat(100);

    await expect(item.save()).resolves.toBeUndefined();
  });
});
