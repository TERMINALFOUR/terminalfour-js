import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Product token identifying this SDK in the User-Agent header. */
export const SDK_PRODUCT = 'Terminalfour-JS-SDK';

/** Version string used when package.json cannot be read. */
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
 * Resolves this package's version from its package.json.
 *
 * Reads package.json at runtime so the version stays in sync with releases
 * without manual updating. The file is located by walking up from the current
 * module's directory (the compiled file lives at `dist/<esm|cjs>/version.js`,
 * so package.json is at the package root above `dist`). Falls back to
 * `UNKNOWN_VERSION` if the file cannot be found or parsed, so the User-Agent
 * header is always present.
 */
export function resolveSdkVersion(moduleDir: string, levelsUp = 5): string {
  let dir = moduleDir;
  for (let i = 0; i <= levelsUp; i++) {
    const version = readVersionAt(join(dir, 'package.json'));
    if (version) return version;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return UNKNOWN_VERSION;
}

function readVersionAt(packageJsonPath: string): string | null {
  try {
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { name?: string; version?: string };
    if (parsed.name === '@terminalfour/terminalfour-js' && typeof parsed.version === 'string') {
      return parsed.version;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the directory of this compiled module in a way that works under
 * both the ESM and CommonJS builds.
 *
 * - CommonJS output: `__dirname` is defined and used directly.
 * - ESM output: `__dirname` is not defined, so the directory is derived from
 *   `import.meta.url`.
 *
 * The `import.meta.url` access is read through `getImportMetaUrl()`, which is
 * stripped by the CommonJS compile (see note there), so neither branch
 * references a construct invalid for its target. Falls back to the current
 * working directory if neither source is available.
 */
export function sdkModuleDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  const metaUrl = getImportMetaUrl();
  if (metaUrl) {
    return dirname(fileURLToPath(metaUrl));
  }
  return process.cwd();
}

/**
 * Returns `import.meta.url` for the ESM build, or `undefined` otherwise.
 *
 * `import.meta` is only valid syntax under an ES module target, so the CommonJS
 * compile (`module: "CommonJS"`) rejects a literal `import.meta` reference even
 * as dead code. It is therefore read through an indirect `eval` so the token
 * never appears in the compiled source — the CJS build never evaluates it
 * (guarded by `__dirname` in `sdkModuleDir()`), and the ESM runtime resolves it
 * to the real module URL. Any failure (e.g. a bundler that disallows eval)
 * degrades to `undefined`, and `sdkModuleDir()` falls back to `process.cwd()`.
 */
function getImportMetaUrl(): string | undefined {
  try {
    const indirectEval = eval;
    return indirectEval('import.meta.url') as string;
  } catch {
    return undefined;
  }
}
