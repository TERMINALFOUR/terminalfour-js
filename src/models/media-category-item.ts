import { HttpClient } from '../http-client.js';

/** Raw media category shape from the T4 API */
interface ApiMediaCategoryDTO {
  id: number;
  name: string;
  parent: number | null;
  path?: string;
  status?: number;
  lastModified?: number;
  [key: string]: unknown;
}

/**
 * A mutable media category object. Modify properties and call save() to persist.
 */
export class MediaCategoryItem {
  readonly id: number;
  readonly parentId: number | null;
  readonly path: string | null;
  readonly lastModified: Date | null;
  name: string;

  private readonly _httpClient!: HttpClient;
  private readonly _language!: string;
  private _rawData!: ApiMediaCategoryDTO;

  constructor(raw: ApiMediaCategoryDTO, httpClient: HttpClient, language: string) {
    this.id = raw.id;
    this.parentId = raw.parent ?? null;
    this.path = raw.path ? raw.path.replace(/&raquo;/g, '»').trim() : null;
    this.lastModified = raw.lastModified ? new Date(raw.lastModified) : null;
    this.name = raw.name;
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_language', { value: language, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw, enumerable: false, writable: true });
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    const updated = {
      ...this._rawData,
      name: this.name,
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/mediacategory/${this.id}/${this._language}`,
      body: updated,
    });

    this._rawData = { ...this._rawData, name: this.name };
  }
}
