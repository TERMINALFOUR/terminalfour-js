import { HttpClient } from '../http-client.js';
import { ContentItem } from './content-item.js';

/**
 * Options for {@link ContentList.reorder}. Exactly one property must be provided.
 */
export interface ReorderOptions {
  /** 1-based target position. `1` moves the item to the front. */
  position?: number;
  /** Move the item immediately before this content ID. */
  before?: number;
  /** Move the item immediately after this content ID. */
  after?: number;
  /** Move the item to the first or last position. */
  to?: 'first' | 'last';
}

/**
 * An ordered list of {@link ContentItem}s for a section.
 *
 * `ContentList` extends `Array`, so it behaves like a normal array of content
 * items (`.map()`, `.length`, indexing, `for…of`, destructuring all work). On
 * top of that it adds {@link setOrder} and {@link reorder} for persisting the
 * display order of content within the section.
 *
 * Both ordering methods call the T4 API immediately and keep this array's
 * in-memory order in sync with the server.
 */
export class ContentList extends Array<ContentItem> {
  private _httpClient!: HttpClient;
  private _sectionId!: number;
  private _language!: string;

  // Ensure derived arrays (map/filter/slice/etc.) are plain Arrays, not
  // ContentList — our constructor isn't a drop-in for Array(length).
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

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
    return list;
  }

  /**
   * Sends a single move request to the T4 API.
   * @param contentId The content ID to move.
   * @param index The 0-based target index on the wire.
   */
  private async moveToIndex(contentId: number, index: number): Promise<void> {
    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this._sectionId}/${this._language}/contents/${contentId}/index`,
      body: { id: contentId, index },
    });
  }

  /**
   * Replaces the entire content order for the section.
   *
   * The passed array must contain exactly the content IDs currently in this
   * section — no more, no fewer. Throws a descriptive error otherwise.
   *
   * Persists the new order to T4 (one request per item, in sequence) and
   * updates this array's in-memory order to match.
   */
  async setOrder(orderedIds: number[]): Promise<void> {
    const currentIds = this.map((item) => item.id);
    const currentSet = new Set(currentIds);

    // Detect duplicates in the input
    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const id of orderedIds) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    if (duplicates.length > 0) {
      throw new Error(
        `setOrder received duplicate content ID(s): ${duplicates.join(', ')}. Pass each content ID exactly once.`,
      );
    }

    const missing = currentIds.filter((id) => !seen.has(id));
    const unknown = orderedIds.filter((id) => !currentSet.has(id));
    if (missing.length > 0 || unknown.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
      if (unknown.length > 0) parts.push(`not in this section: ${unknown.join(', ')}`);
      throw new Error(
        `setOrder must be passed every content ID in section ${this._sectionId} exactly once (${parts.join('; ')}).`,
      );
    }

    // No bulk endpoint exists — walk each item into its target position in
    // sequence. Placing item at index i (ascending) leaves already-placed
    // prefix [0..i-1] fixed, so a single pass is sufficient and index shifts
    // from earlier moves are already accounted for.
    const byId = new Map(this.map((item) => [item.id, item]));
    for (let i = 0; i < orderedIds.length; i++) {
      await this.moveToIndex(orderedIds[i], i);
    }

    // Update in-memory order to match.
    const reordered = orderedIds.map((id) => byId.get(id)!);
    this.length = 0;
    this.push(...reordered);
  }

  /**
   * Moves a single content item to a new position within the section.
   *
   * Provide exactly one of `position` (1-based), `before`, `after`, or `to`.
   * Persists the move to T4 and updates this array's in-memory order.
   */
  async reorder(contentId: number, options: ReorderOptions): Promise<void> {
    const fromIndex = this.findIndex((item) => item.id === contentId);
    if (fromIndex === -1) {
      throw new Error(
        `Cannot reorder content ${contentId}: it is not in section ${this._sectionId}.`,
      );
    }

    const provided = (['position', 'before', 'after', 'to'] as const).filter(
      (key) => options[key] !== undefined,
    );
    if (provided.length === 0) {
      throw new Error(
        'reorder requires exactly one of: position, before, after, or to.',
      );
    }
    if (provided.length > 1) {
      throw new Error(
        `reorder accepts exactly one of: position, before, after, or to (received ${provided.join(', ')}).`,
      );
    }

    // Compute the target index in the array as it would be WITHOUT the moved
    // item, so before/after reference positions are stable.
    const withoutMoved = this.filter((item) => item.id !== contentId);
    let targetIndex: number;

    if (options.position !== undefined) {
      if (!Number.isInteger(options.position) || options.position < 1) {
        throw new Error(
          `reorder position must be a positive integer (1-based), received ${options.position}.`,
        );
      }
      // Clamp to the valid range [1, length].
      targetIndex = Math.min(options.position, this.length) - 1;
    } else if (options.to !== undefined) {
      if (options.to !== 'first' && options.to !== 'last') {
        throw new Error(
          `reorder "to" must be 'first' or 'last', received '${options.to}'.`,
        );
      }
      targetIndex = options.to === 'first' ? 0 : withoutMoved.length;
    } else {
      const siblingId = (options.before ?? options.after) as number;
      if (siblingId === contentId) {
        throw new Error(
          `reorder ${options.before !== undefined ? 'before' : 'after'} cannot reference the item being moved (${contentId}).`,
        );
      }
      const siblingIndex = withoutMoved.findIndex((item) => item.id === siblingId);
      if (siblingIndex === -1) {
        throw new Error(
          `Cannot reorder relative to content ${siblingId}: it is not in section ${this._sectionId}.`,
        );
      }
      targetIndex = options.before !== undefined ? siblingIndex : siblingIndex + 1;
    }

    await this.moveToIndex(contentId, targetIndex);

    // Update in-memory order: remove the moved item, splice it back at target.
    const [moved] = this.splice(fromIndex, 1);
    this.splice(targetIndex, 0, moved);
  }
}
