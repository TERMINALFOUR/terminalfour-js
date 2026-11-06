import { HttpClient } from '../http-client.js';
import { ContentTypeData, ContentTypeFieldDef, WaitOption } from '../types.js';
import { decodeHtmlEntities, AUTH_LEVEL_MAP, AUTH_LEVEL_REVERSE, debugWarn, DEFAULT_CACHE_TTL, DEFAULT_WRITE_WAIT_TIMEOUT, WRITE_WAIT_POLL_INTERVAL, sleep, getCacheEpoch, invalidateAllCaches, readPrimaryGroup, readSharedGroups, writePrimaryGroup, writeSharedGroups, assertGroupsValid, assertRequired, assertNotEmptyIfPresent, suffixNameForUniqueness, defaultMaxSizeForType, extractMaxLength, assertMaxLength, TtlValue, ValidationRuleSet, RawPrimaryGroup } from '../utils.js';

/** Raw content type element from the API response */
interface ApiContentTypeElement {
  id?: number;
  name: string;
  alias?: string;
  description?: string;
  type?: number | { id?: number; name?: string };
  compulsory?: boolean;
  maxSize?: number;
  listId?: number;
  shown?: boolean;
  contentTypeElementConfiguration?: {
    contentTypeId?: number;
    contentTypeDTO?: {
      name: string;
      alias?: string;
      description?: string;
    };
    layout?: string;
    minRepeats?: number;
    maxRepeats?: number;
    editorID?: number;
  };
}

/** Raw content type shape from the API response */
interface ApiContentType {
  id: number;
  name: string;
  alias: string;
  description?: string;
  /** Content type category. `30` marks a system content type. Regular types are `10`. */
  type?: number;
  minAuthLevel?: number;
  workflow?: number;
  sharedGroups?: Array<{ id: number }>;
  primaryGroup?: RawPrimaryGroup;
  enableDirectEdit?: boolean;
  elementIdforFilename?: number;
  contentTypeElements?: ApiContentTypeElement[];
}

/** The content type category ID that marks a system content type. */
const SYSTEM_CONTENT_TYPE = 30;

/**
 * Fetches and caches the T4 length-validation rules for content types and
 * template elements.
 *
 * T4 limits the length of a content type's name/description and an element's
 * name/description, and rejects an over-length value with an opaque 500 (issue
 * #35). The limits come from `GET /validationrule/contenttype` and
 * `GET /validationrule/templateElement`; they are instance-wide and effectively
 * static, so each response is cached in a `TtlValue` (the same TTL + global
 * cache-epoch mechanism as every other SDK cache, so `clearCache()` invalidates
 * it).
 *
 * One instance is created per `ContentTypeResource` and threaded into every
 * `ContentType` so saves and field edits validate against the same cache. A
 * standalone `ContentType` (e.g. in tests) builds its own from the HttpClient.
 *
 * A fetch failure or unexpected shape resolves to an empty rule set: validation
 * is skipped and the write proceeds, so a transient lookup failure never blocks
 * a legitimate change — the server remains the backstop.
 */
export class ValidationRules {
  private readonly httpClient: HttpClient;
  private readonly contentTypeCache = new TtlValue<ValidationRuleSet>();
  private readonly templateElementCache = new TtlValue<ValidationRuleSet>();
  private contentTypePromise: Promise<ValidationRuleSet> | null = null;
  private templateElementPromise: Promise<ValidationRuleSet> | null = null;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Length-validation rules for a content type's own name/description. */
  contentType(): Promise<ValidationRuleSet> {
    return this.load('/validationrule/contenttype', this.contentTypeCache, (p) => { this.contentTypePromise = p; }, () => this.contentTypePromise);
  }

  /** Length-validation rules for a template element's name/description. */
  templateElement(): Promise<ValidationRuleSet> {
    return this.load('/validationrule/templateElement', this.templateElementCache, (p) => { this.templateElementPromise = p; }, () => this.templateElementPromise);
  }

  /**
   * Returns the cached rule set, or fetches it once (deduping concurrent calls
   * via the in-flight promise). On any error the result is an empty rule set so
   * callers skip validation rather than block the write.
   */
  private load(
    path: string,
    cache: TtlValue<ValidationRuleSet>,
    setPromise: (p: Promise<ValidationRuleSet> | null) => void,
    getPromise: () => Promise<ValidationRuleSet> | null,
  ): Promise<ValidationRuleSet> {
    const cached = cache.get();
    if (cached) return Promise.resolve(cached);

    const existing = getPromise();
    if (existing) return existing;

    const promise = this.httpClient
      .request<ValidationRuleSet>({ method: 'GET', path })
      .then((rules) => {
        const value = rules && typeof rules === 'object' ? rules : {};
        cache.set(value);
        setPromise(null);
        return value;
      })
      .catch((error) => {
        debugWarn(`Failed to fetch validation rules from ${path}; skipping length validation`, error);
        setPromise(null);
        return {} as ValidationRuleSet;
      });

    setPromise(promise);
    return promise;
  }
}

/**
 * Waits until a content type write is readable from the server (issue #37).
 *
 * Content type writes propagate server-side with a short delay, so a write that
 * resolves is not immediately readable — a read, or a chained SDK call that reads
 * back (like add-then-rename), can see stale state. This polls the authoritative
 * raw `GET /contenttype/{id}` until `predicate` confirms the written change is
 * observable.
 *
 * The read is the settle signal (not the `/lock` or `/notifications` endpoints):
 * both of those have a startup window where the task is not yet registered after
 * the write returns, so "poll until unlocked" can return instantly and miss the
 * propagation entirely. The content read is self-verifying — the change is either
 * present or it is not — and has no such window.
 *
 * Best-effort: on timeout it resolves anyway (the write itself succeeded; waiting
 * is only about read-after-write visibility) and emits a debug warning.
 *
 * `invalidateAllCaches()` must have been called by the caller before this runs so
 * the poll reads fresh data rather than a cached definition.
 */
async function waitForContentTypeReadable(
  httpClient: HttpClient,
  id: number,
  predicate: (raw: ApiContentType) => boolean,
  options?: WaitOption,
): Promise<void> {
  if (options?.wait === false) return;

  const timeout = options?.waitTimeout ?? DEFAULT_WRITE_WAIT_TIMEOUT;
  const deadline = Date.now() + timeout;

  for (;;) {
    let raw: ApiContentType | undefined;
    try {
      raw = await httpClient.request<ApiContentType>({ method: 'GET', path: `/contenttype/${id}` });
    } catch (error) {
      // A transient read failure mid-poll shouldn't abort the wait — keep trying
      // until the deadline. (Issue #40 may later add HTTP-layer retry here too.)
      debugWarn(`Settle poll read failed for content type ${id}; will retry`, error);
    }

    if (raw && predicate(raw)) return;

    if (Date.now() >= deadline) {
      debugWarn(
        `Content type ${id} write did not become readable within ${timeout}ms ` +
        '(issue #37 propagation). Resolving anyway — the write succeeded; a read ' +
        'immediately after may still be stale. Pass a larger waitTimeout if this persists.',
      );
      return;
    }

    await sleep(WRITE_WAIT_POLL_INTERVAL);
  }
}

/** Returns the friendly name of a raw element (alias wins, decoded). */
function rawElementName(el: ApiContentTypeElement): string {
  return decodeHtmlEntities(el.alias || el.name);
}

/** True if the raw content type has an element matching `name` (alias or name). */
function rawHasElement(raw: ApiContentType, name: string): boolean {
  return (raw.contentTypeElements ?? []).some((el) => rawElementName(el) === name);
}

function resolveTypeName(type: unknown, typeMap: Map<number, string>): string {
  if (type == null) return '';
  if (typeof type === 'number') return typeMap.get(type) ?? `Type ${type}`;
  if (typeof type === 'object' && type !== null && 'name' in type) return (type as { name?: string }).name ?? '';
  return '';
}

/**
 * Maps a raw API content type response to a ContentTypeData object.
 */
function mapContentType(raw: ApiContentType, typeMap: Map<number, string>, editorMap?: Map<number, string>): { data: ContentTypeData; rawData: ApiContentType } {
  const fieldsRecord: Record<string, ContentTypeFieldDef> = {};

  for (const el of raw.contentTypeElements ?? []) {
    const friendlyName = decodeHtmlEntities(el.alias || el.name);
    const field: ContentTypeFieldDef = {
      name: friendlyName,
      description: decodeHtmlEntities(el.description ?? ''),
      type: resolveTypeName(el.type, typeMap),
      required: el.compulsory ?? false,
      maxSize: el.maxSize ?? 0,
      listId: el.listId ?? 0,
      listName: '',
      shown: el.shown ?? true,
      useAsFilename: raw.elementIdforFilename !== undefined && el.id === raw.elementIdforFilename,
    };

    if (el.contentTypeElementConfiguration) {
      const cfg = el.contentTypeElementConfiguration;
      const elTypeName = resolveTypeName(el.type, typeMap);
      if (elTypeName === 'Repeater') {
        field.config = {
          contentTypeId: cfg.contentTypeId ?? 0,
          contentTypeName: cfg.contentTypeDTO?.alias || cfg.contentTypeDTO?.name || '',
          contentTypeDescription: cfg.contentTypeDTO?.description ?? '',
          layout: cfg.layout ?? '',
          minRepeats: cfg.minRepeats ?? 0,
          maxRepeats: cfg.maxRepeats ?? 0,
        };
      } else if (elTypeName === 'HTML' && cfg.editorID != null && editorMap) {
        field.editor = editorMap.get(cfg.editorID) ?? `Editor ${cfg.editorID}`;
      }
    }

    // Store element ID as non-enumerable for internal matching on save
    Object.defineProperty(field, '_elementId', { value: el.id, enumerable: false });

    fieldsRecord[friendlyName] = field;
  }

  return {
    data: {
      id: raw.id,
      name: decodeHtmlEntities(raw.alias || raw.name),
      description: decodeHtmlEntities(raw.description ?? ''),
      minUserLevel: AUTH_LEVEL_MAP[raw.minAuthLevel ?? 2] ?? `unknown (${raw.minAuthLevel})`,
      workflow: raw.workflow ?? 0,
      sharedGroups: readSharedGroups(raw.sharedGroups),
      primaryGroup: readPrimaryGroup(raw.primaryGroup),
      directEdit: raw.enableDirectEdit ?? true,
      fields: fieldsRecord,
    },
    rawData: raw,
  };
}

/** Friendly processor names mapped to API names */
const PROCESSOR_MAP: Record<string, string> = {
  't4-tags': 'T4 Tag Content',
  'handlebars': 'Handlebars Content',
  'programmable-layouts': 'Programmable Layout Content',
};

/** Raw layout response from the API */
interface RawLayout {
  id: number;
  name: string;
  lastModified?: number;
  [key: string]: unknown;
}

/** Extracts a value from raw elements by element name prefix (case-insensitive). */
function getElementValue(elements: Record<string, unknown>, name: string): string {
  const key = Object.keys(elements).find((k) => k.toLowerCase().startsWith(name.toLowerCase() + '#'));
  return key ? String(elements[key] ?? '') : '';
}

/** Options for updating a content layout (immutable pattern) */
interface UpdateLayoutData {
  /** New layout name. If provided, checks uniqueness. */
  name?: string;
  code?: string;
  syntax?: string;
  processor?: 't4-tags' | 'handlebars' | 'programmable-layouts';
  extension?: string;
}

/** A mutable content layout. Modify properties and call save() to persist. */
export class Layout {
  name: string;
  code: string;
  readonly lastModified: Date | null;

  private readonly _httpClient!: HttpClient;
  private _rawDTO!: RawLayout;
  private readonly _layoutElements!: LayoutElement[];
  private readonly _fetchLayouts!: () => Promise<RawLayout[]>;

  constructor(
    raw: RawLayout,
    httpClient: HttpClient,
    _contentTypeId: number,
    layoutElements: LayoutElement[],
    fetchLayouts: () => Promise<RawLayout[]>,
    _resolveSyntaxId: (name: string) => Promise<string>,
    _resolveProcessorId: (key: string) => Promise<string>,
    _resolveExtension: (ext: string) => Promise<string>,
  ) {
    this.name = raw.name;
    this.code = getElementValue(raw.elements as Record<string, unknown>, 'formatcode');
    this.lastModified = raw.lastModified ? new Date(raw.lastModified) : null;
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawDTO', { value: raw, enumerable: false, writable: true });
    Object.defineProperty(this, '_layoutElements', { value: layoutElements, enumerable: false });
    Object.defineProperty(this, '_fetchLayouts', { value: fetchLayouts, enumerable: false });
  }

  /** Persists current property values to the server. */
  async save(): Promise<void> {
    // If name changed, check uniqueness
    if (this.name !== this._rawDTO.name) {
      const existing = await this._fetchLayouts();
      if (existing.some((l) => l.name === this.name && l.id !== this._rawDTO.id)) {
        throw new Error(`Layout "${this.name}" already exists on this content type`);
      }
    }

    const findEl = (n: string) => {
      const el = this._layoutElements.find((e) => e.name.toLowerCase() === n.toLowerCase());
      if (!el) throw new Error(`Layout element "${n}" not found`);
      return el;
    };

    const nameEl = findEl('name');
    const codeEl = findEl('formatcode');

    // Start from raw elements, overlay changed fields
    const elements = { ...(this._rawDTO.elements as Record<string, unknown>) };
    elements[layoutKey(nameEl)] = this.name;
    elements[layoutKey(codeEl)] = this.code;

    const response = await this._httpClient.request<RawLayout>({
      method: 'PUT',
      path: `/layout/${this._rawDTO.id}/en`,
      body: {
        ...this._rawDTO,
        name: this.name,
        elements,
      },
    });

    this._rawDTO = response;
    this.name = response.name;
    this.code = getElementValue(response.elements as Record<string, unknown>, 'formatcode');
    (this as { lastModified: Date | null }).lastModified = response.lastModified ? new Date(response.lastModified) : null;
  }
}
interface CreateLayoutData {
  name: string;
  code: string;
  /** Syntax highlighting type. Defaults to 'HTML/XML'. */
  syntax?: string;
  /** Layout processor: 't4-tags' | 'handlebars' | 'programmable-layouts'. Defaults to 'handlebars'. */
  processor?: 't4-tags' | 'handlebars' | 'programmable-layouts';
  /** File extension (e.g. 'html', 'json', 'xml'). Defaults to '' (none). */
  extension?: string;
}

/** Layout content type element from GET /contenttype/2 */
interface LayoutElement {
  id: number;
  name: string;
  type: number;
}

/** Builds an element key from a layout element: Name#id:type */
function layoutKey(el: LayoutElement): string {
  return `${el.name}#${el.id}:${el.type}`;
}

/** A content type with methods for related operations. */
export class ContentType implements ContentTypeData {
  readonly id: number;
  name: string;
  description: string;
  minUserLevel: string;
  workflow: number;
  sharedGroups: number[];
  primaryGroup: number;
  directEdit: boolean;
  fields: Record<string, ContentTypeFieldDef>;

  /** Namespace for content layout operations on this content type. */
  readonly layouts!: {
    list: () => Promise<Array<{ name: string; lastModified: Date | null }>>;
    get: (name: string) => Promise<Layout>;
    create: (data: CreateLayoutData) => Promise<Layout>;
    update: (name: string, data: UpdateLayoutData) => Promise<Layout>;
    delete: (name: string) => Promise<void>;
  };

  private readonly _httpClient!: HttpClient;
  private _rawData!: ApiContentType;
  private _removedElementIds!: Set<number>;
  private _exemptSystemTypeIdsCache!: Set<number> | null;
  private readonly _validationRules!: ValidationRules;

  constructor(data: ContentTypeData, httpClient: HttpClient, rawData?: ApiContentType, validationRules?: ValidationRules) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.minUserLevel = data.minUserLevel;
    this.workflow = data.workflow;
    this.sharedGroups = data.sharedGroups;
    this.primaryGroup = data.primaryGroup;
    this.directEdit = data.directEdit;
    this.fields = data.fields;
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: rawData ?? ({} as ApiContentType), enumerable: false, writable: true });
    Object.defineProperty(this, '_removedElementIds', { value: new Set(), enumerable: false, writable: true });
    Object.defineProperty(this, '_exemptSystemTypeIdsCache', { value: null, enumerable: false, writable: true });
    Object.defineProperty(this, '_validationRules', { value: validationRules ?? new ValidationRules(httpClient), enumerable: false });

    const contentTypeId = this.id;
    let layoutElementsCache: LayoutElement[] | null = null;
    let layoutContentTypeIdCache: number | null = null;

    const fetchLayouts = async (): Promise<RawLayout[]> => {
      return httpClient.request<RawLayout[]>({
        method: 'GET',
        path: `/layout/contenttype/${contentTypeId}/en`,
      });
    };

    /** Resolves the layout content type ID by looking up "Content Layout" (type 30). */
    const getLayoutContentTypeId = async (): Promise<number> => {
      if (layoutContentTypeIdCache !== null) return layoutContentTypeIdCache;
      const types = await httpClient.request<Array<{ id: number; name: string; alias?: string; type: number }>>({
        method: 'GET',
        path: '/contenttype/?excludeElements=true',
      });
      const match = types.find((t) => (t.name === 'Content Layout' || t.alias === 'Content Layout') && t.type === 30);
      if (!match) throw new Error('Could not find "Content Layout" system content type');
      layoutContentTypeIdCache = match.id;
      return match.id;
    };

    /** Fetches and caches the layout content type elements. */
    const getLayoutElements = async (): Promise<LayoutElement[]> => {
      if (layoutElementsCache) return layoutElementsCache;
      const ctId = await getLayoutContentTypeId();
      const raw = await httpClient.request<{ contentTypeElements: LayoutElement[] }>({
        method: 'GET',
        path: `/contenttype/${ctId}`,
      });
      layoutElementsCache = raw.contentTypeElements ?? [];
      return layoutElementsCache;
    };

    /** Finds a layout element by name (case-insensitive). */
    const findElement = (elements: LayoutElement[], name: string): LayoutElement => {
      const el = elements.find((e) => e.name.toLowerCase() === name.toLowerCase());
      if (!el) throw new Error(`Layout element "${name}" not found in layout content type`);
      return el;
    };

    const resolveSyntaxId = async (syntaxName: string): Promise<string> => {
      const types = await httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/syntaxType',
      });
      const match = types.find((t) => t.name.toLowerCase() === syntaxName.toLowerCase());
      if (!match) {
        const valid = types.map((t) => t.name).join(', ');
        throw new Error(`Unknown syntax "${syntaxName}". Valid options: ${valid}`);
      }
      return String(match.id);
    };

    const resolveProcessorId = async (processorKey: string): Promise<string> => {
      const apiName = PROCESSOR_MAP[processorKey];
      if (!apiName) {
        throw new Error(`Unknown processor "${processorKey}". Valid options: t4-tags, handlebars, programmable-layouts`);
      }
      const processors = await httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/publishProcessor/20',
      });
      const match = processors.find((p) => p.name === apiName);
      if (!match) throw new Error(`Processor "${apiName}" not found on this T4 instance`);
      return String(match.id);
    };

    const resolveExtension = async (ext: string): Promise<string> => {
      const extensions = await httpClient.request<Array<{ extension: string }>>({
        method: 'GET',
        path: '/fileExtension',
      });
      const match = extensions.find((e) => e.extension.toLowerCase() === ext.toLowerCase());
      if (!match) {
        const valid = extensions.map((e) => e.extension).join(', ');
        throw new Error(`Unknown extension "${ext}". Valid options: ${valid}`);
      }
      return match.extension;
    };

    Object.defineProperty(this, 'layouts', {
      value: {
      list: async () => {
        const raw = await fetchLayouts();
        return raw.map((l) => ({
          name: l.name,
          lastModified: l.lastModified ? new Date(l.lastModified) : null,
        }));
      },

      get: async (layoutName: string) => {
        const all = await fetchLayouts();
        const match = all.find((l) => l.name === layoutName);
        if (!match) throw new Error(`Layout "${layoutName}" not found on this content type`);

        // Fetch full layout details
        const raw = await httpClient.request<RawLayout>({
          method: 'GET',
          path: `/layout/${match.id}/en`,
        });
        const layoutElements = await getLayoutElements();
        return new Layout(
          raw, httpClient, contentTypeId, layoutElements,
          fetchLayouts, resolveSyntaxId, resolveProcessorId, resolveExtension,
        );
      },

      update: async (layoutName: string, updateData: UpdateLayoutData) => {
        assertNotEmptyIfPresent(updateData.name, 'Layout name');

        const all = await fetchLayouts();
        const match = all.find((l) => l.name === layoutName);
        if (!match) throw new Error(`Layout "${layoutName}" not found on this content type`);

        // If renaming, check uniqueness
        if (updateData.name && updateData.name !== layoutName) {
          if (all.some((l) => l.name === updateData.name)) {
            throw new Error(`Layout "${updateData.name}" already exists on this content type`);
          }
        }

        // Fetch full layout
        const raw = await httpClient.request<RawLayout>({
          method: 'GET',
          path: `/layout/${match.id}/en`,
        });

        const layoutElements = await getLayoutElements();
        const elements = { ...(raw.elements as Record<string, unknown>) };

        const newName = updateData.name ?? raw.name;
        elements[layoutKey(findElement(layoutElements, 'name'))] = newName;

        if (updateData.code !== undefined) {
          elements[layoutKey(findElement(layoutElements, 'formatcode'))] = updateData.code;
        }
        if (updateData.syntax !== undefined) {
          elements[layoutKey(findElement(layoutElements, 'syntax'))] = await resolveSyntaxId(updateData.syntax);
        }
        if (updateData.processor !== undefined) {
          elements[layoutKey(findElement(layoutElements, 'Format Processor'))] = await resolveProcessorId(updateData.processor);
        }
        if (updateData.extension !== undefined) {
          const extValue = updateData.extension ? await resolveExtension(updateData.extension) : '';
          elements[layoutKey(findElement(layoutElements, 'extension'))] = extValue;
        }

        const response = await httpClient.request<RawLayout>({
          method: 'PUT',
          path: `/layout/${match.id}/en`,
          body: { ...raw, name: newName, elements },
        });

        return new Layout(
          response, httpClient, contentTypeId, layoutElements,
          fetchLayouts, resolveSyntaxId, resolveProcessorId, resolveExtension,
        );
      },

      create: async (createData: CreateLayoutData) => {
        assertRequired(createData.name, 'Layout name');

        // Check name uniqueness
        const existing = await fetchLayouts();
        if (existing.some((l) => l.name === createData.name)) {
          throw new Error(`Layout "${createData.name}" already exists on this content type`);
        }

        // Fetch layout content type elements for dynamic key resolution
        const layoutElements = await getLayoutElements();
        const layoutCtId = await getLayoutContentTypeId();
        const nameEl = findElement(layoutElements, 'name');
        const codeEl = findElement(layoutElements, 'formatcode');
        const extensionEl = findElement(layoutElements, 'extension');
        const syntaxEl = findElement(layoutElements, 'syntax');
        const processorEl = findElement(layoutElements, 'Format Processor');

        const [syntaxId, processorId] = await Promise.all([
          resolveSyntaxId(createData.syntax ?? 'HTML/XML'),
          resolveProcessorId(createData.processor ?? 'handlebars'),
        ]);

        const extensionValue = createData.extension
          ? await resolveExtension(createData.extension)
          : '';

        const response = await httpClient.request<RawLayout>({
          method: 'PUT',
          path: `/layout/${contentTypeId}`,
          body: {
            id: 0,
            contentTypeID: layoutCtId,
            archiveSection: 0,
            name: createData.name,
            status: 0,
            lastModifiedBy: 0,
            channels: [],
            editable: false,
            expired: false,
            canPublishNow: false,
            canSaveAndApprove: false,
            contentTypeAccess: 0,
            elements: {
              [layoutKey(nameEl)]: createData.name,
              [layoutKey(extensionEl)]: extensionValue,
              [layoutKey(syntaxEl)]: syntaxId,
              [layoutKey(codeEl)]: createData.code,
              [layoutKey(processorEl)]: processorId,
            },
            sectionIDs: [],
          },
        });

        return new Layout(
          response, httpClient, contentTypeId, layoutElements,
          fetchLayouts, resolveSyntaxId, resolveProcessorId, resolveExtension,
        );
      },

      delete: async (layoutName: string) => {
        const all = await fetchLayouts();
        const match = all.find((l) => l.name === layoutName);
        if (!match) throw new Error(`Layout "${layoutName}" not found on this content type`);

        await httpClient.request<void>({
          method: 'DELETE',
          path: `/layout/${match.id}/en`,
        });
      },
    },
      enumerable: false,
      configurable: false,
    });
  }

  /**
   * Adds a new field (element) to this content type. Takes effect on save().
   *
   * The `type` must be a valid element type name (e.g. 'Plain Text', 'HTML', 'Select Box', 'Repeater').
   * Use `t4.contentTypes.get(id)` to see existing field types for reference.
   */
  async addField(data: {
    name: string;
    type: string;
    description?: string;
    maxSize?: number;
    required?: boolean;
    shown?: boolean;
    /** List ID — required for list-based element types (Select Box, Radio Button, Checkbox, etc.) */
    listId?: number;
    /** HTML editor name — only valid for HTML elements. Use the editor name (e.g. 'TinyMCE', 'Standard Textarea'). */
    editor?: string;
    /** Repeater configuration — required when type is 'Repeater' */
    repeater?: {
      /** The content type ID that defines the repeater's fields */
      contentTypeId: number;
      /** The content layout name to use for the repeater (e.g. 'text/html') */
      layout?: string;
      /** Minimum number of repeater instances. Defaults to 0. */
      minRepeats?: number;
      /** Maximum number of repeater instances. Defaults to 100. */
      maxRepeats?: number;
    };
  }): Promise<void> {
    if (!data.name?.trim()) throw new Error('Field name is required');
    if (!data.type?.trim()) throw new Error('Field type is required');
    if (this.fields[data.name]) throw new Error(`Field "${data.name}" already exists on this content type`);

    // Validate name/description length against the live T4 limits (issue #35)
    // before any network call, so an over-length value fails fast and clearly.
    const elementRules = await this._validationRules.templateElement();
    assertMaxLength(data.name, extractMaxLength(elementRules, 'name'), `Element "${data.name}" name`);
    assertMaxLength(data.description, extractMaxLength(elementRules, 'description'), `Element "${data.name}" description`);

    // Resolve type name to ID via GET /type/
    const types = await this._httpClient.request<Array<{ id: number; name: string; listType: boolean }>>({
      method: 'GET',
      path: '/type/',
    });
    const typeMatch = types.find((t) => t.name.toLowerCase() === data.type.toLowerCase());
    if (!typeMatch) {
      const valid = types.map((t) => t.name).join(', ');
      throw new Error(`Unknown element type "${data.type}". Valid options: ${valid}`);
    }

    // Validate listId for list-based types
    if (typeMatch.listType && !data.listId) {
      throw new Error(`Field "${data.name}" is type "${data.type}" which requires a listId`);
    }

    // Validate repeater config
    const isRepeater = typeMatch.name.toLowerCase() === 'repeater';
    if (isRepeater && !data.repeater) {
      throw new Error(`Field "${data.name}" is type "Repeater" which requires a repeater configuration (contentTypeId)`);
    }
    if (!isRepeater && data.repeater) {
      throw new Error(`Field "${data.name}" is type "${data.type}" — repeater configuration is only valid for Repeater elements`);
    }

    // Validate editor option (only valid for HTML elements)
    const isHtml = typeMatch.name === 'HTML';
    let resolvedEditorId: number | undefined;
    if (data.editor !== undefined) {
      if (!isHtml) {
        throw new Error(`Field "${data.name}" is type "${data.type}" — editor is only valid for HTML elements`);
      }
      const editors = await this._httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/htmlEditor',
      });
      const match = editors.find((e) => e.name.toLowerCase() === data.editor!.toLowerCase());
      if (!match) {
        const valid = editors.map((e) => `"${e.name}"`).join(', ');
        throw new Error(`Unknown editor "${data.editor}". Valid options: ${valid}`);
      }
      resolvedEditorId = match.id;
    }

    // Generate a negative random ID for the new element (API convention for new items)
    const newElementId = -Math.floor(Math.random() * 1000000);

    // Determine the next sequence number
    const existingElements = this._rawData.contentTypeElements ?? [];
    const maxSequence = existingElements.reduce((max, el) => {
      const seq = (el as unknown as Record<string, unknown>).sequence as number | undefined;
      return seq !== undefined && seq > max ? seq : max;
    }, 0);

    // Add to the raw elements array so save() picks it up.
    // New elements use string type IDs and include contentTypeID (matching browser behaviour).
    const newRawElement: Record<string, unknown> = {
      id: newElementId,
      name: data.name,
      description: data.description ?? '',
      type: String(typeMatch.id),
      maxSize: data.maxSize ?? defaultMaxSizeForType(typeMatch.id),
      compulsory: data.required ?? false,
      shown: data.shown ?? true,
      contentTypeID: this.id,
      sequence: maxSequence + 1,
    };

    // Add repeater configuration if applicable
    if (isRepeater && data.repeater) {
      const maxRepeats = data.repeater.maxRepeats ?? 100;
      newRawElement.contentTypeElementConfiguration = {
        contentTypeId: data.repeater.contentTypeId,
        layout: data.repeater.layout ?? '',
        minRepeats: data.repeater.minRepeats ?? 0,
        maxRepeats: maxRepeats,
        maxRepeatsLimit: maxRepeats,
      };
    } else {
      newRawElement.listId = data.listId ?? 0;
    }

    // Add HTML editor configuration if applicable
    if (isHtml && resolvedEditorId !== undefined) {
      newRawElement.contentTypeElementConfiguration = { editorID: resolvedEditorId };
    }

    existingElements.push(newRawElement as unknown as ApiContentTypeElement);

    // Add to the friendly fields record
    const field: ContentTypeFieldDef = {
      name: data.name,
      description: data.description ?? '',
      type: typeMatch.name,
      required: data.required ?? false,
      maxSize: data.maxSize ?? defaultMaxSizeForType(typeMatch.id),
      listId: data.listId ?? 0,
      listName: '',
      shown: data.shown ?? true,
      useAsFilename: false,
    };

    if (isRepeater && data.repeater) {
      field.config = {
        contentTypeId: data.repeater.contentTypeId,
        contentTypeName: '',
        contentTypeDescription: '',
        layout: data.repeater.layout ?? '',
        minRepeats: data.repeater.minRepeats ?? 0,
        maxRepeats: data.repeater.maxRepeats ?? 100,
      };
    }

    if (isHtml && data.editor) {
      field.editor = data.editor;
    }

    Object.defineProperty(field, '_elementId', { value: newElementId, enumerable: false });
    this.fields[data.name] = field;
  }

  /** Removes a field (element) by name. Takes effect on save(). */
  removeField(fieldName: string): void {
    const field = this.fields[fieldName];
    if (!field) throw new Error(`Field "${fieldName}" not found on this content type`);

    const elementId = (field as unknown as { _elementId?: number })._elementId;
    if (elementId !== undefined) {
      this._removedElementIds.add(elementId);
    }
    delete this.fields[fieldName];
  }

  /**
   * Resolves the set of system content type IDs where removing and renaming
   * elements is permitted: the Section Meta Data content type and the Extended
   * User content type. Cached per instance; only called when a removal or rename
   * is attempted on a system content type.
   */
  private async _getExemptSystemTypeIds(): Promise<Set<number>> {
    if (this._exemptSystemTypeIdsCache) return this._exemptSystemTypeIdsCache;

    const ids = new Set<number>();

    // Section Meta Data content type
    try {
      const config = await this._httpClient.request<{ name: string; type: string; value: string }>({
        method: 'GET',
        path: '/config/hierarchy.metaDataContentType',
      });
      const sectionMetaId = parseInt(config.value, 10);
      if (sectionMetaId > 0) ids.add(sectionMetaId);
    } catch (error) {
      debugWarn('Failed to resolve Section Meta Data content type ID', error);
    }

    // Extended User content type
    try {
      const credentials = await this._httpClient.request<{ userExtensibleObjectID?: number | null }>({
        method: 'GET',
        path: '/userSearch/credentials',
      });
      const userExtId = credentials.userExtensibleObjectID;
      if (typeof userExtId === 'number' && userExtId > 0) ids.add(userExtId);
    } catch (error) {
      debugWarn('Failed to resolve Extended User content type ID', error);
    }

    this._exemptSystemTypeIdsCache = ids;
    return ids;
  }

  /**
   * Guards against removing or renaming elements on system content types.
   *
   * System content types (`type === 30`) may have elements added, and their
   * descriptions and maxSize changed, but removing or renaming existing elements
   * is unsafe. Two system content types are exempt: the Section Meta Data content
   * type and the Extended User content type.
   *
   * Detects renames by comparing each field's current name against the name/alias
   * of its matched raw element. Only performs network calls when a removal or
   * rename is actually attempted on a system content type.
   */
  private async _guardSystemContentTypeElementChanges(rawElements: ApiContentTypeElement[]): Promise<void> {
    if (this._rawData.type !== SYSTEM_CONTENT_TYPE) return;

    const removedNames = this._collectRemovedElementNames();
    const renames = this._collectRenamedElements(rawElements);

    if (removedNames.length === 0 && renames.length === 0) return;

    const exemptIds = await this._getExemptSystemTypeIds();
    if (exemptIds.has(this.id)) return;

    if (removedNames.length > 0) {
      throw new Error(
        `Cannot remove element${removedNames.length > 1 ? 's' : ''} ${removedNames.map((n) => `"${n}"`).join(', ')} ` +
        `from content type "${this.name}" because it is a system content type. ` +
        'Removing elements from system content types is not allowed. ' +
        'You can still add elements and change their description or maxSize.',
      );
    }

    const { from, to } = renames[0];
    throw new Error(
      `Cannot rename element "${from}" to "${to}" on content type "${this.name}" because it is a system content type. ` +
      'Renaming elements on system content types is not allowed. ' +
      'You can still add elements and change their description or maxSize.',
    );
  }

  /** Returns the names of elements queued for removal, resolved from the raw data. */
  private _collectRemovedElementNames(): string[] {
    if (this._removedElementIds.size === 0) return [];
    const names: string[] = [];
    for (const el of this._rawData.contentTypeElements ?? []) {
      if (el.id !== undefined && this._removedElementIds.has(el.id)) {
        names.push(decodeHtmlEntities(el.alias || el.name));
      }
    }
    return names;
  }

  /**
   * Detects fields whose name differs from the current name/alias of their matched
   * raw element (i.e. a rename). New fields (no matching raw element) are ignored.
   */
  private _collectRenamedElements(rawElements: ApiContentTypeElement[]): Array<{ from: string; to: string }> {
    const renames: Array<{ from: string; to: string }> = [];
    for (const field of Object.values(this.fields)) {
      const elementId = (field as unknown as { _elementId?: number })._elementId;
      if (elementId === undefined) continue;
      const rawEl = rawElements.find((el) => el.id === elementId);
      if (!rawEl) continue;
      const currentName = decodeHtmlEntities(rawEl.alias || rawEl.name);
      if (currentName !== field.name) {
        renames.push({ from: currentName, to: field.name });
      }
    }
    return renames;
  }

  /**
   * Persists current property values to the server via PUT.
   *
   * By default waits until the change is readable from the server before
   * resolving (issue #37 — content type writes propagate with a short delay).
   * Pass `{ wait: false }` to resolve as soon as the PUT returns, or
   * `{ waitTimeout }` to adjust the ceiling (default 10s).
   */
  async save(options?: WaitOption): Promise<void> {
    assertRequired(this.name, 'Content type name');
    assertGroupsValid(this.primaryGroup, this.sharedGroups);
    await this._validateLengths();
    await this._validateElementLengths();

    // Capture what's changing BEFORE _rawData is overwritten, so the post-write
    // settle poll knows what to confirm is readable.
    const settlePredicate = this._buildSettlePredicate();

    const authLevel = String(AUTH_LEVEL_REVERSE[this.minUserLevel] ?? this._rawData.minAuthLevel ?? 2);

    // Sync field changes back to raw contentTypeElements
    let rawElements = (this._rawData.contentTypeElements ?? []) as Array<ApiContentTypeElement>;

    // Block element removal/renaming on system content types (except the two
    // exempt types). Runs before any mutation so nothing is persisted on failure.
    await this._guardSystemContentTypeElementChanges(rawElements);

    // Remove elements that were deleted via removeField()
    if (this._removedElementIds.size > 0) {
      rawElements = rawElements.filter((el) => !this._removedElementIds.has(el.id as number));
    }

    const editorFieldsToSync: Array<{ field: ContentTypeFieldDef; rawEl: ApiContentTypeElement }> = [];

    for (const field of Object.values(this.fields)) {
      const elementId = (field as unknown as { _elementId?: number })._elementId;
      const rawEl = elementId !== undefined
        ? rawElements.find((el) => (el.id as number) === elementId)
        : rawElements.find((el) => {
            const elAlias = el.alias as string | undefined;
            const elName = el.name as string;
            return elAlias === field.name || elName === field.name;
          });
      if (rawEl) {
        rawEl.alias = field.name;
        rawEl.description = field.description;
        rawEl.maxSize = field.maxSize;
        rawEl.compulsory = field.required;
        rawEl.shown = field.shown;

        // Sync repeater config min/max if present (only for Repeater elements)
        if (field.config && rawEl.contentTypeElementConfiguration && field.type === 'Repeater') {
          const cfg = rawEl.contentTypeElementConfiguration as Record<string, unknown>;
          cfg.minRepeats = field.config.minRepeats;
          cfg.maxRepeats = field.config.maxRepeats;
        }

        // Sync HTML editor if changed
        if (field.type === 'HTML' && field.editor !== undefined) {
          if (field.editor === null) {
            // Explicitly remove the editor configuration
            delete rawEl.contentTypeElementConfiguration;
          } else {
            editorFieldsToSync.push({ field, rawEl });
          }
        }
      }
    }

    // Resolve HTML editor names to IDs for any fields that need syncing
    if (editorFieldsToSync.length > 0) {
      const editors = await this._httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/htmlEditor',
      });
      for (const { field, rawEl } of editorFieldsToSync) {
        const match = editors.find((e) => e.name.toLowerCase() === field.editor!.toLowerCase());
        if (!match) {
          const valid = editors.map((e) => `"${e.name}"`).join(', ');
          throw new Error(`Unknown editor "${field.editor}". Valid options: ${valid}`);
        }
        rawEl.contentTypeElementConfiguration = { editorID: match.id } as unknown as ApiContentTypeElement['contentTypeElementConfiguration'];
      }
    }

    const updated = {
      ...this._rawData,
      alias: this.name,
      name: this.name,
      description: this.description,
      minAuthLevel: authLevel,
      workflow: String(this.workflow),
      enableDirectEdit: this.directEdit,
      sharedGroups: writeSharedGroups(this.sharedGroups),
      primaryGroup: writePrimaryGroup(this.primaryGroup),
      contentTypeElements: rawElements,
    } as Record<string, unknown>;

    // Resolve useAsFilename → elementIdforFilename
    const filenameFields = Object.values(this.fields).filter((f) => f.useAsFilename);
    if (filenameFields.length > 0) {
      // Last one wins — use the last field marked as useAsFilename
      const chosen = filenameFields[filenameFields.length - 1];
      if (chosen.type !== 'Plain Text') {
        throw new Error(`Only Plain Text elements can be used as filename. "${chosen.name}" is type "${chosen.type}"`);
      }
      const elementId = (chosen as unknown as { _elementId?: number })._elementId;
      if (elementId !== undefined) {
        updated.elementIdforFilename = elementId;
      }
      // Clear all others
      for (const f of Object.values(this.fields)) {
        f.useAsFilename = f === chosen;
      }
    }

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/contenttype/${this.id}`,
      body: updated,
    });

    // The content type definition changed, so any cached copy (content type
    // templates/definitions, element type maps, etc.) is now stale. Invalidate
    // all caches via the global epoch so subsequent reads re-fetch.
    invalidateAllCaches();

    // Update raw data for next save
    this._rawData = updated as unknown as ApiContentType;
    this._removedElementIds.clear();

    // Wait until the write is readable from the server (issue #37). Runs after
    // the cache invalidation so the poll reads fresh data.
    await waitForContentTypeReadable(this._httpClient, this.id, settlePredicate, options);
  }

  /**
   * Validates this content type's own name and description lengths against the
   * live T4 limits (issue #35), throwing a clear SDK error before the PUT rather
   * than letting an over-length value trigger a server 500.
   */
  private async _validateLengths(): Promise<void> {
    const rules = await this._validationRules.contentType();
    assertMaxLength(this.name, extractMaxLength(rules, 'name'), 'Content type name');
    assertMaxLength(this.description, extractMaxLength(rules, 'description'), 'Content type description');
  }

  /**
   * Validates every field's name and description lengths against the live T4
   * template-element limits (issue #35). Covers additions and renames/edits made
   * before `save()`.
   */
  private async _validateElementLengths(): Promise<void> {
    const rules = await this._validationRules.templateElement();
    const nameMax = extractMaxLength(rules, 'name');
    const descMax = extractMaxLength(rules, 'description');
    for (const field of Object.values(this.fields)) {
      assertMaxLength(field.name, nameMax, `Element "${field.name}" name`);
      assertMaxLength(field.description, descMax, `Element "${field.name}" description`);
    }
  }

  /**
   * Builds a predicate that confirms this save's changes are readable from the
   * server. Captures added element names, renamed-to names, and removed element
   * names from the current pending state (must be called before `_rawData` is
   * overwritten). The returned predicate passes when every added/renamed element
   * is present and every removed element is absent in a fresh read.
   */
  private _buildSettlePredicate(): (raw: ApiContentType) => boolean {
    const originalElements = (this._rawData.contentTypeElements ?? []) as ApiContentTypeElement[];
    const originalById = new Map<number, ApiContentTypeElement>();
    for (const el of originalElements) {
      if (el.id !== undefined) originalById.set(el.id, el);
    }

    const expectedPresent = new Set<string>();
    const expectedAbsent = new Set<string>();

    for (const field of Object.values(this.fields)) {
      const elementId = (field as unknown as { _elementId?: number })._elementId;
      // New field (negative/unknown id) → must become present.
      if (elementId === undefined || elementId < 0 || !originalById.has(elementId)) {
        expectedPresent.add(field.name);
        continue;
      }
      // Existing field: detect a rename against its original name.
      const originalName = rawElementName(originalById.get(elementId)!);
      if (originalName !== field.name) {
        expectedPresent.add(field.name);
        expectedAbsent.add(originalName);
      }
    }

    // Removed elements → must become absent.
    for (const id of this._removedElementIds) {
      const el = originalById.get(id);
      if (el) expectedAbsent.add(rawElementName(el));
    }

    // Property-only changes (description, maxSize, etc.) have no element-presence
    // signal; a single successful read is enough to confirm the write landed.
    return (raw: ApiContentType): boolean => {
      for (const name of expectedPresent) {
        if (!rawHasElement(raw, name)) return false;
      }
      for (const name of expectedAbsent) {
        if (rawHasElement(raw, name)) return false;
      }
      return true;
    };
  }
}

/**
 * Resource for content type operations.
 * Provides listing and retrieval of content type definitions.
 */
export class ContentTypeResource {
  private readonly httpClient: HttpClient;
  private readonly validationRules: ValidationRules;
  private typeMapPromise: Promise<Map<number, string>> | null = null;
  private typeMapExpiresAt = 0;
  private typeMapEpoch = -1;
  private editorMapPromise: Promise<Map<number, string>> | null = null;
  private editorMapExpiresAt = 0;
  private editorMapEpoch = -1;
  private existingNamesPromise: Promise<string[]> | null = null;
  private existingNamesExpiresAt = 0;
  private existingNamesEpoch = -1;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
    this.validationRules = new ValidationRules(httpClient);
  }

  /** Fetches and caches element type ID → name map from GET /type/ */
  private getTypeMap(): Promise<Map<number, string>> {
    if (!this.typeMapPromise || Date.now() > this.typeMapExpiresAt || this.typeMapEpoch < getCacheEpoch()) {
      this.typeMapExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.typeMapEpoch = getCacheEpoch();
      this.typeMapPromise = this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/type/',
      }).then((types) => new Map(types.map((t) => [t.id, t.name])));
    }
    return this.typeMapPromise;
  }

  /** Fetches and caches HTML editor ID → name map from GET /htmlEditor */
  private getEditorMap(): Promise<Map<number, string>> {
    if (!this.editorMapPromise || Date.now() > this.editorMapExpiresAt || this.editorMapEpoch < getCacheEpoch()) {
      this.editorMapExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.editorMapEpoch = getCacheEpoch();
      this.editorMapPromise = this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/htmlEditor',
      }).then(
        (editors) => new Map(editors.map((e) => [e.id, e.name])),
        () => new Map<number, string>(),
      );
    }
    return this.editorMapPromise;
  }

  /**
   * Fetches and caches the decoded names of all existing content types, used by
   * `create()` to auto-suffix a colliding name (issue #52).
   *
   * Caching matters because `GET /contenttype?excludeElements=true` returns every
   * content type on the instance, so an uncached fetch on every `create()` could
   * be heavy. It is safe because the cache is gated on the global cache epoch
   * (the same TTL + epoch idiom as `getTypeMap`/`getEditorMap`): a successful
   * `create()` calls `invalidateAllCaches()`, bumping the epoch, so the very next
   * create refetches and sees the name just created — two creates in a row can't
   * race into a stale suffix.
   *
   * Unlike `getEditorMap`, a fetch failure is **not** swallowed: if existing
   * names can't be read, uniqueness can't be guaranteed, so the rejection
   * propagates (per DECISIONS #123). The in-flight promise is cleared on
   * rejection so a transient failure doesn't poison the cache for the TTL window.
   */
  private getExistingNames(): Promise<string[]> {
    if (!this.existingNamesPromise || Date.now() > this.existingNamesExpiresAt || this.existingNamesEpoch < getCacheEpoch()) {
      this.existingNamesExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.existingNamesEpoch = getCacheEpoch();
      this.existingNamesPromise = this.httpClient.request<ApiContentType[]>({
        method: 'GET',
        path: '/contenttype?excludeElements=true',
      })
        .then((types) => types.map((ct) => decodeHtmlEntities(ct.alias || ct.name)))
        .catch((error) => {
          this.existingNamesPromise = null;
          throw error;
        });
    }
    return this.existingNamesPromise;
  }

  /** Resolves listName for all fields that have a non-zero listId. */
  private async resolveListNames(contentTypes: ContentTypeData[]): Promise<void> {
    // Collect unique list IDs across all content types
    const listIds = new Set<number>();
    for (const ct of contentTypes) {
      for (const f of Object.values(ct.fields)) {
        if (f.listId) listIds.add(f.listId);
      }
    }
    if (listIds.size === 0) return;

    // Fetch each list and build a name map
    const listNameMap = new Map<number, string>();
    await Promise.all(
      Array.from(listIds).map(async (id) => {
        try {
          const list = await this.httpClient.request<{ id: number; name?: string }>({
            method: 'GET',
            path: `/list/${id}/en?override=false`,
          });
          listNameMap.set(id, list.name ?? '');
        } catch (error) {
          debugWarn(`Failed to resolve list name for listId ${id}`, error);
        }
      }),
    );

    // Apply names to fields
    for (const ct of contentTypes) {
      for (const f of Object.values(ct.fields)) {
        if (f.listId) {
          f.listName = listNameMap.get(f.listId) ?? '';
        }
      }
    }
  }

  /**
   * Lists all content type definitions.
   */
  async list(): Promise<ContentType[]> {
    const [raw, typeMap, editorMap] = await Promise.all([
      this.httpClient.request<ApiContentType[]>({ method: 'GET', path: '/contenttype?excludeElements=true' }),
      this.getTypeMap(),
      this.getEditorMap(),
    ]);
    const results = raw.map((r) => mapContentType(r, typeMap, editorMap));
    const dataOnly = results.map((r) => r.data);
    await this.resolveListNames(dataOnly);
    return results.map((r) => new ContentType(r.data, this.httpClient, r.rawData, this.validationRules));
  }

  /**
   * Retrieves a single content type definition by ID.
   */
  async get(id: number): Promise<ContentType> {
    const [raw, typeMap, editorMap] = await Promise.all([
      this.httpClient.request<ApiContentType>({ method: 'GET', path: `/contenttype/${id}` }),
      this.getTypeMap(),
      this.getEditorMap(),
    ]);
    const result = mapContentType(raw, typeMap, editorMap);
    await this.resolveListNames([result.data]);
    return new ContentType(result.data, this.httpClient, result.rawData, this.validationRules);
  }

  /**
   * Updates a content type's properties (immutable pattern).
   * Fetches existing, merges changes, PUTs full body.
   */
  async update(id: number, data: {
    name?: string;
    description?: string;
    minUserLevel?: string;
    workflow?: number;
    directEdit?: boolean;
    sharedGroups?: number[];
    primaryGroup?: number;
    /** Fields to add to the content type */
    addFields?: Array<{
      name: string;
      type: string;
      description?: string;
      maxSize?: number;
      required?: boolean;
      shown?: boolean;
      listId?: number;
      editor?: string;
      repeater?: {
        contentTypeId: number;
        layout?: string;
        minRepeats?: number;
        maxRepeats?: number;
      };
    }>;
    /**
     * Existing fields to modify, matched by `name`. Only the provided
     * properties are changed; omitted ones are left as-is. Use this to change
     * an element's length (`maxSize`), description, its `required`/`shown`
     * flags, or to rename it with `newName`. Throws if a named field does not
     * exist on the content type. Renaming an element on a system content type
     * is blocked (except the Section Meta Data and Extended User types).
     */
    updateFields?: Array<{
      name: string;
      /** New name for the element. Renames are blocked on system content types. */
      newName?: string;
      maxSize?: number;
      description?: string;
      required?: boolean;
      shown?: boolean;
    }>;
    /** Field names to remove from the content type */
    removeFields?: string[];
  }, options?: WaitOption): Promise<ContentType> {
    const ct = await this.get(id);
    if (data.name !== undefined) ct.name = data.name;
    if (data.description !== undefined) ct.description = data.description;
    if (data.minUserLevel !== undefined) ct.minUserLevel = data.minUserLevel;
    if (data.workflow !== undefined) ct.workflow = data.workflow;
    if (data.directEdit !== undefined) ct.directEdit = data.directEdit;
    if (data.sharedGroups !== undefined) ct.sharedGroups = data.sharedGroups;
    if (data.primaryGroup !== undefined) ct.primaryGroup = data.primaryGroup;
    if (data.updateFields) {
      for (const change of data.updateFields) {
        const field = ct.fields[change.name];
        if (!field) {
          throw new Error(`Cannot update field "${change.name}" because it does not exist on content type "${ct.name}".`);
        }
        if (change.maxSize !== undefined) field.maxSize = change.maxSize;
        if (change.description !== undefined) field.description = change.description;
        if (change.required !== undefined) field.required = change.required;
        if (change.shown !== undefined) field.shown = change.shown;
        // Rename last: save() detects the change against the element's _elementId
        // link and applies the system content type rename guard. Re-key the
        // fields record so the returned model is addressable by the new name.
        if (change.newName !== undefined && change.newName !== change.name) {
          field.name = change.newName;
          ct.fields[change.newName] = field;
          delete ct.fields[change.name];
        }
      }
    }
    if (data.removeFields) {
      for (const fieldName of data.removeFields) {
        ct.removeField(fieldName);
      }
    }
    if (data.addFields) {
      for (const field of data.addFields) {
        await ct.addField(field);
      }
    }
    await ct.save(options);
    return ct;
  }

  /**
   * Deletes a content type by ID.
   *
   * System content types (`type === 30`) are managed by T4 and back core
   * features; deleting one can break the instance, so this is blocked with a
   * clear error. There is no override.
   */
  async delete(id: number): Promise<void> {
    const raw = await this.httpClient.request<ApiContentType>({
      method: 'GET',
      path: `/contenttype/${id}`,
    });

    if (raw.type === SYSTEM_CONTENT_TYPE) {
      const name = decodeHtmlEntities(raw.alias || raw.name);
      throw new Error(
        `Cannot delete content type "${name}" (${id}) because it is a system content type. ` +
        'Deleting system content types is not allowed.',
      );
    }

    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/contenttype/${id}`,
    });

    // A deleted content type may be cached; invalidate all caches so stale
    // definitions/templates aren't served after the delete.
    invalidateAllCaches();
  }

  /** Creates a new content type. */
  async create(data: {
    name: string;
    description?: string;
    elements: Array<{
      name: string;
      description?: string;
      type: string;
      maxSize?: number;
      required?: boolean;
      shown?: boolean;
      useAsFilename?: boolean;
      /** List ID — required for list-based element types (Select Box, Radio Button, Checkbox, etc.) */
      listId?: number;
      /** HTML editor name — only valid for HTML elements. */
      editor?: string;
      /** Repeater configuration — required when type is 'Repeater' */
      repeater?: {
        /** The content type ID that defines the repeater's fields */
        contentTypeId: number;
        /** The content layout name to use for the repeater (e.g. 'text/html') */
        layout?: string;
        /** Minimum number of repeater instances. Defaults to 0. */
        minRepeats?: number;
        /** Maximum number of repeater instances. Defaults to 100. */
        maxRepeats?: number;
      };
    }>;
    minUserLevel?: string;
    workflow?: number;
    directEdit?: boolean;
    sharedGroups?: number[];
    primaryGroup?: number;
  }, options?: WaitOption): Promise<ContentType> {
    if (!data.name?.trim()) {
      throw new Error('Content type name is required');
    }
    if (!data.elements?.length) {
      throw new Error('Content type must have at least one element');
    }
    assertGroupsValid(data.primaryGroup ?? 0, data.sharedGroups);

    // Validate useAsFilename constraints
    const filenameElements = data.elements.filter((el) => el.useAsFilename);
    if (filenameElements.length > 1) {
      throw new Error('Only one element can be used as filename');
    }
    if (filenameElements.length === 1 && filenameElements[0].type.toLowerCase() !== 'plain text') {
      throw new Error(`Only Plain Text elements can be used as filename. "${filenameElements[0].name}" is type "${filenameElements[0].type}"`);
    }

    // Validate name/description lengths against the live T4 limits (issue #35)
    // before building the request, so an over-length value fails fast and
    // clearly instead of triggering a server 500. Validating the raw name here,
    // before the uniqueness fetch below, means an over-length name fails without
    // a wasted list request — the ` (n)` suffix only lengthens the name, so a
    // name that is already too long cannot be rescued by suffixing.
    const [ctRules, elementRules] = await Promise.all([
      this.validationRules.contentType(),
      this.validationRules.templateElement(),
    ]);
    const ctNameMax = extractMaxLength(ctRules, 'name');
    assertMaxLength(data.name, ctNameMax, 'Content type name');
    assertMaxLength(data.description, extractMaxLength(ctRules, 'description'), 'Content type description');
    const elementNameMax = extractMaxLength(elementRules, 'name');
    const elementDescMax = extractMaxLength(elementRules, 'description');
    for (const el of data.elements) {
      assertMaxLength(el.name, elementNameMax, `Element "${el.name}" name`);
      assertMaxLength(el.description, elementDescMax, `Element "${el.name}" description`);
    }

    // Match the T4 UI: if the name collides with an existing content type,
    // auto-suffix it with ` (n)` before sending (issue #52). Existing names are
    // fetched via the cached getExistingNames() (decoded to friendly form, as the
    // UI shows them) so this doesn't issue a heavy list request on every create.
    // The suffixed name is length-validated again, since the suffix can push a
    // name that was within the limit over it.
    const existingNames = await this.getExistingNames();
    const uniqueName = suffixNameForUniqueness(data.name, existingNames);
    if (uniqueName !== data.name.trim()) {
      assertMaxLength(uniqueName, ctNameMax, 'Content type name');
    }

    const typeMap = await this.getTypeMap();
    const reverseTypeMap = new Map(Array.from(typeMap.entries()).map(([id, name]) => [name.toLowerCase(), id]));

    // Fetch raw types to get listType flag for validation
    const rawTypes = await this.httpClient.request<Array<{ id: number; name: string; listType: boolean }>>({
      method: 'GET',
      path: '/type/',
    });
    const listTypeNames = new Set(rawTypes.filter((t) => t.listType).map((t) => t.name.toLowerCase()));

    const plainTextId = reverseTypeMap.get('plain text') ?? 1;

    // Build elements array — Name element is always first
    const contentTypeElements: Array<Record<string, unknown>> = [
      {
        id: 1,
        name: 'Name',
        description: '',
        maxSize: 80,
        compulsory: true,
        type: plainTextId,
        listId: '',
        alias: 'Name',
        shown: true,
        sequence: 1,
      },
    ];

    // Default: Name element is used for filename
    let elementIdForFilename = 1;
    let editorMapForCreate: Map<string, { id: number; name: string }> | null = null;

    for (let i = 0; i < data.elements.length; i++) {
      const el = data.elements[i];
      const typeId = reverseTypeMap.get(el.type.toLowerCase());
      if (typeId === undefined) {
        const valid = Array.from(typeMap.values()).join(', ');
        throw new Error(`Unknown element type "${el.type}". Valid options: ${valid}`);
      }

      // Validate listId for list-based types
      if (listTypeNames.has(el.type.toLowerCase()) && !el.listId) {
        throw new Error(`Element "${el.name}" is type "${el.type}" which requires a listId`);
      }

      // Validate repeater config
      const isRepeater = el.type.toLowerCase() === 'repeater';
      if (isRepeater && !el.repeater) {
        throw new Error(`Element "${el.name}" is type "Repeater" which requires a repeater configuration (contentTypeId)`);
      }
      if (!isRepeater && el.repeater) {
        throw new Error(`Element "${el.name}" is type "${el.type}" — repeater configuration is only valid for Repeater elements`);
      }

      // Validate editor option (only valid for HTML elements)
      const isHtml = el.type.toLowerCase() === 'html';
      if (el.editor !== undefined && !isHtml) {
        throw new Error(`Element "${el.name}" is type "${el.type}" — editor is only valid for HTML elements`);
      }

      const elId = -Math.floor(Math.random() * 1000000);

      const elDef: Record<string, unknown> = {
        id: elId,
        name: el.name,
        description: el.description ?? '',
        maxSize: String(el.maxSize ?? defaultMaxSizeForType(typeId)),
        compulsory: el.required ?? false,
        type: String(typeId),
        listId: el.listId ? String(el.listId) : '',
        shown: el.shown ?? true,
        sequence: i + 2,
      };

      // Add repeater configuration if applicable
      if (isRepeater && el.repeater) {
        const maxRepeats = el.repeater.maxRepeats ?? 100;
        elDef.contentTypeElementConfiguration = {
          contentTypeId: el.repeater.contentTypeId,
          layout: el.repeater.layout ?? '',
          minRepeats: el.repeater.minRepeats ?? 0,
          maxRepeats: maxRepeats,
          maxRepeatsLimit: maxRepeats,
        };
      }

      // Add HTML editor configuration if applicable
      if (isHtml && el.editor) {
        if (!editorMapForCreate) {
          const editors = await this.httpClient.request<Array<{ id: number; name: string }>>({
            method: 'GET',
            path: '/htmlEditor',
          });
          editorMapForCreate = new Map(editors.map((e) => [e.name.toLowerCase(), e]));
        }
        const match = editorMapForCreate.get(el.editor.toLowerCase());
        if (!match) {
          const valid = Array.from(editorMapForCreate.values()).map((e) => `"${e.name}"`).join(', ');
          throw new Error(`Unknown editor "${el.editor}". Valid options: ${valid}`);
        }
        elDef.contentTypeElementConfiguration = { editorID: match.id };
      }

      contentTypeElements.push(elDef);

      if (el.useAsFilename) {
        elementIdForFilename = elId;
      }
    }

    const raw = await this.httpClient.request<ApiContentType>({
      method: 'POST',
      path: '/contenttype',
      body: {
        name: uniqueName,
        description: data.description ?? '',
        type: 10,
        editable: true,
        fullAccess: true,
        enableDirectEdit: data.directEdit ?? true,
        minAuthLevel: String(AUTH_LEVEL_REVERSE[data.minUserLevel ?? 'contributor'] ?? 2),
        workflow: data.workflow !== undefined ? String(data.workflow) : '',
        warningMessage: '',
        elementIdforFilename: elementIdForFilename,
        conditionals: [],
        sharedGroups: writeSharedGroups(data.sharedGroups),
        primaryGroup: writePrimaryGroup(data.primaryGroup ?? 0),
        contentTypeElements,
      },
    });

    // New content type may affect cached lookups; invalidate for consistency.
    invalidateAllCaches();

    // Wait until the new content type (with its elements) is readable from the
    // server before resolving (issue #37). Confirm the user-supplied element
    // names are present in a fresh read.
    const expectedNames = data.elements.map((el) => el.name);
    await waitForContentTypeReadable(
      this.httpClient,
      raw.id,
      (fresh) => expectedNames.every((name) => rawHasElement(fresh, name)),
      options,
    );

    const editorMap = await this.getEditorMap();
    const result = mapContentType(raw, typeMap, editorMap);
    await this.resolveListNames([result.data]);
    return new ContentType(result.data, this.httpClient, result.rawData, this.validationRules);
  }
}
