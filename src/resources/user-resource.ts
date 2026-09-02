import { HttpClient } from '../http-client.js';
import { parseElementKey, AUTH_LEVEL_MAP, AUTH_LEVEL_REVERSE, debugWarn } from '../utils.js';

/** Symbol used to restrict _initCustomFields() access to UserResource.get() in this module */
const INIT_CUSTOM_FIELDS = Symbol('User.initCustomFields');

/** Maps auth method IDs to friendly names */
const AUTH_METHOD_MAP: Record<number, string> = {
  1: 'local',
  2: 'ldap',
  4: 'saml',
  5: 'cas',
  6: 'remoteuser',
};

const AUTH_METHOD_REVERSE: Record<string, number> = {
  'local': 1,
  'ldap': 2,
  'saml': 4,
  'cas': 5,
  'remoteuser': 6,
};

/** Auth methods that never have an identifier */
const NO_IDENTIFIER_METHODS = new Set(['local', 'remoteuser']);

/** Raw user from the API */
interface RawUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  authLevel: number;
  emailAddress: string;
  enabled: boolean;
  accountLocked: boolean;
  lastLoginDate?: number;
}

/** Raw response from GET /userSearch */
interface RawUserSearchResponse {
  userList: RawUser[];
}

/** A user returned to developers */
export interface UserData {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  userLevel: string;
  enabled: boolean;
  accountLocked: boolean;
  /** When the user last logged in. `null` if they have never logged in (or T4 version doesn't track it). */
  lastLogin: Date | null;
}

function mapUser(raw: RawUser): UserData {
  return {
    id: raw.id,
    username: raw.username,
    firstName: raw.firstName,
    lastName: raw.lastName,
    emailAddress: raw.emailAddress,
    userLevel: AUTH_LEVEL_MAP[raw.authLevel] ?? `unknown (${raw.authLevel})`,
    enabled: raw.enabled,
    accountLocked: raw.accountLocked,
    lastLogin: raw.lastLoginDate ? new Date(raw.lastLoginDate) : null,
  };
}

/** Raw user detail from GET /user/{id} */
interface RawUserDetail {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  userLevel: number;
  defaultLanguage?: string;
  enabled: boolean;
  lastLoginDate?: number;
  groupUser?: Array<{ id: number; name: string }>;
  authenticationMappingList?: Array<{ id: number; identifier?: string; enabled?: boolean }>;
  [key: string]: unknown;
}

/** A group the user belongs to */
export interface UserGroup {
  id: number;
  name: string;
}

/** Auth method entry — true/false for simple enable/disable, or object with identifier */
export type AuthMethodValue = boolean | { enabled: boolean; identifier: string };

/** Auth methods on a user */
export interface AuthMethods {
  local?: boolean;
  ldap?: AuthMethodValue;
  saml?: AuthMethodValue;
  cas?: AuthMethodValue;
  remoteuser?: boolean;
}

/** Raw extensible object DTO on user */
interface RawExtensibleObjectDto {
  id: number;
  contentTypeID: number;
  elements: Record<string, unknown>;
  [key: string]: unknown;
}

/** Content type template element */
interface TemplateElement {
  id: number;
  name: string;
  alias?: string;
  type: number;
}

/**
 * Converts the raw authenticationMappingList to a friendly AuthMethods object.
 */
function parseAuthMethods(list: Array<{ id: number; identifier?: string; enabled?: boolean }> | undefined): AuthMethods {
  const result: AuthMethods = {};
  if (!list) return result;

  for (const entry of list) {
    const name = AUTH_METHOD_MAP[entry.id];
    if (!name) continue;

    if (NO_IDENTIFIER_METHODS.has(name)) {
      // local and remoteuser: just a boolean
      (result as Record<string, unknown>)[name] = entry.enabled ?? false;
    } else {
      // ldap, saml, cas: object with enabled + identifier
      if (entry.enabled || entry.identifier) {
        (result as Record<string, unknown>)[name] = {
          enabled: entry.enabled ?? false,
          identifier: entry.identifier ?? '',
        };
      } else {
        (result as Record<string, unknown>)[name] = false;
      }
    }
  }

  return result;
}

/**
 * Converts a friendly AuthMethods object back to the API's authenticationMappingList.
 */
function buildAuthMappingList(authMethods: AuthMethods): Array<{ id: string; identifier?: string }> {
  const result: Array<{ id: string; identifier?: string }> = [];

  for (const [name, value] of Object.entries(authMethods)) {
    const id = AUTH_METHOD_REVERSE[name];
    if (id === undefined) continue;

    if (value === false || value === undefined) {
      // Disabled — omit from the list entirely
      continue;
    } else if (value === true) {
      // Enabled, no identifier (local/remoteuser)
      result.push({ id: String(id) });
    } else if (typeof value === 'object') {
      if (!value.enabled) continue; // Disabled — omit
      // Enabled with identifier (ldap/saml/cas)
      const entry: { id: string; identifier?: string } = { id: String(id) };
      if (value.identifier) entry.identifier = value.identifier;
      result.push(entry);
    }
  }

  return result;
}

/** A mutable user object. Modify properties and call save() to persist. */
export class User {
  readonly id: number;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  userLevel: string;
  defaultLanguage: string;
  enabled: boolean;
  /** Set to change the user's password. Leave undefined to keep unchanged. */
  password?: string;
  readonly groups: UserGroup[];
  /** Authentication methods configured for this user. */
  authMethods: AuthMethods;
  /** When the user last logged in. `null` if they have never logged in (or T4 version doesn't track it). */
  readonly lastLogin: Date | null;
  /** Custom fields from the user extensible object. Only present when configured. */
  customFields!: Record<string, unknown> | null;

  private readonly _httpClient!: HttpClient;
  private _rawData!: RawUserDetail;
  private _customFieldKeyMap!: Map<string, string> | null;

  constructor(raw: RawUserDetail, httpClient: HttpClient) {
    this.id = raw.id;
    this.username = raw.username;
    this.firstName = raw.firstName;
    this.lastName = raw.lastName;
    this.emailAddress = raw.emailAddress;
    this.userLevel = AUTH_LEVEL_MAP[raw.userLevel] ?? `unknown (${raw.userLevel})`;
    this.defaultLanguage = raw.defaultLanguage ?? 'en';
    this.enabled = raw.enabled;
    this.groups = (raw.groupUser ?? []).map((g) => ({ id: g.id, name: g.name }));
    this.authMethods = parseAuthMethods(raw.authenticationMappingList);
    this.lastLogin = raw.lastLoginDate ? new Date(raw.lastLoginDate) : null;
    // customFields starts as null and non-enumerable; _initCustomFields makes it enumerable if configured
    Object.defineProperty(this, 'customFields', { value: null, enumerable: false, writable: true, configurable: true });
    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw as RawUserDetail, enumerable: false, writable: true });
    Object.defineProperty(this, '_customFieldKeyMap', { value: null, enumerable: false, writable: true });
  }

  /** @internal Async initialization for custom fields. Only callable via UserResource.get(). */
  async [INIT_CUSTOM_FIELDS](): Promise<void> {
    const dto = this._rawData.userExtensibleObjectDto as RawExtensibleObjectDto | undefined;
    if (!dto?.elements) return;

    // Fetch the content type template to get aliases
    let templateElements: TemplateElement[] = [];
    try {
      const ct = await this._httpClient.request<{ contentTypeElements: TemplateElement[] }>({
        method: 'GET',
        path: `/contenttype/${dto.contentTypeID}`,
      });
      templateElements = ct.contentTypeElements ?? [];
    } catch (error) {
      debugWarn(`Failed to fetch user custom fields template (contentTypeID: ${dto.contentTypeID})`, error);
    }

    this.customFields = {};
    this._customFieldKeyMap = new Map();

    for (const [rawKey, value] of Object.entries(dto.elements)) {
      const parsed = parseElementKey(rawKey);
      if (!parsed) continue;
      if (parsed.name.toLowerCase() === 'name') continue;

      const templateEl = templateElements.find((el) => el.name === parsed.name);
      const friendlyName = templateEl?.alias || parsed.name;
      this.customFields[friendlyName] = value;
      this._customFieldKeyMap.set(friendlyName.toLowerCase(), rawKey);
    }

    // Make customFields enumerable now that it has values
    Object.defineProperty(this, 'customFields', { value: this.customFields, enumerable: true, writable: true, configurable: true });
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    if (!this.username?.trim()) throw new Error('Username is required');
    if (!this.firstName?.trim()) throw new Error('First name is required');
    if (!this.lastName?.trim()) throw new Error('Last name is required');
    if (!this.emailAddress?.trim()) throw new Error('Email address is required');

    const authLevel = AUTH_LEVEL_REVERSE[this.userLevel];
    if (authLevel === undefined) {
      const valid = Object.keys(AUTH_LEVEL_REVERSE).join(', ');
      throw new Error(`Unknown user level "${this.userLevel}". Valid options: ${valid}`);
    }

    const updated = {
      ...this._rawData,
      username: this.username,
      firstName: this.firstName,
      lastName: this.lastName,
      emailAddress: this.emailAddress,
      userLevel: String(authLevel),
      defaultLanguage: this.defaultLanguage,
      enabled: this.enabled,
      password: this.password ?? '',
      authenticationMappingList: buildAuthMappingList(this.authMethods),
    } as Record<string, unknown>;

    // Sync custom fields back to the extensible object DTO
    if (this.customFields && this._customFieldKeyMap) {
      const dto = updated.userExtensibleObjectDto as RawExtensibleObjectDto | undefined;
      if (dto?.elements) {
        for (const [friendlyName, value] of Object.entries(this.customFields)) {
          const rawKey = this._customFieldKeyMap.get(friendlyName.toLowerCase());
          if (rawKey) {
            dto.elements[rawKey] = value;
          }
        }
      }
    }

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/user/${this.id}`,
      body: updated,
    });

    this._rawData = updated as RawUserDetail;
  }
}

/**
 * Resource for user operations.
 */
export class UserResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Lists users. Optionally filter by user level. */
  async list(options?: { userLevel?: string }): Promise<UserData[]> {
    let authLevel = 100; // all users
    if (options?.userLevel) {
      const level = AUTH_LEVEL_REVERSE[options.userLevel];
      if (level === undefined) {
        const valid = Object.keys(AUTH_LEVEL_REVERSE).join(', ');
        throw new Error(`Unknown user level "${options.userLevel}". Valid options: ${valid}`);
      }
      authLevel = level;
    }

    const raw = await this.httpClient.request<RawUserSearchResponse>({
      method: 'GET',
      path: `/userSearch?authLevel=${authLevel}&allUsers=true`,
    });

    return (raw.userList ?? []).map(mapUser);
  }

  /** Gets a single user by ID. Returns a mutable User object. */
  async get(id: number): Promise<User> {
    const raw = await this.httpClient.request<RawUserDetail>({
      method: 'GET',
      path: `/user/${id}`,
    });
    const user = new User(raw, this.httpClient);
    await user[INIT_CUSTOM_FIELDS]();
    return user;
  }

  /** Updates a user's properties (immutable pattern). */
  async update(id: number, data: {
    username?: string;
    firstName?: string;
    lastName?: string;
    emailAddress?: string;
    userLevel?: string;
    defaultLanguage?: string;
    enabled?: boolean;
    password?: string;
    authMethods?: AuthMethods;
    customFields?: Record<string, unknown>;
  }): Promise<User> {
    const user = await this.get(id);
    if (data.username !== undefined) user.username = data.username;
    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.emailAddress !== undefined) user.emailAddress = data.emailAddress;
    if (data.userLevel !== undefined) user.userLevel = data.userLevel;
    if (data.defaultLanguage !== undefined) user.defaultLanguage = data.defaultLanguage;
    if (data.enabled !== undefined) user.enabled = data.enabled;
    if (data.password !== undefined) user.password = data.password;
    if (data.authMethods !== undefined) Object.assign(user.authMethods, data.authMethods);
    if (data.customFields !== undefined && user.customFields) {
      Object.assign(user.customFields, data.customFields);
    }
    await user.save();
    return user;
  }

  /** Creates a new user. */
  async create(data: {
    username: string;
    firstName: string;
    lastName: string;
    emailAddress: string;
    password: string;
    userLevel?: string;
    defaultLanguage?: string;
    enabled?: boolean;
    authMethods?: AuthMethods;
  }): Promise<User> {
    if (!data.username?.trim()) throw new Error('Username is required');
    if (!data.firstName?.trim()) throw new Error('First name is required');
    if (!data.lastName?.trim()) throw new Error('Last name is required');
    if (!data.emailAddress?.trim()) throw new Error('Email address is required');
    if (!data.password?.trim()) throw new Error('Password is required');

    const level = AUTH_LEVEL_REVERSE[data.userLevel ?? 'contributor'];
    if (level === undefined) {
      const valid = Object.keys(AUTH_LEVEL_REVERSE).join(', ');
      throw new Error(`Unknown user level "${data.userLevel}". Valid options: ${valid}`);
    }

    // Default to local auth only if no authMethods provided
    const authMethods = data.authMethods ?? { local: true };
    const authMappingList = buildAuthMappingList(authMethods);

    await this.httpClient.request<RawUserDetail>({
      method: 'POST',
      path: '/user',
      body: {
        username: data.username,
        firstName: data.firstName,
        lastName: data.lastName,
        emailAddress: data.emailAddress,
        password: data.password,
        userLevel: String(level),
        defaultLanguage: data.defaultLanguage ?? 'en',
        enabled: data.enabled ?? true,
        defaultPreviewChannel: '0',
        extranetAccess: 'A',
        htmlEditor: '5',
        assignedChannelsList: [],
        authenticationMappingList: authMappingList,
      },
    });

    // API returns id: 0 on create — look up the real user by username
    const allUsers = await this.httpClient.request<RawUserSearchResponse>({
      method: 'GET',
      path: '/userSearch?authLevel=100&allUsers=true',
    });
    const created = (allUsers.userList ?? []).find((u) => u.username === data.username);
    if (!created) {
      throw new Error(`User "${data.username}" was created but could not be found`);
    }

    return this.get(created.id);
  }

  /** Deletes a user by ID. */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/user/${id}`,
    });
  }
}
