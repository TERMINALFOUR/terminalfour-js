import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { resolveLanguage, toTimestamp, decodeHtmlEntities, debugWarn, invalidateAllCaches, parseFileSize, normaliseBaseUrl, assertNotBrowser, readPrimaryGroup, readSharedGroups, writePrimaryGroup, writeSharedGroups, assertGroupsValid, assertRequired, assertNotEmptyIfPresent, parseDuplicatedSectionId, defaultMaxSizeForType, DEFAULT_MAX_SIZE, extractMaxLength, assertMaxLength, ValidationRuleSet } from '../src/utils.js';

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

describe('group mapping helpers', () => {
  describe('readPrimaryGroup', () => {
    it('reads a direct id', () => {
      expect(readPrimaryGroup({ id: 42 })).toBe(42);
    });

    it('prefers the nested group.id when present', () => {
      expect(readPrimaryGroup({ id: 5, group: { id: 99 } })).toBe(99);
    });

    it('returns 0 for null id', () => {
      expect(readPrimaryGroup({ id: null })).toBe(0);
    });

    it('returns 0 when undefined', () => {
      expect(readPrimaryGroup(undefined)).toBe(0);
    });
  });

  describe('readSharedGroups', () => {
    it('maps an array of { id } to ids', () => {
      expect(readSharedGroups([{ id: 1 }, { id: 2 }, { id: 3 }])).toEqual([1, 2, 3]);
    });

    it('returns an empty array when undefined', () => {
      expect(readSharedGroups(undefined)).toEqual([]);
    });

    it('returns an empty array for an empty array', () => {
      expect(readSharedGroups([])).toEqual([]);
    });
  });

  describe('writePrimaryGroup', () => {
    it('wraps a positive id', () => {
      expect(writePrimaryGroup(42)).toEqual({ id: 42 });
    });

    it('maps 0 to null (no primary group)', () => {
      expect(writePrimaryGroup(0)).toEqual({ id: null });
    });
  });

  describe('writeSharedGroups', () => {
    it('maps ids to an array of { id }', () => {
      expect(writeSharedGroups([1, 2])).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('returns an empty array when undefined', () => {
      expect(writeSharedGroups(undefined)).toEqual([]);
    });

    it('returns an empty array for an empty array', () => {
      expect(writeSharedGroups([])).toEqual([]);
    });
  });
});

describe('assertGroupsValid', () => {
  it('does nothing when sharedGroups does not contain primaryGroup', () => {
    expect(() => assertGroupsValid(35, [34, 40])).not.toThrow();
  });

  it('does nothing when there is no primary group (0)', () => {
    expect(() => assertGroupsValid(0, [34, 40])).not.toThrow();
    expect(() => assertGroupsValid(0, [0])).not.toThrow();
  });

  it('does nothing when sharedGroups is empty or undefined', () => {
    expect(() => assertGroupsValid(35, [])).not.toThrow();
    expect(() => assertGroupsValid(35, undefined)).not.toThrow();
  });

  it('throws when sharedGroups contains the primaryGroup id', () => {
    expect(() => assertGroupsValid(35, [34, 35])).toThrow(
      'sharedGroups cannot contain the primaryGroup id (35)',
    );
  });

  it('mentions both fields in the error message', () => {
    expect(() => assertGroupsValid(7, [7])).toThrow(/primary \(owning\) group and a shared group/);
  });
});

describe('assertRequired', () => {
  it('passes for a non-empty string', () => {
    expect(() => assertRequired('Hello', 'Name')).not.toThrow();
  });

  it('throws "<label> is required" for undefined', () => {
    expect(() => assertRequired(undefined, 'Name')).toThrow('Name is required');
  });

  it('throws for null', () => {
    expect(() => assertRequired(null, 'Layout name')).toThrow('Layout name is required');
  });

  it('throws for an empty string', () => {
    expect(() => assertRequired('', 'Section name')).toThrow('Section name is required');
  });

  it('throws for a whitespace-only string', () => {
    expect(() => assertRequired('   ', 'Group name')).toThrow('Group name is required');
  });
});

describe('assertNotEmptyIfPresent', () => {
  it('passes when the value is omitted (undefined)', () => {
    expect(() => assertNotEmptyIfPresent(undefined, 'Name')).not.toThrow();
  });

  it('passes when the value is null', () => {
    expect(() => assertNotEmptyIfPresent(null, 'Name')).not.toThrow();
  });

  it('passes for a non-empty string', () => {
    expect(() => assertNotEmptyIfPresent('Hello', 'Name')).not.toThrow();
  });

  it('throws "<label> cannot be empty" for an empty string', () => {
    expect(() => assertNotEmptyIfPresent('', 'Section name')).toThrow('Section name cannot be empty');
  });

  it('throws for a whitespace-only string', () => {
    expect(() => assertNotEmptyIfPresent('   ', 'Content name')).toThrow('Content name cannot be empty');
  });
});

describe('parseDuplicatedSectionId', () => {
  const successBody = [
    'Home>>samplesite.terminalfour.com>>Home>>Doc Example',
    'Duplicated section id: 8822',
    'Updating Server Side Links...',
    'Server Side Links updated successfully',
    'DUPLICATE_BRANCH_SUCCESS',
  ].join('\n');

  it('extracts the new section id from a successful duplicate log', () => {
    expect(parseDuplicatedSectionId(successBody)).toBe(8822);
  });

  it('tolerates varied spacing after the colon', () => {
    const body = 'Duplicated section id:12345\nDUPLICATE_BRANCH_SUCCESS';
    expect(parseDuplicatedSectionId(body)).toBe(12345);
  });

  it('throws when the success marker is absent (partial/failed response)', () => {
    const body = 'Home>>...\nDuplicated section id: 8822\nUpdating Server Side Links...';
    expect(() => parseDuplicatedSectionId(body)).toThrow(/did not report success/);
  });

  it('throws when success but no id line is present', () => {
    const body = 'Updating Server Side Links...\nDUPLICATE_BRANCH_SUCCESS';
    expect(() => parseDuplicatedSectionId(body)).toThrow(/new section ID could not be determined/);
  });

  it('handles a non-string body by coercing to string', () => {
    expect(() => parseDuplicatedSectionId(null)).toThrow(/did not report success/);
    expect(() => parseDuplicatedSectionId(undefined)).toThrow(/did not report success/);
  });

  it('requires the marker on the LAST non-empty line, not just anywhere (issue 11)', () => {
    // A content path/name containing the marker text must NOT be a false positive
    // when the real terminal line is an error.
    const body = [
      'Home>>A section named DUPLICATE_BRANCH_SUCCESS',
      'ERROR: destination is invalid',
      'DUPLICATE_BRANCH_ERROR',
    ].join('\n');
    expect(() => parseDuplicatedSectionId(body)).toThrow(/did not report success/);
  });

  it('surfaces the ERROR: line (end of response) in the failure message (issue 5)', () => {
    const body = [
      'Home>>samplesite>>Doc',
      'Home>>samplesite>>Doc>>Child',
      'ERROR: parent section is read-only',
      'DUPLICATE_BRANCH_ERROR',
    ].join('\n');
    expect(() => parseDuplicatedSectionId(body)).toThrow(/ERROR: parent section is read-only/);
  });

  it('accepts a trailing blank line after the success marker', () => {
    const body = successBody + '\n\n';
    expect(parseDuplicatedSectionId(body)).toBe(8822);
  });
});

describe('defaultMaxSizeForType', () => {
  it('returns 240 for Plain Text (type 1)', () => {
    expect(defaultMaxSizeForType(1)).toBe(240);
  });

  it('returns 10000 for Image (type 2)', () => {
    expect(defaultMaxSizeForType(2)).toBe(10000);
  });

  it('returns 5000 for HTML (type 3)', () => {
    expect(defaultMaxSizeForType(3)).toBe(5000);
  });

  it('returns 10000 for File (type 4)', () => {
    expect(defaultMaxSizeForType(4)).toBe(10000);
  });

  it('falls back to 80 for every other type', () => {
    expect(defaultMaxSizeForType(5)).toBe(80);   // Date
    expect(defaultMaxSizeForType(7)).toBe(80);   // Select Box
    expect(defaultMaxSizeForType(13)).toBe(80);  // Whole Number
    expect(defaultMaxSizeForType(19)).toBe(80);  // Repeater
  });

  it('falls back to 80 for an unknown type id', () => {
    expect(defaultMaxSizeForType(999)).toBe(80);
    expect(defaultMaxSizeForType(0)).toBe(80);
  });

  it('exposes the fallback default as DEFAULT_MAX_SIZE (80)', () => {
    expect(DEFAULT_MAX_SIZE).toBe(80);
  });
});

describe('extractMaxLength', () => {
  const contentTypeRules: ValidationRuleSet = {
    name: [{ msgTemplate: 'notBlank', required: true }, { msgTemplate: 'maxLength', maxLength: 100 }],
    description: [{ msgTemplate: 'maxLength', maxLength: 200, required: false }],
  };

  it('returns the maxLength of a field with a maxLength rule', () => {
    expect(extractMaxLength(contentTypeRules, 'name')).toBe(100);
    expect(extractMaxLength(contentTypeRules, 'description')).toBe(200);
  });

  it('returns undefined when the field is absent', () => {
    expect(extractMaxLength(contentTypeRules, 'nope')).toBeUndefined();
  });

  it('returns undefined when the field has no maxLength rule', () => {
    expect(extractMaxLength({ name: [{ msgTemplate: 'notBlank', required: true }] }, 'name')).toBeUndefined();
  });

  it('returns undefined when the rule set is undefined', () => {
    expect(extractMaxLength(undefined, 'name')).toBeUndefined();
  });

  it('returns undefined when maxLength is not a positive number', () => {
    expect(extractMaxLength({ name: [{ msgTemplate: 'maxLength', maxLength: 0 }] }, 'name')).toBeUndefined();
    expect(extractMaxLength({ name: [{ msgTemplate: 'maxLength' }] }, 'name')).toBeUndefined();
  });

  it('returns undefined when the field value is not an array', () => {
    expect(extractMaxLength({ name: 'oops' } as unknown as ValidationRuleSet, 'name')).toBeUndefined();
  });
});

describe('assertMaxLength', () => {
  it('passes when the value is within the limit', () => {
    expect(() => assertMaxLength('a'.repeat(100), 100, 'Content type name')).not.toThrow();
  });

  it('throws when the value exceeds the limit, reporting length and max', () => {
    expect(() => assertMaxLength('a'.repeat(201), 200, 'Content type description'))
      .toThrow('Content type description is too long (201 characters). The maximum is 200.');
  });

  it('measures length in JS string units (UTF-16 code units), not code points', () => {
    // '😀' is one code point but two UTF-16 units, so 100 of them = 200 units.
    expect(() => assertMaxLength('😀'.repeat(100), 200, 'X')).not.toThrow();
    expect(() => assertMaxLength('😀'.repeat(101), 200, 'X')).toThrow('is too long (202 characters)');
  });

  it('no-ops when max is undefined (no known limit)', () => {
    expect(() => assertMaxLength('a'.repeat(10000), undefined, 'X')).not.toThrow();
  });

  it('no-ops for empty, null or undefined values', () => {
    expect(() => assertMaxLength('', 5, 'X')).not.toThrow();
    expect(() => assertMaxLength(null, 5, 'X')).not.toThrow();
    expect(() => assertMaxLength(undefined, 5, 'X')).not.toThrow();
  });
});
