import { HttpClient } from '../http-client.js';
import { MediaItem, RawMediaDTO, MediaFileInput } from '../models/media-item.js';
import { LanguageOption } from '../types.js';
import { resolveLanguage, resolveFileToBlob, deriveFilename, DEFAULT_CACHE_TTL, getCacheEpoch } from '../utils.js';

/** Raw media type from GET /mediaType */
interface RawMediaType {
  id: number;
  name: string;
  permittedExtensions: string;
  permittedExtensionsFormatted: string[];
  binary: boolean;
}

/** Extension → syntax type mapping for non-binary media */
const EXTENSION_SYNTAX_MAP: Record<string, number> = {
  js: 1,
  css: 2,
  html: 3,
  htm: 3,
  php: 4,
  java: 5,
};

/** Extracts the extension from a filename (lowercase, no dot) */
function getExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex >= 0 ? filename.slice(dotIndex + 1).toLowerCase() : '';
}

/**
 * Resource for media operations: get, create, update, upload, delete.
 */
export class MediaResource {
  private readonly httpClient: HttpClient;
  private mediaTypesPromise: Promise<RawMediaType[]> | null = null;
  private mediaTypesExpiresAt = 0;
  private mediaTypesEpoch = -1;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Retrieves a single media item by ID.
   * Defaults to language 'smxx' (language-independent).
   */
  async get(id: number, options?: LanguageOption): Promise<MediaItem> {
    const language = resolveLanguage(options?.language, 'smxx');

    const [raw, mediaTypes] = await Promise.all([
      this.httpClient.request<RawMediaDTO>({
        method: 'GET',
        path: `/media/${id}/${language}`,
      }),
      this.getMediaTypes(),
    ]);

    const mediaTypeMap = new Map(mediaTypes.map((t) => [t.id, t.name]));
    const mediaTypeName = raw.typeName ?? mediaTypeMap.get(this.extractMediaTypeId(raw)) ?? 'Unknown';

    return new MediaItem(raw, mediaTypeName, this.httpClient);
  }

  /**
   * Creates a new media item in a category.
   *
   * The media type is auto-detected from the file extension using `GET /mediaType`.
   * Syntax type is auto-detected for non-binary media (CSS, JS, PHP, etc.).
   *
   * Returns the new media item.
   */
  async create(data: {
    file: MediaFileInput;
    name: string;
    category: number;
    description?: string;
    mediaTypeId?: number;
    fields?: Record<string, unknown>;
    language?: string;
  }): Promise<MediaItem> {
    if (!data.name?.trim()) throw new Error('Media name is required');
    if (!data.category) throw new Error('Media category is required');

    const language = data.language ?? 'smxx';
    const filename = deriveFilename(data.file);
    const ext = getExtension(filename);

    // Resolve the file to a Blob
    const rawFile = typeof data.file === 'object' && !(data.file instanceof Blob) && 'file' in data.file
      ? data.file.file
      : data.file as string | Blob;
    const blob = await resolveFileToBlob(rawFile);

    // Resolve media type from extension if not explicitly provided
    const mediaTypes = await this.getMediaTypes();
    let mediaTypeId = data.mediaTypeId;
    let isBinary = true;

    if (mediaTypeId === undefined) {
      const matched = mediaTypes.find((t) =>
        t.permittedExtensionsFormatted.some((e) => e.toLowerCase() === ext),
      );
      if (!matched) {
        const validTypes = mediaTypes.map((t) => `${t.name} (${t.permittedExtensionsFormatted.join(', ')})`).join('; ');
        throw new Error(
          `Cannot determine media type for extension "${ext}". ` +
          `Available types: ${validTypes}`,
        );
      }
      mediaTypeId = matched.id;
      isBinary = matched.binary;
    } else {
      const matched = mediaTypes.find((t) => t.id === mediaTypeId);
      isBinary = matched?.binary ?? true;
    }

    // Resolve syntax type for non-binary media
    const syntaxType = !isBinary ? (EXTENSION_SYNTAX_MAP[ext] ?? 0) : 0;

    // Build elements JSON from user fields
    const elementsObj: Record<string, unknown> = {};
    if (data.fields) {
      // For create, we don't have the content type template yet, so use raw keys
      // The API accepts friendly element names with undefined IDs on create
      for (const [key, value] of Object.entries(data.fields)) {
        elementsObj[key] = value;
      }
    }

    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('description', data.description ?? '');
    formData.append('type', String(mediaTypeId));
    formData.append('syntaxType', String(syntaxType));
    formData.append('myMedia', '0');
    formData.append('elements', JSON.stringify(elementsObj));
    formData.append('version', '');
    formData.append('binaryLanguage', language);
    formData.append('language', language);
    formData.append('categories', String(data.category));

    formData.append('file', blob, filename);
    formData.append('fileName', filename);

    const newId = await this.httpClient.request<number>({
      method: 'POST',
      path: '/media',
      multipart: true,
      formData,
    });

    return this.get(newId);
  }

  /**
   * Updates a media item's properties (immutable pattern).
   * Fetches the item, applies changes, and saves.
   */
  async update(id: number, data: {
    name?: string;
    description?: string;
    mediaTypeId?: number;
    fields?: Record<string, unknown>;
    file?: MediaFileInput;
    content?: string;
    syntaxType?: string;
  }, options?: LanguageOption): Promise<MediaItem> {
    const item = await this.get(id, options);
    if (data.name !== undefined) item.name = data.name;
    if (data.description !== undefined) item.description = data.description;
    if (data.mediaTypeId !== undefined) item.mediaTypeId = data.mediaTypeId;
    if (data.fields !== undefined) Object.assign(item.fields, data.fields);
    if (data.file !== undefined) item.file = data.file;
    if (data.content !== undefined) item.content = data.content;
    if (data.syntaxType !== undefined) item.syntaxType = data.syntaxType;
    await item.save();
    return item;
  }

  /**
   * Deletes a media item.
   *
   * If the media item belongs to a single category, the category is auto-selected.
   * If it belongs to multiple categories, pass `categoryId` to specify which one,
   * or the SDK throws with the valid options.
   */
  async delete(id: number, options?: { categoryId?: number } & LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, 'smxx');

    let categoryId = options?.categoryId;

    if (categoryId === undefined) {
      const item = await this.get(id);
      const categories = item.categories;

      if (categories.length === 0) {
        throw new Error(`Cannot delete media ${id} — it has no category assigned.`);
      } else if (categories.length === 1) {
        categoryId = categories[0];
      } else {
        const catList = categories.join(', ');
        throw new Error(
          `Media ${id} belongs to multiple categories (${catList}). ` +
          `Pass a categoryId to specify which category to delete from.`,
        );
      }
    }

    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/media/category/${categoryId}/id/${id}/${language}`,
    });
  }

  /**
   * Permanently removes a media item. The item must be deleted (inactive) first.
   */
  async purge(id: number, options?: LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, 'en');
    await this.httpClient.request<void>({
      method: 'POST',
      path: '/content/purge',
      body: {
        languageCode: language,
        contentIds: [String(id)],
      },
    });
  }

  /**
   * Fetches and caches the media types.
   */
  private getMediaTypes(): Promise<RawMediaType[]> {
    if (!this.mediaTypesPromise || Date.now() > this.mediaTypesExpiresAt || this.mediaTypesEpoch < getCacheEpoch()) {
      this.mediaTypesExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.mediaTypesEpoch = getCacheEpoch();
      this.mediaTypesPromise = this.httpClient.request<RawMediaType[]>({
        method: 'GET',
        path: '/mediaType',
      });
    }
    return this.mediaTypesPromise;
  }

  /** Extracts the media type ID from the raw elements */
  private extractMediaTypeId(raw: RawMediaDTO): number {
    for (const [key, value] of Object.entries(raw.elements ?? {})) {
      if (key.toLowerCase().startsWith('mediatype#')) {
        return typeof value === 'number' ? value : Number(value) || 0;
      }
    }
    return 0;
  }
}
