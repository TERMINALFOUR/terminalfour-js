import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentTypeResource } from '../src/resources/content-type-resource.js';
import { HttpClient } from '../src/http-client.js';
import { ELEMENT_TYPES, HTML_EDITORS } from './helpers.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

describe('ContentTypeResource', () => {
  let http: HttpClient;
  let resource: ContentTypeResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new ContentTypeResource(http);
  });

  it('list() maps contentTypeElements to fields with type names', async () => {
    const listResponse = [
      {
        id: 1, name: 'Article', alias: 'Article', description: 'A news article',
        contentTypeElements: [
          { name: 'Title', description: 'The title', type: 1, compulsory: true, maxSize: 200, listId: 0, shown: true },
          { name: 'Body', description: '', type: 3, compulsory: false, maxSize: 5000, listId: 0, shown: true },
        ],
      },
    ];
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype?excludeElements=true') return listResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.list();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Article');
    expect(result[0].description).toBe('A news article');
    expect(result[0].fields['Title']).toEqual({ name: 'Title', description: 'The title', type: 'Plain Text', required: true, maxSize: 200, listId: 0, listName: '', shown: true, useAsFilename: false });
    expect(result[0].fields['Body']).toEqual({ name: 'Body', description: '', type: 'HTML', required: false, maxSize: 5000, listId: 0, listName: '', shown: true, useAsFilename: false });
  });

  it('get(id) resolves numeric type IDs to names', async () => {
    const getResponse = {
      id: 5, name: 'Page', alias: 'page', description: 'A page',
      contentTypeElements: [
        { name: 'Heading', description: 'Page heading', type: 1, compulsory: true, maxSize: 100, listId: 0, shown: true },
        { name: 'Size', description: '', type: 7, compulsory: false, maxSize: 0, listId: 1, shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/5') return getResponse;
      if (opts.path.startsWith('/list/1/')) return { id: 1, name: 'Sizes', items: [] };
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.get(5);

    expect(result.fields['Heading'].type).toBe('Plain Text');
    expect(result.fields['Size'].type).toBe('Select Box');
    expect(result.fields['Size'].listId).toBe(1);
    expect(result.fields['Size'].listName).toBe('Sizes');
  });

  it('get(id) does not populate config for non-Repeater elements with contentTypeElementConfiguration', async () => {
    const getResponse = {
      id: 6, name: 'Rich Page', alias: 'Rich Page', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, shown: true, alias: 'Name' },
        { id: 2, name: 'Body', type: 3, compulsory: false, maxSize: 5000, listId: 0, shown: true, alias: 'Body',
          contentTypeElementConfiguration: { editorType: 'markdown' } },
        { id: 3, name: 'Items', type: 19, compulsory: false, maxSize: 80, listId: 0, shown: true, alias: 'Items',
          contentTypeElementConfiguration: { contentTypeId: 55, contentTypeDTO: { name: 'Sub', alias: 'Sub', contentTypeElements: [] }, layout: '', minRepeats: 0, maxRepeats: 10 } },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/6') return getResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.get(6);

    // HTML element with config should NOT have field.config (it's not a Repeater)
    expect(result.fields['Body'].type).toBe('HTML');
    expect(result.fields['Body'].config).toBeUndefined();

    // Repeater element with config SHOULD have field.config
    expect(result.fields['Items'].type).toBe('Repeater');
    expect(result.fields['Items'].config).toBeDefined();
    expect(result.fields['Items'].config!.contentTypeId).toBe(55);
  });

  it('get(id) resolves editorID to friendly name on HTML elements', async () => {
    const getResponse = {
      id: 7, name: 'With Editor', alias: 'With Editor', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, shown: true, alias: 'Name' },
        { id: 2, name: 'Body', type: 3, compulsory: false, maxSize: 5000, listId: 0, shown: true, alias: 'Body',
          contentTypeElementConfiguration: { editorID: 5 } },
        { id: 3, name: 'Plain HTML', type: 3, compulsory: false, maxSize: 5000, listId: 0, shown: true, alias: 'Plain HTML' },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/7') return getResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.get(7);

    // HTML element with editorID should have field.editor resolved to name
    expect(result.fields['Body'].editor).toBe('TinyMCE');
    // HTML element without editorID should not have field.editor
    expect(result.fields['Plain HTML'].editor).toBeUndefined();
  });

  it('addField() sets editor on HTML element and resolves to editorID on save', async () => {
    const ctResponse = {
      id: 343, name: 'Test', alias: 'Test', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, sequence: 1, alias: 'Name', shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctResponse;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    await ct.addField({ name: 'Content', type: 'HTML', editor: 'TinyMCE' });

    expect(ct.fields['Content'].editor).toBe('TinyMCE');

    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const htmlEl = body.body.contentTypeElements.find((el) => el.name === 'Content');
    expect(htmlEl!.contentTypeElementConfiguration).toEqual({ editorID: 5 });
  });

  it('addField() throws for invalid editor name', async () => {
    const ctResponse = {
      id: 343, name: 'Test', alias: 'Test', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, sequence: 1, alias: 'Name', shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Body', type: 'HTML', editor: 'NonExistent' }))
      .rejects.toThrow(/Unknown editor "NonExistent".*"Standard Textarea".*"TinyMCE"/);
  });

  it('addField() throws if editor is set on non-HTML element', async () => {
    const ctResponse = {
      id: 343, name: 'Test', alias: 'Test', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, sequence: 1, alias: 'Name', shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Title', type: 'Plain Text', editor: 'TinyMCE' }))
      .rejects.toThrow(/editor is only valid for HTML elements/);
  });

  it('ContentType.save() syncs editor changes to contentTypeElementConfiguration', async () => {
    const ctResponse = {
      id: 343, name: 'Test', alias: 'Test', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 2, name: 'Body', type: 3, compulsory: false, maxSize: 5000, listId: 0, sequence: 2, alias: 'Body', shown: true,
          contentTypeElementConfiguration: { editorID: 2 } },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctResponse;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    expect(ct.fields['Body'].editor).toBe('Standard Textarea');

    // Change editor
    ct.fields['Body'].editor = 'TinyMCE';
    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const bodyEl = body.body.contentTypeElements.find((el) => el.name === 'Body');
    expect(bodyEl!.contentTypeElementConfiguration).toEqual({ editorID: 5 });
  });

  it('ContentType.save() removes editor when set to null', async () => {
    const ctResponse = {
      id: 343, name: 'Test', alias: 'Test', description: '',
      contentTypeElements: [
        { id: 1, name: 'Name', type: 1, compulsory: true, maxSize: 80, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 2, name: 'Body', type: 3, compulsory: false, maxSize: 5000, listId: 0, sequence: 2, alias: 'Body', shown: true,
          contentTypeElementConfiguration: { editorID: 5 } },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctResponse;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    expect(ct.fields['Body'].editor).toBe('TinyMCE');

    // Remove editor
    ct.fields['Body'].editor = null;
    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const bodyEl = body.body.contentTypeElements.find((el) => el.name === 'Body');
    // contentTypeElementConfiguration should be removed entirely
    expect(bodyEl!.contentTypeElementConfiguration).toBeUndefined();
  });

  it('contentTypes.create() sets editor on HTML elements', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return {
        id: 500, name: 'New CT', alias: 'New CT', description: '',
        contentTypeElements: [
          { id: 1, name: 'Name', type: 1, alias: 'Name', sequence: 1 },
          { id: 2, name: 'Body', type: 3, alias: 'Body', sequence: 2,
            contentTypeElementConfiguration: { editorID: 5 } },
        ],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.create({
      name: 'New CT',
      elements: [
        { name: 'Body', type: 'HTML', editor: 'TinyMCE' },
      ],
    });

    // Verify the POST body included editor config
    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = postCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const bodyEl = body.body.contentTypeElements.find((el) => el.name === 'Body');
    expect(bodyEl!.contentTypeElementConfiguration).toEqual({ editorID: 5 });

    // Verify the returned content type has editor resolved
    expect(ct.fields['Body'].editor).toBe('TinyMCE');
  });

  it('handles object-style type (from list endpoint)', async () => {
    const listResponse = [{
      id: 10, name: 'Test', alias: 'test',
      contentTypeElements: [
        { name: 'Field1', type: { name: 'Date' }, compulsory: false },
      ],
    }];
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype?excludeElements=true') return listResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.list();
    expect(result[0].fields['Field1'].type).toBe('Date');
  });

  it('defaults missing fields gracefully', async () => {
    const getResponse = {
      id: 10, name: 'Test', alias: 'test',
      contentTypeElements: [
        { name: 'Field1', type: undefined, compulsory: undefined },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/10') return getResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.get(10);
    expect(result.description).toBe('');
    expect(result.fields['Field1']).toEqual({ name: 'Field1', description: '', type: '', required: false, maxSize: 0, listId: 0, listName: '', shown: true, useAsFilename: false });
  });

  it('decodes HTML entities in name and description', async () => {
    const getResponse = {
      id: 20, name: 'Content &#x2F; Page', alias: 'Content &#x2F; Page', description: 'It&#x27;s a page',
      contentTypeElements: [],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/20') return getResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const result = await resource.get(20);
    expect(result.name).toBe('Content / Page');
    expect(result.description).toBe("It's a page");
  });

  it('layouts.list() returns layouts without IDs', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/layout/contenttype/343/en') return [
        { id: 11771, name: 'text/foo', lastModified: 1776098921883 },
        { id: 11088, name: 'text/html', lastModified: 1718190390000 },
      ];
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    const layouts = await ct.layouts.list();

    expect(layouts).toHaveLength(2);
    expect(layouts[0].name).toBe('text/foo');
    expect(layouts[0].lastModified).toBeInstanceOf(Date);
    expect(layouts[0]).not.toHaveProperty('id');
    expect(layouts[1].name).toBe('text/html');
  });

  const layoutContentType = {
    contentTypeElements: [
      { id: 1, name: 'name', type: 1 },
      { id: 2, name: 'formatcode', type: 1 },
      { id: 3, name: 'templateid', type: 1 },
      { id: 4, name: 'extension', type: 1 },
      { id: 5, name: 'Format Processor', type: 13 },
      { id: 6, name: 'syntax', type: 13 },
    ],
  };

  it('layouts.create() sends PUT with dynamically resolved element keys', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/contenttype/?excludeElements=true') return [{ id: 2, name: 'Content Layout', type: 30 }];
      if (opts.path === '/contenttype/2') return layoutContentType;
      if (opts.path === '/layout/contenttype/343/en') return [];
      if (opts.path === '/syntaxType') return [{ id: 3, name: 'HTML/XML' }, { id: 1, name: 'Javascript' }];
      if (opts.path === '/publishProcessor/20') return [
        { id: 2, name: 'T4 Tag Content' },
        { id: 16, name: 'Handlebars Content' },
      ];
      if (opts.method === 'PUT' && opts.path === '/layout/343') return { id: 999, name: 'text/new', lastModified: 1776109686289, elements: { 'formatcode#2:1': 'Hello', 'name#1:1': 'text/new', 'syntax#6:13': '3', 'Format Processor#5:13': '16', 'extension#4:1': '' } };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    const result = await ct.layouts.create({ name: 'text/new', code: 'Hello' });

    expect(result.name).toBe('text/new');
    expect(result.lastModified).toBeInstanceOf(Date);
    expect(result.code).toBe('Hello');
    expect(typeof result.save).toBe('function');

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = (putCall![0] as { body: { elements: Record<string, string> } }).body;
    // Keys should use dynamic element IDs from contenttype/2
    expect(body.elements['formatcode#2:1']).toBe('Hello');
    expect(body.elements['syntax#6:13']).toBe('3');
    expect(body.elements['Format Processor#5:13']).toBe('16');
    expect(body.elements['name#1:1']).toBe('text/new');
    expect(body.elements['extension#4:1']).toBe('');
  });

  it('layouts.create() throws if name already exists', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/layout/contenttype/343/en') return [{ id: 1, name: 'text/html', lastModified: 0 }];
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.layouts.create({ name: 'text/html', code: 'x' })).rejects.toThrow('already exists');
  });

  const fullLayoutResponse = {
    id: 100, name: 'text/html', lastModified: 1776111621000,
    contentTypeID: 2, status: 0, channels: [], sectionIDs: [7897],
    elements: {
      'name#1:1': 'text/html',
      'formatcode#2:1': '<h1>Hello</h1>',
      'extension#4:1': '',
      'syntax#6:13': '3',
      'Format Processor#5:13': '16',
    },
  };

  it('layouts.get() returns a mutable Layout object', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/contenttype/?excludeElements=true') return [{ id: 2, name: 'Content Layout', type: 30 }];
      if (opts.path === '/contenttype/2') return layoutContentType;
      if (opts.path === '/layout/contenttype/343/en') return [{ id: 100, name: 'text/html', lastModified: 1776111621000 }];
      if (opts.path === '/layout/100/en') return fullLayoutResponse;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    const layout = await ct.layouts.get('text/html');

    expect(layout.name).toBe('text/html');
    expect(layout.code).toBe('<h1>Hello</h1>');
    expect(layout.lastModified).toBeInstanceOf(Date);
  });

  it('layouts.get() throws if layout not found', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/layout/contenttype/343/en') return [];
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.layouts.get('text/missing')).rejects.toThrow('not found');
  });

  it('Layout.save() sends PUT with updated code', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/contenttype/?excludeElements=true') return [{ id: 2, name: 'Content Layout', type: 30 }];
      if (opts.path === '/contenttype/2') return layoutContentType;
      if (opts.path === '/layout/contenttype/343/en') return [{ id: 100, name: 'text/html', lastModified: 1776111621000 }];
      if (opts.method === 'GET' && opts.path === '/layout/100/en') return fullLayoutResponse;
      if (opts.method === 'PUT' && opts.path === '/layout/100/en') return { ...fullLayoutResponse, elements: { ...fullLayoutResponse.elements, 'formatcode#2:1': 'Updated' } };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    const layout = await ct.layouts.get('text/html');
    layout.code = 'Updated';
    await layout.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => {
        const o = c[0] as { method: string; path: string };
        return o.method === 'PUT' && o.path === '/layout/100/en';
      },
    );
    expect(putCall).toBeDefined();
    const body = (putCall![0] as { body: { elements: Record<string, string> } }).body;
    expect(body.elements['formatcode#2:1']).toBe('Updated');
  });

  it('Layout.save() checks name uniqueness on rename', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/contenttype/?excludeElements=true') return [{ id: 2, name: 'Content Layout', type: 30 }];
      if (opts.path === '/contenttype/2') return layoutContentType;
      if (opts.path === '/layout/contenttype/343/en') return [
        { id: 100, name: 'text/html', lastModified: 0 },
        { id: 101, name: 'text/json', lastModified: 0 },
      ];
      if (opts.method === 'GET' && opts.path === '/layout/100/en') return fullLayoutResponse;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    const layout = await ct.layouts.get('text/html');
    layout.name = 'text/json'; // already exists
    await expect(layout.save()).rejects.toThrow('already exists');
  });

  it('layouts.update() immutably updates a layout by name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/contenttype/?excludeElements=true') return [{ id: 2, name: 'Content Layout', type: 30 }];
      if (opts.path === '/contenttype/2') return layoutContentType;
      if (opts.path === '/layout/contenttype/343/en') return [{ id: 100, name: 'text/html', lastModified: 0 }];
      if (opts.method === 'GET' && opts.path === '/layout/100/en') return fullLayoutResponse;
      if (opts.method === 'PUT' && opts.path === '/layout/100/en') return { ...fullLayoutResponse, name: 'text/html', lastModified: 9999 };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    const result = await ct.layouts.update('text/html', { code: 'New code' });

    expect(result.name).toBe('text/html');
    expect(result.lastModified).toBeInstanceOf(Date);
    expect(result.code).toBeDefined();
    expect(typeof result.save).toBe('function');
  });

  it('layouts.delete() resolves name to ID and sends DELETE', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/layout/contenttype/343/en') return [{ id: 100, name: 'text/html', lastModified: 0 }];
      if (opts.method === 'DELETE' && opts.path === '/layout/100/en') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    await ct.layouts.delete('text/html');

    const deleteCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'DELETE',
    );
    expect(deleteCall).toBeDefined();
    expect((deleteCall![0] as { path: string }).path).toBe('/layout/100/en');
  });

  it('layouts.delete() throws if layout not found', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return { id: 343, name: 'All', alias: 'all', contentTypeElements: [] };
      if (opts.path === '/layout/contenttype/343/en') return [];
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.layouts.delete('text/missing')).rejects.toThrow('not found');
  });

  const fullContentType = {
    id: 343, name: 'All elements', alias: 'All elements', description: 'Test CT',
    minAuthLevel: 2, workflow: 0, enableDirectEdit: true, sharedGroups: [],
    contentTypeElements: [],
  };

  it('ContentType.save() sends PUT with updated properties', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return fullContentType;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    ct.name = 'Renamed';
    ct.description = 'Updated desc';
    ct.minUserLevel = 'moderator';
    ct.workflow = 5;
    ct.directEdit = false;
    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = putCall![0] as { body: Record<string, unknown> };
    expect(body.body.alias).toBe('Renamed');
    expect(body.body.description).toBe('Updated desc');
    expect(body.body.minAuthLevel).toBe('1');
    expect(body.body.workflow).toBe('5');
    expect(body.body.enableDirectEdit).toBe(false);
  });

  it('contentTypes.update() immutably updates a content type', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return fullContentType;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.update(343, { name: 'Updated', directEdit: false });
    expect(ct.name).toBe('Updated');
    expect(ct.directEdit).toBe(false);
  });

  it('contentTypes.update() supports addFields', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return fullContentType;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.update(343, {
      addFields: [{ name: 'Summary', type: 'Plain Text', maxSize: 300 }],
    });

    expect(ct.fields['Summary']).toBeDefined();
    expect(ct.fields['Summary'].type).toBe('Plain Text');
    expect(ct.fields['Summary'].maxSize).toBe(300);

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const names = body.body.contentTypeElements.map((el) => el.name);
    expect(names).toContain('Summary');
  });

  it('contentTypes.update() supports addFields with repeater', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return fullContentType;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.update(343, {
      addFields: [{
        name: 'Items',
        type: 'Repeater',
        repeater: { contentTypeId: 88, layout: 'text/item', minRepeats: 0, maxRepeats: 20 },
      }],
    });

    expect(ct.fields['Items']).toBeDefined();
    expect(ct.fields['Items'].type).toBe('Repeater');
    expect(ct.fields['Items'].config).toBeDefined();
    expect(ct.fields['Items'].config!.contentTypeId).toBe(88);

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const repeaterEl = body.body.contentTypeElements.find((el) => el.name === 'Items');
    expect(repeaterEl).toBeDefined();
    expect((repeaterEl!.contentTypeElementConfiguration as Record<string, unknown>).contentTypeId).toBe(88);
  });

  it('contentTypes.update() supports removeFields', async () => {
    const ctWithName = {
      ...fullContentType,
      contentTypeElements: [
        { id: 1, contentTypeID: 343, name: 'Name', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 2, contentTypeID: 343, name: 'Body', type: 3, maxSize: 5000, compulsory: false, listId: 0, sequence: 2, alias: 'Body', shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithName;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.update(343, { removeFields: ['Body'] });

    expect(ct.fields['Body']).toBeUndefined();
    expect(ct.fields['Name']).toBeDefined();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const names = body.body.contentTypeElements.map((el) => el.name);
    expect(names).not.toContain('Body');
    expect(names).toContain('Name');
  });

  const ctWithElements = () => ({
    ...fullContentType,
    contentTypeElements: [
      { id: 1, contentTypeID: 343, name: 'Name', description: 'The name', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, alias: 'Name', shown: true, conditionalShown: true, binary: false },
      { id: 20, contentTypeID: 343, name: 'Repeater', description: '', type: 19, maxSize: 80, compulsory: false, listId: 0, sequence: 2, alias: 'Repeater', shown: true, conditionalShown: true, binary: false,
        contentTypeElementConfiguration: { contentTypeId: 67, layout: 'text/html', minRepeats: 2, maxRepeats: 50 } },
    ],
  });

  it('ContentType.save() syncs field property changes to raw elements', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithElements();
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);

    // Modify element properties
    ct.fields['Name'].name = 'Renamed Element';
    ct.fields['Name'].description = 'New desc';
    ct.fields['Name'].maxSize = 200;
    ct.fields['Name'].required = false;
    ct.fields['Name'].shown = false;

    // Modify repeater config
    ct.fields['Repeater'].config!.minRepeats = 1;
    ct.fields['Repeater'].config!.maxRepeats = 100;

    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const els = body.body.contentTypeElements;

    expect(els[0].alias).toBe('Renamed Element');
    expect(els[0].description).toBe('New desc');
    expect(els[0].maxSize).toBe(200);
    expect(els[0].compulsory).toBe(false);
    expect(els[0].shown).toBe(false);

    const repeaterCfg = els[1].contentTypeElementConfiguration as Record<string, unknown>;
    expect(repeaterCfg.minRepeats).toBe(1);
    expect(repeaterCfg.maxRepeats).toBe(100);
    // Content type and layout should be unchanged
    expect(repeaterCfg.contentTypeId).toBe(67);
    expect(repeaterCfg.layout).toBe('text/html');
  });

  it('ContentType.save() does not write repeater config to non-Repeater elements with contentTypeElementConfiguration', async () => {
    const ctWithHtmlConfig = {
      ...fullContentType,
      contentTypeElements: [
        { id: 1, contentTypeID: 343, name: 'Name', description: '', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 2, contentTypeID: 343, name: 'Body', description: '', type: 3, maxSize: 5000, compulsory: false, listId: 0, sequence: 2, alias: 'Body', shown: true,
          contentTypeElementConfiguration: { editorType: 'markdown' } },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithHtmlConfig;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);

    // HTML element should NOT have config populated
    expect(ct.fields['Body'].config).toBeUndefined();

    // Modify a property and save
    ct.fields['Body'].description = 'Updated body';
    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const bodyEl = body.body.contentTypeElements.find((el) => el.name === 'Body');

    // The contentTypeElementConfiguration should be preserved as-is (not mutated with repeater fields)
    expect(bodyEl!.contentTypeElementConfiguration).toEqual({ editorType: 'markdown' });
  });

  it('ContentType.removeField() removes element from fields and raw data on save', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithElements();
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    expect(ct.fields['Name']).toBeDefined();

    ct.removeField('Name');
    expect(ct.fields['Name']).toBeUndefined();

    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const names = body.body.contentTypeElements.map((el) => el.name);
    expect(names).not.toContain('Name');
    expect(names).toContain('Repeater');
  });

  it('ContentType.removeField() throws for unknown field', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    expect(() => ct.removeField('NonExistent')).toThrow('not found');
  });

  describe('system content type element protection', () => {
    // A system content type (type 30) with two removable/renamable elements.
    const systemCt = (id: number) => ({
      id, name: 'System CT', alias: 'System CT', description: '', type: 30,
      minAuthLevel: 2, workflow: 0, enableDirectEdit: true, sharedGroups: [],
      contentTypeElements: [
        { id: 1, contentTypeID: id, name: 'Name', description: '', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 2, contentTypeID: id, name: 'Title', description: '', type: 1, maxSize: 200, compulsory: false, listId: 0, sequence: 2, alias: 'Title', shown: true },
      ],
    });

    const SECTION_META_CONFIG = { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '75' };

    it('blocks removing an element from a system content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: 420 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      ct.removeField('Title');
      await expect(ct.save()).rejects.toThrow(/system content type/i);
    });

    it('does not send a PUT when a system content type removal is blocked', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: 420 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      ct.removeField('Title');
      await expect(ct.save()).rejects.toThrow();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeUndefined();
    });

    it('blocks removing via update({ removeFields }) on a system content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: 420 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(resource.update(900, { removeFields: ['Title'] })).rejects.toThrow(/system content type/i);
    });

    it('blocks renaming an element on a system content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: 420 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      ct.fields['Title'].name = 'Headline';
      await expect(ct.save()).rejects.toThrow(/rename.*system content type/i);
    });

    it('allows adding an element to a system content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      await ct.addField({ name: 'Extra', type: 'Plain Text', maxSize: 100 });
      await ct.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
      expect(body.body.contentTypeElements.map((el) => el.name)).toContain('Extra');
    });

    it('allows changing maxSize and description on a system content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      ct.description = 'Updated content type description';
      ct.fields['Title'].maxSize = 500;
      ct.fields['Title'].description = 'Updated element description';
      await ct.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = putCall![0] as { body: { description: string; contentTypeElements: Array<Record<string, unknown>> } };
      expect(body.body.description).toBe('Updated content type description');
      const titleEl = body.body.contentTypeElements.find((el) => el.alias === 'Title');
      expect(titleEl!.maxSize).toBe(500);
      expect(titleEl!.description).toBe('Updated element description');
    });

    it('allows removing an element from the exempt Section Meta Data content type', async () => {
      // Section Meta Data content type ID is 75 (from config)
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return systemCt(75);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: 420 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/75') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(75);
      ct.removeField('Title');
      await ct.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
      expect(body.body.contentTypeElements.map((el) => el.name)).not.toContain('Title');
    });

    it('allows renaming an element on the exempt Extended User content type', async () => {
      // Extended User content type ID is 420 (from userSearch/credentials)
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/420') return systemCt(420);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: 420 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/420') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(420);
      ct.fields['Title'].name = 'Headline';
      await ct.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
      const renamed = body.body.contentTypeElements.find((el) => el.id === 2);
      expect(renamed!.alias).toBe('Headline');
    });

    it('blocks removal when Extended User content type is not configured (userExtensibleObjectID missing)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return {}; // userExtensibleObjectID absent
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      ct.removeField('Title');
      await expect(ct.save()).rejects.toThrow(/system content type/i);
    });

    it('treats a negative or zero userExtensibleObjectID as not configured', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        if (opts.method === 'GET' && opts.path === '/contenttype/900') return systemCt(900);
        if (opts.path === '/config/hierarchy.metaDataContentType') return SECTION_META_CONFIG;
        if (opts.path === '/userSearch/credentials') return { userExtensibleObjectID: -1 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/900') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(900);
      ct.removeField('Title');
      await expect(ct.save()).rejects.toThrow(/system content type/i);
    });

    it('allows removal on a regular (non-system) content type without extra lookups', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.path === '/htmlEditor') return HTML_EDITORS;
        // Regular content type: type 10
        if (opts.method === 'GET' && opts.path === '/contenttype/901') return { ...systemCt(901), id: 901, type: 10 };
        if (opts.method === 'PUT' && opts.path === '/contenttype/901') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const ct = await resource.get(901);
      ct.removeField('Title');
      await ct.save();

      // The exemption endpoints must NOT be called for a non-system type
      const configCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/config/hierarchy.metaDataContentType',
      );
      const credsCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/userSearch/credentials',
      );
      expect(configCall).toBeUndefined();
      expect(credsCall).toBeUndefined();
    });
  });

  it('ContentType.addField() adds a new field and includes it on save', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithElements();
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    const fieldCountBefore = Object.keys(ct.fields).length;

    await ct.addField({ name: 'Summary', type: 'Plain Text', maxSize: 200, required: true });

    expect(Object.keys(ct.fields)).toHaveLength(fieldCountBefore + 1);
    expect(ct.fields['Summary']).toBeDefined();
    expect(ct.fields['Summary'].type).toBe('Plain Text');
    expect(ct.fields['Summary'].maxSize).toBe(200);
    expect(ct.fields['Summary'].required).toBe(true);

    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const names = body.body.contentTypeElements.map((el) => el.name);
    expect(names).toContain('Summary');
  });

  it('ContentType.addField() throws for empty name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: '', type: 'Plain Text' })).rejects.toThrow('name is required');
  });

  it('ContentType.addField() throws for empty type', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Test', type: '' })).rejects.toThrow('type is required');
  });

  it('ContentType.addField() throws for duplicate field name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Name', type: 'Plain Text' })).rejects.toThrow('already exists');
  });

  it('ContentType.addField() throws for unknown element type', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Test', type: 'Nonexistent Type' })).rejects.toThrow('Unknown element type');
  });

  it('ContentType.addField() throws if list-based type has no listId', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Category', type: 'Select Box' })).rejects.toThrow('requires a listId');
  });

  it('ContentType.addField() accepts list-based type with listId', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await ct.addField({ name: 'Category', type: 'Select Box', listId: 71 });

    expect(ct.fields['Category']).toBeDefined();
    expect(ct.fields['Category'].listId).toBe(71);
  });

  it('contentTypes.create() sends POST with elements and returns ContentType', async () => {
    const createdResponse = {
      id: 412, name: 'New CT', alias: 'New CT', description: 'Test',
      minAuthLevel: 2, workflow: 0, enableDirectEdit: true, sharedGroups: [],
      contentTypeElements: [
        { id: 1, name: 'Name', alias: 'Name', type: 1, maxSize: 80, compulsory: true, sequence: 1 },
        { id: 2, name: 'Body', alias: 'Body', type: 3, maxSize: 500, compulsory: true, sequence: 2 },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return createdResponse;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.create({
      name: 'New CT',
      description: 'Test',
      elements: [
        { name: 'Body', type: 'HTML', maxSize: 500, required: true },
      ],
    });

    expect(ct.id).toBe(412);
    expect(ct.name).toBe('New CT');
    expect(ct.fields['Body']).toBeDefined();

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = (postCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } }).body;
    // Should have Name element + Body element
    expect(body.contentTypeElements).toHaveLength(2);
    expect(body.contentTypeElements[0].name).toBe('Name');
    expect(body.contentTypeElements[1].name).toBe('Body');
  });

  it('contentTypes.create() throws if name is empty', async () => {
    await expect(resource.create({ name: '', elements: [{ name: 'X', type: 'Plain Text' }] }))
      .rejects.toThrow('name is required');
  });

  it('contentTypes.create() throws if no elements', async () => {
    await expect(resource.create({ name: 'Test', elements: [] }))
      .rejects.toThrow('at least one element');
  });

  it('contentTypes.create() throws for unknown element type', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    await expect(resource.create({ name: 'Test', elements: [{ name: 'X', type: 'FakeType' }] }))
      .rejects.toThrow('Unknown element type');
  });

  it('contentTypes.create() throws if list-based type has no listId', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    await expect(resource.create({ name: 'Test', elements: [{ name: 'Category', type: 'Select Box' }] }))
      .rejects.toThrow('requires a listId');
  });

  it('contentTypes.create() accepts list-based type with listId', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return {
        id: 501, name: 'Test', alias: 'Test', contentTypeElements: [],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    await resource.create({ name: 'Test', elements: [{ name: 'Category', type: 'Select Box', listId: 71 }] });

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = postCall![0] as { body: { contentTypeElements: Array<{ listId: string }> } };
    // Element 0 is Name, element 1 is Category
    expect(body.body.contentTypeElements[1].listId).toBe('71');
  });

  it('contentTypes.create() defaults elementIdforFilename to Name element', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return {
        id: 500, name: 'Test', alias: 'Test', contentTypeElements: [],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    await resource.create({ name: 'Test', elements: [{ name: 'Body', type: 'HTML' }] });

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = (postCall![0] as { body: { elementIdforFilename: number } }).body;
    expect(body.elementIdforFilename).toBe(1); // Name element ID
  });

  it('contentTypes.create() sets elementIdforFilename for useAsFilename element', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return {
        id: 500, name: 'Test', alias: 'Test', contentTypeElements: [],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    await resource.create({
      name: 'Test',
      elements: [{ name: 'Slug', type: 'Plain Text', useAsFilename: true }],
    });

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = (postCall![0] as { body: { elementIdforFilename: number; contentTypeElements: Array<{ id: number; name: string }> } }).body;
    const slugEl = body.contentTypeElements.find((el) => el.name === 'Slug');
    expect(body.elementIdforFilename).toBe(slugEl!.id);
  });

  it('contentTypes.create() throws if multiple elements have useAsFilename', async () => {
    await expect(resource.create({
      name: 'Test',
      elements: [
        { name: 'A', type: 'Plain Text', useAsFilename: true },
        { name: 'B', type: 'Plain Text', useAsFilename: true },
      ],
    })).rejects.toThrow('Only one element');
  });

  it('contentTypes.create() throws if non-Plain Text element has useAsFilename', async () => {
    await expect(resource.create({
      name: 'Test',
      elements: [{ name: 'Body', type: 'HTML', useAsFilename: true }],
    })).rejects.toThrow('Only Plain Text');
  });

  it('ContentType.save() updates elementIdforFilename when useAsFilename is changed', async () => {
    const ctWithFilename = {
      ...fullContentType,
      elementIdforFilename: 1,
      contentTypeElements: [
        { id: 1, contentTypeID: 343, name: 'Name', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 2, contentTypeID: 343, name: 'Slug', type: 1, maxSize: 200, compulsory: false, listId: 0, sequence: 2, alias: 'Slug', shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithFilename;
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    expect(ct.fields['Name'].useAsFilename).toBe(true);
    expect(ct.fields['Slug'].useAsFilename).toBe(false);

    // Switch to Slug — no need to unset Name first
    ct.fields['Slug'].useAsFilename = true;
    await ct.save();

    expect(ct.fields['Name'].useAsFilename).toBe(false);
    expect(ct.fields['Slug'].useAsFilename).toBe(true);

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { elementIdforFilename: number } };
    expect(body.body.elementIdforFilename).toBe(2);
  });

  it('ContentType.save() throws if non-Plain Text element has useAsFilename', async () => {
    const ctMixed = {
      ...fullContentType,
      elementIdforFilename: 1,
      contentTypeElements: [
        { id: 1, contentTypeID: 343, name: 'Name', type: 1, maxSize: 80, compulsory: true, listId: 0, sequence: 1, alias: 'Name', shown: true },
        { id: 3, contentTypeID: 343, name: 'HTML', type: 3, maxSize: 80, compulsory: false, listId: 0, sequence: 2, alias: 'HTML', shown: true },
      ],
    };
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctMixed;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    ct.fields['Name'].useAsFilename = false;
    ct.fields['HTML'].useAsFilename = true;
    await expect(ct.save()).rejects.toThrow('Only Plain Text');
  });

  it('ContentType.addField() adds a repeater field with config', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'GET' && opts.path === '/contenttype/343') return ctWithElements();
      if (opts.method === 'PUT' && opts.path === '/contenttype/343') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.get(343);
    await ct.addField({
      name: 'Slides',
      type: 'Repeater',
      repeater: { contentTypeId: 99, layout: 'text/slides', minRepeats: 1, maxRepeats: 10 },
    });

    expect(ct.fields['Slides']).toBeDefined();
    expect(ct.fields['Slides'].type).toBe('Repeater');
    expect(ct.fields['Slides'].config).toEqual({
      contentTypeId: 99,
      contentTypeName: '',
      contentTypeDescription: '',
      layout: 'text/slides',
      minRepeats: 1,
      maxRepeats: 10,
    });

    await ct.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const body = putCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } };
    const repeaterEl = body.body.contentTypeElements.find((el) => el.name === 'Slides');
    expect(repeaterEl).toBeDefined();
    expect(repeaterEl!.contentTypeElementConfiguration).toEqual({
      contentTypeId: 99,
      layout: 'text/slides',
      minRepeats: 1,
      maxRepeats: 10,
      maxRepeatsLimit: 10,
    });
  });

  it('ContentType.addField() uses defaults for optional repeater config fields', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await ct.addField({
      name: 'Items',
      type: 'Repeater',
      repeater: { contentTypeId: 55 },
    });

    expect(ct.fields['Items'].config).toEqual({
      contentTypeId: 55,
      contentTypeName: '',
      contentTypeDescription: '',
      layout: '',
      minRepeats: 0,
      maxRepeats: 100,
    });
  });

  it('ContentType.addField() throws if Repeater type has no repeater config', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({ name: 'Items', type: 'Repeater' })).rejects.toThrow('requires a repeater configuration');
  });

  it('ContentType.addField() throws if non-Repeater type has repeater config', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.path === '/contenttype/343') return ctWithElements();
      throw new Error(`Unexpected: ${opts.path}`);
    });

    const ct = await resource.get(343);
    await expect(ct.addField({
      name: 'Title',
      type: 'Plain Text',
      repeater: { contentTypeId: 99 },
    } as Parameters<typeof ct.addField>[0])).rejects.toThrow('only valid for Repeater elements');
  });

  it('contentTypes.create() includes contentTypeElementConfiguration for Repeater elements', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return {
        id: 600, name: 'With Repeater', alias: 'With Repeater',
        contentTypeElements: [
          { id: 1, name: 'Name', alias: 'Name', type: 1, sequence: 1 },
          { id: 2, name: 'Items', alias: 'Items', type: 19, sequence: 2,
            contentTypeElementConfiguration: { contentTypeId: 77, layout: 'text/item', minRepeats: 2, maxRepeats: 20 } },
        ],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const ct = await resource.create({
      name: 'With Repeater',
      elements: [
        { name: 'Items', type: 'Repeater', repeater: { contentTypeId: 77, layout: 'text/item', minRepeats: 2, maxRepeats: 20 } },
      ],
    });

    expect(ct.id).toBe(600);

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = (postCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } }).body;
    const repeaterEl = body.contentTypeElements.find((el) => el.name === 'Items');
    expect(repeaterEl).toBeDefined();
    expect(repeaterEl!.contentTypeElementConfiguration).toEqual({
      contentTypeId: 77,
      layout: 'text/item',
      minRepeats: 2,
      maxRepeats: 20,
      maxRepeatsLimit: 20,
    });
  });

  it('contentTypes.create() uses defaults for optional repeater config fields', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      if (opts.method === 'POST' && opts.path === '/contenttype') return {
        id: 601, name: 'Test', alias: 'Test', contentTypeElements: [],
      };
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    await resource.create({
      name: 'Test',
      elements: [
        { name: 'Rows', type: 'Repeater', repeater: { contentTypeId: 44 } },
      ],
    });

    const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
    );
    const body = (postCall![0] as { body: { contentTypeElements: Array<Record<string, unknown>> } }).body;
    const repeaterEl = body.contentTypeElements.find((el) => el.name === 'Rows');
    expect(repeaterEl!.contentTypeElementConfiguration).toEqual({
      contentTypeId: 44,
      layout: '',
      minRepeats: 0,
      maxRepeats: 100,
      maxRepeatsLimit: 100,
    });
  });

  it('contentTypes.create() throws if Repeater element has no repeater config', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    await expect(resource.create({
      name: 'Test',
      elements: [{ name: 'Items', type: 'Repeater' }],
    })).rejects.toThrow('requires a repeater configuration');
  });

  it('contentTypes.create() throws if non-Repeater element has repeater config', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
      if (opts.path === '/type/') return ELEMENT_TYPES;
      if (opts.path === '/htmlEditor') return HTML_EDITORS;
      throw new Error(`Unexpected: ${opts.path}`);
    });

    await expect(resource.create({
      name: 'Test',
      elements: [{ name: 'Title', type: 'Plain Text', repeater: { contentTypeId: 99 } }],
    })).rejects.toThrow('only valid for Repeater elements');
  });
});
