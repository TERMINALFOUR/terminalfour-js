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
 * - the bulk reorder request (`persistOrder`).
 *
 * Each T must expose a numeric `id`.
 *
 * ## Ordering is a single atomic request
 *
 * Both `setOrder` and `reorder` compute the full desired order and persist it
 * with ONE bulk PUT (`persistOrder`). The T4 API applies the whole list in a
 * single transaction, so a partial failure can't leave the section half
 * reordered. (The older per-item index endpoint is not used — it is not
 * transactional and is unreliable on some server versions.)
 *
 * ## Auto-sorted sections
 *
 * A section whose children are automatically sorted (alphabetical, by date,
 * etc.) ignores a manual order: the server would silently re-sort, so a reorder
 * is a no-op or an error. Subclasses that know the section's sort type override
 * {@link assertManuallySorted} to refuse reordering with a clear message rather
 * than reporting a success that didn't happen.
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
   * Persists a complete new order to the API in a single request. `orderedIds`
   * is the full set of IDs in this list, in the desired order. Subclasses
   * implement the specific bulk endpoint.
   */
  protected abstract persistOrder(orderedIds: number[]): Promise<void>;

  /**
   * Throws when the list's section is read-only (a mirror), so reordering is
   * blocked. Called after input validation but before any API call. Subclasses
   * that live in a section override this; the default is a no-op.
   */
  protected async assertWritable(): Promise<void> {
    // Default: writable. Overridden by section-backed lists.
  }

  /**
   * Throws when the section is not manually sorted, so a manual order would be
   * ignored by the server. Called after input validation but before any API
   * call. Subclasses that know the section's sort type override this; the
   * default is a no-op.
   */
  protected async assertManuallySorted(): Promise<void> {
    // Default: assume manual. Overridden by section-backed lists.
  }

  private get ids(): number[] {
    return this.map((item) => item.id);
  }

  /**
   * Replaces the entire order for this list.
   *
   * The passed array must contain exactly the IDs currently in this list — no
   * more, no fewer, no duplicates. Throws a descriptive error otherwise and
   * makes no API calls.
   *
   * Persists the new order in a single bulk request and updates this array's
   * in-memory order to match.
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

    // Guards run after input validation so bad input still fails fast without a
    // network call, but before persisting so we never claim a reorder that the
    // server would reject or ignore.
    await this.assertManuallySorted();
    await this.assertWritable();

    const byId = new Map(this.map((item) => [item.id, item]));
    await this.persistOrder(orderedIds);

    const reordered = orderedIds.map((id) => byId.get(id)!);
    this.length = 0;
    this.push(...reordered);
  }

  /**
   * Moves a single item to a new position within this list.
   *
   * Provide exactly one of `position` (1-based), `before`, `after`, or `to`.
   * Persists the resulting full order in a single bulk request and updates this
   * array's in-memory order. Throws (with no API call) on an unknown target ID,
   * an unknown sibling, or invalid options.
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
    // for the in-memory splice.
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

    // Guards run after input validation, before any API call.
    await this.assertManuallySorted();
    await this.assertWritable();

    // Build the full desired order and persist it in one request.
    const moved = this[fromIndex];
    const nextOrder = withoutMoved.slice();
    nextOrder.splice(targetIndex, 0, moved);
    await this.persistOrder(nextOrder.map((item) => item.id));

    this.length = 0;
    this.push(...nextOrder);
  }
}
