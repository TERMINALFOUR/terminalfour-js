import { HttpClient } from './http-client.js';
import { ContentDTO } from './types.js';
import { DEFAULT_CACHE_TTL, getCacheEpoch } from './utils.js';

/** Config endpoint response shape */
interface ConfigResponse {
  options: Array<{ name: string; type: string; value: string }>;
}

/** Summary returned from list() */
export interface HandlebarsItemSummary {
  id: number;
  name: string;
  lastModified: Date | null;
}

/** Response shape from GET /hierarchy/{id}/{language}/contents */
interface ContentsResponse {
  children: Array<{
    id: number;
    content: ContentDTO;
    printSequence: number;
    sortLock: string;
  }>;
  sortType: number;
}

/** Configuration for a handlebars content resource (helpers or partials) */
interface HandlebarsResourceConfig {
  /** Config endpoint path for the section ID (e.g. '/config/handlebars.helpersSectionId') */
  sectionIdConfigPath: string;
  /** Config option name for the section ID (e.g. 'handlebars.helpersSectionId') */
  sectionIdOptionName: string;
  /** Config endpoint path for the content type ID */
  contentTypeIdConfigPath: string;
  /** Config option name for the content type ID */
  contentTypeIdOptionName: string;
  /** The element name that holds the code (e.g. 'function code' or 'code') */
  codeElementName: string;
  /** Display name for error messages (e.g. 'Helper' or 'Partial') */
  displayName: string;
}

/**
 * A mutable Handlebars item (helper or partial).
 * Modify `name` and/or `code`, then call `save()` to persist.
 * All saves are automatically set to approved status.
 */
export class HandlebarsItem {
  readonly id: number;
  name: string;
  code: string;
  readonly lastModified: Date | null;

  private readonly _httpClient!: HttpClient;
  private readonly _sectionId!: number;
  private readonly _language!: string;
  private readonly _codeElementName!: string;
  private _rawDTO!: ContentDTO;

  constructor(dto: ContentDTO, httpClient: HttpClient, sectionId: number, language: string, codeElementName: string) {
    this.id = dto.id;
    this.name = dto.name;
    this.lastModified = dto.lastModified ? new Date(dto.lastModified) : null;

    // Extract the code field value from elements
    this.code = this.extractCode(dto.elements, codeElementName) ?? '';

    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_sectionId', { value: sectionId, enumerable: false });
    Object.defineProperty(this, '_language', { value: language, enumerable: false });
    Object.defineProperty(this, '_codeElementName', { value: codeElementName, enumerable: false });
    Object.defineProperty(this, '_rawDTO', { value: dto, enumerable: false, writable: true });
  }

  /**
   * Persists changes to name and/or code back to the server.
   * Always saves with approved status.
   */
  async save(): Promise<void> {
    // Update elements with current name and code
    const elements = { ...this._rawDTO.elements };
    for (const key of Object.keys(elements)) {
      if (key.toLowerCase().startsWith('name#')) {
        elements[key] = this.name;
      } else if (key.toLowerCase().startsWith(this._codeElementName + '#')) {
        elements[key] = this.code;
      }
    }

    const response = await this._httpClient.request<ContentDTO>({
      method: 'POST',
      path: `/content/${this._sectionId}/${this.id}/${this._language}`,
      body: {
        id: this.id,
        contentTypeID: this._rawDTO.contentTypeID,
        name: this.name,
        language: this._language,
        status: 0, // approved
        elements,
        channels: this._rawDTO.channels,
        canPublishNow: true,
        canSaveAndApprove: true,
        publishDate: this._rawDTO.publishDate ?? null,
        expiryDate: this._rawDTO.expiryDate ?? null,
        reviewDate: this._rawDTO.reviewDate ?? null,
        archiveSection: this._rawDTO.archiveSection ?? null,
        owner: this._rawDTO.owner ?? { id: 0, type: 'USER' },
        excludedMirrorSectionIds: [],
        sectionIDs: [this._sectionId],
        version: this._rawDTO.version,
        lastModified: this._rawDTO.lastModified,
      },
    });

    // Update internal state from response
    (this as { id: number }).id = response.id;
    this.name = response.name;
    (this as { lastModified: Date | null }).lastModified = response.lastModified ? new Date(response.lastModified) : null;
    this.code = this.extractCode(response.elements, this._codeElementName) ?? this.code;
    this._rawDTO = response;
  }

  /** Extracts the code value from the raw elements map */
  private extractCode(elements: Record<string, unknown>, codeElementName: string): string | null {
    for (const [key, value] of Object.entries(elements)) {
      if (key.toLowerCase().startsWith(codeElementName + '#')) {
        return (value as string) ?? null;
      }
    }
    return null;
  }
}

/**
 * Generic resource for managing Handlebars content items (helpers or partials).
 * Both share the same pattern: content in a hidden section with name + code fields.
 */
export class HandlebarsContentResource {
  private readonly httpClient: HttpClient;
  private readonly config: HandlebarsResourceConfig;

  // Cached config values
  private sectionIdPromise: Promise<number> | null = null;
  private sectionIdExpiresAt = 0;
  private sectionIdEpoch = -1;

  private contentTypeIdPromise: Promise<number> | null = null;
  private contentTypeIdExpiresAt = 0;
  private contentTypeIdEpoch = -1;

  constructor(httpClient: HttpClient, config: HandlebarsResourceConfig) {
    this.httpClient = httpClient;
    this.config = config;
  }

  /** Fetches and caches the section ID */
  private getSectionId(): Promise<number> {
    if (!this.sectionIdPromise || Date.now() > this.sectionIdExpiresAt || this.sectionIdEpoch < getCacheEpoch()) {
      this.sectionIdExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.sectionIdEpoch = getCacheEpoch();
      this.sectionIdPromise = this.httpClient.request<ConfigResponse>({
        method: 'POST',
        path: this.config.sectionIdConfigPath,
        body: {},
      }).then((res) => {
        const opt = res.options.find((o) => o.name === this.config.sectionIdOptionName);
        if (!opt) throw new Error(`Could not resolve ${this.config.displayName.toLowerCase()} section ID from config`);
        return Number(opt.value);
      });
    }
    return this.sectionIdPromise;
  }

  /** Fetches and caches the content type ID */
  private getContentTypeId(): Promise<number> {
    if (!this.contentTypeIdPromise || Date.now() > this.contentTypeIdExpiresAt || this.contentTypeIdEpoch < getCacheEpoch()) {
      this.contentTypeIdExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.contentTypeIdEpoch = getCacheEpoch();
      this.contentTypeIdPromise = this.httpClient.request<ConfigResponse>({
        method: 'POST',
        path: this.config.contentTypeIdConfigPath,
        body: {},
      }).then((res) => {
        const opt = res.options.find((o) => o.name === this.config.contentTypeIdOptionName);
        if (!opt) throw new Error(`Could not resolve ${this.config.displayName.toLowerCase()} content type ID from config`);
        return Number(opt.value);
      });
    }
    return this.contentTypeIdPromise;
  }

  /**
   * Lists all items (summaries only: id, name, lastModified).
   */
  async list(): Promise<HandlebarsItemSummary[]> {
    const sectionId = await this.getSectionId();
    const language = 'en';

    const response = await this.httpClient.request<ContentsResponse>({
      method: 'GET',
      path: `/hierarchy/${sectionId}/${language}/contents?showAll=false&removeNonTranslated=false`,
    });

    return (response.children ?? []).map((child) => ({
      id: child.content.id,
      name: child.content.name,
      lastModified: child.content.lastModified ? new Date(child.content.lastModified) : null,
    }));
  }

  /**
   * Resolves a name or ID to a numeric content ID.
   * If a string is passed, lists all items and finds by name.
   * Throws if the name is not found or if multiple items share the same name.
   */
  private async resolveId(nameOrId: string | number): Promise<number> {
    if (typeof nameOrId === 'number') return nameOrId;

    const items = await this.list();
    const matches = items.filter((item) => item.name === nameOrId);

    if (matches.length === 0) {
      const available = items.map((i) => `"${i.name}"`).join(', ');
      throw new Error(
        `${this.config.displayName} "${nameOrId}" not found. Available: ${available}`,
      );
    }
    if (matches.length > 1) {
      throw new Error(
        `Multiple ${this.config.displayName.toLowerCase()}s found with name "${nameOrId}" (IDs: ${matches.map((m) => m.id).join(', ')}). Use an ID instead.`,
      );
    }

    return matches[0].id;
  }

  /**
   * Retrieves a single item by name or ID. Returns a mutable HandlebarsItem.
   */
  async get(nameOrId: string | number): Promise<HandlebarsItem> {
    const id = await this.resolveId(nameOrId);
    const sectionId = await this.getSectionId();
    const language = 'en';

    const dto = await this.httpClient.request<ContentDTO>({
      method: 'GET',
      path: `/content/${sectionId}/${id}/${language}`,
    });

    return new HandlebarsItem(dto, this.httpClient, sectionId, language, this.config.codeElementName);
  }

  /**
   * Creates a new item. Always created as approved.
   * Throws if an item with the same name already exists.
   * Returns a mutable HandlebarsItem.
   */
  async create(data: { name: string; code: string }): Promise<HandlebarsItem> {
    if (!data.name?.trim()) throw new Error(`${this.config.displayName} name is required`);
    if (!data.code?.trim()) throw new Error(`${this.config.displayName} code is required`);

    // Check for duplicate names
    const existing = await this.list();
    const duplicate = existing.find((item) => item.name === data.name);
    if (duplicate) {
      throw new Error(
        `A ${this.config.displayName.toLowerCase()} named "${data.name}" already exists (ID: ${duplicate.id})`,
      );
    }

    const [sectionId, contentTypeId] = await Promise.all([
      this.getSectionId(),
      this.getContentTypeId(),
    ]);
    const language = 'en';

    // Fetch the content type template to get element keys
    const template = await this.httpClient.request<{
      contentType: { id: number; contentTypeElements: Array<{ id: number; name: string; type: number; sequence: number }> };
      channels: number[];
    }>({
      method: 'GET',
      path: `/content/type/${contentTypeId}/${sectionId}`,
    });

    const elements: Record<string, unknown> = {};
    for (const el of template.contentType.contentTypeElements) {
      const key = `${el.name}#${el.id}:${el.type}`;
      if (el.name.toLowerCase() === 'name') {
        elements[key] = data.name;
      } else if (el.name.toLowerCase() === this.config.codeElementName) {
        elements[key] = data.code;
      }
    }

    const contentId = -Math.floor(Math.random() * 1000000);

    const dto = await this.httpClient.request<ContentDTO>({
      method: 'POST',
      path: `/content/${sectionId}/${language}`,
      body: {
        id: contentId,
        contentTypeID: contentTypeId,
        name: data.name,
        language,
        status: 0, // approved
        elements,
        channels: template.channels,
        canPublishNow: true,
        canSaveAndApprove: true,
        publishDate: null,
        expiryDate: null,
        reviewDate: null,
        archiveSection: null,
        owner: { id: 0, type: 'USER' },
        excludedMirrorSectionIds: [],
      },
    });

    return new HandlebarsItem(dto, this.httpClient, sectionId, language, this.config.codeElementName);
  }

  /**
   * Updates an item's name and/or code (immutable pattern).
   * Accepts a name or ID. Fetches existing, merges changes, saves. Always approved.
   */
  async update(nameOrId: string | number, data: { name?: string; code?: string }): Promise<HandlebarsItem> {
    const item = await this.get(nameOrId);
    if (data.name !== undefined) item.name = data.name;
    if (data.code !== undefined) item.code = data.code;
    await item.save();
    return item;
  }

  /**
   * Deletes an item by name or ID (soft delete — sets to inactive).
   */
  async delete(nameOrId: string | number): Promise<void> {
    const id = await this.resolveId(nameOrId);
    const sectionId = await this.getSectionId();
    const language = 'en';

    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/content/${sectionId}/${id}/${language}`,
    });
  }

  /**
   * Permanently removes an item by name or ID.
   */
  async purge(nameOrId: string | number): Promise<void> {
    const id = await this.resolveId(nameOrId);
    const language = 'en';

    await this.httpClient.request<void>({
      method: 'POST',
      path: '/content/purge',
      body: {
        languageCode: language,
        contentIds: [String(id)],
      },
    });
  }
}

// ── Type aliases for backward compatibility and clarity ──

/** A mutable Handlebars Custom Helper (alias for HandlebarsItem) */
export type Helper = HandlebarsItem;
/** A mutable Handlebars Partial (alias for HandlebarsItem) */
export type Partial = HandlebarsItem;

/** Summary returned from helpers.list() */
export type HelperSummary = HandlebarsItemSummary;
/** Summary returned from partials.list() */
export type PartialSummary = HandlebarsItemSummary;

/**
 * The `t4.handlebars` namespace — provides access to helpers and partials.
 */
export class Handlebars {
  readonly helpers: HandlebarsContentResource;
  readonly partials: HandlebarsContentResource;

  constructor(httpClient: HttpClient) {
    this.helpers = new HandlebarsContentResource(httpClient, {
      sectionIdConfigPath: '/config/handlebars.helpersSectionId',
      sectionIdOptionName: 'handlebars.helpersSectionId',
      contentTypeIdConfigPath: '/config/handlebars.helpersContentTypeId',
      contentTypeIdOptionName: 'handlebars.helpersContentTypeId',
      codeElementName: 'function code',
      displayName: 'Helper',
    });

    this.partials = new HandlebarsContentResource(httpClient, {
      sectionIdConfigPath: '/config/handlebars.partialsSectionId',
      sectionIdOptionName: 'handlebars.partialsSectionId',
      contentTypeIdConfigPath: '/config/handlebars.partialsContentTypeId',
      contentTypeIdOptionName: 'handlebars.partialsContentTypeId',
      codeElementName: 'code',
      displayName: 'Partial',
    });
  }
}
