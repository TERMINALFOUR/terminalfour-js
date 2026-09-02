import { HttpClient } from './http-client.js';
import { LanguageOption } from './types.js';
import { resolveLanguage, decodeHtmlEntities, DEFAULT_CACHE_TTL, getCacheEpoch } from './utils.js';

/** A node in the media category tree */
export interface MediaCategoryNode {
  id: number;
  name: string;
  children?: MediaCategoryNode[];
}

/** Raw tree node from the API */
interface ApiTreeNode {
  id: number;
  name: string;
  language: string;
  status: number;
  children: ApiTreeNode[];
  hasChildren: boolean;
  [key: string]: unknown;
}

/** Config response for media library root section */
interface ConfigResponse {
  name: string;
  type: string;
  value: string;
}

/**
 * Provides operations on the media library as a whole.
 */
export class MediaLibrary {
  private readonly httpClient: HttpClient;
  private rootIdPromise: Promise<number> | null = null;
  private rootIdExpiresAt = 0;
  private rootIdEpoch = -1;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Returns the full media category tree.
   * Fetches the media library root, then retrieves the complete tree structure.
   */
  async tree(options?: LanguageOption & { depth?: number }): Promise<MediaCategoryNode> {
    const language = resolveLanguage(options?.language, 'en');
    const depth = options?.depth ?? 30;

    const rootId = await this.getRootId();

    // Get the single child of the root (the "Categorised" node)
    const subsResponse = await this.httpClient.request<{ children: Array<{ id: number; name: string }> }>({
      method: 'GET',
      path: `/hierarchy/${rootId}/${language}/subsections?showAll=false&removeNonTranslated=false`,
    });

    const topChild = (subsResponse.children ?? [])[0];
    if (!topChild) {
      return { id: rootId, name: 'Media Library' };
    }

    // Fetch the full tree from the top child
    const treeResponse = await this.httpClient.request<ApiTreeNode[]>({
      method: 'POST',
      path: '/mediacategory',
      body: {
        category: { id: topChild.id, language },
        recursionDepth: depth,
        explode: false,
        activeNode: -1,
        showInactive: false,
        showMyMedia: false,
      },
    });

    const rootNode = treeResponse[0];
    if (!rootNode) {
      return { id: topChild.id, name: topChild.name };
    }

    return this.mapNode(rootNode);
  }

  /** Fetches and caches the media library root section ID */
  private getRootId(): Promise<number> {
    if (!this.rootIdPromise || Date.now() > this.rootIdExpiresAt || this.rootIdEpoch < getCacheEpoch()) {
      this.rootIdExpiresAt = Date.now() + DEFAULT_CACHE_TTL;
      this.rootIdEpoch = getCacheEpoch();
      this.rootIdPromise = this.httpClient.request<ConfigResponse>({
        method: 'GET',
        path: '/config/mediaLibrary.section',
      }).then((config) => Number(config.value));
    }
    return this.rootIdPromise;
  }

  /** Recursively maps API tree nodes to clean MediaCategoryNode objects */
  private mapNode(node: ApiTreeNode): MediaCategoryNode {
    const children = (node.children ?? []).map((child) => this.mapNode(child));
    const result: MediaCategoryNode = {
      id: node.id,
      name: decodeHtmlEntities(node.name),
    };
    if (children.length > 0) {
      result.children = children;
    }
    return result;
  }
}
