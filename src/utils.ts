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
