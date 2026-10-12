import { HttpClient } from '../http-client.js';
import { OrderedList } from './ordered-list.js';
import { assertManualSortType } from '../utils.js';

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
 * Both ordering methods call the T4 API immediately (one bulk request) and keep
 * this array's in-memory order in sync with the server.
 *
 * ## Language scope
 *
 * The list reflects the child sections that exist in the requested language.
 * Reordering sends the full observed order in one bulk request, and the server
 * positions those children relative to one another — there is no absolute-index
 * arithmetic that untranslated siblings could offset. If a parent mixes
 * languages, reorder within a single language at a time.
 */
export class SubsectionList extends OrderedList<SubsectionSummary> {
  protected readonly entityLabel = 'section';
  protected readonly scopeLabel!: string;

  private _httpClient!: HttpClient;
  private _parentSectionId!: number;
  private _language!: string;
  private _sortType!: number;

  /**
   * Builds a SubsectionList from already-resolved summaries. Used internally by
   * `SectionRef.subsections()`. Not intended for direct construction.
   *
   * `sortType` is the parent's subsection sort type from the list response
   * (`0` = manual). It gates whether reordering is permitted.
   */
  static create(
    items: SubsectionSummary[],
    httpClient: HttpClient,
    parentSectionId: number,
    language: string,
    sortType: number,
  ): SubsectionList {
    const list = new SubsectionList();
    list.push(...items);
    Object.defineProperty(list, '_httpClient', { value: httpClient, enumerable: false, writable: false });
    Object.defineProperty(list, '_parentSectionId', { value: parentSectionId, enumerable: false, writable: false });
    Object.defineProperty(list, '_language', { value: language, enumerable: false, writable: false });
    Object.defineProperty(list, '_sortType', { value: sortType, enumerable: false, writable: false });
    Object.defineProperty(list, 'scopeLabel', { value: `section ${parentSectionId}`, enumerable: false, writable: false });
    return list;
  }

  protected async persistOrder(orderedIds: number[]): Promise<void> {
    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this._parentSectionId}/${this._language}/subsections`,
      body: orderedIds.map((id, index) => ({ id, index })),
    });
  }

  /** Subsections of an auto-sorted parent can't be manually reordered. */
  protected async assertManuallySorted(): Promise<void> {
    assertManualSortType(this._sortType, 'section', this._parentSectionId);
  }
}
