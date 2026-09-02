import { HttpClient } from '../http-client.js';
import { resolveLanguage } from '../utils.js';
import { LanguageOption } from '../types.js';
import { decodeHtmlEntities } from '../utils.js';

/** Raw list from GET /list/{language} */
interface RawListSummary {
  id: number;
  name: string;
  description?: string;
}

/** Raw list item from GET /list/{id}/{language} */
interface RawListItem {
  id: number;
  name: string;
  value: string;
  sequence: number;
  listId: number;
  sublist: number;
  isSelected: boolean;
}

/** Raw single list response */
interface RawListDetail {
  id: number;
  name: string;
  description?: string;
  language: string;
  isForcedLanguage?: boolean;
  isDefaultLanguage?: boolean;
  primaryGroup?: { id: number | null; group?: { id: number } };
  sharedGroups?: Array<{ id: number }>;
  items: RawListItem[];
  [key: string]: unknown;
}

/** A list item with mutable properties */
export interface ListItemData {
  name: string;
  value: string;
  selected: boolean;
  sublistId?: number;
}

/** A list summary returned from list() */
export interface ListSummary {
  id: number;
  name: string;
  description: string;
}

/** A mutable list object. Modify properties and call save() to persist. */
export class List {
  readonly id: number;
  name: string;
  description: string;
  isForcedLanguage: boolean;
  isDefaultLanguage: boolean;
  primaryGroup: number;
  sharedGroups: number[];
  items: Record<string, ListItemData>;

  private readonly _httpClient!: HttpClient;
  private readonly _language!: string;
  private _rawData!: RawListDetail;

  constructor(raw: RawListDetail, httpClient: HttpClient, language: string) {
    this.id = raw.id;
    this.name = decodeHtmlEntities(raw.name);
    this.description = decodeHtmlEntities(raw.description ?? '');
    this.isForcedLanguage = raw.isForcedLanguage ?? false;
    this.isDefaultLanguage = raw.isDefaultLanguage ?? false;
    this.primaryGroup = raw.primaryGroup?.group?.id ?? (raw.primaryGroup?.id as number) ?? 0;
    this.sharedGroups = (raw.sharedGroups ?? []).map((g) => g.id);
    this.items = {};
    for (const item of (raw.items ?? []).sort((a, b) => a.sequence - b.sequence)) {
      const friendlyName = decodeHtmlEntities(item.name);
      const mapped: ListItemData = {
        name: friendlyName,
        value: item.value,
        selected: item.isSelected,
      };
      if (item.sublist) mapped.sublistId = item.sublist;
      // Store raw item ID as non-enumerable for save
      Object.defineProperty(mapped, '_rawId', { value: item.id, enumerable: false });
      this.items[friendlyName] = mapped;
    }
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_language', { value: language, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw as RawListDetail, enumerable: false, writable: true });
  }

  /** Adds a new item to this list. Takes effect on save(). */
  addItem(data: { name: string; value: string; selected?: boolean; sublistId?: number }): void {
    if (!data.name?.trim()) throw new Error('List item name is required');
    if (this.items[data.name]) throw new Error(`List item "${data.name}" already exists`);

    const mapped: ListItemData = {
      name: data.name,
      value: data.value,
      selected: data.selected ?? false,
    };
    if (data.sublistId) mapped.sublistId = data.sublistId;
    // New items get _rawId = 0 so save() sends id: "0" (tells the API to create)
    Object.defineProperty(mapped, '_rawId', { value: 0, enumerable: false });
    this.items[data.name] = mapped;
  }

  /** Removes a list item by name. Takes effect on save(). */
  removeItem(itemName: string): void {
    if (!this.items[itemName]) throw new Error(`List item "${itemName}" not found`);
    delete this.items[itemName];
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    if (this.isForcedLanguage && this.isDefaultLanguage) {
      throw new Error('isForcedLanguage and isDefaultLanguage cannot both be true');
    }
    const items = Object.values(this.items).map((item, i) => ({
      id: String((item as unknown as { _rawId?: number })._rawId ?? 0),
      name: item.name,
      value: item.value,
      isSelected: item.selected,
      sublist: item.sublistId ? String(item.sublistId) : '0',
      sequence: i + 1,
    }));

    const updated = {
      ...this._rawData,
      name: this.name,
      description: this.description,
      isForcedLanguage: this.isForcedLanguage,
      isDefaultLanguage: this.isDefaultLanguage,
      primaryGroup: { id: this.primaryGroup || 0 },
      sharedGroups: this.sharedGroups.map((id) => ({ id })),
      items,
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/list/${this.id}/${this._language}?override=false`,
      body: updated,
    });

    this._rawData = updated as unknown as RawListDetail;
  }
}

/**
 * Resource for list operations.
 */
export class ListResource {
  private readonly httpClient: HttpClient;
  private readonly defaultLanguage: string;

  constructor(httpClient: HttpClient, defaultLanguage: string) {
    this.httpClient = httpClient;
    this.defaultLanguage = defaultLanguage;
  }

  /** Lists all lists. */
  async list(options?: LanguageOption): Promise<ListSummary[]> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const raw = await this.httpClient.request<RawListSummary[]>({
      method: 'GET',
      path: `/list/${language}`,
    });
    return raw.map((l) => ({
      id: l.id,
      name: decodeHtmlEntities(l.name),
      description: decodeHtmlEntities(l.description ?? ''),
    }));
  }

  /** Gets a single list with its items. Returns a mutable List object. */
  async get(id: number, options?: LanguageOption): Promise<List> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const raw = await this.httpClient.request<RawListDetail>({
      method: 'GET',
      path: `/list/${id}/${language}?override=false`,
    });
    return new List(raw, this.httpClient, language);
  }

  /** Updates a list's properties (immutable pattern). */
  async update(id: number, data: {
    name?: string;
    description?: string;
    isForcedLanguage?: boolean;
    isDefaultLanguage?: boolean;
    primaryGroup?: number;
    sharedGroups?: number[];
  }, options?: LanguageOption): Promise<List> {
    const list = await this.get(id, options);
    if (data.name !== undefined) list.name = data.name;
    if (data.description !== undefined) list.description = data.description;
    if (data.isForcedLanguage !== undefined) list.isForcedLanguage = data.isForcedLanguage;
    if (data.isDefaultLanguage !== undefined) list.isDefaultLanguage = data.isDefaultLanguage;
    if (data.primaryGroup !== undefined) list.primaryGroup = data.primaryGroup;
    if (data.sharedGroups !== undefined) list.sharedGroups = data.sharedGroups;
    await list.save();
    return list;
  }

  /** Deletes a list by ID. */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/list/${id}?override=false`,
    });
  }

  /** Creates a new list. */
  async create(data: {
    name: string;
    description?: string;
    items?: Array<{ name: string; value: string; selected?: boolean; sublistId?: number }>;
    isForcedLanguage?: boolean;
    isDefaultLanguage?: boolean;
    primaryGroup?: number;
    sharedGroups?: number[];
  }, options?: LanguageOption): Promise<List> {
    if (!data.name?.trim()) {
      throw new Error('List name is required');
    }
    if (data.isForcedLanguage && data.isDefaultLanguage) {
      throw new Error('isForcedLanguage and isDefaultLanguage cannot both be true');
    }

    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const items = (data.items ?? []).map((item, i) => ({
      id: '0',
      name: item.name,
      value: item.value,
      isSelected: item.selected ?? false,
      sublist: item.sublistId ? String(item.sublistId) : '',
      sequence: i + 1,
    }));

    const raw = await this.httpClient.request<RawListDetail>({
      method: 'POST',
      path: `/list/${language}?override=false`,
      body: {
        name: data.name,
        description: data.description ?? '',
        items,
        isForcedLanguage: data.isForcedLanguage ?? false,
        isDefaultLanguage: data.isDefaultLanguage ?? false,
        sharedGroups: (data.sharedGroups ?? []).map((id) => ({ id })),
        primaryGroup: { id: data.primaryGroup ?? 0 },
        sortType: 0,
      },
    });

    return new List(raw, this.httpClient, language);
  }
}
