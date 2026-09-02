import { HttpClient } from './http-client.js';
import { TypeRegistry } from './type-registry.js';
import { FileInput, resolveFileToBlob, deriveFilename, TtlMap } from './utils.js';

/** A content type element from the template */
export interface TemplateElement {
  id: number;
  name: string;
  alias: string;
  type: number;
  sequence: number;
  listId: number;
  maxSize?: number;
  contentTypeElementConfiguration?: {
    contentTypeId: number;
    contentTypeDTO?: {
      id: number;
      contentTypeElements: TemplateElement[];
    };
    minRepeats: number;
    maxRepeats: number;
  };
}

/** List item from GET /list/{id}/{language} */
interface ListItem {
  id: number;
  name: string;
  value: string;
  listId: number;
  sublist: number;
}

/** List response from GET /list/{id}/{language} */
interface ListResponse {
  id: number;
  items: ListItem[];
}

/** Keyword selector AND group */
interface KeywordAndGroup {
  and: Array<string>;
}

/** Keyword selector input: array of OR items, where each item is a string or AND group */
export type KeywordSelectorInput = {
  or: Array<string | KeywordAndGroup>;
};

/** Repeater item input from the developer */
export interface RepeaterInput {
  name: string;
  fields: Record<string, unknown>;
}

/** Section/Content Link input from the developer */
export interface SectionContentLinkInput {
  sectionId: number;
  contentId?: number;
  linkText?: string;
}

/** Context needed for resolving certain element types (e.g. SS links) */
export interface ResolveContext {
  fromSectionId: number;
  fromContentId: number;
}

/** SS response from PUT /ssl */
interface SslResponse {
  id: number;
  fromSection: number;
  toSection: number;
  fromContent: number;
  toContent: number;
  linkText: string;
  path: string;
}

/** Section DTO shape for path lookup */
interface SectionPathDTO {
  path: string;
  name: string;
}

/** Checks if a value is a SectionContentLinkInput */
function isSectionContentLinkInput(value: unknown): value is SectionContentLinkInput {
  return (
    value !== null &&
    typeof value === 'object' &&
    'sectionId' in value
  );
}

/** Checks if a value is a FileInput object (has a `file` property) */
function isFileInput(value: unknown): value is { file: string | Blob | NodeJS.ReadableStream; filename?: string } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'file' in value
  );
}

/** Response from POST /upload/ */
interface UploadResponse {
  code: string;
  name: string;
}

/** Input for inline media upload within a Media element */
export interface MediaElementUpload {
  file: string | Blob | { file: string | Blob; filename?: string };
  name: string;
  category: number;
  description?: string;
}

/** Function that creates a media item and returns its ID */
export type MediaCreateFn = (data: MediaElementUpload) => Promise<number>;

/** Checks if a value is a MediaElementUpload */
function isMediaElementUpload(value: unknown): value is MediaElementUpload {
  return (
    value !== null &&
    typeof value === 'object' &&
    'file' in value &&
    'name' in value &&
    'category' in value
  );
}

/**
 * Resolves developer-friendly field values to T4 API element format.
 * Handles list lookups, date conversion, repeater building, etc.
 */
export class ElementResolver {
  private readonly httpClient: HttpClient;
  private readonly typeRegistry: TypeRegistry;
  private readonly mediaCreateFn: MediaCreateFn | null;
  private listCache: TtlMap<number, ListResponse> = new TtlMap();

  constructor(httpClient: HttpClient, _defaultLanguage: string, typeRegistry: TypeRegistry, mediaCreateFn?: MediaCreateFn | null) {
    this.httpClient = httpClient;
    this.typeRegistry = typeRegistry;
    this.mediaCreateFn = mediaCreateFn ?? null;
  }

  /**
   * Resolves a single field value based on its element type.
   * Uses the TypeRegistry to look up type names instead of hardcoded IDs.
   */
  async resolveValue(
    value: unknown,
    element: TemplateElement,
    language: string,
    allElements?: TemplateElement[],
    context?: ResolveContext,
  ): Promise<unknown> {
    const typeName = await this.typeRegistry.getNameById(element.type);

    switch (typeName) {
      case 'Plain Text':
        return value;

      case 'HTML':
        return this.revertHtmlSsLinks(value, language, context);

      case 'Image':
      case 'File':
        return this.resolveFileUpload(value, element);

      case 'Date':
        return this.resolveDate(value);

      case 'Check Box':
      case 'Multiple Select':
        return this.resolveCheckbox(value, element.listId, language, element.alias || element.name);

      case 'Select Box':
        return this.resolveSingleList(value, element.listId, language, element.alias || element.name);

      case 'Radio Button':
        return this.resolveSingleList(value, element.listId, language, element.alias || element.name);

      case 'Cascading List':
        return this.resolveCascadingList(value, element.listId, language, element.alias || element.name);

      case 'Media':
        if (isMediaElementUpload(value)) {
          if (!this.mediaCreateFn) {
            throw new Error('Inline media upload is not available. Pass a media ID instead.');
          }
          const mediaId = await this.mediaCreateFn(value);
          return String(mediaId);
        }
        return String(value);

      case 'Decimal Number':
        return value;

      case 'Whole Number':
        return value;

      case 'Section/Content Link':
        return this.resolveSectionContentLink(value, language, context);

      case 'Multi-select List':
        return this.resolveMultiSelect(value, element.listId, language, element.alias || element.name);

      case 'Content Owner':
        return String(value);

      case 'Group Select':
        return this.resolveGroupSelect(value);

      case 'Keyword Selector':
        return this.resolveKeywordSelector(value, element.listId, language);

      case 'Repeater':
        return value; // handled separately in buildElements

      default:
        return value;
    }
  }

  // ── List fetching ──

  async getList(listId: number, language: string): Promise<ListResponse> {
    const cached = this.listCache.get(listId);
    if (cached) return cached;

    const list = await this.httpClient.request<ListResponse>({
      method: 'GET',
      path: `/list/${listId}/${language}?override=false`,
    });
    this.listCache.set(listId, list);
    return list;
  }

  private async resolveItemName(
    name: string,
    listId: number,
    language: string,
    elementName?: string,
    allowFreeText = false,
  ): Promise<string> {
    // Already in listId:itemId format
    if (/^\d+:\d+$/.test(name)) return name;

    const list = await this.getList(listId, language);
    const item = list.items.find(
      (i) => i.name.toLowerCase() === name.toLowerCase(),
    );

    if (!item) {
      // Keyword selectors allow free text values that aren't in the list
      if (allowFreeText) return name;

      const validNames = list.items.map((i) => `"${i.name}"`).join(', ');
      const fieldContext = elementName ? ` for field "${elementName}"` : '';
      throw new Error(
        `Invalid list value "${name}"${fieldContext}. Valid options are: ${validNames}`,
      );
    }

    return `${list.id}:${item.id}`;
  }

  // ── Type resolvers ──

  private resolveDate(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return new Date(value).getTime();
    return 0;
  }

  /** Select Box, Radio Button — single list value: "listId:itemId" */
  private async resolveSingleList(
    value: unknown,
    listId: number,
    language: string,
    elementName?: string,
  ): Promise<string> {
    return this.resolveItemName(String(value), listId, language, elementName);
  }

  /** Checkbox, Multiple Select — "listId:id1,id2" */
  private async resolveCheckbox(
    value: unknown,
    listId: number,
    language: string,
    elementName?: string,
  ): Promise<string> {
    const items = Array.isArray(value) ? value : [value];
    const list = await this.getList(listId, language);

    const ids: number[] = [];
    for (const item of items) {
      const str = String(item);
      const found = list.items.find(
        (i) => i.name.toLowerCase() === str.toLowerCase(),
      );
      if (!found) {
        const validNames = list.items.map((i) => `"${i.name}"`).join(', ');
        const fieldContext = elementName ? ` for field "${elementName}"` : '';
        throw new Error(
          `Invalid list value "${str}"${fieldContext}. Valid options are: ${validNames}`,
        );
      }
      ids.push(found.id);
    }

    return ids.length > 0 ? `${list.id}:${ids.join(',')}` : '';
  }

  /** Multi-Select — "listId:id1;listId:id2" */
  private async resolveMultiSelect(
    value: unknown,
    listId: number,
    language: string,
    elementName?: string,
  ): Promise<string> {
    const items = Array.isArray(value) ? value : [value];
    const list = await this.getList(listId, language);

    const parts: string[] = [];
    for (const item of items) {
      const str = String(item);
      const found = list.items.find(
        (i) => i.name.toLowerCase() === str.toLowerCase(),
      );
      if (!found) {
        const validNames = list.items.map((i) => `"${i.name}"`).join(', ');
        const fieldContext = elementName ? ` for field "${elementName}"` : '';
        throw new Error(
          `Invalid list value "${str}"${fieldContext}. Valid options are: ${validNames}`,
        );
      }
      parts.push(`${list.id}:${found.id}`);
    }

    return parts.join(';');
  }

  /** Cascading List — "listId1:itemId1, listId2:itemId2" */
  private async resolveCascadingList(
    value: unknown,
    listId: number,
    language: string,
    elementName?: string,
  ): Promise<string> {
    const items = Array.isArray(value) ? value : [value];
    const parts: string[] = [];

    let currentListId = listId;
    for (const item of items) {
      const str = String(item);

      if (/^\d+:\d+$/.test(str)) {
        parts.push(str);
        const list = await this.getList(currentListId, language);
        const matched = list.items.find((i) => `${list.id}:${i.id}` === str);
        if (matched && matched.sublist) currentListId = matched.sublist;
        continue;
      }

      const list = await this.getList(currentListId, language);
      const found = list.items.find(
        (i) => i.name.toLowerCase() === str.toLowerCase(),
      );
      if (!found) {
        const validNames = list.items.map((i) => `"${i.name}"`).join(', ');
        const fieldContext = elementName ? ` for field "${elementName}"` : '';
        throw new Error(
          `Invalid cascading list value "${str}"${fieldContext}. Valid options at this level are: ${validNames}`,
        );
      }
      parts.push(`${list.id}:${found.id}`);
      if (found.sublist) currentListId = found.sublist;
    }

    return parts.join(', ');
  }

  /** Group Select — comma-separated group IDs */
  private resolveGroupSelect(value: unknown): string {
    if (Array.isArray(value)) return value.join(',');
    return String(value);
  }

  /** Keyword Selector — OR items comma-separated, AND groups with && */
  private async resolveKeywordSelector(
    value: unknown,
    listId: number,
    language: string,
  ): Promise<string> {
    // If it's a plain string, pass through (already formatted or simple free text)
    if (typeof value === 'string') return value;

    const input = value as KeywordSelectorInput;
    if (!input?.or) return String(value);

    const parts: string[] = [];

    for (const item of input.or) {
      if (typeof item === 'string') {
        // Single OR item — resolve from list or pass as free text
        parts.push(await this.resolveItemName(item, listId, language, undefined, true));
      } else if (item && typeof item === 'object' && 'and' in item) {
        // AND group — resolve each item and join with &&
        const andParts: string[] = [];
        for (const andItem of item.and) {
          andParts.push(await this.resolveItemName(andItem, listId, language, undefined, true));
        }
        parts.push(andParts.join('&&'));
      }
    }

    return parts.join(',');
  }

  /** File/Image — upload file via POST /upload/ and return element value */
  private async resolveFileUpload(
    value: unknown,
    element: TemplateElement,
  ): Promise<unknown> {
    // If already in the API format (has code property), pass through
    if (value && typeof value === 'object' && 'code' in value) {
      return value;
    }

    // If it's just a file path string, wrap it as FileInput
    if (typeof value === 'string' && !value.startsWith('{')) {
      value = { file: value } as FileInput;
    }

    if (!isFileInput(value)) return value;

    const filename = deriveFilename(value);
    const blob = await resolveFileToBlob(value.file);

    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('filename', filename);
    formData.append('elementID', String(element.id));

    const response = await this.httpClient.request<UploadResponse>({
      method: 'POST',
      path: '/upload/',
      multipart: true,
      formData,
    });

    return {
      existingFile: false,
      code: response.code,
      preferredFilename: response.name,
    };
  }

  /** Section/Content Link — create SS record and return T4 tag */
  private async resolveSectionContentLink(
    value: unknown,
    language: string,
    context?: ResolveContext,
  ): Promise<string> {
    // Already a T4 tag string — pass through
    if (typeof value === 'string') return value;

    if (!isSectionContentLinkInput(value) || !context) return String(value ?? '');

    const toSectionId = value.sectionId;
    const toContentId = value.contentId ?? 0;

    // Get the target section's path and name
    const targetSection = await this.httpClient.request<SectionPathDTO>({
      method: 'GET',
      path: `/hierarchy/${toSectionId}/${language}`,
    });

    // Build link text: use provided, or content name, or section name
    let linkText = value.linkText;
    if (!linkText) {
      if (toContentId) {
        // Fetch content name
        const content = await this.httpClient.request<{ name: string }>({
          method: 'GET',
          path: `/content/${toSectionId}/${toContentId}/${language}`,
        });
        linkText = content.name;
      } else {
        linkText = targetSection.name;
      }
    }

    // Build path — append content name for content links
    let path = targetSection.path || targetSection.name;
    if (toContentId && linkText) {
      path = `${path} &raquo; ${linkText}`;
    }

    // Create the SS record
    const sslResponse = await this.httpClient.request<SslResponse>({
      method: 'PUT',
      path: '/ssl',
      body: {
        useDefaultLinkText: false,
        fromSection: context.fromSectionId,
        toSection: toSectionId,
        fromContent: context.fromContentId,
        toContent: toContentId,
        linkText,
        language,
        toLanguage: language,
        attributes: null,
        path,
        active: true,
      },
    });

    return `<t4 sslink_id="${sslResponse.id}" type="sslink" />`;
  }

  /** Regex to match anchor tags that are SS link markers (have data-section-id attribute) */
  private static readonly SSLINK_ANCHOR_REGEX = /<a\s+[^>]*data-section-id="(\d+)"[^>]*>([^<]*)<\/a>/gi;

  /**
   * Reverts friendly anchor elements in HTML back to T4 SS link tags.
   * - Existing links (data-t4-sslink="39") → `<t4 type="sslink" sslink_id="39"/>`
   * - New links (no data-t4-sslink or data-t4-sslink="new") → creates SS record via PUT /ssl, then inserts the tag
   */
  private async revertHtmlSsLinks(
    value: unknown,
    language: string,
    context?: ResolveContext,
  ): Promise<unknown> {
    if (typeof value !== 'string') return value;

    // Quick check — if no data-section-id attribute, pass through unchanged
    if (!value.includes('data-section-id')) return value;

    const regex = new RegExp(ElementResolver.SSLINK_ANCHOR_REGEX.source, ElementResolver.SSLINK_ANCHOR_REGEX.flags);
    const matches: Array<{ full: string; sslId: string; linkText: string; sectionId: number; contentId: number }> = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(value)) !== null) {
      const full = match[0];
      const innerText = match[2];
      const sectionId = parseInt(match[1], 10);

      // Extract data-t4-sslink, data-content-id, and data-linktext from the tag
      const sslIdMatch = full.match(/data-t4-sslink="([^"]*)"/);
      const contentMatch = full.match(/data-content-id="(\d+)"/);
      const linkTextMatch = full.match(/data-linktext="([^"]*)"/);

      // data-linktext takes priority (even if empty string) over inner text
      const linkText = linkTextMatch !== null ? linkTextMatch[1] : innerText;

      matches.push({
        full,
        sslId: sslIdMatch ? sslIdMatch[1] : '',
        linkText,
        sectionId,
        contentId: contentMatch ? parseInt(contentMatch[1], 10) : 0,
      });
    }

    if (matches.length === 0) return value;

    // Process each match
    let result = value;
    for (const { full, sslId, linkText, sectionId, contentId } of matches) {
      let t4Tag: string;

      if (sslId && sslId !== 'new' && /^\d+$/.test(sslId)) {
        // Existing SS link — just revert to T4 tag with the known ID
        t4Tag = `<t4 type="sslink" sslink_id="${sslId}"/>`;
      } else if (context && sectionId) {
        // New SS link — create the SS record
        const targetSection = await this.httpClient.request<{ path: string; name: string }>({
          method: 'GET',
          path: `/hierarchy/${sectionId}/${language}`,
        });

        const path = contentId && linkText
          ? `${targetSection.path || targetSection.name} &raquo; ${linkText}`
          : targetSection.path || targetSection.name;

        const sslResponse = await this.httpClient.request<{ id: number }>({
          method: 'PUT',
          path: '/ssl',
          body: {
            useDefaultLinkText: false,
            fromSection: context.fromSectionId,
            toSection: sectionId,
            fromContent: context.fromContentId,
            toContent: contentId,
            linkText,
            language,
            toLanguage: language,
            attributes: null,
            path,
            active: true,
          },
        });

        t4Tag = `<t4 type="sslink" sslink_id="${sslResponse.id}"/>`;
      } else {
        // No context to create — leave as-is (shouldn't happen in normal flow)
        continue;
      }

      result = result.replace(full, t4Tag);
    }

    return result;
  }
}
