import { HttpClient } from '../http-client.js';
import { mapStatus, STATUS_CODES } from '../utils.js';
import { ApiSectionDTO } from '../types.js';
import { ContentResource } from '../resources/content-resource.js';
import { MediaCreateFn } from '../element-resolver.js';

/**
 * A mutable section object. Modify properties and call save() to persist.
 */
export class SectionItem {
  readonly id: number;
  readonly parentId: number | null;
  readonly path: string | null;
  readonly pathMembers: number[];
  readonly lastModified: Date | null;
  readonly accessControl: { active: boolean; enabled: boolean };
  name: string;
  show: boolean;
  status: string;
  outputUri: string;
  filename: string;
  archive: boolean;
  /** Custom fields from the section's metadata content. `null` when no metadata is configured. */
  customFields: Record<string, unknown> | null;

  private readonly _httpClient!: HttpClient;
  private readonly _language!: string;
  private readonly _mediaCreateFn!: MediaCreateFn | null;
  private _rawData!: ApiSectionDTO;
  private _initialCustomFields: Record<string, unknown> | null = null;

  constructor(
    raw: ApiSectionDTO,
    httpClient: HttpClient,
    language: string,
    customFields?: Record<string, unknown> | null,
    mediaCreateFn?: MediaCreateFn | null,
  ) {
    this.id = raw.id;
    this.parentId = raw.parent ?? null;
    this.path = raw.path ? raw.path.replace(/&raquo;/g, '\u00BB').trim() : null;
    this.pathMembers = raw.pathMembers ?? [];
    this.lastModified = raw.lastModified ? new Date(raw.lastModified) : null;
    const ac = raw.accessControl as { active?: boolean; enabled?: boolean } | undefined;
    this.accessControl = {
      active: ac?.active ?? false,
      enabled: ac?.enabled ?? false,
    };
    this.name = raw.name;
    this.show = raw.show ?? true;
    this.status = mapStatus(Number(raw.status) || 0);
    this.outputUri = raw['output-uri'] ?? '';
    this.filename = raw['file-name'] ?? '';
    this.archive = raw.archive ?? false;
    this.customFields = customFields ?? null;
    this._initialCustomFields = customFields ? { ...customFields } : null;
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_language', { value: language, enumerable: false });
    Object.defineProperty(this, '_mediaCreateFn', { value: mediaCreateFn ?? null, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw, enumerable: false, writable: true });
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    const statusCode = STATUS_CODES[this.status] ?? Number(this._rawData.status) ?? 0;

    const updated = {
      ...this._rawData,
      name: this.name,
      show: this.show,
      status: String(statusCode),
      'output-uri': this.outputUri,
      'file-name': this.filename,
      archive: this.archive,
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.id}/${this._language}`,
      body: updated,
    });

    // Update raw data for next save
    this._rawData = {
      ...this._rawData,
      name: this.name,
      show: this.show,
      status: statusCode,
      'output-uri': this.outputUri,
      'file-name': this.filename,
      archive: this.archive,
    };

    // Persist custom fields if they changed
    await this._saveCustomFields();
  }

  /**
   * Creates or updates the section's metadata content when customFields changed.
   * Compares current customFields to the snapshot taken at construction time.
   */
  private async _saveCustomFields(): Promise<void> {
    if (this.customFields === null) return;

    // Detect whether customFields actually changed
    if (this._initialCustomFields !== null && !this._customFieldsChanged()) return;
    // If _initialCustomFields was null but customFields is now set, that means
    // the user assigned customFields on a section that had none — treat as create.

    const meta = this._rawData.metaData as { id?: number; type?: number; enabled?: boolean } | undefined;
    const metaDataTypeId = await this._resolveMetaDataTypeId(meta?.type ?? 0);

    if (!metaDataTypeId) {
      throw new Error(
        'Cannot save customFields: no Section Meta Data content type is configured on this T4 instance',
      );
    }

    const contentResource = new ContentResource(
      this._httpClient, this.id, this._language, this._mediaCreateFn,
    );

    const metaContentId = meta?.id ?? 0;

    if (metaContentId > 0) {
      // Update existing metadata content
      const item = await contentResource.update(metaContentId, {
        fields: this.customFields,
      });
      this.customFields = this._stripName(item.fields) ?? this.customFields;
    } else {
      // Create new metadata content. The Name element mirrors the section name.
      const item = await contentResource.create({
        type: metaDataTypeId,
        name: this.name,
        fields: this.customFields,
        status: 'pending',
      });
      this.customFields = this._stripName(item.fields) ?? this.customFields;
      // Update rawData so subsequent saves know the content ID exists
      if (meta) {
        (meta as { id: number }).id = item.id;
      }
    }

    // Update the snapshot so the next save doesn't re-persist unchanged fields
    this._initialCustomFields = this.customFields ? { ...this.customFields } : null;
  }

  /**
   * Resolves the Section Meta Data content type ID.
   *
   * Prefers the section's own `metaData.type`, but falls back to the
   * instance-level configuration (`GET /config/hierarchy.metaDataContentType`)
   * when the section has none. This covers sections created before a metadata
   * content type existed, or created via the API without one, while a metadata
   * content type is now configured on the instance. Returns `0` when no metadata
   * content type is configured anywhere.
   */
  private async _resolveMetaDataTypeId(sectionMetaDataType: number): Promise<number> {
    if (sectionMetaDataType > 0) return sectionMetaDataType;

    try {
      const config = await this._httpClient.request<{ name: string; type: string; value: string }>({
        method: 'GET',
        path: '/config/hierarchy.metaDataContentType',
      });
      return parseInt(config.value, 10) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Strips the internal `Name` element from resolved metadata fields. The Section
   * Meta Data content type always has a Name element mirroring the section name,
   * which isn't a user-facing custom field.
   */
  private _stripName(fields: Record<string, unknown> | undefined): Record<string, unknown> | null {
    if (!fields) return null;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key.toLowerCase() === 'name') continue;
      result[key] = value;
    }
    return result;
  }

  /** Shallow comparison of current customFields against the initial snapshot. */
  private _customFieldsChanged(): boolean {
    if (this.customFields === null && this._initialCustomFields === null) return false;
    if (this.customFields === null || this._initialCustomFields === null) return true;

    const currentKeys = Object.keys(this.customFields);
    const initialKeys = Object.keys(this._initialCustomFields);
    if (currentKeys.length !== initialKeys.length) return true;

    for (const key of currentKeys) {
      if (this.customFields[key] !== this._initialCustomFields[key]) return true;
    }
    return false;
  }
}
