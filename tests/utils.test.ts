import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { resolveLanguage, toTimestamp, decodeHtmlEntities, debugWarn, invalidateAllCaches, parseFileSize, normaliseBaseUrl, assertNotBrowser } from '../src/utils.js';

describe('resolveLanguage', () => {
  it('returns override when provided', () => {
    expect(resolveLanguage('fr', 'de')).toBe('fr');
  });

  it('returns defaultLang when no override', () => {
    expect(resolveLanguage(undefined, 'de')).toBe('de');
  });

  it('returns "en" when neither provided', () => {
    expect(resolveLanguage(undefined, undefined)).toBe('en');
  });

  it('override takes precedence over defaultLang', () => {
    expect(resolveLanguage('ja', 'de')).toBe('ja');
  });
});

describe('assertNotBrowser', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  function simulateBrowser() {
    (globalThis as { window?: unknown }).window = { document: {} };
  }

  it('does nothing in a Node-like environment', () => {
    expect(() => assertNotBrowser()).not.toThrow();
  });

  it('throws when window and window.document are present', () => {
    simulateBrowser();
    expect(() => assertNotBrowser()).toThrow(/cannot be used in a browser/);
  });

  it('explains the risk and the recommended alternative', () => {
    simulateBrowser();
    expect(() => assertNotBrowser()).toThrow(/full-privilege credential/);
    expect(() => assertNotBrowser()).toThrow(/server you control/);
  });

  it('does not throw when window exists without a document (e.g. worker runtimes)', () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => assertNotBrowser()).not.toThrow();
  });
});

describe('normaliseBaseUrl', () => {
  it('returns an https URL unchanged', () => {
    expect(normaliseBaseUrl('https://mysite.edu/terminalfour/rs'))
      .toBe('https://mysite.edu/terminalfour/rs');
  });

  it('strips a single trailing slash', () => {
    expect(normaliseBaseUrl('https://mysite.edu/terminalfour/rs/'))
      .toBe('https://mysite.edu/terminalfour/rs');
  });

  it('strips multiple trailing slashes', () => {
    expect(normaliseBaseUrl('https://mysite.edu/terminalfour/rs///'))
      .toBe('https://mysite.edu/terminalfour/rs');
  });

  it('preserves a port and path', () => {
    expect(normaliseBaseUrl('https://localhost:8443/terminalfour/rs/'))
      .toBe('https://localhost:8443/terminalfour/rs');
  });

  it('throws for a non-absolute URL', () => {
    expect(() => normaliseBaseUrl('mysite.edu/terminalfour/rs'))
      .toThrow(/not a valid absolute URL/);
  });

  it('throws for a non-http protocol', () => {
    expect(() => normaliseBaseUrl('ftp://mysite.edu/terminalfour/rs'))
      .toThrow(/must use http or https/);
  });

  it('warns but does not throw for http', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = normaliseBaseUrl('http://localhost:8080/terminalfour/rs/');
    expect(result).toBe('http://localhost:8080/terminalfour/rs');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cleartext'));
    warn.mockRestore();
  });

  it('does not warn for https', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    normaliseBaseUrl('https://mysite.edu/terminalfour/rs');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});


describe('toTimestamp', () => {
  it('converts Date to ms timestamp', () => {
    const d = new Date('2025-07-01T00:00:00Z');
    expect(toTimestamp(d)).toBe(d.getTime());
  });

  it('passes through numeric timestamps', () => {
    expect(toTimestamp(1751328000000)).toBe(1751328000000);
  });

  it('converts date string to ms timestamp', () => {
    const ts = toTimestamp('2025-07-01T00:00:00Z');
    expect(ts).toBe(new Date('2025-07-01T00:00:00Z').getTime());
  });

  it('returns null for null', () => {
    expect(toTimestamp(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toTimestamp(undefined)).toBeNull();
  });

  it('returns null for invalid date string', () => {
    expect(toTimestamp('not-a-date')).toBeNull();
  });
});


describe('decodeHtmlEntities', () => {
  it('decodes hex entities', () => {
    expect(decodeHtmlEntities('hello&#x2F;world')).toBe('hello/world');
    expect(decodeHtmlEntities('it&#x27;s')).toBe("it's");
  });

  it('decodes named entities', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot;')).toBe('& < > "');
    expect(decodeHtmlEntities('Home &raquo; Blog')).toBe('Home » Blog');
  });

  it('decodes decimal entities', () => {
    expect(decodeHtmlEntities('&#39;hello&#47;')).toBe("'hello/");
  });

  it('leaves unknown entities as-is', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
  });

  it('handles strings with no entities', () => {
    expect(decodeHtmlEntities('plain text')).toBe('plain text');
  });
});


describe('debugWarn', () => {
  afterEach(() => {
    delete process.env.T4_DEBUG;
    vi.restoreAllMocks();
  });

  it('logs warning when T4_DEBUG=1', () => {
    process.env.T4_DEBUG = '1';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugWarn('test message');
    expect(spy).toHaveBeenCalledWith('[T4 SDK] test message');
  });

  it('includes error detail when provided', () => {
    process.env.T4_DEBUG = '1';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugWarn('something failed', new Error('connection refused'));
    expect(spy).toHaveBeenCalledWith('[T4 SDK] something failed: connection refused');
  });

  it('does not log when T4_DEBUG is not set', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugWarn('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not log when T4_DEBUG is "0"', () => {
    process.env.T4_DEBUG = '0';
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugWarn('should not appear');
    expect(spy).not.toHaveBeenCalled();
  });
});


describe('TtlMap', () => {
  // Import dynamically to avoid hoisting issues
  let TtlMap: typeof import('../src/utils.js').TtlMap;

  beforeAll(async () => {
    TtlMap = (await import('../src/utils.js')).TtlMap;
  });

  it('stores and retrieves values', () => {
    const map = new TtlMap<string, number>(60000);
    map.set('a', 1);
    expect(map.get('a')).toBe(1);
  });

  it('returns undefined for missing keys', () => {
    const map = new TtlMap<string, number>(60000);
    expect(map.get('missing')).toBeUndefined();
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    const map = new TtlMap<string, number>(100);
    map.set('a', 1);
    expect(map.get('a')).toBe(1);

    vi.advanceTimersByTime(101);
    expect(map.get('a')).toBeUndefined();
    vi.useRealTimers();
  });

  it('clear() removes all entries', () => {
    const map = new TtlMap<string, number>(60000);
    map.set('a', 1);
    map.set('b', 2);
    map.clear();
    expect(map.get('a')).toBeUndefined();
    expect(map.get('b')).toBeUndefined();
  });
});

describe('TtlValue', () => {
  let TtlValue: typeof import('../src/utils.js').TtlValue;

  beforeAll(async () => {
    TtlValue = (await import('../src/utils.js')).TtlValue;
  });

  it('stores and retrieves a value', () => {
    const val = new TtlValue<string>(60000);
    val.set('hello');
    expect(val.get()).toBe('hello');
  });

  it('returns undefined when empty', () => {
    const val = new TtlValue<string>(60000);
    expect(val.get()).toBeUndefined();
  });

  it('expires after TTL', () => {
    vi.useFakeTimers();
    const val = new TtlValue<string>(100);
    val.set('hello');
    expect(val.get()).toBe('hello');

    vi.advanceTimersByTime(101);
    expect(val.get()).toBeUndefined();
    vi.useRealTimers();
  });

  it('clear() removes the value', () => {
    const val = new TtlValue<string>(60000);
    val.set('hello');
    val.clear();
    expect(val.get()).toBeUndefined();
  });
});


describe('invalidateAllCaches (cache epoch)', () => {
  let TtlMap: typeof import('../src/utils.js').TtlMap;
  let TtlValue: typeof import('../src/utils.js').TtlValue;

  beforeAll(async () => {
    const utils = await import('../src/utils.js');
    TtlMap = utils.TtlMap;
    TtlValue = utils.TtlValue;
  });

  it('TtlMap entries are stale after invalidateAllCaches()', () => {
    const map = new TtlMap<string, number>(60000);
    map.set('a', 1);
    expect(map.get('a')).toBe(1);

    invalidateAllCaches();
    expect(map.get('a')).toBeUndefined();
  });

  it('TtlMap entries set after invalidation are valid', () => {
    invalidateAllCaches();
    const map = new TtlMap<string, number>(60000);
    map.set('a', 1);
    expect(map.get('a')).toBe(1);
  });

  it('TtlValue entries are stale after invalidateAllCaches()', () => {
    const val = new TtlValue<string>(60000);
    val.set('hello');
    expect(val.get()).toBe('hello');

    invalidateAllCaches();
    expect(val.get()).toBeUndefined();
  });

  it('TtlValue entries set after invalidation are valid', () => {
    invalidateAllCaches();
    const val = new TtlValue<string>(60000);
    val.set('hello');
    expect(val.get()).toBe('hello');
  });

  it('multiple invalidations keep working', () => {
    const map = new TtlMap<string, number>(60000);
    map.set('a', 1);
    invalidateAllCaches();
    expect(map.get('a')).toBeUndefined();

    map.set('b', 2);
    expect(map.get('b')).toBe(2);

    invalidateAllCaches();
    expect(map.get('b')).toBeUndefined();

    map.set('c', 3);
    expect(map.get('c')).toBe(3);
  });
});


describe('parseFileSize', () => {
  it('parses KB to bytes', () => {
    expect(parseFileSize('2 KB')).toBe(2048);
    expect(parseFileSize('2KB')).toBe(2048);
    expect(parseFileSize('1.5 KB')).toBe(1536);
  });

  it('parses MB to bytes', () => {
    expect(parseFileSize('5 MB')).toBe(5 * 1024 * 1024);
    expect(parseFileSize('2.5MB')).toBe(Math.round(2.5 * 1024 * 1024));
  });

  it('parses B to bytes', () => {
    expect(parseFileSize('512 B')).toBe(512);
    expect(parseFileSize('512B')).toBe(512);
  });

  it('parses GB to bytes', () => {
    expect(parseFileSize('1 GB')).toBe(1024 * 1024 * 1024);
  });

  it('treats bare numbers as bytes', () => {
    expect(parseFileSize('2048')).toBe(2048);
  });

  it('passes through numeric input', () => {
    expect(parseFileSize(1024)).toBe(1024);
  });

  it('returns 0 for null/undefined/empty', () => {
    expect(parseFileSize(null)).toBe(0);
    expect(parseFileSize(undefined)).toBe(0);
    expect(parseFileSize('')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(parseFileSize('2 kb')).toBe(2048);
    expect(parseFileSize('5 Mb')).toBe(5 * 1024 * 1024);
  });
});
