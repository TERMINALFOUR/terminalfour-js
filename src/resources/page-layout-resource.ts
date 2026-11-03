import { HttpClient } from '../http-client.js';
import { decodeHtmlEntities, TtlValue, readPrimaryGroup, readSharedGroups, writePrimaryGroup, writeSharedGroups, assertGroupsValid, assertRequired, RawPrimaryGroup } from '../utils.js';

/** Friendly processor keys accepted for page layouts. */
export type PageLayoutProcessor = 't4-tags' | 'handlebars' | 'programmable-layouts';

/** Friendly processor keys mapped to API names for page layouts */
const PAGE_PROCESSOR_MAP: Record<PageLayoutProcessor, string> = {
  't4-tags': 'T4 Tag Page',
  'handlebars': 'Handlebars Page',
  'programmable-layouts': 'Programmable Layout Page',
};

/** Processor used by `create()` when none is passed. Resolved by name on the instance. */
const DEFAULT_PAGE_PROCESSOR: PageLayoutProcessor = 'handlebars';

/** Syntax used by `create()` when none is passed. Resolved by name on the instance. */
const DEFAULT_PAGE_SYNTAX = 'HTML/XML';

/** Raw page layout from the API */
interface RawPageLayout {
  id: number;
  name: string;
  description?: string;
  primaryGroup?: { id: number | null; group?: { id: number } };
  sharedGroups?: Array<{ id: number }>;
  [key: string]: unknown;
}

/** Raw page layout detail from GET /pageLayout/{id} */
interface RawPageLayoutDetail {
  id: number;
  name: string;
  description?: string;
  headerCode?: string;
  footerCode?: string;
  stylesheetCode?: string;
  fileExtension?: string;
  syntaxType?: number | string;
  layoutProcessor?: number | string;
  primaryGroup?: RawPrimaryGroup;
  sharedGroups?: Array<{ id: number }>;
  [key: string]: unknown;
}

/** A page layout summary returned from list() */
export interface PageLayoutSummary {
  id: number;
  name: string;
  description: string;
}

/**
 * Instance lookups shared between `PageLayoutResource` and the `PageLayout`
 * objects it returns, so `save()` resolves against the same cached data as
 * `create()`.
 * @internal
 */
interface PageLayoutLookups {
  getSyntaxMap(): Promise<Map<number, string>>;
  getProcessorMap(): Promise<Map<number, string>>;
  getFileExtensions(): Promise<string[]>;
}

/** Values of the instance-resolved fields as last read from / written to the server. */
interface ResolvedBaseline {
  syntax: string;
  processor: string;
  fileExtension: string;
}

/**
 * Resolves a syntax name (case-insensitive) to its instance ID.
 * @throws when the syntax isn't available on the instance, listing the valid options.
 */
function resolveSyntaxId(syntaxMap: Map<number, string>, syntax: string): number {
  const match = Array.from(syntaxMap.entries()).find(([, name]) => name.toLowerCase() === syntax.toLowerCase());
  if (!match) {
    const valid = Array.from(syntaxMap.values()).join(', ');
    throw new Error(`Unknown syntax "${syntax}". Valid options: ${valid}`);
  }
  return match[0];
}

/**
 * Resolves a friendly processor key to its instance ID. Only the keys in
 * `PAGE_PROCESSOR_MAP` are accepted — raw API names are rejected.
 * @throws when the key is unknown, or the processor isn't available on the instance.
 */
function resolveProcessorId(processorMap: Map<number, string>, processor: string): number {
  const apiName = Object.prototype.hasOwnProperty.call(PAGE_PROCESSOR_MAP, processor)
    ? PAGE_PROCESSOR_MAP[processor as PageLayoutProcessor]
    : undefined;
  if (!apiName) {
    throw new Error(`Unknown processor "${processor}". Valid options: ${Object.keys(PAGE_PROCESSOR_MAP).join(', ')}`);
  }
  const match = Array.from(processorMap.entries()).find(([, name]) => name === apiName);
  if (!match) {
    const available = Array.from(processorMap.values()).join(', ');
    throw new Error(`Processor "${apiName}" not found on this T4 instance. Available processors: ${available}`);
  }
  return match[0];
}

/**
 * Validates a file extension against the instance's extensions and returns
 * the instance's canonical casing. An empty extension means None and makes
 * no lookup.
 * @throws `Unknown extension` when it doesn't match, or `Could not validate file extension`
 *   (with the original error as `cause`) when the lookup itself fails.
 */
async function resolveFileExtension(lookups: PageLayoutLookups, fileExtension: string): Promise<string> {
  if (!fileExtension) return '';
  let extensions: string[];
  try {
    extensions = await lookups.getFileExtensions();
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Could not validate file extension "${fileExtension}": ${reason}`, { cause });
  }
  const match = extensions.find((e) => e.toLowerCase() === fileExtension.toLowerCase());
  if (match === undefined) {
    throw new Error(`Unknown extension "${fileExtension}". Valid options: ${extensions.join(', ')}`);
  }
  return match;
}

/** A mutable page layout object. */
export class PageLayout {
  readonly id: number;
  name: string;
  description: string;
  headerCode: string;
  footerCode: string;
  /** File extension, or `''` for None. Validated against the instance on `save()` when changed. */
  fileExtension: string;
  /** Syntax name (e.g. `'HTML/XML'`). Resolved against the instance on `save()` when changed. */
  syntax: string;
  /**
   * Processor key: `'t4-tags'`, `'handlebars'` or `'programmable-layouts'`. May read back as a
   * raw API name or `unknown (id)` for processors outside those keys; such values are sent
   * unchanged on `save()`, but setting a new value must be one of the three keys.
   */
  processor: string;
  /** Owning group ID. 0 = no primary group (Global). */
  primaryGroup: number;
  /** Group IDs this page layout is shared with. */
  sharedGroups: number[];

  private readonly _httpClient!: HttpClient;
  private _rawData!: RawPageLayoutDetail;
  private readonly _lookups!: PageLayoutLookups;
  private _baseline!: ResolvedBaseline;

  /** @internal Construct via `t4.pageLayouts.get()` / `create()`. */
  constructor(
    raw: RawPageLayoutDetail,
    httpClient: HttpClient,
    syntaxMap: Map<number, string>,
    processorMap: Map<number, string>,
    lookups: PageLayoutLookups,
  ) {
    this.id = raw.id;
    this.name = decodeHtmlEntities(raw.name);
    this.description = decodeHtmlEntities(raw.description ?? '');
    this.headerCode = raw.headerCode ?? '';
    this.footerCode = raw.footerCode ?? '';
    this.fileExtension = raw.fileExtension ?? '';
    this.syntax = syntaxMap.get(Number(raw.syntaxType ?? 0)) ?? `unknown (${raw.syntaxType})`;

    const procName = processorMap.get(Number(raw.layoutProcessor ?? 0)) ?? '';
    const procEntry = Object.entries(PAGE_PROCESSOR_MAP).find(([, apiName]) => apiName === procName);
    this.processor = procEntry ? procEntry[0] : procName || `unknown (${raw.layoutProcessor})`;
    this.primaryGroup = readPrimaryGroup(raw.primaryGroup);
    this.sharedGroups = readSharedGroups(raw.sharedGroups);
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw, enumerable: false, writable: true });
    Object.defineProperty(this, '_lookups', { value: lookups, enumerable: false });
    Object.defineProperty(this, '_baseline', { value: this.currentResolvedValues(), enumerable: false, writable: true });
  }

  private currentResolvedValues(): ResolvedBaseline {
    return { syntax: this.syntax, processor: this.processor, fileExtension: this.fileExtension };
  }

  /**
   * Persists current property values to the server via PUT.
   *
   * `syntax`, `processor` and `fileExtension` are only resolved against the instance when they
   * differ from the last read/saved value; unchanged values are sent as their existing raw IDs,
   * so a layout with an unmapped processor can still have unrelated fields saved. A changed value
   * that can't be resolved throws before any request is sent.
   */
  async save(): Promise<void> {
    assertRequired(this.name, 'Page layout name');
    assertGroupsValid(this.primaryGroup, this.sharedGroups);

    const baseline = this._baseline;
    const syntaxId = this.syntax === baseline.syntax
      ? this._rawData.syntaxType
      : resolveSyntaxId(await this._lookups.getSyntaxMap(), this.syntax);
    const processorId = this.processor === baseline.processor
      ? this._rawData.layoutProcessor
      : resolveProcessorId(await this._lookups.getProcessorMap(), this.processor);
    const fileExtension = this.fileExtension === baseline.fileExtension
      ? this.fileExtension
      : await resolveFileExtension(this._lookups, this.fileExtension);

    const updated: RawPageLayoutDetail = {
      ...this._rawData,
      name: this.name,
      description: this.description,
      headerCode: this.headerCode,
      footerCode: this.footerCode,
      fileExtension,
      syntaxType: String(syntaxId),
      layoutProcessor: String(processorId),
      primaryGroup: writePrimaryGroup(this.primaryGroup) as RawPrimaryGroup,
      sharedGroups: writeSharedGroups(this.sharedGroups),
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/pageLayout/${this.id}`,
      body: updated,
    });

    this._rawData = updated;
    this.fileExtension = fileExtension;
    this._baseline = this.currentResolvedValues();
  }
}

/**
 * Returns the cached promise in `slot`, or starts `load()` and caches it.
 * A rejected promise is evicted so the next call refetches rather than
 * replaying the failure for the rest of the TTL.
 */
function cachedLookup<T>(slot: TtlValue<Promise<T>>, load: () => Promise<T>): Promise<T> {
  const cached = slot.get();
  if (cached) return cached;
  const promise = load();
  slot.set(promise);
  promise.catch(() => {
    if (slot.get() === promise) slot.clear();
  });
  return promise;
}

/**
 * Resource for page layout operations.
 */
export class PageLayoutResource {
  private readonly httpClient: HttpClient;
  private readonly syntaxMapCache = new TtlValue<Promise<Map<number, string>>>();
  private readonly processorMapCache = new TtlValue<Promise<Map<number, string>>>();
  private readonly fileExtensionsCache = new TtlValue<Promise<string[]>>();
  private readonly lookups: PageLayoutLookups;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
    this.lookups = {
      getSyntaxMap: () => this.getSyntaxMap(),
      getProcessorMap: () => this.getProcessorMap(),
      getFileExtensions: () => this.getFileExtensions(),
    };
  }

  private getSyntaxMap(): Promise<Map<number, string>> {
    return cachedLookup(this.syntaxMapCache, () =>
      this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/syntaxType',
      }).then((types) => new Map(types.map((t) => [t.id, t.name]))));
  }

  private getProcessorMap(): Promise<Map<number, string>> {
    return cachedLookup(this.processorMapCache, () =>
      this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/publishProcessor/10',
      }).then((procs) => new Map(procs.map((p) => [p.id, p.name]))));
  }

  private getFileExtensions(): Promise<string[]> {
    return cachedLookup(this.fileExtensionsCache, () =>
      this.httpClient.request<Array<{ extension: string }>>({
        method: 'GET',
        path: '/fileExtension',
      }).then((exts) => exts.map((e) => e.extension)));
  }

  /** Lists all page layouts. */
  async list(): Promise<PageLayoutSummary[]> {
    const raw = await this.httpClient.request<RawPageLayout[]>({
      method: 'GET',
      path: '/pageLayout',
    });
    return raw.map((l) => ({
      id: l.id,
      name: decodeHtmlEntities(l.name),
      description: decodeHtmlEntities(l.description ?? ''),
    }));
  }

  /** Gets a single page layout by ID. Returns a mutable PageLayout object. */
  async get(id: number): Promise<PageLayout> {
    const [raw, syntaxMap, processorMap] = await Promise.all([
      this.httpClient.request<RawPageLayoutDetail>({ method: 'GET', path: `/pageLayout/${id}` }),
      this.getSyntaxMap(),
      this.getProcessorMap(),
    ]);
    return new PageLayout(raw, this.httpClient, syntaxMap, processorMap, this.lookups);
  }

  /**
   * Updates a page layout's properties (immutable pattern). Delegates to `PageLayout.save()`,
   * so changed `syntax`, `processor` and `fileExtension` values are resolved against the
   * instance and throw when they can't be.
   */
  async update(id: number, data: {
    name?: string;
    description?: string;
    headerCode?: string;
    footerCode?: string;
    fileExtension?: string;
    syntax?: string;
    processor?: PageLayoutProcessor;
    primaryGroup?: number;
    sharedGroups?: number[];
  }): Promise<PageLayout> {
    const layout = await this.get(id);
    if (data.name !== undefined) layout.name = data.name;
    if (data.description !== undefined) layout.description = data.description;
    if (data.headerCode !== undefined) layout.headerCode = data.headerCode;
    if (data.footerCode !== undefined) layout.footerCode = data.footerCode;
    if (data.fileExtension !== undefined) layout.fileExtension = data.fileExtension;
    if (data.syntax !== undefined) layout.syntax = data.syntax;
    if (data.processor !== undefined) layout.processor = data.processor;
    if (data.primaryGroup !== undefined) layout.primaryGroup = data.primaryGroup;
    if (data.sharedGroups !== undefined) layout.sharedGroups = data.sharedGroups;
    await layout.save();
    return layout;
  }

  /**
   * Creates a new page layout. Every instance-specific value is resolved against the instance —
   * nothing is hardcoded:
   * - `processor` defaults to `'handlebars'`; throws if it isn't available.
   * - `syntax` defaults to `'HTML/XML'` (matched by name); throws if it isn't available.
   * - `fileExtension` defaults to None (`''`) with no lookup; an explicit value is validated and
   *   a failed lookup throws rather than creating the layout without it.
   */
  async create(data: {
    name: string;
    description?: string;
    headerCode?: string;
    footerCode?: string;
    syntax?: string;
    processor?: PageLayoutProcessor;
    fileExtension?: string;
    primaryGroup?: number;
    sharedGroups?: number[];
  }): Promise<PageLayout> {
    assertRequired(data.name, 'Page layout name');
    assertGroupsValid(data.primaryGroup ?? 0, data.sharedGroups);

    const [syntaxMap, processorMap] = await Promise.all([
      this.getSyntaxMap(),
      this.getProcessorMap(),
    ]);

    const syntaxId = resolveSyntaxId(syntaxMap, data.syntax || DEFAULT_PAGE_SYNTAX);
    const processorId = resolveProcessorId(processorMap, data.processor ?? DEFAULT_PAGE_PROCESSOR);
    const fileExtension = await resolveFileExtension(this.lookups, data.fileExtension ?? '');

    const raw = await this.httpClient.request<RawPageLayoutDetail>({
      method: 'POST',
      path: '/pageLayout',
      body: {
        name: data.name,
        description: data.description ?? '',
        headerCode: data.headerCode ?? '',
        footerCode: data.footerCode ?? '',
        fileExtension,
        syntaxType: String(syntaxId),
        layoutProcessor: String(processorId),
        sharedGroups: writeSharedGroups(data.sharedGroups),
        primaryGroup: writePrimaryGroup(data.primaryGroup ?? 0),
      },
    });

    return new PageLayout(raw, this.httpClient, syntaxMap, processorMap, this.lookups);
  }

  /** Deletes a page layout by ID. */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/pageLayout/${id}`,
    });
  }
}
