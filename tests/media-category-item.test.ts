import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaCategoryItem } from '../src/models/media-category-item.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const rawCategory = {
  id: 367,
  parent: 366,
  name: 'Parallax Images',
  description: 'Parallax Images',
  status: 0,
  lastModified: 1452619968000,
  path: 'Media Library &raquo; Images &raquo; Parallax Images',
  channels: [],
  userIDs: [],
};

describe('MediaCategoryItem', () => {
  let http: HttpClient;

  beforeEach(() => {
    http = mockHttpClient();
  });

  it('exposes read-only id, parentId, path, lastModified', () => {
    const item = new MediaCategoryItem(rawCategory, http, 'en');
    expect(item.id).toBe(367);
    expect(item.parentId).toBe(366);
    expect(item.path).toBe('Media Library » Images » Parallax Images');
    expect(item.lastModified).toEqual(new Date(1452619968000));
  });

  it('exposes mutable name', () => {
    const item = new MediaCategoryItem(rawCategory, http, 'en');
    expect(item.name).toBe('Parallax Images');
    item.name = 'Updated';
    expect(item.name).toBe('Updated');
  });

  it('handles null parent', () => {
    const item = new MediaCategoryItem({ ...rawCategory, parent: null }, http, 'en');
    expect(item.parentId).toBeNull();
  });

  it('handles missing lastModified', () => {
    const item = new MediaCategoryItem({ ...rawCategory, lastModified: 0 }, http, 'en');
    expect(item.lastModified).toBeNull();
  });

  describe('save()', () => {
    it('sends PUT to /mediacategory/{id}/{language} with full body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      const item = new MediaCategoryItem(rawCategory, http, 'en');
      item.name = 'New Name';
      await item.save();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('PUT');
      expect(callArgs.path).toBe('/mediacategory/367/en');
      expect(callArgs.body.name).toBe('New Name');
      expect(callArgs.body.id).toBe(367); // preserved
      expect(callArgs.body.channels).toEqual([]); // preserved
    });

    it('updates internal raw data for subsequent saves', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const item = new MediaCategoryItem(rawCategory, http, 'en');
      item.name = 'First Update';
      await item.save();

      item.name = 'Second Update';
      await item.save();

      const secondCall = (http.request as ReturnType<typeof vi.fn>).mock.calls[1][0];
      expect(secondCall.body.name).toBe('Second Update');
    });
  });
});
