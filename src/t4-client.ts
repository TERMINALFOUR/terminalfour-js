import { T4ClientConfig } from './types.js';
import { HttpClient } from './http-client.js';
import { SectionRef } from './section-ref.js';
import { MediaCategoryRef } from './media-category-ref.js';
import { MediaLibrary } from './media-library.js';
import { SiteStructure } from './site-structure.js';
import { ContentTypeResource } from './resources/content-type-resource.js';
import { ChannelResource } from './resources/channel-resource.js';
import { MediaResource } from './resources/media-resource.js';
import { MediaCreateFn } from './element-resolver.js';
import { ListResource } from './resources/list-resource.js';
import { GroupResource } from './resources/group-resource.js';
import { UserResource } from './resources/user-resource.js';
import { PageLayoutResource } from './resources/page-layout-resource.js';
import { MediaTypeResource } from './resources/media-type-resource.js';
import { NavigationResource } from './resources/navigation-resource.js';
import { Handlebars } from './handlebars.js';
import { invalidateAllCaches, normaliseBaseUrl, assertNotBrowser } from './utils.js';

/**
 * Main entry point for the T4 SDK.
 * Validates configuration, instantiates a shared HttpClient,
 * and exposes resource accessors for content types, media,
 * and section-scoped operations.
 */
export class T4Client {
  readonly contentTypes: ContentTypeResource;
  readonly channels: ChannelResource;
  readonly media: MediaResource;
  readonly mediaLibrary: MediaLibrary;
  readonly siteStructure: SiteStructure;
  readonly lists: ListResource;
  readonly groups: GroupResource;
  readonly users: UserResource;
  readonly pageLayouts: PageLayoutResource;
  readonly mediaTypes: MediaTypeResource;
  readonly navigation: NavigationResource;
  readonly handlebars: Handlebars;

  private readonly httpClient: HttpClient;
  private readonly defaultLanguage: string;
  private readonly mediaCreateFn: MediaCreateFn;

  constructor(config: T4ClientConfig) {
    assertNotBrowser();

    if (!config.baseUrl || typeof config.baseUrl !== 'string') {
      throw new Error('T4Client requires a valid baseUrl string');
    }
    if (!config.apiToken || typeof config.apiToken !== 'string') {
      throw new Error('T4Client requires a valid apiToken string');
    }

    const baseUrl = normaliseBaseUrl(config.baseUrl);

    this.httpClient = new HttpClient(baseUrl, config.apiToken, config.concurrency);
    this.defaultLanguage = config.language ?? 'en';

    this.contentTypes = new ContentTypeResource(this.httpClient);
    this.channels = new ChannelResource(this.httpClient);
    this.media = new MediaResource(this.httpClient);
    this.mediaLibrary = new MediaLibrary(this.httpClient);
    this.siteStructure = new SiteStructure(this.httpClient, this.defaultLanguage);
    this.lists = new ListResource(this.httpClient, this.defaultLanguage);
    this.groups = new GroupResource(this.httpClient);
    this.users = new UserResource(this.httpClient);
    this.pageLayouts = new PageLayoutResource(this.httpClient);
    this.mediaTypes = new MediaTypeResource(this.httpClient);
    this.navigation = new NavigationResource(this.httpClient);
    this.handlebars = new Handlebars(this.httpClient);

    // Create the media upload function for inline media element resolution
    this.mediaCreateFn = async (data) => {
      const item = await this.media.create({
        file: data.file,
        name: data.name,
        category: data.category,
        description: data.description,
      });
      return item.id;
    };
  }

  /**
   * Returns a section reference scoped to the given section ID.
   */
  section(id: number): SectionRef {
    return new SectionRef(this.httpClient, id, this.defaultLanguage, this.mediaCreateFn);
  }

  /**
   * Returns a media category reference scoped to the given category ID.
   * Use to list media items within a category.
   */
  mediaCategory(id: number): MediaCategoryRef {
    return new MediaCategoryRef(this.httpClient, id);
  }

  /**
   * Clears all internal caches across the entire SDK, forcing fresh data
   * on the next API call. This invalidates every cache — content type
   * templates, list lookups, media types, meta tags, group trees, element
   * type definitions, page layout metadata, and media library root IDs.
   *
   * Use when external changes (e.g. content type modifications, list updates)
   * need to be picked up mid-session.
   */
  clearCache(): void {
    invalidateAllCaches();
  }

  // ── Platform info (read-only) ──

  /** Returns the T4 version string (e.g. `'8.4.2-FINAL'`). */
  async version(): Promise<string> {
    const info = await this.about();
    return info.t4.version;
  }

  /** Returns the T4 instance uptime as a `Date` (when the server started). */
  async uptime(): Promise<Date> {
    const info = await this.about();
    return info.t4.uptime;
  }

  /**
   * Returns general information about the T4 instance — version, uptime,
   * OS, Java, and servlet container details.
   */
  async about(): Promise<{
    t4: { version: string; buildDate: string; buildNumber: string; dbPatchLevel: number; uptime: Date; totalRequests: number; activeRequests: number };
    os: { name: string; version: string; arch: string; hostname: string };
    java: { version: string; vendor: string; availableProcessors: number; heap: { total: number; free: number; max: number } };
    servlet: { containerName: string; contextName: string };
  }> {
    const raw = await this.httpClient.request<Record<string, unknown>>({
      method: 'GET',
      path: '/about/general',
    });
    const t4 = raw.t4 as Record<string, unknown>;
    const t4Version = t4.version as Record<string, unknown>;
    const os = raw.os as Record<string, unknown>;
    const java = raw.java as Record<string, unknown>;
    const javaVendor = java.vendor as Record<string, unknown>;
    const javaHeap = java.heap as Record<string, unknown>;
    const servlet = raw.servlet as Record<string, unknown>;

    return {
      t4: {
        version: (t4Version.version as string) ?? '',
        buildDate: (t4Version.buildDate as string) ?? '',
        buildNumber: (t4Version.buildNumber as string) ?? '',
        dbPatchLevel: (t4.dbPatchLevel as number) ?? 0,
        uptime: new Date(t4.uptime as string),
        totalRequests: (t4.totalRequests as number) ?? 0,
        activeRequests: (t4.activeRequests as number) ?? 0,
      },
      os: {
        name: (os.name as string) ?? '',
        version: (os.version as string) ?? '',
        arch: (os.arch as string) ?? '',
        hostname: (os.localHostname as string) ?? '',
      },
      java: {
        version: (java.version as string) ?? '',
        vendor: (javaVendor.name as string) ?? '',
        availableProcessors: (java.availableProcessors as number) ?? 0,
        heap: {
          total: (javaHeap.total as number) ?? 0,
          free: (javaHeap.free as number) ?? 0,
          max: (javaHeap.max as number) ?? 0,
        },
      },
      servlet: {
        containerName: (servlet.containerName as string) ?? '',
        contextName: (servlet.contextName as string) ?? '',
      },
    };
  }

  /**
   * Returns database connection details for the T4 instance.
   */
  async database(): Promise<{
    name: string;
    version: string;
    driverName: string;
    driverVersion: string;
    address: string;
  }> {
    const raw = await this.httpClient.request<Record<string, unknown>>({
      method: 'GET',
      path: '/about/database',
    });
    const jdbc = raw.jdbc as Record<string, unknown>;
    const db = raw.database as Record<string, unknown>;

    return {
      name: (db.name as string) ?? '',
      version: (db.version as string) ?? '',
      driverName: (jdbc.driverName as string) ?? '',
      driverVersion: (jdbc.driverVersion as string) ?? '',
      address: (db.address as string) ?? '',
    };
  }

  /**
   * Returns environment configuration variables for the T4 instance.
   */
  async environment(): Promise<Record<string, string>> {
    const raw = await this.httpClient.request<{ environmentalVariables: Record<string, string> }>({
      method: 'GET',
      path: '/about/environment',
    });
    return raw.environmentalVariables ?? {};
  }

  /**
   * Returns licence usage information — content limits and current usage.
   */
  async licence(): Promise<{
    contentLimit: number;
    contentItemsInSystem: number;
    itemsCountedForLicence: number;
    remaining: number;
  }> {
    const raw = await this.httpClient.request<{
      contentLimit: number;
      contentItemsInSystem: number;
      itemsCountedForLicence: number;
      remaining: number;
    }>({
      method: 'GET',
      path: '/about/licence',
    });
    return {
      contentLimit: raw.contentLimit ?? 0,
      contentItemsInSystem: raw.contentItemsInSystem ?? 0,
      itemsCountedForLicence: raw.itemsCountedForLicence ?? 0,
      remaining: raw.remaining ?? 0,
    };
  }
}
