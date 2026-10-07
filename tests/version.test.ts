import { describe, it, expect, vi, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildUserAgent,
  resolveSdkVersion,
  SDK_PRODUCT,
  UNKNOWN_VERSION,
} from '../src/version.js';

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

describe('resolveSdkVersion', () => {
  const created: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of created.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function tempRoot(): string {
    const dir = mkdtempSync(join(tmpdir(), 't4-version-'));
    created.push(dir);
    return dir;
  }

  it('reads the version from a package.json in the module directory', () => {
    const root = tempRoot();
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: '@terminalfour/terminalfour-js', version: '3.4.5' }),
    );
    expect(resolveSdkVersion(root)).toBe('3.4.5');
  });

  it('walks up parent directories to find package.json', () => {
    const root = tempRoot();
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: '@terminalfour/terminalfour-js', version: '7.0.0' }),
    );
    const nested = join(root, 'dist', 'esm');
    mkdirSync(nested, { recursive: true });
    expect(resolveSdkVersion(nested)).toBe('7.0.0');
  });

  it('skips package.json files belonging to other packages', () => {
    const root = tempRoot();
    const nested = join(root, 'dist', 'esm');
    mkdirSync(nested, { recursive: true });
    // A different package.json closer to the module should be ignored
    writeFileSync(
      join(nested, 'package.json'),
      JSON.stringify({ name: 'something-else', version: '0.0.1' }),
    );
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: '@terminalfour/terminalfour-js', version: '2.2.2' }),
    );
    expect(resolveSdkVersion(nested)).toBe('2.2.2');
  });

  it('falls back to UNKNOWN_VERSION when no package.json is found', () => {
    const root = tempRoot();
    const nested = join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    expect(resolveSdkVersion(nested, 2)).toBe(UNKNOWN_VERSION);
  });

  it('falls back to UNKNOWN_VERSION when package.json is malformed', () => {
    const root = tempRoot();
    writeFileSync(join(root, 'package.json'), '{ not valid json');
    expect(resolveSdkVersion(root, 0)).toBe(UNKNOWN_VERSION);
  });
});
