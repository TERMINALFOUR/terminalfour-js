import { SDK_VERSION } from './generated-version.js';

/** Product token identifying this SDK in the User-Agent header. */
export const SDK_PRODUCT = 'Terminalfour-JS-SDK';

/** Version string used when the baked-in version is somehow unavailable. */
export const UNKNOWN_VERSION = 'unknown';

/**
 * Builds the SDK User-Agent string.
 *
 * The SDK's own product token (`Terminalfour-JS-SDK/<version>`) is always
 * present. An optional caller-supplied identifier is **prepended** before it,
 * separated by a single space, following the RFC 9110 convention of
 * whitespace-separated product tokens. The caller's application identity leads
 * so that, in server logs, the application making the request is read first and
 * the SDK ("how" it's making the request) second. Blank or whitespace-only
 * values are ignored so only the SDK default remains.
 */
export function buildUserAgent(version: string, prefix?: string): string {
  const base = `${SDK_PRODUCT}/${version}`;
  const trimmed = prefix?.trim();
  return trimmed ? `${trimmed} ${base}` : base;
}

/**
 * Returns the SDK version.
 *
 * The version is baked in at build time from package.json (see
 * `scripts/generate-version.mjs` and `generated-version.ts`), so it is always
 * present regardless of how the SDK is consumed — including when it is bundled
 * into another application, where a runtime read of package.json would fail
 * (issue #38). Falls back to `UNKNOWN_VERSION` only if the baked-in value is
 * somehow empty, so the User-Agent header is always present.
 */
export function getSdkVersion(): string {
  return SDK_VERSION && SDK_VERSION.length > 0 ? SDK_VERSION : UNKNOWN_VERSION;
}
