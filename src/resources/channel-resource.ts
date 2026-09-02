import { HttpClient } from '../http-client.js';

/** Raw channel from the API */
interface ApiChannel {
  id: number;
  name: string;
  description: string;
  rootSectionID: number;
  pendingVersionOutputDir: string;
  hasPendingVersion: boolean;
  microSites: ApiChannel[];
  parentID?: number;
  [key: string]: unknown;
}

/** Raw channel detail from GET /channel/{id} */
interface ApiChannelDetail {
  id: number;
  name: string;
  description: string;
  type: string;
  defaultLanguage: string;
  rootSectionID: number;
  fileOutputPath: string;
  indexFileName: string;
  baseHref: string;
  siteRoot: string;
  channelPublishURL: string;
  fullTextType: string;
  fullTextExtension: string;
  languages: Array<{ code: string; name: string; charset: string }>;
  microSites: Array<{ id: number; name: string }>;
  permittedFileExtensions: Array<{ extension: string; priority: number }>;
  appliedPageLayout?: { channelID: number; sectionID: number; pageLayoutID: number; inheritablePageLayoutID: number };
  [key: string]: unknown;
}

/** A language configured on a channel */
export interface ChannelLanguage {
  code: string;
  name: string;
  charset: string;
}

/** A microsite nested under a channel */
export interface Microsite {
  id: number;
  name: string;
  description: string;
  rootSectionId: number;
  parentId: number;
}

/** A channel returned from list() */
export interface ChannelSummary {
  id: number;
  name: string;
  description: string;
  rootSectionId: number;
  microSites?: Microsite[];
}

/**
 * Full channel details returned from get().
 * Includes a publish() method to trigger a full channel publish.
 */
export class Channel {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly defaultLayout: string;
  readonly defaultLanguage: string;
  readonly rootSectionId: number;
  readonly fileOutputPath: string;
  readonly indexFileName: string;
  readonly baseHref: string;
  readonly siteRoot: string;
  readonly publishUrl: string;
  readonly defaultFullTextLayout: string;
  readonly fullTextExtension: string;
  readonly languages: ChannelLanguage[];
  readonly microSites?: Array<{ id: number; name: string }>;
  readonly fileExtensions: string[];

  /** @internal */
  private readonly _httpClient!: HttpClient;

  constructor(raw: ApiChannelDetail, httpClient: HttpClient) {
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    this.id = raw.id;
    this.name = raw.name;
    this.description = raw.description ?? '';
    this.defaultLayout = raw.type ?? '';
    this.defaultLanguage = raw.defaultLanguage ?? 'en';
    this.rootSectionId = raw.rootSectionID;
    this.fileOutputPath = raw.fileOutputPath ?? '';
    this.indexFileName = raw.indexFileName ?? '';
    this.baseHref = raw.baseHref ?? '';
    this.siteRoot = raw.siteRoot ?? '';
    this.publishUrl = raw.channelPublishURL ?? '';
    this.defaultFullTextLayout = raw.fullTextType ?? '';
    this.fullTextExtension = raw.fullTextExtension ?? '';
    this.languages = (raw.languages ?? []).map((l) => ({
      code: l.code,
      name: l.name,
      charset: l.charset,
    }));
    this.microSites = (raw.microSites ?? []).length > 0
      ? raw.microSites.map((ms) => ({ id: ms.id, name: ms.name }))
      : undefined;
    this.fileExtensions = (raw.permittedFileExtensions ?? [])
      .sort((a, b) => a.priority - b.priority)
      .map((e) => e.extension);
  }

  /**
   * Publishes this entire channel.
   *
   * Options:
   * - `includeArchives` — publish archive sections too (default: `false`)
   * - `overridePublishPeriodRestriction` — override publish period restriction (default: `false`)
   */
  async publish(options?: {
    includeArchives?: boolean;
    overridePublishPeriodRestriction?: boolean;
    language?: string;
  }): Promise<void> {
    const language = options?.language ?? this.defaultLanguage;

    await this._httpClient.request<void>({
      method: 'POST',
      path: '/task/repository',
      body: {
        taskType: 'channelPublish',
        channel: this.id,
        sections: [this.rootSectionId],
        branch: true,
        publishCompleteChannel: true,
        publishOptions: {
          publishArchiveSections: options?.includeArchives ?? false,
          overridePublishPeriodRestriction: options?.overridePublishPeriodRestriction ?? false,
        },
        taskLevel: 'channel',
        selectedLanguage: language,
      },
    });
  }
}

/**
 * Resource for channel operations.
 */
export class ChannelResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Lists all channels. */
  async list(): Promise<ChannelSummary[]> {
    const raw = await this.httpClient.request<ApiChannel[]>({
      method: 'GET',
      path: '/channel',
    });

    return raw.map((ch) => {
      const microSites = (ch.microSites ?? []).map((ms) => ({
        id: ms.id,
        name: ms.name,
        description: ms.description ?? '',
        rootSectionId: ms.rootSectionID,
        parentId: ms.parentID ?? ch.id,
      }));
      const result: ChannelSummary = {
        id: ch.id,
        name: ch.name,
        description: ch.description ?? '',
        rootSectionId: ch.rootSectionID,
      };
      if (microSites.length > 0) result.microSites = microSites;
      return result;
    });
  }

  /** Gets a single channel by ID with full details. Returns a Channel object with publish(). */
  async get(id: number): Promise<Channel> {
    const raw = await this.httpClient.request<ApiChannelDetail>({
      method: 'GET',
      path: `/channel/${id}`,
    });

    return new Channel(raw, this.httpClient);
  }
}
