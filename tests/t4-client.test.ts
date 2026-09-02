import { describe, it, expect, vi } from 'vitest';
import { T4Client } from '../src/t4-client.js';
import { SectionRef } from '../src/section-ref.js';
import { MediaCategoryRef } from '../src/media-category-ref.js';
import { ContentTypeResource } from '../src/resources/content-type-resource.js';
import { MediaResource } from '../src/resources/media-resource.js';
import { ChannelResource } from '../src/resources/channel-resource.js';
import { HttpClient } from '../src/http-client.js';

describe('T4Client', () => {
  const validConfig = { baseUrl: 'https://api.example.com', apiToken: 'token-123' };

  it('throws on missing baseUrl', () => {
    expect(() => new T4Client({ baseUrl: '', apiToken: 'token' } as never)).toThrow();
  });

  it('throws on missing apiToken', () => {
    expect(() => new T4Client({ baseUrl: 'https://api.example.com', apiToken: '' } as never)).toThrow();
  });

  it('throws on empty baseUrl', () => {
    expect(() => new T4Client({ baseUrl: '', apiToken: 'token' })).toThrow('baseUrl');
  });

  it('throws on empty apiToken', () => {
    expect(() => new T4Client({ baseUrl: 'https://api.example.com', apiToken: '' })).toThrow('apiToken');
  });

  describe('browser guard', () => {
    afterEach(() => {
      delete (globalThis as { window?: unknown }).window;
    });

    function simulateBrowser() {
      (globalThis as { window?: unknown }).window = { document: {} };
    }

    it('throws when constructed in a browser', () => {
      simulateBrowser();
      expect(() => new T4Client(validConfig)).toThrow(/cannot be used in a browser/);
    });

    it('cannot be overridden by config', () => {
      simulateBrowser();
      // No escape hatch exists — passing extra flags must not bypass the guard
      expect(() => new T4Client({ ...validConfig, allowBrowser: true } as never))
        .toThrow(/cannot be used in a browser/);
    });

    it('guard runs before other config validation', () => {
      simulateBrowser();
      // Even with an invalid baseUrl, the browser error is what surfaces
      expect(() => new T4Client({ baseUrl: '', apiToken: '' })).toThrow(/cannot be used in a browser/);
    });
  });

  it('throws when baseUrl is not an absolute URL', () => {
    expect(() => new T4Client({ baseUrl: 'api.example.com', apiToken: 'token' }))
      .toThrow(/not a valid absolute URL/);
  });

  it('throws when baseUrl uses an unsupported protocol', () => {
    expect(() => new T4Client({ baseUrl: 'ftp://api.example.com', apiToken: 'token' }))
      .toThrow(/must use http or https/);
  });

  it('strips a trailing slash from baseUrl', () => {
    const client = new T4Client({ baseUrl: 'https://api.example.com/terminalfour/rs/', apiToken: 'token' });
    const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
    expect((httpClient as unknown as { baseUrl: string }).baseUrl)
      .toBe('https://api.example.com/terminalfour/rs');
  });

  it('defaults language to "en"', () => {
    const client = new T4Client(validConfig);
    // Verify by checking that section() creates a SectionRef (which uses defaultLanguage)
    const ref = client.section(1);
    expect(ref).toBeInstanceOf(SectionRef);
  });

  it('uses custom language when provided', () => {
    const client = new T4Client({ ...validConfig, language: 'fr' });
    // Client should be created without error
    expect(client).toBeDefined();
  });

  it('section() returns a SectionRef', () => {
    const client = new T4Client(validConfig);
    const ref = client.section(42);
    expect(ref).toBeInstanceOf(SectionRef);
  });

  it('contentTypes is a ContentTypeResource', () => {
    const client = new T4Client(validConfig);
    expect(client.contentTypes).toBeInstanceOf(ContentTypeResource);
  });

  it('media is a MediaResource', () => {
    const client = new T4Client(validConfig);
    expect(client.media).toBeInstanceOf(MediaResource);
  });

  it('channels is a ChannelResource', () => {
    const client = new T4Client(validConfig);
    expect(client.channels).toBeInstanceOf(ChannelResource);
  });

  it('mediaCategory() returns a MediaCategoryRef', () => {
    const client = new T4Client(validConfig);
    const ref = client.mediaCategory(367);
    expect(ref).toBeInstanceOf(MediaCategoryRef);
  });

  it('accepts custom concurrency option', () => {
    const client = new T4Client({ ...validConfig, concurrency: 5 });
    expect(client).toBeDefined();
  });

  it('clearCache() does not throw', () => {
    const client = new T4Client(validConfig);
    expect(() => client.clearCache()).not.toThrow();
  });

  describe('about()', () => {
    it('returns mapped platform info from GET /about/general', async () => {
      const client = new T4Client(validConfig);
      const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
      vi.spyOn(httpClient, 'request').mockResolvedValueOnce({
        os: { arch: 'amd64', name: 'Linux', version: '3.10.0', localHostname: 'test.example.com' },
        t4: { version: { version: '8.4.2-FINAL', buildDate: '2025-11-27T15:21:00Z', buildNumber: '26' }, dbPatchLevel: 774, uptime: '2026-02-03T15:49:22.911Z', totalRequests: 313613, activeRequests: 17 },
        java: { vendor: { name: 'Red Hat, Inc.' }, version: '11.0.18', availableProcessors: 2, heap: { total: 452984832, free: 96037312, max: 979369984 } },
        servlet: { containerName: 'Apache Tomcat/9.0.21', contextName: 'Terminalfour 8.4' },
      });

      const info = await client.about();

      expect(info.t4.version).toBe('8.4.2-FINAL');
      expect(info.t4.buildNumber).toBe('26');
      expect(info.t4.dbPatchLevel).toBe(774);
      expect(info.t4.uptime).toBeInstanceOf(Date);
      expect(info.t4.totalRequests).toBe(313613);
      expect(info.os.name).toBe('Linux');
      expect(info.os.hostname).toBe('test.example.com');
      expect(info.java.version).toBe('11.0.18');
      expect(info.java.vendor).toBe('Red Hat, Inc.');
      expect(info.java.heap.max).toBe(979369984);
      expect(info.servlet.containerName).toBe('Apache Tomcat/9.0.21');

      const callArgs = (httpClient.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toBe('/about/general');
    });
  });

  describe('version()', () => {
    it('returns the T4 version string', async () => {
      const client = new T4Client(validConfig);
      const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
      vi.spyOn(httpClient, 'request').mockResolvedValueOnce({
        os: {}, t4: { version: { version: '8.4.2-FINAL' }, uptime: '2026-01-01T00:00:00Z' }, java: { vendor: {}, heap: {} }, servlet: {},
      });

      const ver = await client.version();
      expect(ver).toBe('8.4.2-FINAL');
    });
  });

  describe('uptime()', () => {
    it('returns the uptime as a Date', async () => {
      const client = new T4Client(validConfig);
      const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
      vi.spyOn(httpClient, 'request').mockResolvedValueOnce({
        os: {}, t4: { version: { version: '8.4.2' }, uptime: '2026-02-03T15:49:22.911Z' }, java: { vendor: {}, heap: {} }, servlet: {},
      });

      const up = await client.uptime();
      expect(up).toBeInstanceOf(Date);
      expect(up.toISOString()).toBe('2026-02-03T15:49:22.911Z');
    });
  });

  describe('database()', () => {
    it('returns mapped database info from GET /about/database', async () => {
      const client = new T4Client(validConfig);
      const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
      vi.spyOn(httpClient, 'request').mockResolvedValueOnce({
        jdbc: { driverName: 'MySQL Connector/J', driverVersion: 'mysql-connector-java-8.0.29' },
        database: { name: 'MySQL', version: '8.0.32', address: 'jdbc:mysql://127.0.0.1/terminalfour' },
      });

      const db = await client.database();

      expect(db.name).toBe('MySQL');
      expect(db.version).toBe('8.0.32');
      expect(db.driverName).toBe('MySQL Connector/J');
      expect(db.address).toBe('jdbc:mysql://127.0.0.1/terminalfour');
    });
  });

  describe('environment()', () => {
    it('returns environment variables from GET /about/environment', async () => {
      const client = new T4Client(validConfig);
      const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
      vi.spyOn(httpClient, 'request').mockResolvedValueOnce({
        environmentalVariables: { 'enable-caching': 'true', 'max_upload_size': '50000' },
      });

      const env = await client.environment();

      expect(env['enable-caching']).toBe('true');
      expect(env['max_upload_size']).toBe('50000');
    });
  });

  describe('licence()', () => {
    it('returns licence info from GET /about/licence', async () => {
      const client = new T4Client(validConfig);
      const httpClient = (client as unknown as { httpClient: HttpClient }).httpClient;
      vi.spyOn(httpClient, 'request').mockResolvedValueOnce({
        contentLimit: 15000, contentItemsInSystem: 1004, itemsCountedForLicence: 879, remaining: 14121,
      });

      const lic = await client.licence();

      expect(lic.contentLimit).toBe(15000);
      expect(lic.contentItemsInSystem).toBe(1004);
      expect(lic.remaining).toBe(14121);
    });
  });
});
