/** Configuration for the T4Client */
export interface T4ClientConfig {
  /**
   * Base URL of the T4 REST API, e.g. `https://mysite.edu/terminalfour/rs`.
   * Trailing slashes are stripped. Must be an absolute http/https URL —
   * https is strongly recommended because the API token is sent as a header.
   */
  baseUrl: string;
  apiToken: string;
  language?: string;
  /** Maximum number of concurrent HTTP requests. Defaults to 10. */
  concurrency?: number;
}

/** Optional language override for per-call language selection */
export interface LanguageOption {
  language?: string;
}

/** Raw content data transfer object from the T4 API */
export interface ContentDTO {
  id: number;
  contentTypeID: number;
  name: string;
  language: string;
  status: number;
  elements: Record<string, unknown>;
  version: number;
  owner: { id: number; type: string };
  channels: number[];
  sectionIDs?: number[];
  archiveSection?: number | null;
  lastModified?: number;
  lastModifiedBy?: number;
  lastModifierName?: string;
  publishDate?: number;
  expiryDate?: number;
  reviewDate?: number;
}

/** Raw section shape from the T4 API */
export interface ApiSectionDTO {
  id: number;
  name: string;
  parent: number | null;
  show?: boolean;
  status?: number;
  path?: string;
  pathMembers?: number[];
  lastModified?: number;
  'output-uri'?: string;
  'file-name'?: string;
  archive?: boolean;
  channels?: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }>;
  inheritedPageLayouts?: Record<string, number>;
  accessControl?: { id: number; type: number; enabled: boolean; active: boolean };
  metaData?: { id: number; type: number; enabled: boolean; active: boolean };
  metaDatas?: Array<{ id: number; value: string; lang: string }>;
  userIDs?: number[];
  inheritedUserIDs?: number[];
  groupIDs?: number[];
  inheritedGroupIDs?: number[];
  contentTypeScopes?: Array<{ id: number; scope: number; inherited: boolean }>;
  [key: string]: unknown;
}

/** Content type definition */
export interface ContentTypeData {
  id: number;
  name: string;
  description: string;
  minUserLevel: string;
  workflow: number;
  sharedGroups: number[];
  primaryGroup: number;
  directEdit: boolean;
  fields: Record<string, ContentTypeFieldDef>;
}

/** Field definition within a content type */
export interface ContentTypeFieldDef {
  name: string;
  description: string;
  type: string;
  required: boolean;
  maxSize: number;
  listId: number;
  listName: string;
  shown: boolean;
  useAsFilename: boolean;
  /** HTML editor name. Only present on HTML elements with an explicit editor configured. Set to `null` to remove. */
  editor?: string | null;
  config?: {
    contentTypeId: number;
    contentTypeName: string;
    contentTypeDescription: string;
    layout: string;
    minRepeats: number;
    maxRepeats: number;
  };
}

/** A node in the site hierarchy tree */
export interface HierarchyNode {
  id: number;
  name: string;
  parentId: number | null;
  children?: HierarchyNode[];
}

/** Options for retrieving the hierarchy tree */
export interface GetTreeOptions extends LanguageOption {
  depth?: number;
}

/** Data required to add a new section */
export interface AddSectionData {
  name: string;
  parentId: number;
  /** Whether the section appears in navigation on the published site. Defaults to true. */
  show?: boolean;
  /** Section status: 'approved' | 'pending' | 'inactive'. Defaults to 'approved'. */
  status?: 'approved' | 'pending' | 'inactive';
  /** Optional custom fields for the section (e.g. { Title: "My Section Title" }). */
  customFields?: Record<string, unknown>;
}

/** A channel associated with a section (lightweight — just id and name) */
export interface SectionChannel {
  id: number;
  name: string;
}

/** Owner information for a section or content item */
export interface Owner {
  id: number;
  /** User level: 'admin', 'power-user', 'moderator', 'contributor', or 'visitor' */
  type: string;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
}

/** Accepted date input: Date object, timestamp in ms, or date string */
export type DateInput = Date | number | string;

/** Data required to create new content */
export interface CreateContentData {
  type: number;
  name: string;
  fields: Record<string, unknown>;
  /** Content status: 'draft' | 'pending' | 'approved' | 'inactive'. Defaults to 'pending'. */
  status?: 'draft' | 'pending' | 'approved' | 'inactive';
  /** Publish date. Accepts Date, timestamp (ms), or date string. */
  publishDate?: DateInput;
  /** Expiry date. Accepts Date, timestamp (ms), or date string. */
  expiryDate?: DateInput;
  /** Review date. Accepts Date, timestamp (ms), or date string. */
  reviewDate?: DateInput;
  /** Section ID where expired content is archived. */
  archiveSection?: number;
  /** Content owner user ID. Defaults to 0 (current user). */
  owner?: number;
}

/** Data required to update existing content */
export interface UpdateContentData {
  /** Updated content name. If omitted, keeps existing name. */
  name?: string;
  /** Updated fields. Only fields provided are changed; others keep existing values. */
  fields?: Record<string, unknown>;
  /** Updated status. If omitted, defaults to 'pending'. */
  status?: 'draft' | 'pending' | 'approved' | 'inactive';
  /** Publish date. Accepts Date, timestamp (ms), or date string. Pass null to clear. */
  publishDate?: DateInput | null;
  /** Expiry date. Accepts Date, timestamp (ms), or date string. Pass null to clear. */
  expiryDate?: DateInput | null;
  /** Review date. Accepts Date, timestamp (ms), or date string. Pass null to clear. */
  reviewDate?: DateInput | null;
  /** Section ID where expired content is archived. Pass null to clear. */
  archiveSection?: number | null;
  /** Content owner user ID. */
  owner?: number;
}

/** Data required to move content to another section */
export interface MoveContentData {
  sectionId: number;
}

/** Options for an HTTP request made by the internal HttpClient */
export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'MOVE' | 'APPROVE' | 'COPY';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  multipart?: boolean;
  formData?: FormData;
}
