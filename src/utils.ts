/**
 * Resolves the effective language for an API request.
 *
 * Resolution order:
 * 1. Explicit per-call override
 * 2. Client-level default language
 * 3. Hardcoded fallback "en"
 */
export function resolveLanguage(override?: string, defaultLang?: string): string {
  return override ?? defaultLang ?? 'en';
}


/**
 * Converts a DateInput (Date, timestamp in ms, or date string) to a
 * millisecond timestamp suitable for the T4 API.
 * Returns null if the input is null or undefined.
 */
export function toTimestamp(value: Date | number | string | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ts = new Date(value).getTime();
    return isNaN(ts) ? null : ts;
  }
  return null;
}


const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#x2F;': '/',
  '&#39;': "'",
  '&#47;': '/',
  '&apos;': "'",
  '&raquo;': '»',
};

const ENTITY_RE = /&#x[0-9a-fA-F]+;|&#\d+;|&\w+;/g;

/**
 * Decodes HTML entities in a string.
 * Handles named entities (&amp;, &raquo;, etc.) and numeric/hex entities (&#x2F;, &#39;).
 */
export function decodeHtmlEntities(str: string): string {
  return str.replace(ENTITY_RE, (match) => {
    if (HTML_ENTITIES[match]) return HTML_ENTITIES[match];
    // Hex entity: &#xHH;
    if (match.startsWith('&#x')) {
      const code = parseInt(match.slice(3, -1), 16);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    // Decimal entity: &#DD;
    if (match.startsWith('&#')) {
      const code = parseInt(match.slice(2, -1), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    return match;
  });
}


/**
 * Formats a byte count into a human-readable string.
 * Examples: "0 B", "512 B", "15.0 KB", "5.0 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Parses a human-readable file size string into bytes.
 * Accepts: '2 KB', '5.0 MB', '512 B', '1024', etc.
 * Returns 0 for invalid/unparseable input.
 */
export function parseFileSize(input: string | number | null | undefined): number {
  if (input == null) return 0;
  if (typeof input === 'number') return input;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return 0;

  const match = trimmed.match(/^([\d.]+)\s*(b|kb|mb|gb)?$/i);
  if (!match) return 0;

  const value = parseFloat(match[1]);
  if (isNaN(value)) return 0;

  const unit = (match[2] || 'b').toLowerCase();
  switch (unit) {
    case 'b': return Math.round(value);
    case 'kb': return Math.round(value * 1024);
    case 'mb': return Math.round(value * 1024 * 1024);
    case 'gb': return Math.round(value * 1024 * 1024 * 1024);
    default: return Math.round(value);
  }
}


/**
 * Parses a T4 element key like "Title#2:1" into its parts.
 * Returns null if the key doesn't match the expected format.
 */
export function parseElementKey(key: string): { name: string; elementId: number; type: number } | null {
  const match = key.match(/^(.+)#(\d+):(\d+)$/);
  if (!match) return null;
  return { name: match[1], elementId: parseInt(match[2], 10), type: parseInt(match[3], 10) };
}


/**
 * Sensible default element max sizes keyed by T4 element type id.
 *
 * T4's own UI defaults every new element to a max size of 80, which is too
 * small for text-heavy element types and forces callers to set `maxSize`
 * explicitly just to avoid truncation. The SDK instead picks a per-type default
 * so a content type created without explicit sizes lands in a usable state:
 *
 * - Plain Text (1) → 240
 * - Image (2)      → 10000
 * - HTML (3)       → 5000
 * - File (4)       → 10000
 * - anything else  → 80 (the T4 default)
 *
 * The type ids are T4 system constants (stable across instances); the SDK
 * resolves friendly type names to these ids via `GET /type/` before applying
 * the default. Only a missing/`undefined` `maxSize` triggers a default — an
 * explicit value, including `0`, is always honoured.
 */
export const DEFAULT_MAX_SIZE_BY_TYPE: Record<number, number> = {
  1: 240,    // Plain Text
  2: 10000,  // Image
  3: 5000,   // HTML
  4: 10000,  // File
};

/** Fallback max size for element types without a type-specific default. */
export const DEFAULT_MAX_SIZE = 80;

/**
 * Returns the sensible default max size for a given element type id.
 * Falls back to {@link DEFAULT_MAX_SIZE} (80) for any unlisted type.
 */
export function defaultMaxSizeForType(typeId: number): number {
  return DEFAULT_MAX_SIZE_BY_TYPE[typeId] ?? DEFAULT_MAX_SIZE;
}


/**
 * Maps T4 status codes to friendly strings.
 * Sections use 0–2; content and media also use 3 (draft).
 */
export const STATUS_MAP: Record<number, string> = {
  0: 'approved',
  1: 'pending',
  2: 'inactive',
  3: 'draft',
};

/**
 * Converts a numeric T4 status code to a friendly string.
 */
export function mapStatus(code: number): string {
  return STATUS_MAP[code] ?? `unknown (${code})`;
}

/**
 * Maps friendly status strings to T4 numeric status codes.
 * Sections use 0–2; content also uses 3 (draft).
 */
export const STATUS_CODES: Record<string, number> = {
  approved: 0,
  pending: 1,
  inactive: 2,
  draft: 3,
};

/**
 * Maps T4 auth level codes to friendly user level strings.
 */
export const AUTH_LEVEL_MAP: Record<number, string> = {
  0: 'admin',
  40: 'power-user',
  1: 'moderator',
  2: 'contributor',
  50: 'visitor',
};

/**
 * Maps friendly user level strings to T4 auth level codes.
 */
export const AUTH_LEVEL_REVERSE: Record<string, number> = {
  'admin': 0,
  'power-user': 40,
  'moderator': 1,
  'contributor': 2,
  'visitor': 50,
};


/**
 * Recursively flattens a hierarchical group tree into a flat Map of id → name.
 */
export function flattenGroups(
  groups: Array<{ id: number; name: string; groupChildren?: unknown[] }>,
  map: Map<number, string> = new Map(),
): Map<number, string> {
  for (const g of groups) {
    map.set(g.id, g.name);
    if (Array.isArray(g.groupChildren) && g.groupChildren.length > 0) {
      flattenGroups(g.groupChildren as Array<{ id: number; name: string; groupChildren?: unknown[] }>, map);
    }
  }
  return map;
}


/**
 * Group/visibility mapping helpers.
 *
 * The T4 API represents an asset's owning group as `primaryGroup` (an object,
 * where the id may be direct or nested under `group`) and its shared groups as
 * `sharedGroups` (an array of `{ id }`). The SDK exposes these as a plain
 * `primaryGroup: number` (0 = none) and `sharedGroups: number[]`. These helpers
 * centralise the read/write mapping so content types, lists, page layouts, and
 * navigation objects all handle groups identically.
 */

/** Raw shape of the API `primaryGroup` field. */
export interface RawPrimaryGroup {
  id: number | null;
  group?: { id: number };
}

/** Reads the API `primaryGroup` object into a plain group id (0 = none). */
export function readPrimaryGroup(raw?: RawPrimaryGroup): number {
  return raw?.group?.id ?? raw?.id ?? 0;
}

/** Reads the API `sharedGroups` array into a plain array of group ids. */
export function readSharedGroups(raw?: Array<{ id: number }>): number[] {
  return (raw ?? []).map((g) => g.id);
}

/** Writes a plain group id back to the API `primaryGroup` shape (0/falsy = none). */
export function writePrimaryGroup(id: number): { id: number | null } {
  return { id: id || null };
}

/** Writes a plain array of group ids back to the API `sharedGroups` shape. */
export function writeSharedGroups(ids?: number[]): Array<{ id: number }> {
  return (ids ?? []).map((id) => ({ id }));
}

/**
 * Validates that group/visibility values are acceptable to the T4 API before a
 * write. The API returns an opaque 500 when `sharedGroups` contains the same id
 * as `primaryGroup` (a group cannot be both the owner and a shared group), so we
 * catch it here with a clear message. A `primaryGroup` of 0 means "no owning
 * group" and is never a conflict.
 */
export function assertGroupsValid(primaryGroup: number, sharedGroups?: number[]): void {
  if (!primaryGroup) return;
  if ((sharedGroups ?? []).includes(primaryGroup)) {
    throw new Error(
      `sharedGroups cannot contain the primaryGroup id (${primaryGroup}). ` +
      'A group cannot be both the primary (owning) group and a shared group. ' +
      'Remove it from sharedGroups or choose a different primaryGroup.',
    );
  }
}

/**
 * Asserts that a required string value is present and not blank.
 *
 * Use on create paths where the field must always be provided. Throws
 * `"<Label> is required"` when the value is missing, empty, or whitespace-only.
 * Prevents opaque API 500s from malformed requests missing a required field.
 */
export function assertRequired(value: string | null | undefined, label: string): void {
  if (!value || !value.trim()) {
    throw new Error(`${label} is required`);
  }
}

/**
 * Asserts that a value, *if provided*, is not blank.
 *
 * Use on update paths where a field is optional (omitting it leaves the
 * current value unchanged) but explicitly setting it to an empty or
 * whitespace-only string is invalid. `undefined` passes (means "no change");
 * `''` or whitespace throws `"<Label> cannot be empty"`.
 */
export function assertNotEmptyIfPresent(value: string | null | undefined, label: string): void {
  if (value === undefined || value === null) return;
  if (!value.trim()) {
    throw new Error(`${label} cannot be empty`);
  }
}

/**
 * A single validation rule as returned by the T4 `GET /validationrule/{entity}`
 * endpoints. Only `maxLength` rules carry a `maxLength` value; other templates
 * (e.g. `notBlank`) omit it.
 */
export interface ValidationRule {
  msgTemplate: string;
  maxLength?: number;
  required?: boolean;
}

/**
 * A set of validation rules keyed by field name, as returned by
 * `GET /validationrule/contenttype` and `GET /validationrule/templateElement`.
 *
 * Example (`contenttype`):
 * ```json
 * {
 *   "name": [{ "msgTemplate": "notBlank", "required": true }, { "msgTemplate": "maxLength", "maxLength": 100 }],
 *   "description": [{ "msgTemplate": "maxLength", "maxLength": 200, "required": false }]
 * }
 * ```
 */
export type ValidationRuleSet = Record<string, ValidationRule[]>;

/**
 * Extracts the maximum length for a field from a validation rule set.
 *
 * Returns the `maxLength` of the field's `maxLength` rule, or `undefined` when
 * the rule set is missing, the field is absent, no `maxLength` rule exists, or
 * the value is not a positive number. A missing limit means "do not validate"
 * — callers skip the check rather than guessing a bound.
 */
export function extractMaxLength(rules: ValidationRuleSet | undefined, field: string): number | undefined {
  const fieldRules = rules?.[field];
  if (!Array.isArray(fieldRules)) return undefined;
  const rule = fieldRules.find((r) => r?.msgTemplate === 'maxLength');
  if (!rule || typeof rule.maxLength !== 'number' || rule.maxLength <= 0) return undefined;
  return rule.maxLength;
}

/**
 * Asserts that a string does not exceed a maximum length, measured in JS string
 * units (UTF-16 code units, i.e. `String.prototype.length`). This matches how
 * T4 counts: a surrogate-pair emoji such as `😀` counts as 2 units.
 *
 * No-op when `value` is absent/empty or `max` is `undefined` (no known limit).
 * Throws `"<Label> is too long (<n> characters). The maximum is <max>."` when
 * the length exceeds the limit, so the SDK rejects an over-length value with a
 * clear message instead of letting T4 fail the request with an opaque 500.
 */
export function assertMaxLength(value: string | null | undefined, max: number | undefined, label: string): void {
  if (value == null || value === '' || max === undefined) return;
  if (value.length > max) {
    throw new Error(
      `${label} is too long (${value.length} characters). The maximum is ${max}.`,
    );
  }
}


/** Accepted file input: a file path, URL, Blob, ReadableStream, or { file, filename } object */
export type FileInput = string | Blob | NodeJS.ReadableStream | { file: string | Blob | NodeJS.ReadableStream; filename?: string };

/**
 * Resolves a file input (path, URL, Blob, or ReadableStream) to a Blob.
 */
export async function resolveFileToBlob(file: string | Blob | NodeJS.ReadableStream): Promise<Blob> {
  if (file instanceof Blob) return file;

  if (typeof file === 'string') {
    if (file.startsWith('https://') || file.startsWith('http://')) {
      const response = await fetch(file);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from ${file}: ${response.status} ${response.statusText}`);
      }
      return await response.blob();
    }

    const { readFile } = await import('node:fs/promises');
    const buffer = await readFile(file);
    return new Blob([buffer]);
  }

  // ReadableStream — collect into buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of file as AsyncIterable<Buffer>) {
    chunks.push(new Uint8Array(chunk));
  }
  return new Blob(chunks as BlobPart[]);
}

/**
 * Derives a filename from a file input (path, URL, Blob, ReadableStream, or { file, filename }).
 */
export function deriveFilename(input: FileInput): string {
  if (typeof input === 'string') {
    if (input.startsWith('https://') || input.startsWith('http://')) {
      try { return new URL(input).pathname.split('/').pop() || 'file'; } catch { return 'file'; }
    }
    return input.replace(/\\/g, '/').split('/').pop() || 'file';
  }
  if (input instanceof Blob) return 'file';
  if (typeof input === 'object' && input !== null && 'file' in input) {
    return (input as { file: string | Blob | NodeJS.ReadableStream; filename?: string }).filename
      || (typeof input.file === 'string' ? deriveFilename(input.file) : 'file');
  }
  // ReadableStream — no filename derivable
  return 'file';
}


/**
 * Logs a warning message when T4_DEBUG=1 is set.
 * Used for graceful degradation paths where errors are caught and fallback
 * values are returned — the warning makes these visible during debugging.
 */
export function debugWarn(message: string, error?: unknown): void {
  if (typeof process !== 'undefined' && process.env?.T4_DEBUG === '1') {
    const detail = error instanceof Error ? error.message : error ? String(error) : '';
    console.warn(`[T4 SDK] ${message}${detail ? `: ${detail}` : ''}`);
  }
}


/**
 * Throws when running in a browser.
 *
 * The T4 API token is a full-privilege credential sent on every request. Bundling
 * it into front-end code exposes it to anyone who opens devtools, so the SDK fails
 * loudly at construction time — during development, when it's cheapest to fix —
 * rather than silently shipping a leaked credential to production.
 *
 * There is no override. Detection deliberately requires both `window` and
 * `window.document`, so genuine server-side runtimes without a DOM (Node, Deno,
 * Bun, Cloudflare Workers) are unaffected.
 */
export function assertNotBrowser(): void {
  const isBrowser = typeof window !== 'undefined'
    && typeof (window as { document?: unknown }).document !== 'undefined';

  if (!isBrowser) return;

  throw new Error(
    'T4Client cannot be used in a browser. The apiToken is a full-privilege ' +
    'credential and anything in front-end code is publicly readable, so this would ' +
    'expose it to every visitor.\n\n' +
    'Call the T4 API from a server you control (an API route, serverless function, ' +
    'or backend service) and have the browser talk to that instead.',
  );
}


/**
 * Validates and normalises a base URL.
 *
 * - Throws if the value isn't a parseable absolute URL or doesn't use http/https.
 * - Warns when the scheme is `http:`, because every request sends the API token
 *   in an `Authorization` header and plain HTTP transmits it in cleartext.
 * - Strips trailing slashes so `baseUrl + path` never produces a double slash.
 */
export function normaliseBaseUrl(baseUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error(
      `T4Client baseUrl "${baseUrl}" is not a valid absolute URL. ` +
      'Expected something like "https://mysite.edu/terminalfour/rs".',
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(
      `T4Client baseUrl must use http or https, received "${parsed.protocol}".`,
    );
  }

  if (parsed.protocol === 'http:') {
    console.warn(
      '[T4 SDK] baseUrl uses http:// — the API token will be sent in cleartext. ' +
      'Use https:// unless you are testing against a local instance.',
    );
  }

  return baseUrl.replace(/\/+$/, '');
}


/** Default cache TTL in milliseconds (5 minutes) */
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Default ceiling (ms) for a read-after-write settle wait. Content type writes
 * propagate server-side with a short delay (measured ~0.5s, varies with load),
 * so a write that resolves is not immediately readable. See issue #37.
 */
export const DEFAULT_WRITE_WAIT_TIMEOUT = 10_000;

/** Interval (ms) between settle-wait polls. */
export const WRITE_WAIT_POLL_INTERVAL = 50;

/** Resolves after `ms` milliseconds. Honours fake timers in tests. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Global cache epoch. Incremented by `invalidateAllCaches()` to force
 * all TTL-based caches to treat their entries as expired. Every cache
 * records the epoch at write time; on read, if the current epoch is
 * higher, the entry is stale regardless of its TTL.
 */
let cacheEpoch = 0;

/** Returns the current cache epoch. */
export function getCacheEpoch(): number {
  return cacheEpoch;
}

/**
 * Bumps the global cache epoch, causing all TTL-based caches to miss
 * on their next read. This is the mechanism behind `T4Client.clearCache()`.
 */
export function invalidateAllCaches(): void {
  cacheEpoch++;
}

/**
 * A Map with time-to-live expiration on entries.
 * Entries are lazily evicted on access — expired entries return undefined.
 * Respects the global cache epoch: entries written before an epoch bump are stale.
 */
export class TtlMap<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number; epoch: number }>();
  private readonly ttl: number;

  constructor(ttl: number = DEFAULT_CACHE_TTL) {
    this.ttl = ttl;
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.epoch < cacheEpoch || Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttl, epoch: cacheEpoch });
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * A single-value cache with TTL expiration.
 * Stores a promise that resolves to the cached value.
 * Respects the global cache epoch: entries written before an epoch bump are stale.
 */
export class TtlValue<V> {
  private entry: { value: V; expiresAt: number; epoch: number } | null = null;
  private readonly ttl: number;

  constructor(ttl: number = DEFAULT_CACHE_TTL) {
    this.ttl = ttl;
  }

  get(): V | undefined {
    if (!this.entry) return undefined;
    if (this.entry.epoch < cacheEpoch || Date.now() > this.entry.expiresAt) {
      this.entry = null;
      return undefined;
    }
    return this.entry.value;
  }

  set(value: V): void {
    this.entry = { value, expiresAt: Date.now() + this.ttl, epoch: cacheEpoch };
  }

  clear(): void {
    this.entry = null;
  }
}

/**
 * Minimal structural shape of the HttpClient needed by the mirror guard.
 * Declared structurally (rather than importing HttpClient) to keep utils.ts a
 * dependency-free leaf module and avoid a circular import.
 */
interface MirrorGuardClient {
  request<T>(options: { method: string; path: string }): Promise<T>;
}

/** Raw mirror-relevant fields from GET /hierarchy/{id}/{language}. */
interface MirrorSectionShape {
  mirrorOf?: number;
}

/** Per-client cache of section mirror status, keyed by section ID. */
const mirrorStatusCache = new WeakMap<
  object,
  Map<number, { mirrorOf: number | null; expiresAt: number; epoch: number }>
>();

/** Normalises a raw `mirrorOf` to the source ID, or `null` when not a mirror. */
function readMirrorOf(section: MirrorSectionShape | null | undefined): number | null {
  const value = section?.mirrorOf;
  return typeof value === 'number' && value > 0 ? value : null;
}

/**
 * Records a section's mirror status in the per-client cache. Call this from
 * paths that have already fetched the section DTO so a later content-path
 * check can reuse it without an extra request.
 */
export function cacheSectionMirrorStatus(
  client: object,
  sectionId: number,
  section: MirrorSectionShape | null | undefined,
): void {
  let perClient = mirrorStatusCache.get(client);
  if (!perClient) {
    perClient = new Map();
    mirrorStatusCache.set(client, perClient);
  }
  perClient.set(sectionId, {
    mirrorOf: readMirrorOf(section),
    expiresAt: Date.now() + DEFAULT_CACHE_TTL,
    epoch: getCacheEpoch(),
  });
}

/** Reads a cached mirror status, or `undefined` when absent/stale. */
function getCachedMirrorStatus(client: object, sectionId: number): number | null | undefined {
  const entry = mirrorStatusCache.get(client)?.get(sectionId);
  if (!entry) return undefined;
  if (entry.epoch < getCacheEpoch() || Date.now() > entry.expiresAt) {
    mirrorStatusCache.get(client)?.delete(sectionId);
    return undefined;
  }
  return entry.mirrorOf;
}

/**
 * Throws a friendly, read-only error when `section` is a mirror. For callers
 * that already hold the section DTO (section-level write paths), so no request
 * is made. Also records the status in the cache for content-path reuse.
 *
 * @param scope `'section'` for section-level edits, `'content'` for edits to
 *   content inside the section — controls the wording.
 */
export function assertSectionNotMirrored(
  client: object,
  sectionId: number,
  section: MirrorSectionShape | null | undefined,
  scope: 'section' | 'content' = 'section',
): void {
  cacheSectionMirrorStatus(client, sectionId, section);
  const mirrorOf = readMirrorOf(section);
  if (mirrorOf !== null) {
    throw mirrorError(sectionId, mirrorOf, scope);
  }
}

/**
 * Throws a friendly, read-only error when the section is a mirror, fetching the
 * section DTO (cached per client, 5-min TTL) when its status isn't already
 * known. For content write paths that don't otherwise load the section.
 */
export async function assertSectionNotMirroredCached(
  client: MirrorGuardClient,
  sectionId: number,
  language: string,
  scope: 'section' | 'content' = 'content',
): Promise<void> {
  let mirrorOf = getCachedMirrorStatus(client, sectionId);
  if (mirrorOf === undefined) {
    const section = await client.request<MirrorSectionShape>({
      method: 'GET',
      path: `/hierarchy/${sectionId}/${language}`,
    });
    cacheSectionMirrorStatus(client, sectionId, section);
    mirrorOf = readMirrorOf(section);
  }
  if (mirrorOf !== null) {
    throw mirrorError(sectionId, mirrorOf, scope);
  }
}

/** Builds the read-only mirror error. */
function mirrorError(sectionId: number, mirrorOf: number, scope: 'section' | 'content'): Error {
  if (scope === 'content') {
    return new Error(
      `Cannot modify content in section ${sectionId}: it is a mirror of section ${mirrorOf} ` +
      `and is read-only. Edit the content in the source section instead.`,
    );
  }
  return new Error(
    `Cannot modify section ${sectionId}: it is a mirror of section ${mirrorOf} ` +
    `and is read-only. Edit the source section instead.`,
  );
}

/**
 * Parses the plain-text response body returned by the section duplicate
 * endpoint (`COPY /hierarchy/{id}/{language}`) to extract the new branch's
 * root section ID.
 *
 * ⚠️ FRAGILE — depends on T4's human-readable progress log format, not a
 * structured field. The endpoint returns newline-delimited text (mislabeled
 * `application/json`): one `<section path>` line per copied section, then a
 * terminal marker line — `DUPLICATE_BRANCH_SUCCESS` on success, or an `ERROR:…`
 * line followed by `DUPLICATE_BRANCH_ERROR` on failure. The new root id is on a
 * `Duplicated section id: <n>` line. If a future T4 version changes the markers
 * or that line's wording, this parser must be updated. See API_NUANCES.
 *
 * Error reporting notes (review issues 5 & 11):
 * - The success check looks at the **last non-empty line**, not anywhere in the
 *   body — section path lines contain user-entered names, so a stray
 *   "DUPLICATE_BRANCH_SUCCESS" in a name couldn't produce a false positive, and
 *   a marker written mid-stream before a rollback wouldn't be mistaken for a
 *   committed success.
 * - On failure the error message surfaces the **end** of the response (where
 *   the real `ERROR:` line lives), not the start (which is just path lines).
 */
export function parseDuplicatedSectionId(responseBody: unknown): number {
  const text = typeof responseBody === 'string'
    ? responseBody
    : (responseBody == null ? '' : String(responseBody));

  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const lastLine = lines[lines.length - 1] ?? '';

  if (lastLine !== 'DUPLICATE_BRANCH_SUCCESS') {
    // Prefer the explicit ERROR: line if present; otherwise show the tail.
    const errorLine = [...lines].reverse().find((l) => l.startsWith('ERROR:'));
    const detail = errorLine ?? text.slice(-500);
    throw new Error(
      'Section duplication did not report success. The server response did not end with the ' +
      'expected completion marker, so the operation may have failed or been interrupted. ' +
      `Server detail: ${detail}`,
    );
  }

  const match = text.match(/Duplicated section id:\s*(\d+)/);
  if (!match) {
    throw new Error(
      'Section duplication reported success but the new section ID could not be determined ' +
      'from the server response. The duplicate likely exists; locate it under the destination section. ' +
      `Response (tail): ${text.slice(-500)}`,
    );
  }

  return parseInt(match[1], 10);
}
