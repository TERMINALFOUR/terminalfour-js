import { T4ApiError } from '../errors.js';

/**
 * Options for {@link OrderedList.reorder}. Exactly one property must be provided.
 */
export interface ReorderOptions {
  /** 1-based target position. `1` moves the item to the front. */
  position?: number;
  /** Move the item immediately before this item's ID. */
  before?: number;
  /** Move the item immediately after this item's ID. */
  after?: number;
  /** Move the item to the first or last position. */
  to?: 'first' | 'last';
}

/**
 * Base class for ordered, API-backed arrays. Extends `Array<T>` so instances
 * behave like normal arrays (`.map()`, `.length`, indexing, `for…of`), while
 * adding {@link setOrder} and {@link reorder} that persist a new display order
 * to the T4 API and keep the in-memory order in sync.
 *
 * Subclasses supply:
 * - the entity label used in error messages (`entityLabel`),
 * - a human-readable scope for errors (`scopeLabel`, e.g. `section 236`),
 * - the single-item move request (`moveToIndex`).
 *
 * Each T must expose a numeric `id`.
 *
 * ## Write path: one PUT per moved item
 *
 * T4's reorder endpoint moves a single item at a time:
 * `PUT /hierarchy/{id}/{lang}/{contents|subsections}/{itemId}/index` with
 * `{ id, index }` (0-based). `reorder` sends one such request; `setOrder`
 * sends one per item at ascending indices. There is no working bulk endpoint
 * on the server versions tested (a bulk `…/contents` PUT returns 500), so
 * `setOrder` is a sequence of single-item moves and is therefore **not
 * atomic**: if one move fails midway, earlier moves have already applied. The
 * in-memory order is only updated for moves that succeed.
 *
 * ## Auto-sorted sections and pinned items
 *
 * A section can sort its children automatically (alphabetical, by date). Such
 * a section still lets a few items be "pinned" to the top or bottom and ordered
 * manually. The SDK does not try to predict which moves are allowed: it sends
 * the move and, if the server rejects it (`417 invalid_index_collection` —
 * e.g. moving an auto-sorted item, or moving a pinned item outside its block),
 * rethrows a clear error via {@link describeReorderRejection}. Pinned-item
 * reorders, and reorders in fully-manual sections, go through unchanged.
 */
export abstract class OrderedList<T extends { id: number }> extends Array<T> {
  // Derived arrays (map/filter/slice/etc.) are plain Arrays — the subclass
  // constructors aren't drop-in replacements for Array(length).
  static get [Symbol.species](): ArrayConstructor {
    return Array;
  }

  /** Noun for a single item in error messages, e.g. `'content'` or `'section'`. */
  protected abstract readonly entityLabel: string;

  /** Scope phrase for error messages, e.g. `'section 236'`. */
  protected abstract readonly scopeLabel: string;

  /**
   * Persists a single move to the API: place `id` at the 0-based `index`.
   * Subclasses implement the specific endpoint.
   */
  protected abstract moveToIndex(id: number, index: number): Promise<void>;

  /**
   * Throws when the list's section is read-only (a mirror), so reordering is
   * blocked. Called after input validation but before any API call. Subclasses
   * that live in a section override this; the default is a no-op.
   */
  protected async assertWritable(): Promise<void> {
    // Default: writable. Overridden by section-backed lists.
  }

  private get ids(): number[] {
    return this.map((item) => item.id);
  }

  /**
   * Wraps the single-item move, turning the server's "this move isn't allowed"
   * rejection into a clear, actionable error. T4 answers `417` with
   * `invalid_index_collection` when the target index is not permitted — the
   * common cause is an auto-sorted section (the item is not pinned, or a pinned
   * item was moved outside its top/bottom block). Other errors pass through.
   */
  private async move(id: number, index: number): Promise<void> {
    try {
      await this.moveToIndex(id, index);
    } catch (error) {
      if (error instanceof T4ApiError && isInvalidIndexCollection(error)) {
        throw new Error(
          `Terminalfour rejected moving ${this.entityLabel} ${id} to position ${index + 1} in ` +
          `${this.scopeLabel}. This usually means the section is sorted automatically and the ` +
          `item is not pinned, or a pinned item was moved outside its top/bottom block — only ` +
          `pinned items can be ordered in an auto-sorted section. (Server: invalid_index_collection.)`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  /**
   * Replaces the entire order for this list.
   *
   * The passed array must contain exactly the IDs currently in this list — no
   * more, no fewer, no duplicates. Throws a descriptive error otherwise and
   * makes no API calls.
   *
   * Persists the order as one move per item at ascending indices, then updates
   * this array's in-memory order to match. Not atomic (see the class note): a
   * mid-sequence failure leaves earlier moves applied.
   */
  async setOrder(orderedIds: number[]): Promise<void> {
    const currentIds = this.ids;
    const currentSet = new Set(currentIds);

    const seen = new Set<number>();
    const duplicates: number[] = [];
    for (const id of orderedIds) {
      if (seen.has(id)) duplicates.push(id);
      seen.add(id);
    }
    if (duplicates.length > 0) {
      throw new Error(
        `setOrder received duplicate ${this.entityLabel} ID(s): ${duplicates.join(', ')}. Pass each ID exactly once.`,
      );
    }

    const missing = currentIds.filter((id) => !seen.has(id));
    const unknown = orderedIds.filter((id) => !currentSet.has(id));
    if (missing.length > 0 || unknown.length > 0) {
      const parts: string[] = [];
      if (missing.length > 0) parts.push(`missing: ${missing.join(', ')}`);
      if (unknown.length > 0) parts.push(`not in ${this.scopeLabel}: ${unknown.join(', ')}`);
      throw new Error(
        `setOrder must be passed every ${this.entityLabel} ID in ${this.scopeLabel} exactly once (${parts.join('; ')}).`,
      );
    }

    // Blocked if the section is a mirror (read-only). After validation so bad
    // input still fails fast without a network call.
    await this.assertWritable();

    const byId = new Map(this.map((item) => [item.id, item]));
    for (let i = 0; i < orderedIds.length; i++) {
      await this.move(orderedIds[i], i);
    }

    const reordered = orderedIds.map((id) => byId.get(id)!);
    this.length = 0;
    this.push(...reordered);
  }

  /**
   * Moves a single item to a new position within this list.
   *
   * Provide exactly one of `position` (1-based), `before`, `after`, or `to`.
   * Persists the move and updates this array's in-memory order. Throws (with no
   * API call) on an unknown target ID, an unknown sibling, or invalid options.
   */
  async reorder(id: number, options: ReorderOptions): Promise<void> {
    const fromIndex = this.findIndex((item) => item.id === id);
    if (fromIndex === -1) {
      throw new Error(
        `Cannot reorder ${this.entityLabel} ${id}: it is not in ${this.scopeLabel}.`,
      );
    }

    const provided = (['position', 'before', 'after', 'to'] as const).filter(
      (key) => options[key] !== undefined,
    );
    if (provided.length === 0) {
      throw new Error('reorder requires exactly one of: position, before, after, or to.');
    }
    if (provided.length > 1) {
      throw new Error(
        `reorder accepts exactly one of: position, before, after, or to (received ${provided.join(', ')}).`,
      );
    }

    // Compute the target index against the list WITHOUT the moved item, so
    // before/after reference positions are stable and the same index is valid
    // for both the wire PUT and the in-memory splice.
    const withoutMoved = this.filter((item) => item.id !== id);
    let targetIndex: number;

    if (options.position !== undefined) {
      if (!Number.isInteger(options.position) || options.position < 1) {
        throw new Error(
          `reorder position must be a positive integer (1-based), received ${options.position}.`,
        );
      }
      targetIndex = Math.min(options.position, this.length) - 1;
    } else if (options.to !== undefined) {
      if (options.to !== 'first' && options.to !== 'last') {
        throw new Error(`reorder "to" must be 'first' or 'last', received '${options.to}'.`);
      }
      targetIndex = options.to === 'first' ? 0 : withoutMoved.length;
    } else {
      const siblingId = (options.before ?? options.after) as number;
      if (siblingId === id) {
        throw new Error(
          `reorder ${options.before !== undefined ? 'before' : 'after'} cannot reference the item being moved (${id}).`,
        );
      }
      const siblingIndex = withoutMoved.findIndex((item) => item.id === siblingId);
      if (siblingIndex === -1) {
        throw new Error(
          `Cannot reorder relative to ${this.entityLabel} ${siblingId}: it is not in ${this.scopeLabel}.`,
        );
      }
      targetIndex = options.before !== undefined ? siblingIndex : siblingIndex + 1;
    }

    // Blocked if the section is a mirror (read-only). After validation so bad
    // input still fails fast without a network call.
    await this.assertWritable();

    await this.move(id, targetIndex);

    const [moved] = this.splice(fromIndex, 1);
    this.splice(targetIndex, 0, moved);
  }
}

/** True when a T4ApiError is the reorder "invalid_index_collection" rejection. */
function isInvalidIndexCollection(error: T4ApiError): boolean {
  const body = error.responseBody as { errorMessage?: string } | string | null | undefined;
  if (body && typeof body === 'object' && body.errorMessage === 'invalid_index_collection') {
    return true;
  }
  return typeof body === 'string' && body.includes('invalid_index_collection');
}
