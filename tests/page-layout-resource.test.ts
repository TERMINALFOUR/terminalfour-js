import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PageLayoutResource } from '../src/resources/page-layout-resource.js';
import { HttpClient } from '../src/http-client.js';
import { invalidateAllCaches } from '../src/utils.js';

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

/**
 * Instance-resolved processor, syntax and file extension (issues #56, #57).
 * IDs deliberately avoid the old hardcoded defaults (syntax 3, processor 15)
 * so a passing test proves the value came from the instance lookup.
 */
describe('PageLayoutResource instance lookups (#56, #57)', () => {
  type Call = { method: string; path: string; body?: Record<string, unknown> };

  interface RouteOptions {
    syntaxTypes?: Array<{ id: number; name: string }>;
    processors?: Array<{ id: number; name: string }>;
    extensions?: Array<{ extension: string }> | Error;
    layout?: Record<string, unknown>;
  }

  const DEFAULT_SYNTAX = [{ id: 7, name: 'HTML/XML' }, { id: 8, name: 'Javascript' }];
  const DEFAULT_PROCESSORS = [
    { id: 21, name: 'T4 Tag Page' },
    { id: 42, name: 'Handlebars Page' },
    { id: 63, name: 'Programmable Layout Page' },
  ];
  const DEFAULT_LAYOUT = {
    id: 5, name: 'Homepage', description: '', headerCode: '', footerCode: '',
    stylesheetCode: '', fileExtension: '', syntaxType: 7, layoutProcessor: 21,
  };

  let http: HttpClient;
  let resource: PageLayoutResource;
  let calls: Call[];

  function route(opts: RouteOptions = {}) {
    const extensions = opts.extensions ?? [{ extension: 'html' }, { extension: 'PHP' }];
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (req: Call) => {
      calls.push(req);
      if (req.path === '/syntaxType') return opts.syntaxTypes ?? DEFAULT_SYNTAX;
      if (req.path === '/publishProcessor/10') return opts.processors ?? DEFAULT_PROCESSORS;
      if (req.path === '/fileExtension') {
        if (extensions instanceof Error) throw extensions;
        return extensions;
      }
      if (req.method === 'POST' && req.path === '/pageLayout') {
        return { id: 900, ...req.body, syntaxType: Number(req.body?.syntaxType), layoutProcessor: Number(req.body?.layoutProcessor) };
      }
      if (req.method === 'PUT' && req.path === '/pageLayout/5') return undefined;
      if (req.path === '/pageLayout/5') return { ...DEFAULT_LAYOUT, ...opts.layout };
      throw new Error(`Unexpected: ${req.method} ${req.path}`);
    });
  }

  const find = (method: string, path?: string) =>
    calls.find((c) => c.method === method && (path === undefined || c.path === path));
  const countPath = (path: string) => calls.filter((c) => c.path === path).length;

  beforeEach(() => {
    http = { request: vi.fn() } as unknown as HttpClient;
    resource = new PageLayoutResource(http);
    calls = [];
  });

  describe('create() processor', () => {
    it('should default to the instance Handlebars processor ID when none is passed', async () => {
      route();
      const layout = await resource.create({ name: 'L' });
      expect(find('POST')!.body!.layoutProcessor).toBe('42');
      expect(layout.processor).toBe('handlebars');
    });

    it('should throw and not POST when Handlebars is not on the instance', async () => {
      route({ processors: [{ id: 21, name: 'T4 Tag Page' }] });
      await expect(resource.create({ name: 'L' })).rejects.toThrow(
        'Processor "Handlebars Page" not found on this T4 instance. Available processors: T4 Tag Page',
      );
      expect(find('POST')).toBeUndefined();
    });

    it('should throw and not POST when an explicit processor is not on the instance', async () => {
      route({ processors: [{ id: 42, name: 'Handlebars Page' }] });
      await expect(resource.create({ name: 'L', processor: 'programmable-layouts' })).rejects.toThrow(
        'Processor "Programmable Layout Page" not found on this T4 instance',
      );
      expect(find('POST')).toBeUndefined();
    });

    it('should throw on an unknown processor key', async () => {
      route();
      await expect(
        // @ts-expect-error — only the three friendly keys are accepted
        resource.create({ name: 'L', processor: 'not-a-processor' }),
      ).rejects.toThrow('Unknown processor "not-a-processor". Valid options: t4-tags, handlebars, programmable-layouts');
      expect(find('POST')).toBeUndefined();
    });

    it('should resolve a matched explicit processor', async () => {
      route();
      await resource.create({ name: 'L', processor: 'programmable-layouts' });
      expect(find('POST')!.body!.layoutProcessor).toBe('63');
    });
  });

  describe('create() syntax', () => {
    it('should default to the instance HTML/XML syntax ID when none is passed', async () => {
      route();
      const layout = await resource.create({ name: 'L' });
      expect(find('POST')!.body!.syntaxType).toBe('7');
      expect(layout.syntax).toBe('HTML/XML');
    });

    it('should throw and not POST when HTML/XML is not on the instance', async () => {
      route({ syntaxTypes: [{ id: 8, name: 'Javascript' }] });
      await expect(resource.create({ name: 'L' })).rejects.toThrow(
        'Unknown syntax "HTML/XML". Valid options: Javascript',
      );
      expect(find('POST')).toBeUndefined();
    });

    it('should throw on an unmatched explicit syntax', async () => {
      route();
      await expect(resource.create({ name: 'L', syntax: 'Cobol' })).rejects.toThrow(
        'Unknown syntax "Cobol". Valid options: HTML/XML, Javascript',
      );
      expect(find('POST')).toBeUndefined();
    });

    it('should resolve a matched explicit syntax case-insensitively', async () => {
      route();
      await resource.create({ name: 'L', syntax: 'javascript' });
      expect(find('POST')!.body!.syntaxType).toBe('8');
    });
  });

  describe('create() fileExtension', () => {
    it('should create with no extension and make no lookup when omitted', async () => {
      route();
      await resource.create({ name: 'L' });
      expect(find('POST')!.body!.fileExtension).toBe('');
      expect(countPath('/fileExtension')).toBe(0);
    });

    it('should resolve a valid extension to the instance casing', async () => {
      route();
      await resource.create({ name: 'L', fileExtension: 'php' });
      expect(find('POST')!.body!.fileExtension).toBe('PHP');
    });

    it('should still throw Unknown extension for an invalid extension', async () => {
      route();
      await expect(resource.create({ name: 'L', fileExtension: 'xyz' })).rejects.toThrow(
        'Unknown extension "xyz". Valid options: html, PHP',
      );
      expect(find('POST')).toBeUndefined();
    });

    it('should surface a lookup failure with cause and not create the layout', async () => {
      const failure = new Error('Service Unavailable');
      route({ extensions: failure });
      const err = await resource.create({ name: 'L', fileExtension: 'html' }).catch((e: Error) => e);
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('Could not validate file extension "html": Service Unavailable');
      expect((err as Error).cause).toBe(failure);
      expect(find('POST')).toBeUndefined();
    });
  });

  describe('save() / update()', () => {
    it('should send the original raw IDs when syntax and processor are unchanged, even if unmapped', async () => {
      route({ layout: { layoutProcessor: 99, syntaxType: 77 } });
      const layout = await resource.get(5);
      expect(layout.processor).toBe('unknown (99)');
      layout.name = 'Renamed';
      await layout.save();
      const body = find('PUT')!.body!;
      expect(body.layoutProcessor).toBe('99');
      expect(body.syntaxType).toBe('77');
    });

    it('should throw and not PUT when a changed processor key is unknown', async () => {
      route();
      const layout = await resource.get(5);
      layout.processor = 'not-a-processor';
      await expect(layout.save()).rejects.toThrow('Unknown processor "not-a-processor"');
      expect(find('PUT')).toBeUndefined();
    });

    it('should reject raw API processor names on save', async () => {
      route();
      const layout = await resource.get(5);
      layout.processor = 'Handlebars Page';
      await expect(layout.save()).rejects.toThrow('Unknown processor "Handlebars Page"');
      expect(find('PUT')).toBeUndefined();
    });

    it('should throw and not PUT when a changed processor is not on the instance', async () => {
      route({ processors: [{ id: 21, name: 'T4 Tag Page' }] });
      await expect(resource.update(5, { processor: 'handlebars' })).rejects.toThrow(
        'Processor "Handlebars Page" not found on this T4 instance',
      );
      expect(find('PUT')).toBeUndefined();
    });

    it('should throw and not PUT when a changed syntax is unmatched', async () => {
      route();
      await expect(resource.update(5, { syntax: 'Cobol' })).rejects.toThrow('Unknown syntax "Cobol"');
      expect(find('PUT')).toBeUndefined();
    });

    it('should resolve matched changed syntax and processor', async () => {
      route();
      await resource.update(5, { syntax: 'Javascript', processor: 'handlebars' });
      const body = find('PUT')!.body!;
      expect(body.syntaxType).toBe('8');
      expect(body.layoutProcessor).toBe('42');
    });

    it('should only accept the friendly processor keys on update() (type-level)', async () => {
      route();
      // @ts-expect-error — update() processor is narrowed to the friendly keys
      await expect(resource.update(5, { processor: 'Handlebars Page' })).rejects.toThrow('Unknown processor');
    });

    it('should make no extension lookup when fileExtension is unchanged', async () => {
      route({ layout: { fileExtension: 'html' } });
      await resource.update(5, { name: 'Renamed' });
      expect(find('PUT')!.body!.fileExtension).toBe('html');
      expect(countPath('/fileExtension')).toBe(0);
    });

    it('should make no lookup when fileExtension is cleared to None', async () => {
      route({ layout: { fileExtension: 'html' } });
      await resource.update(5, { fileExtension: '' });
      expect(find('PUT')!.body!.fileExtension).toBe('');
      expect(countPath('/fileExtension')).toBe(0);
    });

    it('should validate a changed fileExtension and use the instance casing', async () => {
      route();
      const layout = await resource.update(5, { fileExtension: 'php' });
      expect(find('PUT')!.body!.fileExtension).toBe('PHP');
      expect(layout.fileExtension).toBe('PHP');
    });

    it('should throw Unknown extension and not PUT for an invalid changed extension', async () => {
      route();
      await expect(resource.update(5, { fileExtension: 'xyz' })).rejects.toThrow('Unknown extension "xyz"');
      expect(find('PUT')).toBeUndefined();
    });

    it('should surface an extension lookup failure on save and not PUT', async () => {
      const failure = new Error('boom');
      route({ extensions: failure });
      const layout = await resource.get(5);
      layout.fileExtension = 'html';
      const err = await layout.save().catch((e: Error) => e);
      expect((err as Error).message).toBe('Could not validate file extension "html": boom');
      expect((err as Error).cause).toBe(failure);
      expect(find('PUT')).toBeUndefined();
    });

    it('should treat saved values as the new baseline', async () => {
      route();
      const layout = await resource.get(5);
      layout.processor = 'handlebars';
      layout.fileExtension = 'html';
      await layout.save();
      calls.length = 0;
      (http.request as ReturnType<typeof vi.fn>).mockClear();
      route({ processors: [], extensions: new Error('should not be called') });
      layout.name = 'Again';
      await layout.save();
      const body = find('PUT')!.body!;
      expect(body.layoutProcessor).toBe('42');
      expect(body.fileExtension).toBe('html');
      expect(countPath('/fileExtension')).toBe(0);
    });
  });

  describe('lookup caching', () => {
    it('should fetch /fileExtension once across multiple writes', async () => {
      route();
      await resource.create({ name: 'A', fileExtension: 'html' });
      await resource.create({ name: 'B', fileExtension: 'php' });
      await resource.update(5, { fileExtension: 'html' });
      expect(countPath('/fileExtension')).toBe(1);
    });

    it('should refetch /fileExtension after the cache epoch is bumped', async () => {
      route();
      await resource.create({ name: 'A', fileExtension: 'html' });
      invalidateAllCaches();
      await resource.create({ name: 'B', fileExtension: 'html' });
      expect(countPath('/fileExtension')).toBe(2);
    });

    it('should not cache a failed /fileExtension lookup', async () => {
      route({ extensions: new Error('transient') });
      await expect(resource.create({ name: 'A', fileExtension: 'html' })).rejects.toThrow('Could not validate');
      route();
      await resource.create({ name: 'B', fileExtension: 'html' });
      expect(countPath('/fileExtension')).toBe(2);
      expect(find('POST')!.body!.fileExtension).toBe('html');
    });

    it('should not cache failed syntax or processor lookups', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'));
      await expect(resource.create({ name: 'A' })).rejects.toThrow('down');
      route();
      await resource.create({ name: 'B' });
      expect(countPath('/syntaxType')).toBe(1);
      expect(countPath('/publishProcessor/10')).toBe(1);
    });
  });
});
