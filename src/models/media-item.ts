import { HttpClient } from '../http-client.js';
import { formatFileSize, parseElementKey, STATUS_MAP, resolveFileToBlob, deriveFilename, FileInput } from '../utils.js';

/** Extension → syntax type mapping for non-binary media */
const EXTENSION_SYNTAX_MAP: Record<string, number> = {
  js: 1,
  css: 2,
  html: 3,
  htm: 3,
  php: 4,
  java: 5,
};

/** Raw media response from GET /media/{id}/{language} */
export interface RawMediaDTO {
  id: number;
  name: string;
  description: string;
  language: string;
  status: number;
  version: string;
  fileName: string;
  mediaSize: number;
  typeName: string;
  mediaURL: string;
  thumbnailURL: string;
  mediaPath: string;
  binaryLanguage: string;
  categories: number[];
  lastModifiedBy: number;
  elements: Record<string, unknown>;
  contentType?: {
    contentTypeElements: Array<{
      id: number;
      name: string;
      alias?: string;
      type: number;
      sequence: number;
    }>;
  };
  [key: string]: unknown;
}

/** Accepted file input for replacing a media file */
export type MediaFileInput = FileInput;

/** Maps syntax type IDs to friendly names */
const SYNTAX_TYPE_MAP: Record<number, string> = {
  0: 'none',
  1: 'javascript',
  2: 'css',
  3: 'html',
  4: 'php',
  5: 'java',
};

const SYNTAX_TYPE_REVERSE: Record<string, number> = {
  'none': 0,
  'javascript': 1,
  'css': 2,
  'html': 3,
  'php': 4,
  'java': 5,
};

/** Element names that are internal / not user-editable metadata */
const INTERNAL_ELEMENTS = new Set([
  'name', 'description', 'media', 'thumbnail', 'mediatype', 'variant',
  'variantname', 'variantdimensions', 'syntax', 'binarylanguage',
]);

/** Bumps a version string: "1.0" → "2.0", "3.0" → "4.0" */
function bumpVersion(version: string): string {
  const major = parseInt(version.split('.')[0], 10);
  return isNaN(major) ? '2.0' : `${major + 1}.0`;
}

/**
 * A mutable media item. Modify properties and call save() to persist.
 */
export class MediaItem {
  readonly id: number;
  name: string;
  description: string;
  readonly fileName: string;
  readonly fileSize: string;
  readonly mediaType: string;
  mediaTypeId: number;
  readonly language: string;
  readonly version: string;
  readonly status: string;
  readonly downloadUrl: string;
  readonly thumbnailUrl: string;
  readonly path: string | null;
  readonly categories: number[];
  /** User-editable metadata fields (e.g. Photo Credit, keywords). */
  fields: Record<string, unknown>;
  /** Set to replace the media file. Accepts a file path, URL, Blob, or { file, filename }. For binary media only. */
  file: MediaFileInput | null;
  /** Text content of non-binary media (CSS, JS, etc.). Null for binary media (images, documents). */
  content: string | null;
  /** Syntax type for non-binary media: 'none', 'javascript', 'css', 'html', 'php', 'java'. Null for binary media. */
  syntaxType: string | null;

  private readonly _httpClient!: HttpClient;
  private _rawData!: RawMediaDTO;
  private _fieldKeyMap: Map<string, string>;

  constructor(raw: RawMediaDTO, mediaTypeName: string, httpClient: HttpClient) {
    this.id = raw.id;
    this.name = raw.name ?? '';
    this.description = raw.description ?? '';
    this.fileName = raw.fileName ?? '';
    this.fileSize = formatFileSize(raw.mediaSize ?? 0);
    this.mediaType = mediaTypeName;
    this.mediaTypeId = this.extractMediaTypeId(raw);
    this.language = raw.binaryLanguage ?? raw.language ?? 'smxx';
    this.version = raw.version ?? '';
    this.status = STATUS_MAP[raw.status] ?? `unknown (${raw.status})`;
    this.downloadUrl = raw.mediaURL ?? '';
    this.thumbnailUrl = raw.thumbnailURL ?? '';
    this.path = raw.mediaPath
      ? raw.mediaPath.replace(/&raquo;/g, '»').replace(/\n/g, '').trim()
      : null;
    this.categories = raw.categories ?? [];
    this.file = null;

    // Non-binary media (CSS, JS, etc.) has text content inline
    const syntaxId = Number(raw.syntax) || 0;
    const isBinary = syntaxId === 0;
    this.content = !isBinary && typeof raw.text === 'string' ? raw.text : null;
    this.syntaxType = !isBinary ? (SYNTAX_TYPE_MAP[syntaxId] ?? 'none') : null;

    // Build user-editable fields from elements, excluding internal ones
    this.fields = {};
    this._fieldKeyMap = new Map();
    this.buildFields(raw);

    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw, enumerable: false, writable: true });
    Object.defineProperty(this, '_fieldKeyMap', { value: this._fieldKeyMap, enumerable: false });
  }

  /**
   * Persists current property values to the server.
   * Uses multipart POST to /media/category/{categoryId}/{language}/{mediaId}.
   * If `file` is set, the media file is replaced and the version is bumped.
   * If `content` has changed on non-binary media, the version is bumped.
   */
  async save(): Promise<void> {
    const categoryId = this.categories[0];
    if (!categoryId) {
      throw new Error('Cannot save media item — no category assigned.');
    }

    // Build the elements JSON with only user-editable fields
    const elementsObj: Record<string, unknown> = {};
    for (const [friendlyName, value] of Object.entries(this.fields)) {
      const rawKey = this._fieldKeyMap.get(friendlyName.toLowerCase());
      if (rawKey) elementsObj[rawKey] = value;
    }

    const hasFileReplacement = this.file !== null;
    let resolvedBlob: Blob | null = null;
    let resolvedFilename = '';
    let newMediaTypeId = this.mediaTypeId;
    let newSyntaxType = this.syntaxType ? (SYNTAX_TYPE_REVERSE[this.syntaxType] ?? 0) : 0;

    // If replacing the file, resolve it and recalculate media type + syntax
    if (hasFileReplacement) {
      const fileInput = this.file!;
      const rawFile = typeof fileInput === 'object' && !(fileInput instanceof Blob) && 'file' in fileInput
        ? (fileInput as { file: string | Blob }).file
        : fileInput as string | Blob;
      resolvedBlob = await resolveFileToBlob(rawFile);
      resolvedFilename = deriveFilename(fileInput);

      // Recalculate media type from the new file's extension
      const ext = resolvedFilename.lastIndexOf('.') >= 0
        ? resolvedFilename.slice(resolvedFilename.lastIndexOf('.') + 1).toLowerCase()
        : '';
      if (ext) {
        try {
          const mediaTypes = await this._httpClient.request<Array<{
            id: number; name: string; permittedExtensionsFormatted: string[]; binary: boolean;
          }>>({ method: 'GET', path: '/mediaType' });
          const matched = mediaTypes.find((t) =>
            t.permittedExtensionsFormatted.some((e) => e.toLowerCase() === ext),
          );
          if (matched) {
            newMediaTypeId = matched.id;
            newSyntaxType = matched.binary ? 0 : (EXTENSION_SYNTAX_MAP[ext] ?? 0);
          }
        } catch {
          // Keep existing media type if lookup fails
        }
      }
    }

    const formData = new FormData();
    formData.append('name', this.name);
    formData.append('description', this.description);
    formData.append('type', String(newMediaTypeId));
    formData.append('syntaxType', String(newSyntaxType));
    formData.append('myMedia', '0');
    formData.append('elements', JSON.stringify(elementsObj));
    formData.append('mediaID', String(this.id));
    formData.append('binaryLanguage', this.language);
    formData.append('language', this.language);

    // Categories
    for (const catId of this.categories) {
      formData.append('categories', String(catId));
    }

    // File replacement: always send file + fileName + bumped version (binary or non-binary)
    if (hasFileReplacement && resolvedBlob) {
      formData.append('file', resolvedBlob, resolvedFilename);
      formData.append('fileName', resolvedFilename);
      formData.append('version', bumpVersion(this.version));
    } else {
      formData.append('version', this.version);
    }

    // Non-binary media: always send text content (even alongside file replacement)
    if (this.content !== null) {
      formData.append('text', this.content);
    }

    await this._httpClient.request<void>({
      method: 'POST',
      path: `/media/category/${categoryId}/${this.language}/${this.id}`,
      multipart: true,
      formData,
    });

    // Reset file after save
    this.file = null;
  }

  private extractMediaTypeId(raw: RawMediaDTO): number {
    for (const [key, value] of Object.entries(raw.elements ?? {})) {
      const parsed = parseElementKey(key);
      if (parsed && parsed.name.toLowerCase() === 'mediatype') {
        return typeof value === 'number' ? value : Number(value) || 0;
      }
    }
    return 0;
  }

  private buildFields(raw: RawMediaDTO): void {
    const templateElements = raw.contentType?.contentTypeElements ?? [];

    for (const [rawKey, value] of Object.entries(raw.elements ?? {})) {
      const parsed = parseElementKey(rawKey);
      if (!parsed) continue;

      // Skip internal elements
      if (INTERNAL_ELEMENTS.has(parsed.name.toLowerCase())) continue;

      // Find the template element to get the alias
      const templateEl = templateElements.find(
        (el) => el.name.toLowerCase() === parsed.name.toLowerCase(),
      );
      const friendlyName = templateEl?.alias || parsed.name;

      this.fields[friendlyName] = value;
      this._fieldKeyMap.set(friendlyName.toLowerCase(), rawKey);
    }
  }
}
