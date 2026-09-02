import { HttpClient } from '../http-client.js';
import { formatFileSize, parseFileSize } from '../utils.js';

/** Layout (formatter) for a media type */
export interface MediaTypeLayout {
  name: string;
  default: boolean;
}

/** Raw API response shape from GET /mediaType/ and GET /mediaType/{id} */
interface RawMediaType {
  id: number;
  name: string;
  permittedExtensions: string;
  enableParseForTags: boolean;
  maxSize: number;
  formatters: Array<{ mediaTypeID: number; mediaLayout: string; isDefault: boolean }>;
  isBinary: boolean;
}

/** Raw API response shape from GET /mediaType/ (list endpoint uses slightly different field names) */
interface RawMediaTypeListItem {
  id: number;
  name: string;
  permittedExtensions: string;
  parseForTagsEnabled: boolean;
  maxSize: number;
  formats: Array<{ mediaTypeID: number; mediaLayout: string; default: boolean }>;
  binary: boolean;
  permittedExtensionsFormatted: string[];
  defaultFormat?: { mediaLayout: string; default: boolean };
}

/** Data exposed on a MediaType model */
export interface MediaTypeData {
  id: number;
  name: string;
  extensions: string[];
  binary: boolean;
  parseForTags: boolean;
  maxSize: string | null;
  layouts: MediaTypeLayout[];
  defaultLayout: string;
}

function mapFromDetail(raw: RawMediaType): MediaTypeData {
  const layouts: MediaTypeLayout[] = (raw.formatters ?? []).map((f) => ({
    name: f.mediaLayout,
    default: f.isDefault,
  }));
  const defaultLayout = layouts.find((l) => l.default)?.name ?? '';

  return {
    id: raw.id,
    name: raw.name,
    extensions: raw.permittedExtensions
      ? raw.permittedExtensions.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    binary: raw.isBinary,
    parseForTags: raw.enableParseForTags,
    maxSize: raw.maxSize > 0 ? formatFileSize(raw.maxSize) : null,
    layouts,
    defaultLayout,
  };
}

function mapFromListItem(raw: RawMediaTypeListItem): MediaTypeData {
  const layouts: MediaTypeLayout[] = (raw.formats ?? []).map((f) => ({
    name: f.mediaLayout,
    default: f.default,
  }));
  const defaultLayout = layouts.find((l) => l.default)?.name ?? '';

  return {
    id: raw.id,
    name: raw.name,
    extensions: raw.permittedExtensionsFormatted ?? (raw.permittedExtensions
      ? raw.permittedExtensions.split(',').map((s) => s.trim()).filter(Boolean)
      : []),
    binary: raw.binary,
    parseForTags: raw.parseForTagsEnabled,
    maxSize: raw.maxSize > 0 ? formatFileSize(raw.maxSize) : null,
    layouts,
    defaultLayout,
  };
}

function validateMediaType(data: { binary?: boolean; parseForTags?: boolean; layouts?: MediaTypeLayout[] }): void {
  if (data.binary && data.parseForTags) {
    throw new Error('parseForTags cannot be true when binary is true. Tag parsing is only applicable to non-binary (text) media types.');
  }
  if (data.layouts && data.layouts.length > 0) {
    const hasDefault = data.layouts.some((l) => l.default);
    if (!hasDefault) {
      throw new Error('At least one layout must be set as default.');
    }
  }
}

/**
 * A mutable media type object. Modify properties and call save() to persist.
 */
export class MediaType implements MediaTypeData {
  readonly id: number;
  name: string;
  extensions: string[];
  binary: boolean;
  parseForTags: boolean;
  maxSize: string | null;
  layouts: MediaTypeLayout[];
  defaultLayout: string;

  private readonly _httpClient!: HttpClient;

  constructor(data: MediaTypeData, httpClient: HttpClient) {
    this.id = data.id;
    this.name = data.name;
    this.extensions = data.extensions;
    this.binary = data.binary;
    this.parseForTags = data.parseForTags;
    this.maxSize = data.maxSize;
    this.layouts = data.layouts;
    this.defaultLayout = data.defaultLayout;
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    // Sync defaultLayout into the layouts array
    if (this.defaultLayout) {
      for (const layout of this.layouts) {
        layout.default = layout.name === this.defaultLayout;
      }
    }

    validateMediaType(this);

    const body = {
      id: this.id,
      name: this.name,
      permittedExtensions: this.extensions.join(','),
      enableParseForTags: this.parseForTags,
      maxSize: String(this.maxSize != null ? parseFileSize(this.maxSize) : 0),
      formatters: this.layouts.map((l) => ({
        isDefault: l.default,
        mediaLayout: l.name,
      })),
      isBinary: this.binary,
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/mediaType/${this.id}`,
      body,
    });
  }
}

/** Size input: number (bytes), string ('2 KB'), or null (unlimited) */
type SizeInput = number | string | null;

/**
 * Resource for media type operations.
 * Accessible via `t4.mediaTypes`.
 */
export class MediaTypeResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Lists all media types. */
  async list(): Promise<MediaType[]> {
    const raw = await this.httpClient.request<RawMediaTypeListItem[]>({
      method: 'GET',
      path: '/mediaType/',
    });
    return raw.map((r) => new MediaType(mapFromListItem(r), this.httpClient));
  }

  /** Gets a single media type by ID. Returns a mutable MediaType object. */
  async get(id: number): Promise<MediaType> {
    const raw = await this.httpClient.request<RawMediaType>({
      method: 'GET',
      path: `/mediaType/${id}`,
    });
    return new MediaType(mapFromDetail(raw), this.httpClient);
  }

  /** Updates a media type's properties (immutable pattern). */
  async update(id: number, data: {
    name?: string;
    extensions?: string[];
    binary?: boolean;
    parseForTags?: boolean;
    maxSize?: SizeInput;
    layouts?: MediaTypeLayout[];
    defaultLayout?: string;
  }): Promise<MediaType> {
    const mt = await this.get(id);
    if (data.name !== undefined) mt.name = data.name;
    if (data.extensions !== undefined) mt.extensions = data.extensions;
    if (data.binary !== undefined) mt.binary = data.binary;
    if (data.parseForTags !== undefined) mt.parseForTags = data.parseForTags;
    if (data.maxSize !== undefined) mt.maxSize = data.maxSize != null ? (typeof data.maxSize === 'number' ? formatFileSize(data.maxSize) : data.maxSize) : null;
    if (data.layouts !== undefined) mt.layouts = data.layouts;
    if (data.defaultLayout !== undefined) mt.defaultLayout = data.defaultLayout;
    await mt.save();
    return mt;
  }

  /** Creates a new media type. */
  async create(data: {
    name: string;
    extensions: string[];
    binary: boolean;
    parseForTags?: boolean;
    maxSize?: SizeInput;
    layouts: MediaTypeLayout[];
    defaultLayout?: string;
  }): Promise<MediaType> {
    if (!data.name?.trim()) throw new Error('Media type name is required');
    if (!data.extensions?.length) throw new Error('At least one file extension is required');
    if (!data.layouts?.length) throw new Error('At least one layout is required');

    // If defaultLayout is provided, sync it into the layouts array
    if (data.defaultLayout) {
      for (const layout of data.layouts) {
        layout.default = layout.name === data.defaultLayout;
      }
    }

    const parseForTags = data.parseForTags ?? false;

    // Validate the explicit combination — throw if user passes conflicting values
    if (data.binary && data.parseForTags) {
      throw new Error('parseForTags cannot be true when binary is true. Tag parsing is only applicable to non-binary (text) media types.');
    }

    validateMediaType({ binary: data.binary, parseForTags, layouts: data.layouts });

    const body = {
      name: data.name,
      permittedExtensions: data.extensions.join(','),
      enableParseForTags: parseForTags,
      maxSize: String(data.maxSize != null ? parseFileSize(data.maxSize) : 0),
      formatters: data.layouts.map((l) => ({
        isDefault: l.default,
        mediaLayout: l.name,
      })),
      isBinary: data.binary,
    };

    await this.httpClient.request<RawMediaType>({
      method: 'POST',
      path: '/mediaType',
      body,
    });

    // Re-fetch by name to get real ID (create returns id: 0)
    const all = await this.httpClient.request<RawMediaTypeListItem[]>({
      method: 'GET',
      path: '/mediaType/',
    });
    const created = all.find((t) => t.name === data.name);
    if (!created) throw new Error(`Created media type "${data.name}" but could not find it in the listing`);

    // Fetch full detail by ID
    const detail = await this.httpClient.request<RawMediaType>({
      method: 'GET',
      path: `/mediaType/${created.id}`,
    });
    return new MediaType(mapFromDetail(detail), this.httpClient);
  }
}
