import { HttpClient } from '../http-client.js';
import { OrderedList } from './ordered-list.js';

/** A direct child section as returned by `section(id).subsections()`. */
export interface SubsectionSummary {
  id: number;
  name: string;
  lastModified: Date | null;
}

/**
 * An ordered list of direct child sections for a parent section.
 *
 * `SubsectionList` extends `Array`, so it behaves like a normal array of
 * `{ id, name, lastModified }` summaries (`.map()`, `.length`, indexing,
 * `for…of`). On top of that it adds {@link OrderedList.setOrder | setOrder} and
 * {@link OrderedList.reorder | reorder} for persisting the display order of
 * subsections under their parent.
 *
 * Both ordering methods call the T4 API immediately and keep this array's
 * in-memory order in sync with the server.
 */
export class SubsectionList extends OrderedList<SubsectionSummary> {
  protected readonly entityLabel = 'section';
  protected readonly scopeLabel!: string;

  private _httpClient!: HttpClient;
  private _parentSectionId!: number;
  private _language!: string;

  /**
   * Builds a SubsectionList from already-resolved summaries. Used internally by
   * `SectionRef.subsections()`. Not intended for direct construction.
   */
  static create(
    items: SubsectionSummary[],
    httpClient: HttpClient,
    parentSectionId: number,
    language: string,
  ): SubsectionList {
    const list = new SubsectionList();
    list.push(...items);
    Object.defineProperty(list, '_httpClient', { value: httpClient, enumerable: false, writable: false });
    Object.defineProperty(list, '_parentSectionId', { value: parentSectionId, enumerable: false, writable: false });
    Object.defineProperty(list, '_language', { value: language, enumerable: false, writable: false });
    Object.defineProperty(list, 'scopeLabel', { value: `section ${parentSectionId}`, enumerable: false, writable: false });
    return list;
  }

  protected async moveToIndex(childId: number, index: number): Promise<void> {
    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this._parentSectionId}/${this._language}/subsections/${childId}/index`,
      body: { id: childId, index },
    });
  }
}
