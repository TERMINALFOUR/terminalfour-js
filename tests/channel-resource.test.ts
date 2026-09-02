import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelResource, Channel } from '../src/resources/channel-resource.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const rawChannels = [
  {
    id: 3,
    name: 'Example Channel',
    description: 'Test Description',
    rootSectionID: 8331,
    pendingVersionOutputDir: '/dev/null/',
    hasPendingVersion: true,
    editable: true,
    microSites: [],
  },
  {
    id: 1,
    name: 'Sample Site',
    description: 'The channel to output the standard sample site',
    rootSectionID: 233,
    pendingVersionOutputDir: '',
    hasPendingVersion: false,
    editable: true,
    microSites: [
      {
        id: 6,
        name: 'Microsite Test',
        description: '',
        rootSectionID: 8337,
        pendingVersionOutputDir: '',
        hasPendingVersion: false,
        editable: true,
        microSites: [],
        parentID: 1,
      },
    ],
  },
];

const rawDetail = {
  id: 1,
  name: 'Sample Site',
  description: 'The channel to output the standard sample site',
  type: 'text/html',
  defaultLanguage: 'en',
  rootSectionID: 233,
  fileOutputPath: '/web/stage/htdocs/',
  indexFileName: 'index.php',
  baseHref: 'https://example.com',
  siteRoot: '/',
  channelPublishURL: 'https://example.com',
  fullTextType: 'text/fulltext',
  fullTextExtension: 'php',
  languages: [
    { code: 'en', name: 'English', charset: 'ISO-8859-15' },
  ],
  microSites: [{ id: 6, name: 'Microsite Test' }],
  permittedFileExtensions: [
    { channelID: 1, extension: 'xml', priority: 1 },
    { channelID: 1, extension: 'php', priority: 0 },
    { channelID: 1, extension: 'json', priority: 2 },
  ],
};

describe('ChannelResource', () => {
  let http: HttpClient;
  let resource: ChannelResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new ChannelResource(http);
  });

  describe('list()', () => {
    it('calls GET /channel', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawChannels);
      await resource.list();
      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
      expect(callArgs.path).toBe('/channel');
    });

    it('returns mapped channel summaries', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawChannels);
      const channels = await resource.list();
      expect(channels).toHaveLength(2);
      expect(channels[0]).toEqual({
        id: 3, name: 'Example Channel', description: 'Test Description',
        rootSectionId: 8331,
      });
      expect(channels[0].microSites).toBeUndefined();
    });

    it('maps microSites with parentId when present', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawChannels);
      const channels = await resource.list();
      expect(channels[1].microSites).toHaveLength(1);
      expect(channels[1].microSites![0]).toEqual({
        id: 6, name: 'Microsite Test', description: '',
        rootSectionId: 8337, parentId: 1,
      });
    });

    it('returns empty array when no channels', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
      const channels = await resource.list();
      expect(channels).toEqual([]);
    });
  });

  describe('get()', () => {
    it('calls GET /channel/{id}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawDetail);
      await resource.get(1);
      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
      expect(callArgs.path).toBe('/channel/1');
    });

    it('returns a Channel instance', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawDetail);
      const channel = await resource.get(1);
      expect(channel).toBeInstanceOf(Channel);
    });

    it('maps fields correctly', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawDetail);
      const channel = await resource.get(1);
      expect(channel.id).toBe(1);
      expect(channel.name).toBe('Sample Site');
      expect(channel.defaultLayout).toBe('text/html');
      expect(channel.defaultLanguage).toBe('en');
      expect(channel.rootSectionId).toBe(233);
      expect(channel.publishUrl).toBe('https://example.com');
      expect(channel.defaultFullTextLayout).toBe('text/fulltext');
      expect(channel.fullTextExtension).toBe('php');
    });

    it('maps languages', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawDetail);
      const channel = await resource.get(1);
      expect(channel.languages).toEqual([
        { code: 'en', name: 'English', charset: 'ISO-8859-15' },
      ]);
    });

    it('sorts file extensions by priority', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawDetail);
      const channel = await resource.get(1);
      expect(channel.fileExtensions).toEqual(['php', 'xml', 'json']);
    });

    it('omits microSites when empty', async () => {
      const detailNoMicrosites = { ...rawDetail, microSites: [] };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(detailNoMicrosites);
      const channel = await resource.get(1);
      expect(channel.microSites).toBeUndefined();
    });

    it('includes microSites when present', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(rawDetail);
      const channel = await resource.get(1);
      expect(channel.microSites).toEqual([{ id: 6, name: 'Microsite Test' }]);
    });
  });

  describe('Channel.publish()', () => {
    it('posts to /task/repository with correct body', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/channel/1') return rawDetail;
        if (opts.method === 'POST' && opts.path === '/task/repository') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const channel = await resource.get(1);
      await channel.publish();

      expect(postBody).toEqual({
        taskType: 'channelPublish',
        channel: 1,
        sections: [233],
        branch: true,
        publishCompleteChannel: true,
        publishOptions: {
          publishArchiveSections: false,
          overridePublishPeriodRestriction: false,
        },
        taskLevel: 'channel',
        selectedLanguage: 'en',
      });
    });

    it('uses channel defaultLanguage', async () => {
      const frenchDetail = { ...rawDetail, defaultLanguage: 'fr' };
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET') return frenchDetail;
        if (opts.method === 'POST') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected`);
      });

      const channel = await resource.get(1);
      await channel.publish();
      expect((postBody as Record<string, unknown>).selectedLanguage).toBe('fr');
    });

    it('uses language override when provided', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET') return rawDetail;
        if (opts.method === 'POST') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected`);
      });

      const channel = await resource.get(1);
      await channel.publish({ language: 'de' });
      expect((postBody as Record<string, unknown>).selectedLanguage).toBe('de');
    });

    it('sets includeArchives when passed', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET') return rawDetail;
        if (opts.method === 'POST') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected`);
      });

      const channel = await resource.get(1);
      await channel.publish({ includeArchives: true });
      const body = postBody as { publishOptions: { publishArchiveSections: boolean } };
      expect(body.publishOptions.publishArchiveSections).toBe(true);
    });

    it('sets overridePublishPeriodRestriction when passed', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET') return rawDetail;
        if (opts.method === 'POST') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected`);
      });

      const channel = await resource.get(1);
      await channel.publish({ overridePublishPeriodRestriction: true });
      const body = postBody as { publishOptions: { overridePublishPeriodRestriction: boolean } };
      expect(body.publishOptions.overridePublishPeriodRestriction).toBe(true);
    });
  });
});
