import { HttpClient } from './http-client.js';
import { LanguageOption } from './types.js';
import { resolveLanguage, mapStatus } from './utils.js';
import { SectionTreeNode } from './section-ref.js';

/** Raw tree node from POST /hierarchy/section */
interface ApiSectionTreeNode {
  id: number;
  name: string;
  status: number;
  subsections: ApiSectionTreeNode[];
  hasChildren: boolean;
  [key: string]: unknown;
}

/**
 * Provides operations on the site hierarchy as a whole.
 */
export class SiteStructure {
  private readonly httpClient: HttpClient;
  private readonly defaultLanguage: string;

  constructor(httpClient: HttpClient, defaultLanguage: string) {
    this.httpClient = httpClient;
    this.defaultLanguage = defaultLanguage;
  }

  /**
   * Returns the full site section tree starting from the root.
   */
  async tree(options?: LanguageOption): Promise<SectionTreeNode> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const response = await this.httpClient.request<ApiSectionTreeNode[]>({
      method: 'POST',
      path: '/hierarchy/section',
      body: {
        read: {
          section: { id: 1, language },
          recursionDepth: 1,
          activeNode: 1,
          explode: false,
          showContentInfo: false,
          showWidget: false,
          openNodes: [],
          showFullTree: true,
          showAllSections: true,
          restrictedToPermitedSections: false,
        },
      },
    });

    const root = response[0];
    if (!root) {
      return { id: 1, name: '' };
    }

    return this.mapNode(root);
  }

  /** Recursively maps API tree nodes to clean SectionTreeNode objects */
  private mapNode(node: ApiSectionTreeNode): SectionTreeNode {
    const children = (node.subsections ?? []).map((child) => this.mapNode(child));
    const result: SectionTreeNode = {
      id: node.id,
      name: node.name,
      status: mapStatus(node.status),
    };
    if (children.length > 0) {
      result.children = children;
    }
    return result;
  }
}
