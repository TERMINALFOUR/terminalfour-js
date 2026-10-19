import { describe, it, expect, vi, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
  copyFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { buildUserAgent, SDK_PRODUCT, UNKNOWN_VERSION } from '../src/version.js';

describe('buildUserAgent', () => {
  it('returns the SDK product token with version when no identifier is given', () => {
    expect(buildUserAgent('1.2.0')).toBe('Terminalfour-JS-SDK/1.2.0');
  });

  it('uses the SDK_PRODUCT constant as the product token', () => {
    expect(buildUserAgent('9.9.9')).toBe(`${SDK_PRODUCT}/9.9.9`);
  });

  it('prepends a custom identifier before the SDK token, separated by a single space', () => {
    expect(buildUserAgent('1.2.0', 'MyCustomApplication/1.0.1')).toBe(
      'MyCustomApplication/1.0.1 Terminalfour-JS-SDK/1.2.0',
    );
  });

  it('ignores an undefined identifier', () => {
    expect(buildUserAgent('1.2.0', undefined)).toBe('Terminalfour-JS-SDK/1.2.0');
  });

  it('ignores an empty-string identifier', () => {
    expect(buildUserAgent('1.2.0', '')).toBe('Terminalfour-JS-SDK/1.2.0');
  });

  it('ignores a whitespace-only identifier', () => {
    expect(buildUserAgent('1.2.0', '   ')).toBe('Terminalfour-JS-SDK/1.2.0');
  });

  it('trims surrounding whitespace from the identifier', () => {
    expect(buildUserAgent('1.2.0', '  MyApp/2.0  ')).toBe(
      'MyApp/2.0 Terminalfour-JS-SDK/1.2.0',
    );
  });
});

describe('getSdkVersion', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns the baked-in SDK_VERSION from the generated module', async () => {
    vi.resetModules();
    vi.doMock('../src/generated-version.js', () => ({ SDK_VERSION: '4.5.6' }));
    const { getSdkVersion } = await import('../src/version.js');
    expect(getSdkVersion()).toBe('4.5.6');
    vi.doUnmock('../src/generated-version.js');
  });

  it('falls back to UNKNOWN_VERSION when the baked-in value is empty', async () => {
    vi.resetModules();
    vi.doMock('../src/generated-version.js', () => ({ SDK_VERSION: '' }));
    const { getSdkVersion } = await import('../src/version.js');
    expect(getSdkVersion()).toBe(UNKNOWN_VERSION);
    vi.doUnmock('../src/generated-version.js');
  });

  it('matches the version in package.json (the baked-in value is in sync)', async () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    const { getSdkVersion } = await import('../src/version.js');
    expect(getSdkVersion()).toBe(pkg.version);
  });
});

describe('generate-version script', () => {
  const created: string[] = [];
  const scriptPath = new URL('../scripts/generate-version.mjs', import.meta.url).pathname;

  afterEach(() => {
    for (const dir of created.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempPackage(version: unknown): string {
    const root = mkdtempSync(join(tmpdir(), 't4-genver-'));
    created.push(root);
    mkdirSync(join(root, 'src'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    copyFileSync(scriptPath, join(root, 'scripts', 'generate-version.mjs'));
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: '@terminalfour/terminalfour-js', version }),
    );
    return root;
  }

  it('writes src/generated-version.ts exporting SDK_VERSION from package.json', () => {
    const root = tempPackage('3.1.4');
    execFileSync('node', [join(root, 'scripts', 'generate-version.mjs')]);
    const generated = readFileSync(join(root, 'src', 'generated-version.ts'), 'utf8');
    expect(generated).toContain("export const SDK_VERSION = '3.1.4';");
  });

  it('throws when package.json has no valid version', () => {
    const root = tempPackage(undefined);
    expect(() =>
      execFileSync('node', [join(root, 'scripts', 'generate-version.mjs')], {
        stdio: 'pipe',
      }),
    ).toThrow();
  });
});
