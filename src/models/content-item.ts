import { ContentDTO } from '../types.js';
import { HttpClient } from '../http-client.js';
import { ElementResolver, TemplateElement, ResolveContext } from '../element-resolver.js';
import { TypeRegistry } from '../type-registry.js';
import { formatFileSize, parseElementKey, mapStatus, flattenGroups, STATUS_CODES, AUTH_LEVEL_MAP, debugWarn, DEFAULT_CACHE_TTL, getCacheEpoch } from '../utils.js';

/** Symbol used to restrict _init() access to the factory function in this module */
const INIT = Symbol('ContentItem.init');

/**
 * Reverse-resolves a "listId:itemId" string to the friendly item name.
 */
async function reverseListValue(
  value: string,
  listId: number,
  resolver: ElementResolver,
  language: string,
): Promise<string> {
  const match = value.match(/^(\d+):(\d+)$/);
  if (!match || !listId) return value;

  const list = await resolver.getList(parseInt(match[1], 10), language);
  const item = list.items.find((i) => i.id === parseInt(match[2], 10));
  return item ? item.name : value;
}

/**
 * Reverse-resolves checkbox/multiple-select "listId:id1,id2" to array of names.
 */
async function reverseCheckboxValue(
  value: string,
  listId: number,
  resolver: ElementResolver,
  language: string,
): Promise<string[]> {
  const match = value.match(/^(\d+):(.+)$/);
  if (!match || !listId) return [value];

  const list = await resolver.getList(parseInt(match[1], 10), language);
  const ids = match[2].split(',').map((s) => parseInt(s.trim(), 10));
  return ids.map((id) => {
    const item = list.items.find((i) => i.id === id);
    return item ? item.name : String(id);
  });
}

/**
 * Reverse-resolves multi-select "listId:id1;listId:id2" to array of names.
 */
async function reverseMultiSelectValue(
  value: string,
  listId: number,
  resolver: ElementResolver,
  language: string,
): Promise<string[]> {
  const parts = value.split(';');
  const names: string[] = [];
  for (const part of parts) {
    names.push(await reverseListValue(part.trim(), listId, resolver, language));
  }
  return names;
}

/**
 * Reverse-resolves cascading list "listId1:id1, listId2:id2" to array of names.
 */
async function reverseCascadingValue(
  value: string,
  resolver: ElementResolver,
  language: string,
): Promise<string[]> {
  // Split on comma (with optional space) to get each level
  const parts = value.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  const names: string[] = [];
  for (const part of parts) {
    const match = part.match(/^(\d+):(\d+)$/);
    if (match) {
      try {
        const list = await resolver.getList(parseInt(match[1], 10), language);
        const item = list.items.find((i) => i.id === parseInt(match[2], 10));
        names.push(item ? item.name : part);
      } catch (error) {
        debugWarn(`Failed to reverse-resolve cascading list value "${part}"`, error);
        names.push(part);
      }
    } else {
      names.push(part);
    }
  }
  return names;
}

/**
 * Reverse-resolves a keyword selector value to the friendly format.
 * "1:1,1:2,Freetext,1:1&&1:2&&Other" → { or: ["Large", "Small", "Freetext", { and: ["Large", "Small", "Other"] }] }
 */
async function reverseKeywordValue(
  value: string,
  listId: number,
  resolver: ElementResolver,
  language: string,
): Promise<unknown> {
  // Split on commas, but not within && groups
  const orParts: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i++) {
    if (value[i] === ',' && !current.includes('&&')) {
      orParts.push(current);
      current = '';
    } else if (value[i] === ',' && current.includes('&&')) {
      // Check if remaining has && — if so this comma is between OR groups
      orParts.push(current);
      current = '';
    } else {
      current += value[i];
    }
  }
  if (current) orParts.push(current);

  const result: Array<string | { and: string[] }> = [];
  for (const part of orParts) {
    if (part.includes('&&')) {
      const andItems = part.split('&&');
      const resolved: string[] = [];
      for (const item of andItems) {
        const trimmed = item.trim();
        const match = trimmed.match(/^(\d+):(\d+)$/);
        if (match && listId) {
          const list = await resolver.getList(parseInt(match[1], 10), language);
          const found = list.items.find((i) => i.id === parseInt(match[2], 10));
          resolved.push(found ? found.name : trimmed);
        } else {
          resolved.push(trimmed);
        }
      }
      result.push({ and: resolved });
    } else {
      const trimmed = part.trim();
      const match = trimmed.match(/^(\d+):(\d+)$/);
      if (match && listId) {
        const list = await resolver.getList(parseInt(match[1], 10), language);
        const found = list.items.find((i) => i.id === parseInt(match[2], 10));
        result.push(found ? found.name : trimmed);
      } else {
        result.push(trimmed);
      }
    }
  }
  return { or: result };
}

/** User details from GET /user/{id} */
interface UserDTO {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  authLevel?: number;
}

/** Per-client cache for group lookup, keyed by HttpClient instance */
const groupCacheMap = new WeakMap<HttpClient, { data: Map<number, string>; expiresAt: number; epoch: number }>();

/** Clears the group cache for a specific HttpClient instance */
export function clearGroupCache(httpClient: HttpClient): void {
  groupCacheMap.delete(httpClient);
}

/**
 * Reverse-resolves a Group Select value to an array of group objects.
 */
async function reverseGroupSelect(
  value: string,
  httpClient: HttpClient,
): Promise<unknown> {
  if (!value) return [];

  const ids = value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  if (ids.length === 0) return [];

  // Fetch and cache group tree per client
  const cached = groupCacheMap.get(httpClient);
  let groupData = cached && Date.now() < cached.expiresAt && cached.epoch >= getCacheEpoch() ? cached.data : null;
  if (!groupData) {
    try {
      const groups = await httpClient.request<Array<{ id: number; name: string; groupChildren?: unknown[] }>>({
        method: 'GET',
        path: '/group/topLevelGroups',
      });
      groupData = flattenGroups(groups);
      groupCacheMap.set(httpClient, { data: groupData, expiresAt: Date.now() + DEFAULT_CACHE_TTL, epoch: getCacheEpoch() });
    } catch (error) {
      debugWarn('Failed to resolve group names for Group Select field', error);
      return value;
    }
  }

  return ids.map((id) => ({
    id,
    name: groupData!.get(id) ?? `Group ${id}`,
    selected: true,
  }));
}

/**
 * Reverse-resolves a Content Owner user ID to a user object.
 */
async function reverseContentOwner(
  value: string,
  httpClient: HttpClient,
): Promise<unknown> {
  const userId = parseInt(value, 10);
  if (isNaN(userId) || userId === 0) return value;

  try {
    const user = await httpClient.request<UserDTO>({
      method: 'GET',
      path: `/user/${userId}`,
    });

    return {
      id: user.id,
      type: AUTH_LEVEL_MAP[user.authLevel ?? 2] ?? `unknown (${user.authLevel})`,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.emailAddress,
    };
  } catch (error) {
    debugWarn(`Failed to resolve Content Owner user ${value}`, error);
    return value;
  }
}

/** SS response from GET /ssl/{id}/{language}/{sectionId}/{contentId} */
interface SslRecord {
  id: number;
  toSection: number;
  toContent: number;
  linkText: string;
  path: string;
}

/**
 * Reverse-resolves a T4 SS tag to a friendly object.
 */
async function reverseSslLink(
  value: string,
  httpClient: HttpClient,
  language: string,
  sectionId: number,
  contentId: number,
): Promise<unknown> {
  const match = value.match(/sslink_id="(\d+)"/);
  if (!match) return value;

  const sslId = parseInt(match[1], 10);

  try {
    const ssl = await httpClient.request<SslRecord>({
      method: 'GET',
      path: `/ssl/${sslId}/${language}/${sectionId}/${contentId}`,
    });

    const path = (ssl.path || '').replace(/&raquo;/g, '»');

    const result: Record<string, unknown> = {
      sectionId: ssl.toSection,
      linkText: ssl.linkText,
      path,
    };

    if (ssl.toContent) {
      result.contentId = ssl.toContent;
    }

    return result;
  } catch (error) {
    debugWarn(`Failed to reverse-resolve SS link (id: ${sslId})`, error);
    return value;
  }
}

/** Regex to match T4 SS link tags in HTML content */
const T4_SSLINK_REGEX = /<t4\s+[^>]*sslink_id="(\d+)"[^>]*\/?\s*>/gi;

/**
 * Resolves T4 SS link tags within an HTML string to friendly anchor elements.
 * `<t4 type="sslink" sslink_id="39"/>` → `<a href="#" data-t4-sslink="39" data-section-id="233" ...>linkText</a>`
 */
async function resolveHtmlSsLinks(
  html: string,
  httpClient: HttpClient,
  language: string,
  sectionId: number,
  contentId: number,
): Promise<string> {
  // Find all sslink tags
  const matches: Array<{ full: string; sslId: number }> = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(T4_SSLINK_REGEX.source, T4_SSLINK_REGEX.flags);
  while ((match = regex.exec(html)) !== null) {
    matches.push({ full: match[0], sslId: parseInt(match[1], 10) });
  }

  if (matches.length === 0) return html;

  // Resolve all SS links in parallel
  const resolved = await Promise.all(
    matches.map(async ({ full, sslId }) => {
      try {
        const ssl = await httpClient.request<SslRecord>({
          method: 'GET',
          path: `/ssl/${sslId}/${language}/${sectionId}/${contentId}`,
        });

        let attrs = `href="#" data-t4-sslink="${sslId}" data-section-id="${ssl.toSection}"`;
        if (ssl.toContent) {
          attrs += ` data-content-id="${ssl.toContent}"`;
        }
        attrs += ` data-linktext="${ssl.linkText || ''}"`;

        const displayText = ssl.linkText || 'link';
        return { original: full, replacement: `<a ${attrs}>${displayText}</a>` };
      } catch (error) {
        debugWarn(`Failed to resolve SS link in HTML (id: ${sslId})`, error);
        return { original: full, replacement: full };
      }
    }),
  );

  // Apply replacements
  let result = html;
  for (const { original, replacement } of resolved) {
    result = result.replace(original, replacement);
  }
  return result;
}

/**
 * Resolves a raw element value to its friendly form based on element type.
 */
async function resolveFriendlyValue(
  value: unknown,
  typeName: string,
  listId: number,
  resolver: ElementResolver | null,
  language: string,
  httpClient?: HttpClient,
  sectionId?: number,
  contentId?: number,
): Promise<unknown> {
  if (!resolver || value == null || typeof value !== 'string') return value;

  switch (typeName) {
    case 'Select Box':
    case 'Radio Button':
      return reverseListValue(value, listId, resolver, language);
    case 'Check Box':
    case 'Multiple Select':
      return reverseCheckboxValue(value, listId, resolver, language);
    case 'Multi-select List':
      return reverseMultiSelectValue(value, listId, resolver, language);
    case 'Cascading List':
      return reverseCascadingValue(value, resolver, language);
    case 'Keyword Selector':
      return reverseKeywordValue(value, listId, resolver, language);
    case 'Section/Content Link':
      if (httpClient && sectionId !== undefined && contentId !== undefined && value.includes('sslink_id')) {
        return reverseSslLink(value, httpClient, language, sectionId, contentId);
      }
      return value;
    default:
      return value;
  }
}

/** Download file response from GET /download/file/{contentId}/{language}/{version}/{elementId} */
interface DownloadResponse {
  name: string;
  fileLocation: string;
}

/** Media item response from GET /media/{id}/{language} */
interface MediaDTO {
  id: number;
  name: string;
  fileName: string;
  description: string;
  typeName: string;
  mediaURL: string;
  mediaPath: string;
  mediaSize: number;
  elements: Record<string, { lastModified?: number; preferredFilename?: string; [key: string]: unknown }>;
}

/**
 * Parses raw elements into friendly fields with reverse-resolved list values.
 */
async function parseElements(
  raw: Record<string, unknown>,
  templateElements: TemplateElement[] | null,
  resolver: ElementResolver | null,
  language: string,
  typeRegistry: TypeRegistry | null,
  httpClient?: HttpClient,
  sectionId?: number,
  contentId?: number,
  version?: string,
): Promise<{
  fields: Record<string, unknown>;
  keyMap: Map<string, string>;
}> {
  const entries: Array<{ friendlyName: string; rawKey: string; sequence: number; value: unknown }> = [];
  const keyMap = new Map<string, string>();

  for (const [rawKey, value] of Object.entries(raw)) {
    const parsed = parseElementKey(rawKey);
    if (parsed) {
      const templateEl = templateElements?.find(
        (el) => el.name === parsed.name,
      );
      const friendlyName = templateEl?.alias || parsed.name;
      const sortOrder = templateEl?.sequence ?? parsed.elementId;

      let friendlyValue = value;

      if (templateEl && typeRegistry) {
        const typeName = await typeRegistry.getNameById(parsed.type);
        const isListType = await typeRegistry.isListType(parsed.type);

        if (isListType && typeof value === 'string') {
          friendlyValue = await resolveFriendlyValue(
            value, typeName, templateEl.listId, resolver, language,
            httpClient, sectionId, contentId,
          );
        } else if (typeName === 'Date' && (typeof value === 'number' || typeof value === 'string')) {
          const ts = typeof value === 'number' ? value : parseInt(value, 10);
          friendlyValue = ts ? new Date(ts) : null;
        } else if (typeName === 'HTML' && typeof value === 'string' && value.includes('sslink_id') && httpClient && sectionId !== undefined && contentId !== undefined) {
          friendlyValue = await resolveHtmlSsLinks(value, httpClient, language, sectionId, contentId);
        } else if (typeName === 'Section/Content Link' && typeof value === 'string' && value.includes('sslink_id') && httpClient && sectionId !== undefined && contentId !== undefined) {
          friendlyValue = await reverseSslLink(value, httpClient, language, sectionId, contentId);
        } else if (typeName === 'Content Owner' && typeof value === 'string' && httpClient) {
          friendlyValue = await reverseContentOwner(value, httpClient);
        } else if (typeName === 'Group Select' && typeof value === 'string' && httpClient) {
          friendlyValue = await reverseGroupSelect(value, httpClient);
        } else if (typeName === 'Repeater' && Array.isArray(value)) {
          // Recursively resolve repeater items
          const repeaterElements = templateEl.contentTypeElementConfiguration?.contentTypeDTO?.contentTypeElements ?? null;
          const resolvedItems: unknown[] = [];
          for (const item of value) {
            const repeaterItem = item as { repeaterId: number; repeaterContent: { name: string; elements: Record<string, unknown> } };
            if (repeaterItem.repeaterContent?.elements) {
              const repeaterParsed = await parseElements(
                repeaterItem.repeaterContent.elements,
                repeaterElements,
                resolver,
                language,
                typeRegistry,
                httpClient,
                sectionId,
                repeaterItem.repeaterId,
                version,
              );
              resolvedItems.push({
                name: repeaterItem.repeaterContent.name,
                fields: repeaterParsed.fields,
              });
            } else {
              resolvedItems.push(item);
            }
          }
          friendlyValue = resolvedItems;
        } else if (typeName === 'Media' && typeof value === 'string' && value.trim() && httpClient) {
          const mediaId = parseInt(value, 10);
          if (!isNaN(mediaId)) {
            try {
              const media = await httpClient.request<MediaDTO>({
                method: 'GET',
                path: `/media/${mediaId}/${language}`,
              });
              friendlyValue = {
                id: media.id,
                name: media.name ?? '',
                filename: media.fileName ?? null,
                description: media.description ?? '',
                mediaType: media.typeName ?? null,
                lastModified: media.elements?.['Media#4:4']?.lastModified
                  ? new Date(media.elements['Media#4:4'].lastModified)
                  : null,
                downloadLink: media.mediaURL ?? null,
                path: media.mediaPath
                  ? media.mediaPath.replace(/&raquo;/g, '»').trim()
                  : null,
                fileSize: formatFileSize(media.mediaSize ?? 0),
              };
            } catch (error) {
              debugWarn(`Failed to resolve Media element (id: ${mediaId})`, error);
              friendlyValue = mediaId;
            }
          }
        } else if ((typeName === 'File' || typeName === 'Image') && value && typeof value === 'object' && 'fileSize' in value) {
          const fileObj = value as Record<string, unknown>;
          const enriched: Record<string, unknown> = {
            filename: fileObj.preferredFilename ?? null,
            fileSize: formatFileSize(Number(fileObj.fileSize) || 0),
          };

          // Fetch download link if we have the context and the file exists
          if (httpClient && contentId && version && (fileObj.existingFile || fileObj.code)) {
            try {
              const download = await httpClient.request<DownloadResponse>({
                method: 'GET',
                path: `/download/file/${contentId}/${language}/${version}/${parsed.elementId}`,
              });
              enriched.downloadLink = download.fileLocation;
            } catch (error) {
              debugWarn(`Failed to fetch download link for file element ${parsed.elementId}`, error);
            }
          }

          friendlyValue = enriched;
        }
      }

      entries.push({ friendlyName, rawKey, sequence: sortOrder, value: friendlyValue });
      keyMap.set(friendlyName.toLowerCase(), rawKey);
    } else {
      entries.push({ friendlyName: rawKey, rawKey, sequence: Infinity, value });
      keyMap.set(rawKey.toLowerCase(), rawKey);
    }
  }

  entries.sort((a, b) => a.sequence - b.sequence);

  const fields: Record<string, unknown> = {};
  for (const entry of entries) {
    fields[entry.friendlyName] = entry.value;
  }

  return { fields, keyMap };
}

/**
 * A mutable content item that exposes read-only metadata and mutable fields.
 * Fields use friendly names and human-readable list values.
 * Call save() to persist field changes back to the server.
 *
 * When returned from `content.list()`, this is a summary object — only metadata
 * properties are populated. The `fields` property is not present. Use
 * `content.get(id)` to retrieve a full item with resolved fields.
 */
export class ContentItem {
  readonly id: number;
  name: string;
  readonly contentTypeID: number;
  readonly language: string;
  readonly version: number;
  readonly lastModified: Date | null;
  publishDate: Date | null;
  expiryDate: Date | null;
  reviewDate: Date | null;
  /** Section ID where expired content is archived. `null` if not set. */
  archiveSection: number | null;
  /** Resolved fields with friendly names. Not present on summary items from `content.list()`. */
  fields!: Record<string, unknown>;

  private readonly _httpClient: HttpClient;
  private readonly _sectionId: number;
  private readonly _resolver: ElementResolver | null;
  private readonly _templateElements: TemplateElement[] | null;
  private readonly _typeRegistry: TypeRegistry | null;
  private _keyMap: Map<string, string>;
  private _rawDTO: ContentDTO;
  private _status: string;
  private _statusDirty = false;

  private _dirtyFields: Set<string> = new Set();

  get status(): string { return this._status; }
  set status(value: string) {
    this._status = value;
    this._statusDirty = true;
  }

  constructor(
    data: ContentDTO,
    httpClient: HttpClient,
    sectionId: number,
    resolver?: ElementResolver | null,
    templateElements?: TemplateElement[] | null,
    typeRegistry?: TypeRegistry | null,
  ) {
    this.id = data.id;
    this.name = data.name;
    this.contentTypeID = data.contentTypeID;
    this.language = data.language;
    this._status = mapStatus(data.status);
    this.version = data.version;
    this.lastModified = data.lastModified ? new Date(data.lastModified) : null;
    this.publishDate = data.publishDate ? new Date(data.publishDate) : null;
    this.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    this.reviewDate = data.reviewDate ? new Date(data.reviewDate) : null;
    this.archiveSection = data.archiveSection ?? null;
    this._httpClient = httpClient;
    this._sectionId = sectionId;
    this._resolver = resolver ?? null;
    this._templateElements = templateElements ?? null;
    this._typeRegistry = typeRegistry ?? null;
    this._rawDTO = data;

    // Fields will be populated async via _init()
    this.fields = {};
    this._keyMap = new Map();

    // Make internal properties non-enumerable
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false, writable: false });
    Object.defineProperty(this, '_sectionId', { value: sectionId, enumerable: false, writable: false });
    Object.defineProperty(this, '_resolver', { value: resolver ?? null, enumerable: false, writable: false });
    Object.defineProperty(this, '_templateElements', { value: templateElements ?? null, enumerable: false, writable: false });
    Object.defineProperty(this, '_typeRegistry', { value: typeRegistry ?? null, enumerable: false, writable: false });
    Object.defineProperty(this, '_rawDTO', { value: data, enumerable: false, writable: true });
    Object.defineProperty(this, '_status', { value: mapStatus(data.status), enumerable: false, writable: true });
    Object.defineProperty(this, '_statusDirty', { value: false, enumerable: false, writable: true });
    Object.defineProperty(this, '_keyMap', { value: new Map(), enumerable: false, writable: true });
    Object.defineProperty(this, '_dirtyFields', { value: new Set(), enumerable: false, writable: true });
  }

  /** Includes getter-based properties (status) in JSON serialisation. */
  toJSON(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(this)) {
      obj[key] = (this as Record<string, unknown>)[key];
    }
    obj.status = this.status;
    return obj;
  }

  /** @internal Async initialization — resolves friendly field values. Only callable via the factory. */
  async [INIT](data: ContentDTO): Promise<void> {
    // List items have no template elements — they're summary objects without fields.
    // Remove the fields property entirely so it's clear this is metadata only.
    if (!this._templateElements) {
      delete (this as Partial<ContentItem>).fields;
      return;
    }

    const parsed = await parseElements(
      data.elements ?? {},
      this._templateElements,
      this._resolver,
      this.language,
      this._typeRegistry,
      this._httpClient,
      this._sectionId,
      this.id,
      String(data.version),
    );
    this.fields = parsed.fields;
    this._keyMap = parsed.keyMap;
    this._dirtyFields = new Set();

    // Wrap fields in a Proxy to track which fields the developer modifies
    this.fields = new Proxy(this.fields, {
      set: (target, prop, value) => {
        if (typeof prop === 'string') {
          this._dirtyFields.add(prop);
        }
        target[prop as string] = value;
        return true;
      },
    });
  }

  /**
   * Persists field and property changes back to the server.
   *
   * Status defaults to `'pending'` on save, matching T4's approval workflow
   * where edits go back through review. To preserve the current status, set
   * `item.status = 'approved'` before saving, or use `item.approve()` to
   * save and approve in one step.
   */
  async save(): Promise<void> {
    // Start from the original raw elements (correct API format)
    const rawElements = { ...this._rawDTO.elements };

    // Re-resolve dirty fields through the ElementResolver so friendly values
    // (list names, Date objects, SS link objects, etc.) are converted back
    // to the format the API expects.
    const context: ResolveContext = {
      fromSectionId: this._sectionId,
      fromContentId: this.id,
    };

    for (const friendlyName of this._dirtyFields) {
      const rawKey = this._keyMap.get(friendlyName.toLowerCase());
      if (!(friendlyName in this.fields)) continue;

      if (!rawKey) {
        const validNames = Array.from(this._keyMap.keys())
          .filter((k) => k !== 'name')
          .map((k) => `"${k}"`)
          .join(', ');
        throw new Error(
          `Unknown field "${friendlyName}" on this content type. Valid fields are: ${validNames}`,
        );
      }

      const value = this.fields[friendlyName];

      // Find the matching template element for this field
      const templateEl = this._templateElements?.find(
        (el) => (el.alias || el.name).toLowerCase() === friendlyName.toLowerCase(),
      );

      // Validate maxSize for string values
      if (templateEl?.maxSize && typeof value === 'string' && value.length > templateEl.maxSize) {
        throw new Error(
          `Field "${friendlyName}" exceeds max size: ${value.length} characters (max ${templateEl.maxSize})`,
        );
      }

      let resolved: unknown;
      if (templateEl && this._resolver) {
        resolved = await this._resolver.resolveValue(
          value, templateEl, this.language, this._templateElements ?? undefined, context,
        );
      } else {
        resolved = value;
      }

      // Validate maxSize on the resolved value (skip repeaters — they're arrays)
      if (templateEl?.maxSize && !Array.isArray(resolved)) {
        const resolvedStr = String(resolved ?? '');
        if (resolvedStr.length > templateEl.maxSize) {
          throw new Error(
            `Field "${friendlyName}" exceeds max size: ${resolvedStr.length} characters (max ${templateEl.maxSize})`,
          );
        }
      }

      rawElements[rawKey] = resolved;
    }

    // Update the Name element to match the current name
    if (this._templateElements) {
      const nameEl = this._templateElements.find((el) => el.name.toLowerCase() === 'name');
      if (nameEl) {
        rawElements[`${nameEl.name}#${nameEl.id}:${nameEl.type}`] = this.name;
      }
    }

    const statusCode = this._statusDirty ? (STATUS_CODES[this._status] ?? 1) : 1;

    const response = await this._httpClient.request<ContentDTO>({
      method: 'POST',
      path: `/content/${this._sectionId}/${this.id}/${this.language}`,
      body: {
        id: this.id,
        contentTypeID: this.contentTypeID,
        name: this.name,
        language: this.language,
        status: statusCode,
        elements: rawElements,
        channels: this._rawDTO.channels,
        canPublishNow: true,
        canSaveAndApprove: true,
        publishDate: this.publishDate ? this.publishDate.getTime() : null,
        expiryDate: this.expiryDate ? this.expiryDate.getTime() : null,
        reviewDate: this.reviewDate ? this.reviewDate.getTime() : null,
        archiveSection: this.archiveSection ?? null,
        owner: this._rawDTO.owner ?? { id: 0, type: 'USER' },
        excludedMirrorSectionIds: [],
        sectionIDs: [this._sectionId],
        version: this._rawDTO.version,
        lastModified: this._rawDTO.lastModified,
      },
    });

    (this as { id: number }).id = response.id;
    this.name = response.name;
    (this as { contentTypeID: number }).contentTypeID = response.contentTypeID;
    (this as { language: string }).language = response.language;
    this._status = mapStatus(response.status);
    this._statusDirty = false;
    (this as { version: number }).version = response.version;
    (this as { lastModified: Date | null }).lastModified = response.lastModified ? new Date(response.lastModified) : null;
    this.publishDate = response.publishDate ? new Date(response.publishDate) : null;
    this.expiryDate = response.expiryDate ? new Date(response.expiryDate) : null;
    this.reviewDate = response.reviewDate ? new Date(response.reviewDate) : null;
    this.archiveSection = response.archiveSection ?? null;
    this._rawDTO = response;

    const parsed = await parseElements(
      response.elements ?? {},
      this._templateElements,
      this._resolver,
      this.language,
      this._typeRegistry,
      this._httpClient,
      this._sectionId,
      response.id,
      String(response.version),
    );
    this.fields = parsed.fields;
    this._keyMap = parsed.keyMap;
    this._dirtyFields = new Set();

    // Re-wrap fields in Proxy for dirty tracking
    this.fields = new Proxy(this.fields, {
      set: (target, prop, value) => {
        if (typeof prop === 'string') {
          this._dirtyFields.add(prop);
        }
        target[prop as string] = value;
        return true;
      },
    });
  }

  /**
   * Saves the content item with an approved status.
   * Shorthand for setting `status = 'approved'` and calling `save()`.
   * Throws if the content is already approved.
   */
  async approve(): Promise<void> {
    if (this._status === 'approved' && !this._statusDirty) {
      throw new Error(`Content item ${this.id} is already approved.`);
    }
    this.status = 'approved';
    await this.save();
  }

  /**
   * Duplicates this content item, optionally into a different section.
   *
   * - If `sectionId` is omitted, duplicates within the same section and automatically
   *   appends `(n)` to the name to avoid collisions.
   * - If `sectionId` is provided, duplicates into that section with the original name.
   */
  async duplicate(sectionId?: number): Promise<void> {
    const destination = sectionId ?? this._sectionId;
    const sameSection = destination === this._sectionId;

    let name = this.name;

    if (sameSection) {
      // Fetch all content in this section to determine the next (n) suffix
      const response = await this._httpClient.request<{
        children: Array<{ content: { name: string } }>;
      }>({
        method: 'GET',
        path: `/hierarchy/${this._sectionId}/${this.language}/contents?showAll=false&removeNonTranslated=false`,
      });

      const existingNames = new Set(
        (response.children ?? []).map((child) => child.content.name),
      );

      // Strip any existing trailing " (n)" from the base name
      const baseName = name.replace(/\s*\(\d+\)$/, '');
      let counter = 1;
      let candidate = `${baseName} (${counter})`;
      while (existingNames.has(candidate)) {
        counter++;
        candidate = `${baseName} (${counter})`;
      }
      name = candidate;
    }

    await this._httpClient.request<void>({
      method: 'COPY',
      path: `/content/${this.language}`,
      body: {
        source: this._sectionId,
        destination,
        contents: {
          [this.id]: [{ language: this.language, name }],
        },
      },
    });
  }

  /**
   * Moves this content item to a different section.
   */
  async move(sectionId: number): Promise<void> {
    await this._httpClient.request<void>({
      method: 'MOVE',
      path: `/content/${this.language}`,
      body: {
        source: this._sectionId,
        destination: sectionId,
        contents: { [this.id]: [] },
      },
    });
  }
}

/** Factory function to create a ContentItem with async field resolution */
export async function createContentItem(
  data: ContentDTO,
  httpClient: HttpClient,
  sectionId: number,
  resolver?: ElementResolver | null,
  templateElements?: TemplateElement[] | null,
  typeRegistry?: TypeRegistry | null,
): Promise<ContentItem> {
  const item = new ContentItem(data, httpClient, sectionId, resolver, templateElements, typeRegistry);
  await item[INIT](data);
  return item;
}
