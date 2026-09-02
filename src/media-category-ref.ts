import { HttpClient } from './http-client.js';
import { LanguageOption } from './types.js';
import { resolveLanguage, formatFileSize, STATUS_MAP } from './utils.js';
import { MediaCategoryItem } from './models/media-category-item.js';

/** Raw media category response from the API */
interface ApiMediaCategoryDTO {
  id: number;
  name: string;
  parent: number | null;
  path?: string;
  status?: number;
  lastModified?: number;
  [key: string]: unknown;
}

/** A media item as returned from the category list endpoint */
export interface MediaListItem {
  id: number;
  name: string;
  description: string;
  fileName: string;
  fileSize: string;
  mediaType: string;
  language: string;
  version: string;
  status: string;
  lastModified: Date | null;
}

/** Raw media row from the POST /media/category/{id}/{language}/list response */
interface ApiMediaRow {
  id: number;
  name: string;
  description: string;
  fileName: string;
  fileSize: number;
  mediaTypeName: string;
  language: string;
  binaryLanguage: string;
  version: string;
  status: number;
  lastModified: number;
  thumbnailURL?: string;
  numberOfVariants?: number;
}

/** Response shape from the list endpoint */
interface MediaListResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  accessLevel: number;
  mediaRows: ApiMediaRow[];
}

/**
 * A media category reference scoped to a specific category ID.
 * Provides listing of media items within the category.
 *
 * Usage: `t4.mediaCategory(367).list()`
 */
export class MediaCategoryRef {
  private readonly httpClient: HttpClient;
  private readonly categoryId: number;

  constructor(httpClient: HttpClient, categoryId: number) {
    this.httpClient = httpClient;
    this.categoryId = categoryId;
  }

  /**
   * Returns a mutable media category object. Modify properties and call save() to persist.
   */
  async get(options?: LanguageOption): Promise<MediaCategoryItem> {
    const language = resolveLanguage(options?.language, 'en');
    const raw = await this.httpClient.request<ApiMediaCategoryDTO>({
      method: 'GET',
      path: `/mediacategory/${this.categoryId}/${language}`,
    });
    return new MediaCategoryItem(raw, this.httpClient, language);
  }

  /**
   * Lists direct child categories (one level below).
   */
  async subcategories(options?: LanguageOption): Promise<Array<{ id: number; name: string; lastModified: Date | null }>> {
    const language = resolveLanguage(options?.language, 'en');
    const response = await this.httpClient.request<{ children: Array<{ id: number; name: string; lastModified: number }> }>({
      method: 'GET',
      path: `/hierarchy/${this.categoryId}/${language}/subsections?showAll=false&removeNonTranslated=false`,
    });
    return (response.children ?? []).map((child) => ({
      id: child.id,
      name: child.name,
      lastModified: child.lastModified ? new Date(child.lastModified) : null,
    }));
  }

  /**
   * Updates this media category's name. Fetches the current category,
   * merges the change, and PUTs the full body back.
   * Returns the updated MediaCategoryItem.
   */
  async update(data: { name: string }, options?: LanguageOption): Promise<MediaCategoryItem> {
    if (!data.name?.trim()) {
      throw new Error('Media category name is required');
    }

    const language = resolveLanguage(options?.language, 'en');

    const category = await this.httpClient.request<ApiMediaCategoryDTO>({
      method: 'GET',
      path: `/mediacategory/${this.categoryId}/${language}`,
    });

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/mediacategory/${this.categoryId}/${language}`,
      body: {
        ...category,
        name: data.name,
      },
    });

    return this.get(options);
  }

  /**
   * Deletes this media category.
   */
  async delete(): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/mediacategory/${this.categoryId}`,
    });
  }

  /**
   * Permanently removes this media category.
   * Call delete() first to deactivate it, then purge() to remove it entirely.
   */
  async purge(options?: LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, 'en');
    await this.httpClient.request<void>({
      method: 'POST',
      path: '/hierarchy/purge',
      body: {
        languageCode: language,
        contentIds: [String(this.categoryId)],
      },
    });
  }

  /**
   * Moves this media category under a new parent category.
   */
  async move(newParentId: number, options?: LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, 'en');
    await this.httpClient.request<void>({
      method: 'MOVE',
      path: `/mediacategory/${this.categoryId}/${newParentId}/${language}`,
      body: {},
    });
  }

  /**
   * Creates a child media category under this category.
   * Returns the created child as a mutable MediaCategoryItem.
   */
  async addCategory(data: { name: string }, options?: LanguageOption): Promise<MediaCategoryItem> {
    if (!data.name?.trim()) {
      throw new Error('Media category name is required');
    }

    const language = resolveLanguage(options?.language, 'en');

    const raw = await this.httpClient.request<ApiMediaCategoryDTO>({
      method: 'POST',
      path: `/mediacategory/${language}`,
      body: {
        parent: String(this.categoryId),
        name: data.name,
        description: '',
        status: '0',
        workflow: '-2',
        show: false,
        eForm: false,
        archive: false,
        'output-uri': '',
      },
    });

    const childRef = new MediaCategoryRef(this.httpClient, raw.id);
    return childRef.get(options);
  }

  /**
   * Lists all media items in this category.
   * Fetches all items in a single request (up to 10000).
   */
  async list(options?: LanguageOption): Promise<MediaListItem[]> {
    const language = resolveLanguage(options?.language, 'en');

    const formBody = this.buildListFormBody();

    const response = await this.httpClient.request<MediaListResponse>({
      method: 'POST',
      path: `/media/category/${this.categoryId}/${language}/list?showPending=true&showUntranslated=true`,
      body: formBody,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return (response.mediaRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      fileName: row.fileName,
      fileSize: formatFileSize(row.fileSize ?? 0),
      mediaType: row.mediaTypeName,
      language: row.binaryLanguage ?? row.language,
      version: row.version,
      status: STATUS_MAP[row.status] ?? `unknown (${row.status})`,
      lastModified: row.lastModified ? new Date(row.lastModified) : null,
    }));
  }

  /**
   * Builds the DataTables form body for the list endpoint.
   * Uses a minimal column definition and requests all items.
   */
  private buildListFormBody(): string {
    const params = new URLSearchParams();

    params.set('draw', '1');
    params.set('start', '0');
    params.set('length', '10000');
    params.set('search[value]', '');
    params.set('search[regex]', 'false');

    // Define the 8 columns the API expects
    for (let i = 0; i < 8; i++) {
      params.set(`columns[${i}][data]`, String(i));
      params.set(`columns[${i}][name]`, '');
      params.set(`columns[${i}][searchable]`, 'true');
      params.set(`columns[${i}][orderable]`, i >= 1 && i <= 5 ? 'true' : 'false');
      params.set(`columns[${i}][search][value]`, '');
      params.set(`columns[${i}][search][regex]`, 'false');
    }

    // Sort by lastModified (column 5) descending
    params.set('order[0][column]', '5');
    params.set('order[0][dir]', 'desc');

    return params.toString();
  }
}
