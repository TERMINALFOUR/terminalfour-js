import { HttpClient } from '../http-client.js';
import { AUTH_LEVEL_MAP } from '../utils.js';

/** Raw group from the API */
interface RawGroup {
  id: number;
  name: string;
  description?: string;
  membersCount: number;
  enabled: boolean;
  ldap: boolean;
  emailAddress?: string;
  children: number[];
  groupChildren: RawGroup[];
  members?: RawMember[];
  parents?: number[];
  defaultPreviewChannel?: number;
  [key: string]: unknown;
}

/** Raw member from GET /group/{id} */
interface RawMember {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  authLevel: number;
  emailAddress: string;
}

/** Raw response from GET /groupSearch */
interface RawGroupSearchResponse {
  groupAllowed: RawGroup[];
}

/** A group summary returned to developers */
export interface GroupData {
  id: number;
  name: string;
  description: string;
  membersCount: number;
  enabled: boolean;
  children: number[];
  parentIds: number[];
}

/** A group member */
export interface GroupMember {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  userLevel: string;
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

/** A mutable group object. Modify properties and call save() to persist. */
export class Group {
  readonly id: number;
  name: string;
  description: string;
  enabled: boolean;
  emailAddress: string;
  readonly members: GroupMember[];
  readonly children: number[];

  private readonly _httpClient!: HttpClient;
  private _rawData!: RawGroup;
  private _addedMemberIds!: Set<number>;
  private _removedMemberIds!: Set<number>;

  constructor(raw: RawGroup, httpClient: HttpClient) {
    this.id = raw.id;
    this.name = raw.name;
    this.description = raw.description ?? '';
    this.enabled = raw.enabled;
    this.emailAddress = raw.emailAddress ?? '';
    this.children = raw.children;
    this.members = (raw.members ?? []).map((m) => ({
      id: m.id,
      username: m.username,
      firstName: m.firstName,
      lastName: m.lastName,
      emailAddress: m.emailAddress,
      userLevel: AUTH_LEVEL_MAP[m.authLevel] ?? `unknown (${m.authLevel})`,
    }));
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw as RawGroup, enumerable: false, writable: true });
    Object.defineProperty(this, '_addedMemberIds', { value: new Set(), enumerable: false, writable: true });
    Object.defineProperty(this, '_removedMemberIds', { value: new Set(), enumerable: false, writable: true });
  }

  /** Adds users to this group by ID. Takes effect on save(). */
  addMembers(userIds: number[]): void {
    for (const userId of userIds) {
      if (this.members.some((m) => m.id === userId) && !this._removedMemberIds.has(userId)) {
        continue;
      }
      this._removedMemberIds.delete(userId);
      this._addedMemberIds.add(userId);
    }
  }

  /** Removes users from this group by ID. Takes effect on save(). */
  removeMembers(userIds: number[]): void {
    for (const userId of userIds) {
      this._addedMemberIds.delete(userId);
      this._removedMemberIds.add(userId);
    }
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    // Start from existing raw members
    let rawMembers = [...(this._rawData.members ?? [])];

    // Remove members
    if (this._removedMemberIds.size > 0) {
      rawMembers = rawMembers.filter((m) => !this._removedMemberIds.has(m.id));
    }

    // Add new members — resolve user IDs to full objects
    if (this._addedMemberIds.size > 0) {
      const newMembers = await Promise.all(
        Array.from(this._addedMemberIds).map(async (userId) => {
          const user = await this._httpClient.request<UserDTO>({
            method: 'GET',
            path: `/user/${userId}`,
          });
          return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            authLevel: user.authLevel ?? 2,
            emailAddress: user.emailAddress,
            enabled: true,
            accountLocked: false,
          };
        }),
      );
      rawMembers.push(...newMembers as unknown as RawMember[]);
    }

    if (rawMembers.length === 0) {
      throw new Error('A group must have at least one member');
    }

    const updated = {
      ...this._rawData,
      name: this.name,
      description: this.description,
      enabled: this.enabled,
      emailAddress: this.emailAddress,
      members: rawMembers,
      defaultPreviewChannel: String(this._rawData.defaultPreviewChannel ?? '0'),
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/group/${this.id}`,
      body: updated,
    });

    this._rawData = updated as unknown as RawGroup;
    this._addedMemberIds.clear();
    this._removedMemberIds.clear();

    // Rebuild the public members array from the saved raw members
    (this as { members: GroupMember[] }).members = rawMembers.map((m) => ({
      id: m.id,
      username: m.username,
      firstName: m.firstName,
      lastName: m.lastName,
      emailAddress: m.emailAddress,
      userLevel: AUTH_LEVEL_MAP[m.authLevel] ?? `unknown (${m.authLevel})`,
    }));
  }
}

/**
 * Resource for group operations.
 */
export class GroupResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Lists all groups (flat, with children and parentIds). */
  async list(): Promise<GroupData[]> {
    const raw = await this.httpClient.request<RawGroupSearchResponse>({
      method: 'GET',
      path: '/groupSearch',
    });

    const groups = raw.groupAllowed ?? [];

    // Deduplicate by ID (the API returns child groups as top-level entries too)
    const groupMap = new Map<number, RawGroup>();
    for (const g of groups) {
      groupMap.set(g.id, g);
    }

    // Build parent lookup: for each group, find which groups list it as a child
    const parentMap = new Map<number, number[]>();
    for (const g of groupMap.values()) {
      for (const childId of g.children) {
        const parents = parentMap.get(childId) ?? [];
        parents.push(g.id);
        parentMap.set(childId, parents);
      }
    }

    return Array.from(groupMap.values()).map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? '',
      membersCount: g.membersCount,
      enabled: g.enabled,
      children: g.children,
      parentIds: parentMap.get(g.id) ?? [],
    }));
  }

  /** Gets a single group by ID with full member details. */
  async get(id: number): Promise<Group> {
    const raw = await this.httpClient.request<RawGroup>({
      method: 'GET',
      path: `/group/${id}`,
    });
    return new Group(raw, this.httpClient);
  }

  /** Updates a group's properties (immutable pattern). */
  async update(id: number, data: {
    name?: string;
    description?: string;
    enabled?: boolean;
    emailAddress?: string;
  }): Promise<Group> {
    const group = await this.get(id);
    if (data.name !== undefined) group.name = data.name;
    if (data.description !== undefined) group.description = data.description;
    if (data.enabled !== undefined) group.enabled = data.enabled;
    if (data.emailAddress !== undefined) group.emailAddress = data.emailAddress;
    await group.save();
    return group;
  }

  /** Deletes a group by ID. */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/group/${id}`,
    });
  }

  /** Creates a new group. Members are specified by user ID. */
  async create(data: {
    name: string;
    description?: string;
    emailAddress?: string;
    members: number[];
    enabled?: boolean;
  }): Promise<Group> {
    if (!data.name?.trim()) {
      throw new Error('Group name is required');
    }
    if (!data.members?.length) {
      throw new Error('A group must have at least one member');
    }

    // Resolve member IDs to full user objects
    const resolvedMembers = await Promise.all(
      data.members.map(async (userId) => {
        const user = await this.httpClient.request<{
          id: number; username: string; firstName: string; lastName: string;
          authLevel?: number; emailAddress: string;
        }>({
          method: 'GET',
          path: `/user/${userId}`,
        });
        return {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          authLevel: user.authLevel ?? 2,
          emailAddress: user.emailAddress,
          enabled: true,
          accountLocked: false,
        };
      }),
    );

    const raw = await this.httpClient.request<RawGroup>({
      method: 'POST',
      path: '/group',
      body: {
        name: data.name,
        description: data.description ?? '',
        emailAddress: data.emailAddress ?? '',
        members: resolvedMembers,
        defaultPreviewChannel: '0',
        children: [],
        enabled: data.enabled ?? true,
      },
    });

    return new Group(raw, this.httpClient);
  }
}
