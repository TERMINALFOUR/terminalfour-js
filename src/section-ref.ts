import { HttpClient } from './http-client.js';
import {
  LanguageOption,
  SectionChannel,
  Owner,
  AddSectionData,
  ApiSectionDTO,
} from './types.js';
import { resolveLanguage, mapStatus, flattenGroups, STATUS_CODES, AUTH_LEVEL_MAP, debugWarn, DEFAULT_CACHE_TTL, getCacheEpoch } from './utils.js';
import { ContentResource } from './resources/content-resource.js';
import { SectionItem } from './models/section-item.js';
import { MediaCreateFn } from './element-resolver.js';

/** A node in the section hierarchy tree */
export interface SectionTreeNode {
  id: number;
  name: string;
  status?: string;
  children?: SectionTreeNode[];
}

/** Raw tree node from POST /hierarchy/section */
interface ApiSectionTreeNode {
  id: number;
  name: string;
  status: number;
  subsections: ApiSectionTreeNode[];
  hasChildren: boolean;
  [key: string]: unknown;
}

/** Raw owner response from the API */
interface OwnerDTO {
  id: number;
  type: string;
}

/** User details from GET /user/{id} */
interface UserDTO {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  authLevel?: number;
}

/** Meta tag definition from GET /meta */
interface MetaTagDefinition {
  id: number;
  name: string;
}

/** Per-client cache for meta tag definitions, keyed by HttpClient instance */
const metaTagCacheMap = new WeakMap<HttpClient, { data: MetaTagDefinition[]; expiresAt: number; epoch: number }>();

/** Clears the meta tag cache for a specific HttpClient instance */
export function clearMetaTagCache(httpClient: HttpClient): void {
  metaTagCacheMap.delete(httpClient);
}

/**
 * Strips the internal `Name` element from resolved metadata content fields.
 * The Section Meta Data content type always has a Name element that mirrors the
 * section name, but it isn't a user-facing custom field — `section.name` already
 * exposes it. Returns `null` when the input is `null`.
 */
function stripNameField(fields: Record<string, unknown> | null): Record<string, unknown> | null {
  if (fields === null) return null;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key.toLowerCase() === 'name') continue;
    result[key] = value;
  }
  return result;
}

/**
 * Resolves the Section Meta Data content type ID.
 *
 * Prefers the section's own `metaData.type`, but falls back to the instance-level
 * configuration (`GET /config/hierarchy.metaDataContentType`) when the section has
 * none. This covers sections created before a metadata content type existed, or
 * created via the API without one, while a metadata content type is now configured
 * on the instance. Returns `0` when no metadata content type is configured anywhere.
 */
async function resolveMetaDataTypeId(httpClient: HttpClient, sectionMetaDataType: number): Promise<number> {
  if (sectionMetaDataType > 0) return sectionMetaDataType;

  try {
    const config = await httpClient.request<{ name: string; type: string; value: string }>({
      method: 'GET',
      path: '/config/hierarchy.metaDataContentType',
    });
    return parseInt(config.value, 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * A section reference scoped to a specific section ID.
 * Provides content operations, section metadata, hierarchy navigation,
 * child section creation, and deletion — all from a single entry point.
 */
export class SectionRef {
  readonly content: ContentResource;

  private readonly httpClient: HttpClient;
  private readonly sectionId: number;
  private readonly defaultLanguage: string;
  private readonly mediaCreateFn: MediaCreateFn | null;

  constructor(httpClient: HttpClient, sectionId: number, defaultLanguage: string, mediaCreateFn?: MediaCreateFn | null) {
    this.httpClient = httpClient;
    this.sectionId = sectionId;
    this.defaultLanguage = defaultLanguage;
    this.mediaCreateFn = mediaCreateFn ?? null;

    this.content = new ContentResource(httpClient, sectionId, defaultLanguage, this.mediaCreateFn);
  }

  // ── Section metadata ──

  /** Returns a mutable section object. Modify properties and call save() to persist. */
  async get(options?: LanguageOption): Promise<SectionItem> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const raw = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    // Fetch custom fields from metadata content if configured
    let customFields: Record<string, unknown> | null = null;
    const meta = raw.metaData as { id?: number; type?: number; enabled?: boolean } | undefined;
    if (meta?.enabled && meta.id) {
      try {
        const metaContent = new ContentResource(this.httpClient, this.sectionId, this.defaultLanguage, this.mediaCreateFn);
        const item = await metaContent.get(meta.id, { language });
        customFields = stripNameField(item.fields ?? null);
      } catch {
        // Metadata content may not exist yet — that's fine
      }
    }

    return new SectionItem(raw, this.httpClient, language, customFields, this.mediaCreateFn);
  }

  /** Returns the list of channels associated with this section. */
  async channels(): Promise<SectionChannel[]> {
    return this.httpClient.request<SectionChannel[]>({
      method: 'GET',
      path: `/section/${this.sectionId}/channels`,
    });
  }

  /**
   * Returns the page layouts for this section, one entry per channel.
   *
   * Each entry has two fields:
   * - `pageLayout` — the layout applied to *this* section for the channel.
   *   Either directly set (`inherited: false`) or inherited from a parent (`inherited: true`).
   *   `null` if no layout is set or inherited.
   * - `childPageLayout` — the layout that descendant sections will inherit
   *   when they don't have their own explicit layout. `null` if not set.
   *
   * Data sources in the API response:
   * - `channels[].pageLayout` — directly assigned layout on this section (non-zero = direct)
   * - `inheritedPageLayouts[channelId]` — layout inherited from a parent (used when no direct assignment)
   * - `channels[].inheritedPageLayout` — the "apply to descendants" layout
   */
  async pageLayouts(options?: LanguageOption): Promise<Array<{
    channel: { id: number; name: string };
    pageLayout: { id: number; name: string; inherited: boolean } | null;
    childPageLayout: { id: number; name: string } | null;
  }>> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    // Fetch section details and channel names in parallel
    const [section, channelList] = await Promise.all([
      this.httpClient.request<ApiSectionDTO>({
        method: 'GET',
        path: `/hierarchy/${this.sectionId}/${language}`,
      }),
      this.httpClient.request<SectionChannel[]>({
        method: 'GET',
        path: `/section/${this.sectionId}/channels`,
      }),
    ]);

    // channels[]: direct layout + descendant layout per channel
    const channelEntries = section.channels ?? [];
    const directMap = new Map(channelEntries.map((ch) => [ch.id, ch.pageLayout]));
    const childMap = new Map(channelEntries.map((ch) => [ch.id, ch.inheritedPageLayout]));

    // inheritedPageLayouts: layout inherited from parent, keyed by string channel ID
    const parentInheritedMap = new Map(
      Object.entries(section.inheritedPageLayouts ?? {}).map(([k, v]) => [Number(k), v as number]),
    );

    // Union of all channel IDs from both sources
    const allChannelIds = new Set([...directMap.keys(), ...parentInheritedMap.keys()]);
    if (allChannelIds.size === 0) return [];

    // Build a channel name lookup
    const channelNameMap = new Map(channelList.map((ch) => [ch.id, ch.name]));

    // Collect all unique non-zero layout IDs to resolve names in one request
    const layoutIds = new Set<number>();
    for (const id of allChannelIds) {
      const direct = directMap.get(id);
      const parentInherited = parentInheritedMap.get(id);
      const child = childMap.get(id);
      if (direct) layoutIds.add(direct);
      if (parentInherited) layoutIds.add(parentInherited);
      if (child) layoutIds.add(child);
    }

    // Fetch all page layouts in one request and build a lookup map
    let layoutNameMap = new Map<number, string>();
    if (layoutIds.size > 0) {
      const allLayouts = await this.httpClient.request<Array<{ id: number; name: string }>>({
        method: 'GET',
        path: '/pageLayout',
      });
      layoutNameMap = new Map(allLayouts.map((l) => [l.id, l.name]));
    }

    const resolveName = (id: number): string => layoutNameMap.get(id) ?? `Page Layout ${id}`;

    return Array.from(allChannelIds).map((channelId) => {
      const directId = directMap.get(channelId) ?? 0;
      const parentInheritedId = parentInheritedMap.get(channelId) ?? 0;
      const childId = childMap.get(channelId) ?? 0;

      // pageLayout: direct if set, otherwise inherited from parent
      let pageLayout: { id: number; name: string; inherited: boolean } | null = null;
      if (directId) {
        pageLayout = { id: directId, name: resolveName(directId), inherited: false };
      } else if (parentInheritedId) {
        pageLayout = { id: parentInheritedId, name: resolveName(parentInheritedId), inherited: true };
      }

      return {
        channel: {
          id: channelId,
          name: channelNameMap.get(channelId) ?? `Channel ${channelId}`,
        },
        pageLayout,
        childPageLayout: childId ? { id: childId, name: resolveName(childId) } : null,
      };
    });
  }

  /**
   * Updates page layout assignments on this section. Additive — only the channels
   * you pass are changed; others keep their existing values.
   *
   * Each entry requires a `channelId` and at least one of:
   * - `pageLayout` — the layout to apply directly to this section for the channel
   * - `childPageLayout` — the layout that descendant sections will inherit
   *
   * Pass `null` for either to clear that assignment (sets to 0).
   */
  async setPageLayouts(
    layouts: Array<{
      channelId: number;
      pageLayout?: number | null;
      childPageLayout?: number | null;
    }>,
    options?: LanguageOption,
  ): Promise<void> {
    if (!layouts.length) {
      throw new Error('setPageLayouts requires at least one channel entry');
    }
    for (const entry of layouts) {
      if (entry.pageLayout === undefined && entry.childPageLayout === undefined) {
        throw new Error(
          `setPageLayouts: channel ${entry.channelId} requires at least one of pageLayout or childPageLayout`,
        );
      }
    }

    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    // Build a mutable map of existing channel entries
    const channelMap = new Map(
      (section.channels ?? []).map((ch) => [ch.id, { ...ch }]),
    );

    // Merge in the user's changes
    for (const entry of layouts) {
      const existing = channelMap.get(entry.channelId);
      if (existing) {
        // Update existing channel entry
        if (entry.pageLayout !== undefined) {
          existing.pageLayout = entry.pageLayout ?? 0;
        }
        if (entry.childPageLayout !== undefined) {
          existing.inheritedPageLayout = entry.childPageLayout ?? 0;
        }
      } else {
        // Add new channel entry
        channelMap.set(entry.channelId, {
          id: entry.channelId,
          pageLayout: entry.pageLayout ?? 0,
          inheritedPageLayout: entry.childPageLayout ?? 0,
        });
      }
    }

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: {
        ...section,
        channels: Array.from(channelMap.values()),
      },
    });
  }

  /** Returns the owner information for this section, including user details. */
  async owner(options?: LanguageOption): Promise<Owner> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const ownerDto = await this.httpClient.request<OwnerDTO>({
      method: 'GET',
      path: `/section/${this.sectionId}/${language}/owner`,
    });

    // Fetch user details to get the name
    const user = await this.httpClient.request<UserDTO>({
      method: 'GET',
      path: `/user/${ownerDto.id}`,
    });

    return {
      id: ownerDto.id,
      type: AUTH_LEVEL_MAP[user.authLevel ?? 2] ?? `unknown (${user.authLevel})`,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      emailAddress: user.emailAddress,
    };
  }

  /**
   * Returns the section's meta data values with friendly tag names.
   * Maps meta tag IDs to their names (e.g. id 19 → "og:title").
   */
  async metaDatas(options?: LanguageOption): Promise<Record<string, string>> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    // Fetch section details and meta tag definitions in parallel
    const [section, metaTags] = await Promise.all([
      this.httpClient.request<ApiSectionDTO>({
        method: 'GET',
        path: `/hierarchy/${this.sectionId}/${language}`,
      }),
      this.getMetaTagDefinitions(),
    ]);

    const result: Record<string, string> = {};
    for (const meta of section.metaDatas ?? []) {
      const tag = metaTags.find((t) => t.id === meta.id);
      const name = tag?.name ?? String(meta.id);
      result[name] = meta.value;
    }

    return result;
  }

  /** Fetches and caches meta tag definitions from GET /meta */
  private async getMetaTagDefinitions(): Promise<MetaTagDefinition[]> {
    const cached = metaTagCacheMap.get(this.httpClient);
    if (cached && Date.now() < cached.expiresAt && cached.epoch >= getCacheEpoch()) return cached.data;

    const tags = await this.httpClient.request<MetaTagDefinition[]>({
      method: 'GET',
      path: '/meta',
    });
    metaTagCacheMap.set(this.httpClient, { data: tags, expiresAt: Date.now() + DEFAULT_CACHE_TTL, epoch: getCacheEpoch() });
    return tags;
  }

  /**
   * Updates meta data values on this section.
   * Only updates the tags you pass — existing values are preserved.
   * Uses friendly tag names (e.g. "og:title", "description").
   */
  async setMetaDatas(
    values: Record<string, string>,
    options?: LanguageOption,
  ): Promise<void> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    // Fetch current section and meta tag definitions in parallel
    const [section, metaTags] = await Promise.all([
      this.httpClient.request<ApiSectionDTO>({
        method: 'GET',
        path: `/hierarchy/${this.sectionId}/${language}`,
      }),
      this.getMetaTagDefinitions(),
    ]);

    // Start with existing metaDatas
    const existingMetas = [...(section.metaDatas ?? [])];

    // Merge in the new values
    for (const [tagName, value] of Object.entries(values)) {
      const tagDef = metaTags.find(
        (t) => t.name.toLowerCase() === tagName.toLowerCase(),
      );
      if (!tagDef) {
        const validNames = metaTags.map((t) => `"${t.name}"`).join(', ');
        throw new Error(
          `Invalid meta tag "${tagName}". Valid tags are: ${validNames}`,
        );
      }

      // Update existing or add new
      const existing = existingMetas.find((m) => m.id === tagDef.id);
      if (existing) {
        existing.value = value;
      } else {
        existingMetas.push({ id: tagDef.id, value, lang: language });
      }
    }

    // PUT the full section body with updated metaDatas
    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: {
        ...section,
        metaDatas: existingMetas,
      },
    });
  }

  // ── Hierarchy operations ──

  /**
   * Returns the section hierarchy tree starting from this section.
   */
  async tree(options?: LanguageOption): Promise<SectionTreeNode> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const response = await this.httpClient.request<ApiSectionTreeNode[]>({
      method: 'POST',
      path: '/hierarchy/section',
      body: {
        read: {
          section: { id: this.sectionId, language },
          recursionDepth: 1,
          activeNode: this.sectionId,
          explode: true,
          showContentInfo: false,
          showWidget: false,
          openNodes: [this.sectionId],
          showFullTree: true,
          showAllSections: true,
          restrictedToPermitedSections: false,
        },
      },
    });

    const root = response[0];
    if (!root) {
      return { id: this.sectionId, name: '' };
    }

    return this.mapTreeNode(root);
  }

  /** Recursively maps API tree nodes to clean SectionTreeNode objects */
  private mapTreeNode(node: ApiSectionTreeNode): SectionTreeNode {
    const children = (node.subsections ?? []).map((child) => this.mapTreeNode(child));
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

  /** Lists direct child sections (one level below). */
  async subsections(options?: LanguageOption): Promise<Array<{ id: number; name: string; lastModified: Date | null }>> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const response = await this.httpClient.request<{ children: Array<{ id: number; name: string; lastModified: number }> }>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}/subsections?showAll=false&removeNonTranslated=false`,
    });
    return (response.children ?? []).map((child) => ({
      id: child.id,
      name: child.name,
      lastModified: child.lastModified ? new Date(child.lastModified) : null,
    }));
  }

  /** Returns users and groups with edit rights on this section, including inherited rights. */
  async editRights(options?: LanguageOption): Promise<{
    users: Array<{ id: number; username: string; firstName: string; lastName: string; emailAddress: string; inherited: boolean }>;
    groups: Array<{ id: number; name: string; inherited: boolean }>;
  }> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const directUserIds = section.userIDs ?? [];
    const inheritedUserIds = section.inheritedUserIDs ?? [];
    const directGroupIds = section.groupIDs ?? [];
    const inheritedGroupIds = section.inheritedGroupIDs ?? [];

    // Resolve users
    const allUserIds = [
      ...directUserIds.map((id) => ({ id, inherited: false })),
      ...inheritedUserIds.map((id) => ({ id, inherited: true })),
    ];
    const users = await Promise.all(
      allUserIds.map(async ({ id, inherited }) => {
        try {
          const user = await this.httpClient.request<UserDTO>({
            method: 'GET',
            path: `/user/${id}`,
          });
          return { id, username: user.username, firstName: user.firstName, lastName: user.lastName, emailAddress: user.emailAddress, inherited };
        } catch (error) {
          debugWarn(`Failed to resolve user ${id} in editRights`, error);
          return { id, username: `User ${id}`, firstName: '', lastName: '', emailAddress: '', inherited };
        }
      }),
    );

    // Resolve groups
    let groupMap: Map<number, string>;
    try {
      const groups = await this.httpClient.request<Array<{ id: number; name: string; groupChildren: unknown[] }>>({
        method: 'GET',
        path: '/group/topLevelGroups',
      });
      groupMap = flattenGroups(groups);
    } catch (error) {
      debugWarn('Failed to resolve group names in editRights', error);
      groupMap = new Map();
    }

    const groups = [
      ...directGroupIds.map((id) => ({ id, name: groupMap.get(id) ?? `Group ${id}`, inherited: false })),
      ...inheritedGroupIds.map((id) => ({ id, name: groupMap.get(id) ?? `Group ${id}`, inherited: true })),
    ];

    return { users, groups };
  }

  /** Sets direct (non-inherited) edit rights on this section. At least one of users or groups is required. */
  async setEditRights(
    data: { users?: number[]; groups?: number[] },
    options?: LanguageOption,
  ): Promise<void> {
    if (data.users === undefined && data.groups === undefined) {
      throw new Error('setEditRights requires at least one of users or groups');
    }

    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    // Merge new IDs into existing (deduplicated)
    const mergedUsers = data.users
      ? [...new Set([...(section.userIDs ?? []), ...data.users])]
      : (section.userIDs ?? []);
    const mergedGroups = data.groups
      ? [...new Set([...(section.groupIDs ?? []), ...data.groups])]
      : (section.groupIDs ?? []);

    const updated = {
      ...section,
      userIDs: mergedUsers,
      groupIDs: mergedGroups,
    };

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: updated,
    });
  }

  /** Removes users and/or groups from direct edit rights on this section. */
  async removeEditRights(
    data: { users?: number[]; groups?: number[] },
    options?: LanguageOption,
  ): Promise<void> {
    if (data.users === undefined && data.groups === undefined) {
      throw new Error('removeEditRights requires at least one of users or groups');
    }

    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const removeUsers = new Set(data.users ?? []);
    const removeGroups = new Set(data.groups ?? []);

    const updated = {
      ...section,
      userIDs: (section.userIDs ?? []).filter((id) => !removeUsers.has(id)),
      groupIDs: (section.groupIDs ?? []).filter((id) => !removeGroups.has(id)),
    };

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: updated,
    });
  }

  /** Lists content types enabled in this section, with name, description, and scope. */
  async contentTypes(options?: LanguageOption): Promise<Array<{
    id: number;
    name: string;
    description: string;
    scope: 'branch' | 'section';
  }>> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const scopes = section.contentTypeScopes ?? [];
    if (scopes.length === 0) return [];

    // Fetch all content types in one request and build a lookup map
    const allTypes = await this.httpClient.request<Array<{ id: number; name: string; description?: string }>>({
      method: 'GET',
      path: '/contenttype',
    });
    const typeMap = new Map(allTypes.map((t) => [t.id, t]));

    return scopes.map((s) => {
      const ct = typeMap.get(s.id);
      return {
        id: s.id,
        name: ct?.name ?? `Content Type ${s.id}`,
        description: ct?.description ?? '',
        scope: s.scope === 1 ? 'branch' as const : 'section' as const,
      };
    });
  }

  /** Adds or updates content types on this section. Merges with existing content type scopes. */
  async setContentTypes(
    types: Array<{ id: number; scope: 'branch' | 'section' }>,
    options?: LanguageOption,
  ): Promise<void> {
    if (!types.length) {
      throw new Error('setContentTypes requires at least one content type');
    }

    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const existing = section.contentTypeScopes ?? [];

    // Build a map of existing scopes, then merge in the new ones
    const scopeMap = new Map(existing.map((s) => [s.id, s]));
    for (const t of types) {
      scopeMap.set(t.id, { id: t.id, scope: t.scope === 'branch' ? 1 : 0, inherited: false });
    }

    const updated = {
      ...section,
      contentTypeScopes: Array.from(scopeMap.values()),
    };

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: updated,
    });
  }

  /** Removes content types from this section by ID. */
  async removeContentTypes(ids: number[], options?: LanguageOption): Promise<void> {
    if (!ids.length) {
      throw new Error('removeContentTypes requires at least one content type ID');
    }

    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const removeSet = new Set(ids);
    const updated = {
      ...section,
      contentTypeScopes: (section.contentTypeScopes ?? []).filter((s) => !removeSet.has(s.id)),
    };

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: updated,
    });
  }

  /**
   * Creates a child section under this section.
   * Automatically inherits channels, page layouts, and type IDs from this section.
   * If `data.customFields` is provided, creates and saves section metadata content.
   */
  async addSection(data: Omit<AddSectionData, 'parentId'>, options?: LanguageOption): Promise<SectionItem> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    // Fetch this section's details to inherit config
    const parentSection = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const accessControlType = parentSection.accessControl?.type ?? 0;
    const metaDataTypeId = parentSection.metaData?.type ?? 0;

    const channels = (parentSection.channels ?? []).map((ch) => ({
      id: ch.id,
      pageLayout: 0,
      inheritedPageLayout: 0,
    }));

    // Step 1: Create the section
    const raw = await this.httpClient.request<ApiSectionDTO>({
      method: 'POST',
      path: `/hierarchy/${language}`,
      body: {
        parent: String(this.sectionId),
        name: data.name,
        status: String(STATUS_CODES[data.status ?? 'approved'] ?? 0),
        workflow: '0',
        path: '',
        'output-uri': '',
        'access-key': '',
        seo: '',
        'file-name': '',
        show: data.show ?? true,
        eForm: false,
        archive: false,
        printSequence: 0,
        contentSortMethod: 0,
        sectionSortMethod: 0,
        link: false,
        channels,
        userIDs: [],
        inheritedUserIDs: [],
        groupIDs: [],
        inheritedGroupIDs: [],
        viewUserIDs: [],
        viewGroupIDs: [],
        contentTypeScopes: [],
        metaDatas: [],
        excludedMirrorSections: [],
        accessControl: parentSection.accessControl ?? {
          id: 0, type: accessControlType, enabled: false, active: false,
        },
        metaData: parentSection.metaData ?? {
          id: 0, type: metaDataTypeId, enabled: true, active: true,
        },
        pathMembers: [],
        accessControlType,
        metaDataType: metaDataTypeId,
        inheritedPageLayouts: parentSection.inheritedPageLayouts ?? {},
        enableOutputUri: true,
        enableOutputFilename: true,
        enablePathAsOutputUri: true,
        inheritedLinkSection: false,
        accessControlEnabled: true,
        accessControlInherited: false,
      },
    });

    const newSectionId = raw.id;

    // Steps 2 & 3: Create the section metadata content instance.
    // Every section gets a metadata content item when the instance has a Section
    // Meta Data content type configured, matching T4's own section-create flow.
    // The item's Name element is set to the section name; other elements are
    // blank unless customFields are provided.
    //
    // Prefer the parent's metaData.type, but fall back to the instance-level
    // configuration so a child still gets metadata content when the parent has
    // none but the instance does.
    let customFields: Record<string, unknown> | null = null;
    const hasCustomFields = data.customFields && Object.keys(data.customFields).length > 0;
    const metaContentTypeId = await resolveMetaDataTypeId(this.httpClient, metaDataTypeId);
    if (metaContentTypeId) {
      // Use a ContentResource on the new section to get full element resolution
      // (list values, SS links, file uploads, etc.)
      const metadataContentResource = new ContentResource(this.httpClient, newSectionId, this.defaultLanguage, this.mediaCreateFn);

      // Create the metadata content item (ContentResource.create handles the full body)
      const metaItem = await metadataContentResource.create({
        type: metaContentTypeId,
        name: data.name,
        fields: data.customFields ?? {},
        status: 'pending',
      });
      customFields = stripNameField(metaItem.fields ?? null);
    } else if (hasCustomFields) {
      throw new Error('Cannot set customFields: no Section Meta Data content type is configured on this T4 instance');
    }

    // Return the created child as a mutable SectionItem
    const childRaw = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${newSectionId}/${language}`,
    });
    return new SectionItem(childRaw, this.httpClient, language, customFields, this.mediaCreateFn);
  }

  /** Deletes (deactivates) this section by setting its status to inactive. */
  async delete(options?: LanguageOption): Promise<void> {
    await this.update({ status: 'inactive' }, options);
  }

  /**
   * Permanently removes this section. The section must be inactive first.
   * Call delete() before purge() if the section is still active.
   */
  async purge(options?: LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    // Check the section is inactive before purging
    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const status = Number(section.status);
    if (status !== 2) {
      const statusName = { 0: 'approved', 1: 'pending' }[status] ?? `unknown (${status})`;
      throw new Error(
        `Cannot purge section ${this.sectionId} — it is currently "${statusName}". ` +
        `Only inactive sections can be purged. Call delete() first to deactivate it.`,
      );
    }

    await this.httpClient.request<void>({
      method: 'POST',
      path: '/hierarchy/purge',
      body: {
        languageCode: language,
        contentIds: [String(this.sectionId)],
      },
    });
  }

  /**
   * Moves this section under a new parent section.
   */
  async move(newParentId: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'MOVE',
      path: `/hierarchy/${this.sectionId}/${newParentId}`,
      body: {},
    });
  }

  /**
   * Updates section properties. Fetches the current section, merges your
   * changes, and PUTs the full body back. Only pass the fields you want to change.
   * Returns the updated SectionItem.
   */
  async update(
    data: { name?: string; show?: boolean; status?: 'approved' | 'pending' | 'inactive'; customFields?: Record<string, unknown> },
    options?: LanguageOption,
  ): Promise<SectionItem> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);

    const section = await this.httpClient.request<ApiSectionDTO>({
      method: 'GET',
      path: `/hierarchy/${this.sectionId}/${language}`,
    });

    const updated = {
      ...section,
      ...(data.name !== undefined && { name: data.name }),
      ...(data.show !== undefined && { show: data.show }),
      ...(data.status !== undefined && { status: String(STATUS_CODES[data.status] ?? section.status) }),
    };

    await this.httpClient.request<void>({
      method: 'PUT',
      path: `/hierarchy/${this.sectionId}/${language}`,
      body: updated,
    });

    // Update custom fields if provided
    if (data.customFields !== undefined) {
      const meta = section.metaData as { id?: number; type?: number; enabled?: boolean } | undefined;
      const metaDataTypeId = await resolveMetaDataTypeId(this.httpClient, meta?.type ?? 0);

      if (!metaDataTypeId) {
        throw new Error(
          'Cannot update customFields: no Section Meta Data content type is configured on this T4 instance',
        );
      }

      const contentResource = new ContentResource(this.httpClient, this.sectionId, this.defaultLanguage, this.mediaCreateFn);
      const metaContentId = meta?.id ?? 0;

      if (metaContentId > 0) {
        await contentResource.update(metaContentId, { fields: data.customFields });
      } else {
        // Create the metadata content. The Name element mirrors the section name.
        await contentResource.create({
          type: metaDataTypeId,
          name: section.name,
          fields: data.customFields,
          status: 'pending',
        });
      }
    }

    return this.get(options);
  }

  // ── Publishing ──

  /**
   * Publishes this section (or its entire branch) to a channel.
   *
   * If the section belongs to a single channel, `channelId` is optional — the SDK
   * auto-selects it. If the section belongs to multiple channels, `channelId` is
   * required and the error message lists the valid options.
   *
   * Pass `{ branch: true }` to publish the entire branch below this section.
   */
  async publish(options?: { channelId?: number; branch?: boolean } & LanguageOption): Promise<void> {
    const language = resolveLanguage(options?.language, this.defaultLanguage);
    const branch = options?.branch ?? false;

    // Fetch publishable channels for this section
    const publishableChannels = await this.httpClient.request<Array<{ id: number; name: string }>>({
      method: 'GET',
      path: `/channel/publishables/${this.sectionId}/publish`,
    });

    if (publishableChannels.length === 0) {
      throw new Error(
        `Cannot publish section ${this.sectionId} — it has no publishable channels.`,
      );
    }

    let channelId: number;

    if (options?.channelId !== undefined) {
      // Validate the provided channel ID
      const valid = publishableChannels.find((ch) => ch.id === options.channelId);
      if (!valid) {
        const validList = publishableChannels.map((ch) => `${ch.name} (${ch.id})`).join(', ');
        throw new Error(
          `Channel ${options.channelId} is not a publishable channel for section ${this.sectionId}. ` +
          `Valid channels: ${validList}`,
        );
      }
      channelId = options.channelId;
    } else if (publishableChannels.length === 1) {
      // Auto-select the only channel
      channelId = publishableChannels[0].id;
    } else {
      const validList = publishableChannels.map((ch) => `${ch.name} (${ch.id})`).join(', ');
      throw new Error(
        `Section ${this.sectionId} belongs to multiple channels. ` +
        `Pass a channelId to specify which channel to publish. ` +
        `Available channels: ${validList}`,
      );
    }

    await this.httpClient.request<void>({
      method: 'POST',
      path: '/task/repository',
      body: {
        taskType: 'channelPublish',
        channel: channelId,
        sections: [this.sectionId],
        branch,
        publishCompleteChannel: false,
        publishOptions: { publishArchiveSections: true },
        taskLevel: branch ? 'branch' : 'section',
        selectedLanguage: language,
      },
    });
  }

}
