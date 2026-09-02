import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListResource } from '../src/resources/list-resource.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

describe('ListResource', () => {
  let http: HttpClient;
  let resource: ListResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new ListResource(http, 'en');
  });

  it('list() returns all lists with id, name, description', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { id: 1, name: 'Size', description: 'Small or large' },
      { id: 2, name: 'Cookie Preference', description: '' },
    ]);

    const lists = await resource.list();
    expect(lists).toHaveLength(2);
    expect(lists[0]).toEqual({ id: 1, name: 'Size', description: 'Small or large' });
  });

  it('list() calls GET /list/{language}', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    await resource.list();
    expect(http.request).toHaveBeenCalledWith({ method: 'GET', path: '/list/en' });
  });

  it('get() returns a List with items keyed by name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 71, name: 'Accordion Type', description: '', language: 'en',
      items: [
        { id: 302, name: 'Standard Accordion', value: 'Standard', sequence: 1, listId: 71, sublist: 0, isSelected: true },
        { id: 303, name: 'Code Accordion', value: 'Code', sequence: 2, listId: 71, sublist: 0, isSelected: false },
      ],
    });

    const list = await resource.get(71);
    expect(list.id).toBe(71);
    expect(list.name).toBe('Accordion Type');
    expect(Object.keys(list.items)).toHaveLength(2);
    expect(list.items['Standard Accordion'].value).toBe('Standard');
    expect(list.items['Standard Accordion'].selected).toBe(true);
    expect(list.items['Standard Accordion'].sublistId).toBeUndefined();
    expect(list.items['Code Accordion'].value).toBe('Code');
  });

  it('get() includes sublistId when present', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 75, name: 'Cascading', description: '', language: 'en',
      items: [
        { id: 310, name: 'Netball', value: 'netball', sequence: 1, listId: 75, sublist: 73, isSelected: false },
        { id: 312, name: 'Plain', value: 'plain', sequence: 2, listId: 75, sublist: 0, isSelected: false },
      ],
    });

    const list = await resource.get(75);
    expect(list.items['Netball'].sublistId).toBe(73);
    expect(list.items['Plain'].sublistId).toBeUndefined();
  });

  it('get() decodes HTML entities', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 31, name: 'True &#x2F; False', description: 'for &#x27;Show Lightbox&#x27;', language: 'en',
      items: [{ id: 1, name: 'Yes &#x2F; No', value: 'yes', sequence: 1, listId: 31, sublist: 0, isSelected: false }],
    });

    const list = await resource.get(31);
    expect(list.name).toBe('True / False');
    expect(list.description).toBe("for 'Show Lightbox'");
    expect(list.items['Yes / No'].value).toBe('yes');
  });

  it('List.save() sends PUT with updated properties', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
      if (opts.method === 'GET') return {
        id: 71, name: 'Old Name', description: 'Old', language: 'en',
        isForcedLanguage: false, isDefaultLanguage: false,
        items: [{ id: 302, name: 'Item A', value: 'a', sequence: 1, listId: 71, sublist: 0, isSelected: true }],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
    });

    const list = await resource.get(71);
    list.name = 'New Name';
    list.description = 'Updated';
    list.isForcedLanguage = true;
    list.items['Item A'].name = 'Renamed Item';
    list.items['Item A'].value = 'renamed';
    await list.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = putCall![0] as { body: Record<string, unknown> };
    expect(body.body.name).toBe('New Name');
    expect(body.body.description).toBe('Updated');
    expect(body.body.isForcedLanguage).toBe(true);
    const items = body.body.items as Array<Record<string, unknown>>;
    expect(items[0].name).toBe('Renamed Item');
    expect(items[0].value).toBe('renamed');
    expect(items[0].id).toBe('302');
  });

  it('List.save() sends sublist as string', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 75, name: 'Test', language: 'en',
        items: [{ id: 310, name: 'A', value: 'a', sequence: 1, listId: 75, sublist: 73, isSelected: false }],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const list = await resource.get(75);
    list.items['A'].sublistId = 99;
    await list.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const items = (putCall![0] as { body: { items: Array<{ sublist: string }> } }).body.items;
    expect(items[0].sublist).toBe('99');
  });

  it('List.removeItem() removes item by name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 71, name: 'Test', language: 'en',
        items: [
          { id: 302, name: 'Item A', value: 'a', sequence: 1, listId: 71, sublist: 0, isSelected: false },
          { id: 303, name: 'Item B', value: 'b', sequence: 2, listId: 71, sublist: 0, isSelected: false },
        ],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const list = await resource.get(71);
    expect(Object.keys(list.items)).toHaveLength(2);

    list.removeItem('Item A');
    expect(Object.keys(list.items)).toHaveLength(1);
    expect(list.items['Item B']).toBeDefined();
    expect(list.items['Item A']).toBeUndefined();

    await list.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const items = (putCall![0] as { body: { items: Array<{ name: string }> } }).body.items;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Item B');
  });

  it('List.removeItem() throws for unknown item', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 71, name: 'Test', language: 'en', items: [],
    });

    const list = await resource.get(71);
    expect(() => list.removeItem('NonExistent')).toThrow('not found');
  });

  it('List.addItem() adds a new item', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 71, name: 'Test', language: 'en',
        items: [{ id: 302, name: 'Existing', value: 'existing', sequence: 1, listId: 71, sublist: 0, isSelected: false }],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const list = await resource.get(71);
    expect(Object.keys(list.items)).toHaveLength(1);

    list.addItem({ name: 'New Item', value: 'new' });
    expect(Object.keys(list.items)).toHaveLength(2);
    expect(list.items['New Item'].name).toBe('New Item');
    expect(list.items['New Item'].value).toBe('new');
    expect(list.items['New Item'].selected).toBe(false);

    await list.save();

    const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
    );
    const items = (putCall![0] as { body: { items: Array<{ name: string; id: string }> } }).body.items;
    expect(items).toHaveLength(2);
    const newItem = items.find((i) => i.name === 'New Item');
    expect(newItem).toBeDefined();
    expect(newItem!.id).toBe('0');
  });

  it('List.addItem() supports selected and sublistId', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 71, name: 'Test', language: 'en', items: [],
    });

    const list = await resource.get(71);
    list.addItem({ name: 'With Options', value: 'opts', selected: true, sublistId: 99 });
    expect(list.items['With Options'].selected).toBe(true);
    expect(list.items['With Options'].sublistId).toBe(99);
  });

  it('List.addItem() throws for empty name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 71, name: 'Test', language: 'en', items: [],
    });

    const list = await resource.get(71);
    expect(() => list.addItem({ name: '', value: 'x' })).toThrow('name is required');
  });

  it('List.addItem() throws for duplicate name', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 71, name: 'Test', language: 'en',
      items: [{ id: 302, name: 'Existing', value: 'existing', sequence: 1, listId: 71, sublist: 0, isSelected: false }],
    });

    const list = await resource.get(71);
    expect(() => list.addItem({ name: 'Existing', value: 'dup' })).toThrow('already exists');
  });

  it('update() immutably updates a list', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'GET') return {
        id: 71, name: 'Old', description: '', language: 'en', items: [],
      };
      if (opts.method === 'PUT') return undefined;
      throw new Error('Unexpected');
    });

    const list = await resource.update(71, { name: 'Updated', isForcedLanguage: true });
    expect(list.name).toBe('Updated');
    expect(list.isForcedLanguage).toBe(true);
  });

  it('create() sends POST and returns a List', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string }) => {
      if (opts.method === 'POST') return {
        id: 76, name: 'New List', description: 'Desc', language: 'en',
        items: [{ id: 312, name: 'Item A', value: 'a', sequence: 1, listId: 76, sublist: 0, isSelected: true }],
      };
      throw new Error('Unexpected');
    });

    const list = await resource.create({
      name: 'New List',
      description: 'Desc',
      items: [{ name: 'Item A', value: 'a', selected: true }],
    });

    expect(list.id).toBe(76);
    expect(list.name).toBe('New List');
    expect(Object.keys(list.items)).toHaveLength(1);
    expect(list.items['Item A'].value).toBe('a');
  });

  it('create() throws if name is empty', async () => {
    await expect(resource.create({ name: '' })).rejects.toThrow('name is required');
  });

  it('create() defaults isForcedLanguage and isDefaultLanguage to false', async () => {
    let postBody: Record<string, unknown> = {};
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; body?: unknown }) => {
      if (opts.method === 'POST') {
        postBody = opts.body as Record<string, unknown>;
        return { id: 77, name: 'Test', language: 'en', items: [] };
      }
      throw new Error('Unexpected');
    });

    await resource.create({ name: 'Test' });

    expect(postBody.isForcedLanguage).toBe(false);
    expect(postBody.isDefaultLanguage).toBe(false);
  });

  it('create() throws if both isForcedLanguage and isDefaultLanguage are true', async () => {
    await expect(resource.create({ name: 'Test', isForcedLanguage: true, isDefaultLanguage: true }))
      .rejects.toThrow('cannot both be true');
  });

  it('List.save() throws if both isForcedLanguage and isDefaultLanguage are true', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 71, name: 'Test', language: 'en', items: [],
    });

    const list = await resource.get(71);
    list.isForcedLanguage = true;
    list.isDefaultLanguage = true;
    await expect(list.save()).rejects.toThrow('cannot both be true');
  });

  it('delete() sends DELETE /list/{id}', async () => {
    (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await resource.delete(76);
    expect(http.request).toHaveBeenCalledWith({ method: 'DELETE', path: '/list/76?override=false' });
  });
});
