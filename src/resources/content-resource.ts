import { HttpClient } from '../http-client.js';
import {
  LanguageOption,
  CreateContentData,
  UpdateContentData,
  ContentDTO,
} from '../types.js';
import { resolveLanguage, toTimestamp, STATUS_CODES, TtlMap } from '../utils.js';
import { ContentItem, createContentItem } from '../models/content-item.js';
import { ElementResolver, TemplateElement, RepeaterInput, ResolveContext, MediaCreateFn } from '../element-resolver.js';
import { TypeRegistry } from '../type-registry.js';

/** Raw content type response from GET /contenttype/{id} */
interface RawContentType {
  id: number;
  contentTypeElements: Array<TemplateElement & {
    contentTypeElementConfiguration?: {
      contentTypeId: number;
      contentTypeDTO?: {
        id: number;
        contentTypeElements: TemplateElement[];
      };
      minRepeats: number;
      maxRepeats: number;
    };
  }>;
}

/** Shape returned by GET /content/type/{contentTypeId}/{sectionId} */
interface NewContentTemplate {
  contentType: {
    id: number;
    contentTypeElements: TemplateElement[];
  };
  channels: number[];
  canPublishNow: boolean;
  canSaveAndApprove: boolean;
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

/**
 * Section-scoped resource for content CRUD operations.
 * All requests are scoped to the section ID provided at construction time.
 */
export class ContentResource {
  private readonly httpClient: HttpClient;
  private readonly sectionId: number;
  private readonly defaultLanguage: string;
  private readonly resolver: ElementResolver;
  private readonly typeRegistry: TypeRegistry;

  /** Cache of content type templates keyed by content type ID */
  private templateCache: TtlMap<number, NewContentTemplate> = new TtlMap();

  constructor(httpClient: HttpClient, sectionId: number, defaultLanguage: string, mediaCreateFn?: MediaCreateFn | null) {
    this.httpClient = httpClient;
    this.sectionId = sectionId;
    this.defaultLanguage = defaultLanguage;
    this.typeRegistry = new TypeRegistry(httpClient);
    this.resolver = new ElementResolver(httpClient, defaultLanguage, this.typeRegistry, mediaCreateFn);
  }

  private async getTemplate(contentTypeId: number): Promise<NewContentTemplate> {
    const cached = this.templateCache.get(contentTypeId);
    if (cached) return cached;

    // Fetch both the new content template and the full content type definition
    const [template, rawContentType] = await Promise.all([
      this.httpClient.request<NewContentTemplate>({
        method: 'GET',
        path: `/content/type/${contentTypeId}/${this.sectionId}`,
      }),
      this.httpClient.request<RawContentType>({
        method: 'GET',
        path: `/contenttype/${contentTypeId}`,
      }),
    ]);

    // Merge alias and contentTypeElementConfiguration from the full content type
    for (const templateEl of template.contentType.contentTypeElements) {
      const rawEl = rawContentType.contentTypeElements.find(
        (e) => e.name === templateEl.name,
      );
      if (rawEl) {
        if (rawEl.alias) templateEl.alias = rawEl.alias;
        if (rawEl.listId) templateEl.listId = rawEl.listId;
        if (rawEl.contentTypeElementConfiguration) {
          templateEl.contentTypeElementConfiguration = rawEl.contentTypeElementConfiguration;
        }
      }
    }

    this.templateCache.set(contentTypeId, template);
    return template;
  }

  /**
   * Builds the T4 elements map from developer-friendly field names and values.
   * Resolves list values, dates, repeaters, etc. automatically.
   */
  private async buildElements(
    fields: Record<string, unknown>,
    elements: TemplateElement[],
    name: string,
    language: string,
    context?: ResolveContext,
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    // Name element
    const nameEl = elements.find((el) => el.name.toLowerCase() === 'name');
    if (nameEl) {
      result[`${nameEl.name}#${nameEl.id}:${nameEl.type}`] = name;
    }

    for (const [fieldName, value] of Object.entries(fields)) {
      const fieldLower = fieldName.toLowerCase();
      const element = elements.find(
        (el) => el.name.toLowerCase() === fieldLower
          || (el.alias && el.alias.toLowerCase() === fieldLower),
      );
      if (!element) {
        const validNames = elements
          .filter((el) => el.name.toLowerCase() !== 'name')
          .map((el) => `"${el.alias || el.name}"`)
          .join(', ');
        throw new Error(
          `Unknown field "${fieldName}" on this content type. Valid fields are: ${validNames}`,
        );
      }

      const key = `${element.name}#${element.id}:${element.type}`;

      // Repeater — special handling (no maxSize validation)
      const typeName = await this.typeRegistry.getNameById(element.type);
      if (typeName === 'Repeater' && Array.isArray(value)) {
        result[key] = await this.buildRepeaterValue(
          value as RepeaterInput[],
          element,
          language,
        );
        continue;
      }

      const resolved = await this.resolver.resolveValue(value, element, language, elements, context);

      // Validate maxSize on the resolved value (what actually gets sent to the API)
      if (element.maxSize) {
        const resolvedStr = String(resolved ?? '');
        if (resolvedStr.length > element.maxSize) {
          const friendlyName = element.alias || element.name;
          throw new Error(
            `Field "${friendlyName}" exceeds max size: ${resolvedStr.length} characters (max ${element.maxSize})`,
          );
        }
      }

      result[key] = resolved;
    }

    return result;
  }

  /**
   * Builds repeater value array from developer-friendly input.
   * Each repeater item gets its own element key resolution using the
   * repeater's sub-content-type elements from contentTypeElementConfiguration.
   */
  private async buildRepeaterValue(
    items: RepeaterInput[],
    element: TemplateElement,
    language: string,
  ): Promise<unknown[]> {
    const config = element.contentTypeElementConfiguration;
    const repeaterElements = config?.contentTypeDTO?.contentTypeElements;
    if (!repeaterElements || repeaterElements.length === 0) return items;

    const result: unknown[] = [];
    for (const item of items) {
      const repeaterId = -Math.floor(Math.random() * 100000);

      // Repeater items use their own repeaterId as fromContentId for SS links
      const repeaterContext: ResolveContext = {
        fromSectionId: this.sectionId,
        fromContentId: repeaterId,
      };

      const elements = await this.buildElements(
        item.fields,
        repeaterElements,
        item.name,
        language,
        repeaterContext,
      );

      result.push({
        repeaterId,
        repeaterContent: {
          name: item.name,
          elements,
        },
      });
    }

    return result;
  }

  /** Lists all content items in this section. */
  async list(options?: LanguageOption): Promise<ContentItem[]> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const response = await this.httpClient.request<ContentsResponse>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}/contents?showAll=false&removeNonTranslated=false`,
    });
    return Promise.all(
      (response.children ?? []).map((child) =>
        createContentItem(child.content, this.httpClient, this.sectionId),
      ),
    );
  }

  /** Retrieves a single content item by ID. */
  async get(id: number, options?: LanguageOption): Promise<ContentItem> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const dto = await this.httpClient.request<ContentDTO>({
      method: 'GET',
      path: `/content/${this.sectionId}/${id}/${language}`,
    });
    // Fetch template to get alias and list info for friendly field resolution
    const template = await this.getTemplate(dto.contentTypeID);
    return createContentItem(
      dto, this.httpClient, this.sectionId, this.resolver, template.contentType.contentTypeElements, this.typeRegistry,
    );
  }

  /** Creates a new content item in this section. */
  async create(data: CreateContentData, options?: LanguageOption): Promise<ContentItem> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const template = await this.getTemplate(data.type);
    const contentId = -Math.floor(Math.random() * 1000000);

    const context: ResolveContext = {
      fromSectionId: this.sectionId,
      fromContentId: contentId,
    };

    const elements = await this.buildElements(
      data.fields,
      template.contentType.contentTypeElements,
      data.name,
      language,
      context,
    );

    const statusName = data.status ?? 'pending';
    const statusCode = STATUS_CODES[statusName] ?? 1;

    const dto = await this.httpClient.request<ContentDTO>({
      method: 'POST',
      path: `/content/${this.sectionId}/${language}`,
      body: {
        id: contentId,
        contentTypeID: data.type,
        name: data.name,
        language,
        status: statusCode,
        elements,
        channels: template.channels,
        canPublishNow: true,
        canSaveAndApprove: true,
        publishDate: toTimestamp(data.publishDate),
        expiryDate: toTimestamp(data.expiryDate),
        reviewDate: toTimestamp(data.reviewDate),
        archiveSection: data.archiveSection ?? null,
        owner: { id: data.owner ?? 0, type: 'USER' },
        excludedMirrorSectionIds: [],
      },
    });
    return createContentItem(
      dto, this.httpClient, this.sectionId, this.resolver, template.contentType.contentTypeElements, this.typeRegistry,
    );
  }

  /** Updates an existing content item's fields. */
  async update(id: number, data: UpdateContentData, options?: LanguageOption): Promise<ContentItem> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    // 1. Fetch the existing content (full body needed for the POST)
    const existing = await this.httpClient.request<ContentDTO>({
      method: 'GET',
      path: `/content/${this.sectionId}/${id}/${language}`,
    });

    // 2. Get the template for element resolution
    const template = await this.getTemplate(existing.contentTypeID);

    // 3. Resolve changed fields from friendly names → raw element keys
    const mergedElements = { ...existing.elements };
    if (data.fields && Object.keys(data.fields).length > 0) {
      const context: ResolveContext = {
        fromSectionId: this.sectionId,
        fromContentId: id,
      };
      const resolved = await this.buildElements(
        data.fields,
        template.contentType.contentTypeElements,
        data.name ?? existing.name,
        language,
        context,
      );
      // Merge resolved fields into existing elements (overwrite only changed keys)
      Object.assign(mergedElements, resolved);
    }

    // 4. If name changed, update the Name element in mergedElements too
    const name = data.name ?? existing.name;
    if (data.name) {
      const nameEl = template.contentType.contentTypeElements.find(
        (el) => el.name.toLowerCase() === 'name',
      );
      if (nameEl) {
        mergedElements[`${nameEl.name}#${nameEl.id}:${nameEl.type}`] = data.name;
      }
    }

    // 5. Resolve status
    const statusCode = data.status ? (STATUS_CODES[data.status] ?? 1) : 1;

    // 6. POST the full body back
    const dto = await this.httpClient.request<ContentDTO>({
      method: 'POST',
      path: `/content/${this.sectionId}/${id}/${language}`,
      body: {
        id: existing.id,
        contentTypeID: existing.contentTypeID,
        name,
        language,
        status: statusCode,
        elements: mergedElements,
        channels: existing.channels,
        canPublishNow: true,
        canSaveAndApprove: true,
        publishDate: data.publishDate !== undefined ? toTimestamp(data.publishDate) : (existing.publishDate ?? null),
        expiryDate: data.expiryDate !== undefined ? toTimestamp(data.expiryDate) : (existing.expiryDate ?? null),
        reviewDate: data.reviewDate !== undefined ? toTimestamp(data.reviewDate) : (existing.reviewDate ?? null),
        archiveSection: data.archiveSection !== undefined ? (data.archiveSection ?? null) : (existing.archiveSection ?? null),
        owner: { id: data.owner ?? existing.owner?.id ?? 0, type: 'USER' },
        excludedMirrorSectionIds: [],
        sectionIDs: [this.sectionId],
        version: existing.version,
        lastModified: existing.lastModified,
      },
    });
    return createContentItem(
      dto, this.httpClient, this.sectionId, this.resolver, template.contentType.contentTypeElements, this.typeRegistry,
    );
  }

  /** Deletes a content item by ID. */
  async delete(id: number, options?: LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/content/${this.sectionId}/${id}/${language}`,
    });
  }

  /** Permanently removes a content item. */
  async purge(id: number, options?: LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
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
   * Approves all pending content in this section.
   * Fetches the content list, filters to pending items (status 1),
   * and sends a single APPROVE request with all their IDs.
   * Returns the number of items approved.
   */
  async approveAll(options?: LanguageOption): Promise<number> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const response = await this.httpClient.request<ContentsResponse>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}/contents?showAll=false&removeNonTranslated=false`,
    });

    const pendingIds = (response.children ?? [])
      .filter((child) => child.content.status === 1)
      .map((child) => child.content.id);

    if (pendingIds.length === 0) return 0;

    await this.httpClient.request<void>({
      method: 'APPROVE',
      path: `/content/${language}`,
      body: {
        ids: pendingIds,
        fastTrack: 'workflow',
      },
    });

    return pendingIds.length;
  }
}
