import { HttpClient } from '../http-client.js';
import { decodeHtmlEntities, DEFAULT_CACHE_TTL, getCacheEpoch } from '../utils.js';

/** Friendly processor keys mapped to API names for page layouts */
const PAGE_PROCESSOR_MAP: Record<string, string> = {
  't4-tags': 'T4 Tag Page',
  'handlebars': 'Handlebars Page',
  'programmable-layouts': 'Programmable Layout Page',
};

/** Raw page layout from the API */
interface RawPageLayout {
  id: number;
  name: string;
  description?: string;
  primaryGroup?: { id: number | null; group?: { id: number } };
  sharedGroups?: Array<{ id: number }>;
  [key: string]: unknown;
}

/** Raw page layout detail from GET /pageLayout/{id} */
interface RawPageLayoutDetail {
  id: number;
  name: string;
  description?: string;
  headerCode?: string;
  footerCode?: string;
  stylesheetCode?: string;
  fileExtension?: string;
  syntaxType?: number;
  layoutProcessor?: number;
  [key: string]: unknown;
}

/** A page layout summary returned from list() */
export interface PageLayoutSummary {
  id: number;
  name: string;
  description: string;
}

/** A mutable page layout object. */
export class PageLayout {
  readonly id: number;
  name: string;
  description: string;
  headerCode: string;
  footerCode: string;
  fileExtension: string;
  syntax: string;
  processor: string;

  private readonly _httpClient!: HttpClient;
  private _rawData!: RawPageLayoutDetail;
  private _syntaxMap!: Map<number, string> | null;
  private _processorMap!: Map<number, string> | null;

  constructor(
    raw: RawPageLayoutDetail,
    httpClient: HttpClient,
    syntaxMap: Map<number, string>,
    processorMap: Map<number, string>,
  ) {
    this.id = raw.id;
    this.name = decodeHtmlEntities(raw.name);
    this.description = decodeHtmlEntities(raw.description ?? '');
    this.headerCode = raw.headerCode ?? '';
    this.footerCode = raw.footerCode ?? '';
    this.fileExtension = raw.fileExtension ?? '';
    this.syntax = syntaxMap.get(raw.syntaxType ?? 0) ?? `unknown (${raw.syntaxType})`;

    // Reverse-map processor ID to friendly key
    const procName = processorMap.get(raw.layoutProcessor ?? 0) ?? '';
    const procEntry = Object.entries(PAGE_PROCESSOR_MAP).find(([, apiName]) => apiName === procName);
    this.processor = procEntry ? procEntry[0] : procName || `unknown (${raw.layoutProcessor})`;
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw as RawPageLayoutDetail, enumerable: false, writable: true });
    Object.defineProperty(this, '_syntaxMap', { value: syntaxMap, enumerable: false });
    Object.defineProperty(this, '_processorMap', { value: processorMap, enumerable: false });
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    // Resolve syntax name to ID
    let syntaxId = this._rawData.syntaxType as number;
    if (this._syntaxMap) {
      const match = Array.from(this._syntaxMap.entries()).find(([, name]) => name.toLowerCase() === this.syntax.toLowerCase());
      if (match) syntaxId = match[0];
    }

    // Resolve processor friendly key to ID
    let processorId = this._rawData.layoutProcessor as number;
    if (this._processorMap) {
      const apiName = PAGE_PROCESSOR_MAP[this.processor] ?? this.processor;
      const match = Array.from(this._processorMap.entries()).find(([, name]) => name === apiName);
      if (match) processorId = match[0];
    }

    const updated = {
      ...this._rawData,
      name: this.name,
      description: this.description,
      headerCode: this.headerCode,
      footerCode: this.footerCode,
      fileExtension: this.fileExtension,
      syntaxType: String(syntaxId),
      layoutProcessor: String(processorId),
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/pageLayout/${this.id}`,
      body: updated,
    });

    this._rawData = updated as unknown as RawPageLayoutDetail;
  }
}

/**
 * Resource for page layout operations.
 */
export class PageLayoutResource {
  private readonly httpClient: HttpClient;
  private syntaxMapPromise: Promise<Map<number, string>> | null = null;
  private syntaxMapExpiresAt = 0;
  private syntaxMapEpoch = -1;
  private processorMapPromise: Promise<Map<number, string>> | null = null;
  private processorMapExpiresAt = 0;
  private processorMapEpoch = -1;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  private getSyntaxMap(): Promise<Map<number, string>> {
    if (!this.syntaxMapPromise || Date.now() > this.syntaxMapExpiresAt || this.syntaxMapEpoch < getCacheEpoch()) {
      this.syntaxMapExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.syntaxMapEpoch = getCacheEpoch();
      this.syntaxMapPromise = this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/syntaxType',
      }).then((types) => new Map(types.map((t) => [t.id, t.name])));
    }
    return this.syntaxMapPromise;
  }

  private getProcessorMap(): Promise<Map<number, string>> {
    if (!this.processorMapPromise || Date.now() > this.processorMapExpiresAt || this.processorMapEpoch < getCacheEpoch()) {
      this.processorMapExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.processorMapEpoch = getCacheEpoch();
      this.processorMapPromise = this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/publishProcessor/10',
      }).then((procs) => new Map(procs.map((p) => [p.id, p.name])));
    }
    return this.processorMapPromise;
  }

  /** Lists all page layouts. */
  async list(): Promise<PageLayoutSummary[]> {
    const raw = await this.httpClient.request<RawPageLayout[]>({
      method: 'GET',
      path: '/pageLayout',
    });
    return raw.map((l) => ({
      id: l.id,
      name: decodeHtmlEntities(l.name),
      description: decodeHtmlEntities(l.description ?? ''),
    }));
  }

  /** Gets a single page layout by ID. Returns a mutable PageLayout object. */
  async get(id: number): Promise<PageLayout> {
    const [raw, syntaxMap, processorMap] = await Promise.all([
      this.httpClient.request<RawPageLayoutDetail>({ method: 'GET', path: `/pageLayout/${id}` }),
      this.getSyntaxMap(),
      this.getProcessorMap(),
    ]);
    return new PageLayout(raw, this.httpClient, syntaxMap, processorMap);
  }

  /** Updates a page layout's properties (immutable pattern). */
  async update(id: number, data: {
    name?: string;
    description?: string;
    headerCode?: string;
    footerCode?: string;
    fileExtension?: string;
    syntax?: string;
    processor?: string;
  }): Promise<PageLayout> {
    const layout = await this.get(id);
    if (data.name !== undefined) layout.name = data.name;
    if (data.description !== undefined) layout.description = data.description;
    if (data.headerCode !== undefined) layout.headerCode = data.headerCode;
    if (data.footerCode !== undefined) layout.footerCode = data.footerCode;
    if (data.fileExtension !== undefined) layout.fileExtension = data.fileExtension;
    if (data.syntax !== undefined) layout.syntax = data.syntax;
    if (data.processor !== undefined) layout.processor = data.processor;
    await layout.save();
    return layout;
  }

  /** Creates a new page layout. */
  async create(data: {
    name: string;
    description?: string;
    headerCode?: string;
    footerCode?: string;
    syntax?: string;
    processor?: 't4-tags' | 'handlebars' | 'programmable-layouts';
    fileExtension?: string;
    primaryGroup?: number;
    sharedGroups?: number[];
  }): Promise<PageLayout> {
    if (!data.name?.trim()) throw new Error('Page layout name is required');

    const [syntaxMap, processorMap] = await Promise.all([
      this.getSyntaxMap(),
      this.getProcessorMap(),
    ]);

    // Resolve syntax name to ID
    let syntaxId = '3'; // default HTML/XML
    if (data.syntax) {
      const match = Array.from(syntaxMap.entries()).find(([, name]) => name.toLowerCase() === data.syntax!.toLowerCase());
      if (!match) {
        const valid = Array.from(syntaxMap.values()).join(', ');
        throw new Error(`Unknown syntax "${data.syntax}". Valid options: ${valid}`);
      }
      syntaxId = String(match[0]);
    }

    // Resolve processor friendly key to ID
    const procKey = data.processor ?? 'handlebars';
    const procApiName = PAGE_PROCESSOR_MAP[procKey];
    if (!procApiName) {
      throw new Error(`Unknown processor "${procKey}". Valid options: t4-tags, handlebars, programmable-layouts`);
    }
    const procMatch = Array.from(processorMap.entries()).find(([, name]) => name === procApiName);
    const processorId = procMatch ? String(procMatch[0]) : '15';

    // Resolve file extension
    let extensionValue = '';
    if (data.fileExtension) {
      try {
        const extensions = await this.httpClient.request<Array<{ extension: string }>>({
          method: 'GET',
          path: '/fileExtension',
        });
        const match = extensions.find((e) => e.extension.toLowerCase() === data.fileExtension!.toLowerCase());
        if (!match) {
          const valid = extensions.map((e) => e.extension).join(', ');
          throw new Error(`Unknown extension "${data.fileExtension}". Valid options: ${valid}`);
        }
        extensionValue = match.extension;
      } catch (e) {
        if (e instanceof Error && e.message.startsWith('Unknown extension')) throw e;
      }
    }

    const raw = await this.httpClient.request<RawPageLayoutDetail>({
      method: 'POST',
      path: '/pageLayout',
      body: {
        name: data.name,
        description: data.description ?? '',
        headerCode: data.headerCode ?? '',
        footerCode: data.footerCode ?? '',
        fileExtension: extensionValue,
        syntaxType: syntaxId,
        layoutProcessor: processorId,
        sharedGroups: (data.sharedGroups ?? []).map((id) => ({ id })),
        primaryGroup: { id: data.primaryGroup ?? null },
      },
    });

    return new PageLayout(raw, this.httpClient, syntaxMap, processorMap);
  }

  /** Deletes a page layout by ID. */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/pageLayout/${id}`,
    });
  }
}
