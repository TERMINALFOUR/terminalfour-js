import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageLayoutResource } from '../src/resources/page-layout-resource.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

describe('PageLayoutResource', () => {
  let http: HttpClient;
  let resource: PageLayoutResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new PageLayoutResource(http);
  });

  it('list() returns page layouts with id, name, description', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 5, name: 'Homepage', description: 'Sample Site Homepage' },
      { id: 6, name: 'Inner Page', description: 'Inner page layout' },
    ]);

    const layouts = await resource.list();

    expect(layouts).toHaveLength(2);
    expect(layouts[0]).toEqual({ id: 5, name: 'Homepage', description: 'Sample Site Homepage' });
    expect(layouts[1]).toEqual({ id: 6, name: 'Inner Page', description: 'Inner page layout' });
  });

  it('list() calls GET /pageLayout', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    await resource.list();
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/pageLayout' });
  });

  it('list() decodes HTML entities', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 10, name: 'HC page', description: 'Test &amp; Describe' },
    ]);

    const layouts = await resource.list();
    expect(layouts[0].description).toBe('Test & Describe');
  });

  it('get() returns a mutable PageLayout with resolved syntax and processor', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/pageLayout/10750') return {
        id: 10750, name: 'HC page', description: 'Test &amp; Describe',
        headerCode: '<html>', footerCode: '</html>', stylesheetCode: '',
        fileExtension: '', syntaxType: 3, layoutProcessor: 1,
      };
      if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }, { id: 1, name: 'Javascript' }];
      if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }, { id: 15, name: 'Handlebars Page' }];
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const layout = await resource.get(10750);

    expect(layout.id).toBe(10750);
    expect(layout.name).toBe('HC page');
    expect(layout.description).toBe('Test & Describe');
    expect(layout.headerCode).toBe('<html>');
    expect(layout.footerCode).toBe('</html>');
    expect(layout.syntax).toBe('HTML/XML');
    expect(layout.processor).toBe('t4-tags');
  });

  it('PageLayout.save() sends PUT with resolved syntax and processor IDs', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/pageLayout/5') return {
        id: 5, name: 'Homepage', description: '', headerCode: '<html>', footerCode: '</html>',
        stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
      };
      if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }, { id: 1, name: 'Javascript' }];
      if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }, { id: 15, name: 'Handlebars Page' }];
      if (opts.method === 'PUT' && opts.path === '/pageLayout/5') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const layout = await resource.get(5);
    layout.headerCode = '<html lang="en">';
    layout.syntax = 'Javascript';
    await layout.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = putCall![0] as { body: Record<string, unknown> };
    expect(body.body.headerCode).toBe('<html lang="en">');
    expect(body.body.syntaxType).toBe('1');
  });

  it('update() immutably updates a page layout', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/pageLayout/5') return {
        id: 5, name: 'Old', description: '', headerCode: '', footerCode: '',
        stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
      };
      if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
      if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
      if (opts.method === 'PUT') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const layout = await resource.update(5, { name: 'Updated' });
    expect(layout.name).toBe('Updated');
  });

  it('create() sends POST and returns a PageLayout', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
      if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }, { id: 15, name: 'Handlebars Page' }];
      if (opts.method === 'POST' && opts.path === '/pageLayout') return {
        id: 11781, name: 'New Layout', description: 'Desc',
        headerCode: '<html>', footerCode: '</html>', syntaxType: 3, layoutProcessor: 15,
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const layout = await resource.create({
      name: 'New Layout',
      description: 'Desc',
      headerCode: '<html>',
      footerCode: '</html>',
    });

    expect(layout.id).toBe(11781);
    expect(layout.name).toBe('New Layout');
    expect(layout.processor).toBe('handlebars');

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = postCall![0] as { body: Record<string, unknown> };
    expect(body.body.layoutProcessor).toBe('15');
    expect(body.body.syntaxType).toBe('3');
  });

  it('create() throws if name is empty', async () => {
    await expect(resource.create({ name: '' })).rejects.toThrow('name is required');
  });

  describe('group / visibility', () => {
    it('get() reads primaryGroup and sharedGroups', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
          stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
          primaryGroup: { id: 1, group: { id: 1 } }, sharedGroups: [{ id: 34 }, { id: 40 }],
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const layout = await resource.get(5);
      expect(layout.primaryGroup).toBe(1);
      expect(layout.sharedGroups).toEqual([34, 40]);
    });

    it('get() defaults to 0 / [] when groups are absent', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
          stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const layout = await resource.get(5);
      expect(layout.primaryGroup).toBe(0);
      expect(layout.sharedGroups).toEqual([]);
    });

    it('save() writes primaryGroup and sharedGroups in API shape', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
          stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
          primaryGroup: { id: 0 }, sharedGroups: [],
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
        if (opts.method === 'PUT' && opts.path === '/pageLayout/5') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const layout = await resource.get(5);
      layout.primaryGroup = 35;
      layout.sharedGroups = [34, 40];
      await layout.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = putCall![0] as { body: Record<string, unknown> };
      expect(body.body.primaryGroup).toEqual({ id: 35 });
      expect(body.body.sharedGroups).toEqual([{ id: 34 }, { id: 40 }]);
    });

    it('save() writes { id: null } when primaryGroup is cleared to 0', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
          stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
          primaryGroup: { id: 35 }, sharedGroups: [{ id: 34 }],
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
        if (opts.method === 'PUT') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const layout = await resource.get(5);
      layout.primaryGroup = 0;
      layout.sharedGroups = [];
      await layout.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = putCall![0] as { body: Record<string, unknown> };
      expect(body.body.primaryGroup).toEqual({ id: null });
      expect(body.body.sharedGroups).toEqual([]);
    });

    it('update() sets primaryGroup and sharedGroups', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
          stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
          primaryGroup: { id: 0 }, sharedGroups: [],
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
        if (opts.method === 'PUT') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const layout = await resource.update(5, { primaryGroup: 35, sharedGroups: [34] });
      expect(layout.primaryGroup).toBe(35);
      expect(layout.sharedGroups).toEqual([34]);

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = putCall![0] as { body: Record<string, unknown> };
      expect(body.body.primaryGroup).toEqual({ id: 35 });
      expect(body.body.sharedGroups).toEqual([{ id: 34 }]);
    });

    it('create() sends primaryGroup and sharedGroups', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 15, name: 'Handlebars Page' }];
        if (opts.method === 'POST' && opts.path === '/pageLayout') return {
          id: 900, name: 'Grouped', description: '', headerCode: '', footerCode: '',
          syntaxType: 3, layoutProcessor: 15, primaryGroup: { id: 35 }, sharedGroups: [{ id: 34 }],
        };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const layout = await resource.create({ name: 'Grouped', primaryGroup: 35, sharedGroups: [34] });
      expect(layout.primaryGroup).toBe(35);
      expect(layout.sharedGroups).toEqual([34]);

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = postCall![0] as { body: Record<string, unknown> };
      expect(body.body.primaryGroup).toEqual({ id: 35 });
      expect(body.body.sharedGroups).toEqual([{ id: 34 }]);
    });

    it('save() throws when sharedGroups contains primaryGroup, without a PUT', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
          stylesheetCode: '', fileExtension: '', syntaxType: 3, layoutProcessor: 1,
          primaryGroup: { id: 0 }, sharedGroups: [],
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }];
        if (opts.method === 'PUT') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const layout = await resource.get(5);
      layout.primaryGroup = 35;
      layout.sharedGroups = [34, 35];
      await expect(layout.save()).rejects.toThrow('sharedGroups cannot contain the primaryGroup id (35)');

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeUndefined();
    });

    it('create() throws when sharedGroups contains primaryGroup', async () => {
      await expect(
        resource.create({ name: 'Bad', primaryGroup: 35, sharedGroups: [35] }),
      ).rejects.toThrow('sharedGroups cannot contain the primaryGroup id (35)');
    });
  });

  describe('name validation guard', () => {
    function setupGet() {
      const calls: Array<{ method: string; path: string }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        calls.push(opts);
        if (opts.path === '/pageLayout/5') return {
          id: 5, name: 'HC page', description: '',
          headerCode: '<html>', footerCode: '</html>', stylesheetCode: '',
          fileExtension: '', syntaxType: 3, layoutProcessor: 1,
        };
        if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }, { id: 1, name: 'Javascript' }];
        if (opts.path === '/publishProcessor/10') return [{ id: 1, name: 'T4 Tag Page' }, { id: 15, name: 'Handlebars Page' }];
        if (opts.method === 'PUT' && opts.path === '/pageLayout/5') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });
      return calls;
    }

    it('update(id, { name: "" }) rejects and sends no PUT', async () => {
      const calls = setupGet();
      await expect(resource.update(5, { name: '' })).rejects.toThrow('Page layout name is required');
      expect(calls.find((c) => c.method === 'PUT')).toBeUndefined();
    });

    it('get() then name = "" then save() rejects and sends no PUT', async () => {
      const calls = setupGet();
      const layout = await resource.get(5);
      layout.name = '   ';
      await expect(layout.save()).rejects.toThrow('Page layout name is required');
      expect(calls.find((c) => c.method === 'PUT')).toBeUndefined();
    });
  });
});
