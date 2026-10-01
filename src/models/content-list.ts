import { HttpClient } from '../http-client.js';
import { ContentItem } from './content-item.js';
import { OrderedList } from './ordered-list.js';

export type { ReorderOptions } from './ordered-list.js';

/**
 * An ordered list of {@link ContentItem}s for a section.
 *
 * `ContentList` extends `Array`, so it behaves like a normal array of content
 * items (`.map()`, `.length`, indexing, `for…of`, destructuring all work). On
 * top of that it adds {@link OrderedList.setOrder | setOrder} and
 * {@link OrderedList.reorder | reorder} for persisting the display order of
 * content within the section.
 *
 * Both ordering methods call the T4 API immediately and keep this array's
 * in-memory order in sync with the server.
 */
export class ContentList extends OrderedList<ContentItem> {
  protected readonly entityLabel = 'content';
  protected readonly scopeLabel!: string;

  private _httpClient!: HttpClient;
  private _sectionId!: number;
  private _language!: string;

  /**
   * Builds a ContentList from already-resolved items. Used internally by
   * `ContentResource.list()`. Not intended for direct construction.
   */
  static create(
    items: ContentItem[],
    httpClient: HttpClient,
    sectionId: number,
    language: string,
  ): ContentList {
    const list = new ContentList();
    list.push(...items);
    Object.defineProperty(list, '_httpClient', { value: httpClient, enumerable: false, writable: false });
    Object.defineProperty(list, '_sectionId', { value: sectionId, enumerable: false, writable: false });
    Object.defineProperty(list, '_language', { value: language, enumerable: false, writable: false });
    Object.defineProperty(list, 'scopeLabel', { value: `section ${sectionId}`, enumerable: false, writable: false });
    return list;
  }

  protected async moveToIndex(contentId: number, index: number): Promise<void> {
    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this._sectionId}/${this._language}/contents/${contentId}/index`,
      body: { id: contentId, index },
    });
  }
}
