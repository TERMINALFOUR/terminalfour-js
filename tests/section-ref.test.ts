import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SectionRef } from '../src/section-ref.js';
import { SectionItem } from '../src/models/section-item.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const parentSection = {
  id: 233,
  name: 'Parent',
  parent: 100,
  channels: [{ id: 3, pageLayout: 0, inheritedPageLayout: 0 }],
  inheritedPageLayouts: { '3': 100 },
  accessControl: { id: 0, type: 38, enabled: false, active: false },
  metaData: { id: 1011, type: 75, enabled: true, active: true },
};

const createdSection = {
  id: 500,
  name: 'Child',
  parent: 233,
  channels: [{ id: 3, pageLayout: 0, inheritedPageLayout: 0 }],
};

describe('SectionRef', () => {
  let http: HttpClient;
  let ref: SectionRef;

  beforeEach(() => {
    http = mockHttpClient();
    ref = new SectionRef(http, 233, 'en');
    // Clear the static meta tag cache between tests
    (SectionRef as unknown as { metaTagCache: unknown }).metaTagCache = null;
  });

  describe('get()', () => {
    it('maps API parent field to parentId', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 233, name: 'My Section', parent: 100,
      });

      const node = await ref.get();
      expect(node.parentId).toBe(100);
      expect(node.id).toBe(233);
      expect(node.name).toBe('My Section');
    });

    it('uses language resolution', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 233, name: 'Section', parent: null,
      });

      await ref.get({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.path).toBe('/hierarchy/233/fr');
    });
  });

  describe('channels()', () => {
    it('calls GET /section/{id}/channels', async () => {
      const channels = [{ id: 1, name: 'Channel 1' }];
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(channels);

      const result = await ref.channels();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('GET');
      expect(callArgs.path).toBe('/section/233/channels');
      expect(result).toEqual(channels);
    });
  });

  describe('pageLayouts()', () => {
    // Section has channel 1 with direct layout 4692 and descendant layout 100
    // Channel 3 has no direct assignment — only inherited from parent via inheritedPageLayouts
    const sectionWithLayouts = {
      id: 233,
      name: 'Home',
      parent: 100,
      channels: [
        { id: 1, pageLayout: 4692, inheritedPageLayout: 100 },
      ],
      inheritedPageLayouts: { '1': 6, '3': 3446 },
    };

    const channelList = [
      { id: 1, name: 'Default Channel' },
      { id: 3, name: 'Preview Channel' },
    ];

    const allLayouts = [
      { id: 6, name: 'Parent Layout' },
      { id: 100, name: 'Descendant Layout' },
      { id: 3446, name: 'Preview Layout' },
      { id: 4692, name: 'Custom Layout' },
    ];

    function setupPageLayoutMocks(http: HttpClient, section = sectionWithLayouts) {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return section;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return channelList;
        if (opts.method === 'GET' && opts.path === '/pageLayout') return allLayouts;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });
    }

    it('returns direct pageLayout with inherited: false when explicitly set', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      const ch1 = result.find((r) => r.channel.id === 1)!;
      expect(ch1.pageLayout).toEqual({ id: 4692, name: 'Custom Layout', inherited: false });
    });

    it('returns inherited pageLayout with inherited: true when no direct assignment', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      const ch3 = result.find((r) => r.channel.id === 3)!;
      expect(ch3.pageLayout).toEqual({ id: 3446, name: 'Preview Layout', inherited: true });
    });

    it('returns childPageLayout from channels[].inheritedPageLayout', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      const ch1 = result.find((r) => r.channel.id === 1)!;
      expect(ch1.childPageLayout).toEqual({ id: 100, name: 'Descendant Layout' });
    });

    it('returns childPageLayout: null for channels only in inheritedPageLayouts', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      const ch3 = result.find((r) => r.channel.id === 3)!;
      expect(ch3.childPageLayout).toBeNull();
    });

    it('returns entries for channels from both channels array and inheritedPageLayouts', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      expect(result).toHaveLength(2);
      expect(result.find((r) => r.channel.id === 1)).toBeDefined();
      expect(result.find((r) => r.channel.id === 3)).toBeDefined();
    });

    it('returns full shape for a channel with direct layout and descendant layout', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      const ch1 = result.find((r) => r.channel.id === 1)!;
      expect(ch1).toEqual({
        channel: { id: 1, name: 'Default Channel' },
        pageLayout: { id: 4692, name: 'Custom Layout', inherited: false },
        childPageLayout: { id: 100, name: 'Descendant Layout' },
      });
    });

    it('returns full shape for a channel with only inherited layout', async () => {
      setupPageLayoutMocks(http);
      const result = await ref.pageLayouts();
      const ch3 = result.find((r) => r.channel.id === 3)!;
      expect(ch3).toEqual({
        channel: { id: 3, name: 'Preview Channel' },
        pageLayout: { id: 3446, name: 'Preview Layout', inherited: true },
        childPageLayout: null,
      });
    });

    it('returns pageLayout: null when no direct or inherited layout', async () => {
      const sectionNoLayout = {
        id: 233, name: 'Home', parent: 100,
        channels: [{ id: 1, pageLayout: 0, inheritedPageLayout: 0 }],
        inheritedPageLayouts: {},
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionNoLayout;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return channelList;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.pageLayouts();
      expect(result).toHaveLength(1);
      expect(result[0].pageLayout).toBeNull();
      expect(result[0].childPageLayout).toBeNull();
    });

    it('returns empty array when section has no channels and no inheritedPageLayouts', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return {
          id: 233, name: 'Home', parent: 100, channels: [], inheritedPageLayouts: {},
        };
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return [];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.pageLayouts();
      expect(result).toEqual([]);
    });

    it('handles channels only in inheritedPageLayouts (no channels array entries)', async () => {
      const sectionInheritedOnly = {
        id: 233, name: 'Home', parent: 100,
        channels: [],
        inheritedPageLayouts: { '1': 6, '3': 3446 },
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionInheritedOnly;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return channelList;
        if (opts.method === 'GET' && opts.path === '/pageLayout') return allLayouts;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.pageLayouts();
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.pageLayout?.inherited === true)).toBe(true);
      expect(result.every((r) => r.childPageLayout === null)).toBe(true);
    });

    it('falls back to generic name when channel not in channel list', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionWithLayouts;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return [];
        if (opts.method === 'GET' && opts.path === '/pageLayout') return allLayouts;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.pageLayouts();
      expect(result.find((r) => r.channel.id === 1)!.channel.name).toBe('Channel 1');
      expect(result.find((r) => r.channel.id === 3)!.channel.name).toBe('Channel 3');
    });

    it('falls back to generic name when page layout not in layout list', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionWithLayouts;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return channelList;
        if (opts.method === 'GET' && opts.path === '/pageLayout') return [];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.pageLayouts();
      expect(result.find((r) => r.channel.id === 1)!.pageLayout?.name).toBe('Page Layout 4692');
      expect(result.find((r) => r.channel.id === 3)!.pageLayout?.name).toBe('Page Layout 3446');
    });

    it('uses language override for section fetch', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/fr') return sectionWithLayouts;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return channelList;
        if (opts.method === 'GET' && opts.path === '/pageLayout') return allLayouts;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.pageLayouts({ language: 'fr' });

      const hierarchyCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path.startsWith('/hierarchy/'),
      );
      expect((hierarchyCall![0] as { path: string }).path).toBe('/hierarchy/233/fr');
    });

    it('fetches section, channels, and pageLayout list', async () => {
      setupPageLayoutMocks(http);
      await ref.pageLayouts();

      const paths = (http.request as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => (c[0] as { path: string }).path,
      );
      expect(paths).toContain('/hierarchy/233/en');
      expect(paths).toContain('/section/233/channels');
      expect(paths).toContain('/pageLayout');
    });

    it('skips pageLayout fetch when all layout IDs are 0 or absent', async () => {
      const sectionAllZero = {
        id: 233, name: 'Home', parent: 100,
        channels: [{ id: 1, pageLayout: 0, inheritedPageLayout: 0 }],
        inheritedPageLayouts: {},
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionAllZero;
        if (opts.method === 'GET' && opts.path === '/section/233/channels') return channelList;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.pageLayouts();

      const paths = (http.request as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => (c[0] as { path: string }).path,
      );
      expect(paths).not.toContain('/pageLayout');
    });
  });

  describe('setPageLayouts()', () => {
    const currentSection = {
      id: 233, name: 'Home', parent: 100, status: '0', show: true,
      channels: [
        { id: 1, pageLayout: 5, inheritedPageLayout: 10 },
        { id: 3, pageLayout: 0, inheritedPageLayout: 0 },
      ],
      inheritedPageLayouts: { '1': 6, '3': 3446 },
    };

    it('updates pageLayout on an existing channel entry', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: 99 }]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }> };
      const ch1 = body.channels.find((c) => c.id === 1)!;
      expect(ch1.pageLayout).toBe(99);
      expect(ch1.inheritedPageLayout).toBe(10); // preserved
    });

    it('updates childPageLayout on an existing channel entry', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 3, childPageLayout: 200 }]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }> };
      const ch3 = body.channels.find((c) => c.id === 3)!;
      expect(ch3.inheritedPageLayout).toBe(200);
      expect(ch3.pageLayout).toBe(0); // preserved
    });

    it('updates both pageLayout and childPageLayout at once', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: 50, childPageLayout: 60 }]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }> };
      const ch1 = body.channels.find((c) => c.id === 1)!;
      expect(ch1.pageLayout).toBe(50);
      expect(ch1.inheritedPageLayout).toBe(60);
    });

    it('clears pageLayout when null is passed', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: null }]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number }> };
      expect(body.channels.find((c) => c.id === 1)!.pageLayout).toBe(0);
    });

    it('clears childPageLayout when null is passed', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, childPageLayout: null }]);

      const body = putBody as { channels: Array<{ id: number; inheritedPageLayout: number }> };
      expect(body.channels.find((c) => c.id === 1)!.inheritedPageLayout).toBe(0);
    });

    it('adds a new channel entry when channelId is not in existing channels', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 5, pageLayout: 77 }]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }> };
      expect(body.channels).toHaveLength(3); // 2 existing + 1 new
      const ch5 = body.channels.find((c) => c.id === 5)!;
      expect(ch5.pageLayout).toBe(77);
      expect(ch5.inheritedPageLayout).toBe(0);
    });

    it('preserves other channels when updating one', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: 99 }]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }> };
      expect(body.channels).toHaveLength(2);
      const ch3 = body.channels.find((c) => c.id === 3)!;
      expect(ch3.pageLayout).toBe(0); // unchanged
      expect(ch3.inheritedPageLayout).toBe(0); // unchanged
    });

    it('updates multiple channels at once', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([
        { channelId: 1, pageLayout: 50 },
        { channelId: 3, childPageLayout: 200 },
      ]);

      const body = putBody as { channels: Array<{ id: number; pageLayout: number; inheritedPageLayout: number }> };
      expect(body.channels.find((c) => c.id === 1)!.pageLayout).toBe(50);
      expect(body.channels.find((c) => c.id === 3)!.inheritedPageLayout).toBe(200);
    });

    it('sends PUT to /hierarchy/{id}/{language}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: 99 }]);

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      expect((putCall![0] as { path: string }).path).toBe('/hierarchy/233/en');
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/fr') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/fr') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: 99 }], { language: 'fr' });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect((putCall![0] as { path: string }).path).toBe('/hierarchy/233/fr');
    });

    it('throws when empty array provided', async () => {
      await expect(ref.setPageLayouts([])).rejects.toThrow('setPageLayouts requires at least one channel entry');
    });

    it('throws when neither pageLayout nor childPageLayout provided', async () => {
      await expect(ref.setPageLayouts([{ channelId: 1 }]))
        .rejects.toThrow('channel 1 requires at least one of pageLayout or childPageLayout');
    });

    it('preserves all other section properties in the PUT body', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setPageLayouts([{ channelId: 1, pageLayout: 99 }]);

      const body = putBody as Record<string, unknown>;
      expect(body.name).toBe('Home');
      expect(body.status).toBe('0');
      expect(body.inheritedPageLayouts).toEqual({ '1': 6, '3': 3446 }); // preserved
    });
  });

  describe('owner()', () => {
    const ownerDto = { id: 30, type: 'USER' };
    const userDto = { id: 30, username: 'j.smith', firstName: 'Jane', lastName: 'Smith', emailAddress: 'jane@example.com', authLevel: 2 };

    it('fetches owner and resolves user details', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/section/233/en/owner') return ownerDto;
        if (opts.path === '/user/30') return userDto;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const result = await ref.owner();

      expect(result).toEqual({
        id: 30,
        type: 'contributor',
        username: 'j.smith',
        firstName: 'Jane',
        lastName: 'Smith',
        emailAddress: 'jane@example.com',
      });
    });

    it('uses language override for owner endpoint', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/section/233/de/owner') return ownerDto;
        if (opts.path === '/user/30') return userDto;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await ref.owner({ language: 'de' });

      const ownerCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path.includes('/owner'),
      );
      expect((ownerCall![0] as { path: string }).path).toBe('/section/233/de/owner');
    });
  });

  describe('metaDatas()', () => {
    const sectionWithMeta = {
      id: 233, name: 'Home', parent: 100,
      metaDatas: [
        { id: 19, value: 'My Title', lang: 'en' },
        { id: 12, value: 'My Description', lang: 'en' },
      ],
    };

    const metaTags = [
      { id: 19, name: 'og:title' },
      { id: 12, name: 'description' },
      { id: 14, name: 'keywords' },
    ];

    it('returns meta data with friendly tag names', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return sectionWithMeta;
        if (opts.path === '/meta') return metaTags;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const result = await ref.metaDatas();
      expect(result).toEqual({
        'og:title': 'My Title',
        'description': 'My Description',
      });
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/fr') return { ...sectionWithMeta, metaDatas: [] };
        if (opts.path === '/meta') return metaTags;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const result = await ref.metaDatas({ language: 'fr' });
      expect(result).toEqual({});
    });

    it('falls back to ID string when meta tag name not found', async () => {
      const sectionWithUnknownMeta = {
        id: 233, name: 'Home', parent: 100,
        metaDatas: [{ id: 999, value: 'Unknown', lang: 'en' }],
      };

      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return sectionWithUnknownMeta;
        if (opts.path === '/meta') return metaTags;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const result = await ref.metaDatas();
      expect(result).toEqual({ '999': 'Unknown' });
    });

    it('returns empty object when section has no metaDatas', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { id: 233, name: 'Home', parent: 100 };
        if (opts.path === '/meta') return metaTags;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const result = await ref.metaDatas();
      expect(result).toEqual({});
    });
  });

  describe('setMetaDatas()', () => {
    const sectionFull = {
      id: 233, name: 'Home', parent: 100, status: '0',
      channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
      metaDatas: [
        { id: 19, value: 'Old Title', lang: 'en' },
        { id: 12, value: 'Old Description', lang: 'en' },
      ],
    };

    const metaTags = [
      { id: 19, name: 'og:title' },
      { id: 12, name: 'description' },
      { id: 34, name: 'article:author' },
    ];

    it('updates existing meta values and preserves others', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionFull;
        if (opts.path === '/meta') return metaTags;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') {
          putBody = opts.body;
          return undefined;
        }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setMetaDatas({ 'og:title': 'New Title' });

      const body = putBody as { metaDatas: Array<{ id: number; value: string }> };
      expect(body.metaDatas).toHaveLength(2);
      expect(body.metaDatas.find((m: { id: number }) => m.id === 19)?.value).toBe('New Title');
      expect(body.metaDatas.find((m: { id: number }) => m.id === 12)?.value).toBe('Old Description');
    });

    it('adds new meta values that did not exist before', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionFull;
        if (opts.path === '/meta') return metaTags;
        if (opts.method === 'PUT') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setMetaDatas({ 'article:author': 'Jane Doe' });

      const body = putBody as { metaDatas: Array<{ id: number; value: string }> };
      expect(body.metaDatas).toHaveLength(3);
      expect(body.metaDatas.find((m: { id: number }) => m.id === 34)?.value).toBe('Jane Doe');
    });

    it('sends PUT to /hierarchy/{id}/{language}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionFull;
        if (opts.path === '/meta') return metaTags;
        if (opts.method === 'PUT') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setMetaDatas({ 'og:title': 'Test' });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const opts = putCall![0] as { method: string; path: string };
      expect(opts.path).toBe('/hierarchy/233/en');
    });

    it('throws for invalid meta tag name', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionFull;
        if (opts.path === '/meta') return metaTags;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.setMetaDatas({ 'nonexistent:tag': 'value' }))
        .rejects.toThrow('Invalid meta tag "nonexistent:tag"');
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/fr') return { ...sectionFull, metaDatas: [] };
        if (opts.path === '/meta') return metaTags;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/fr') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setMetaDatas({ 'og:title': 'Titre' }, { language: 'fr' });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect((putCall![0] as { path: string }).path).toBe('/hierarchy/233/fr');
    });
  });

  describe('addSection()', () => {
    const metaTemplate = {
      contentType: { id: 75, contentTypeElements: [
        { id: 1, name: 'Name', type: 1, sequence: 0 },
        { id: 2, name: 'Title', type: 1, sequence: 1 },
      ] },
      channels: [],
      canPublishNow: true,
      canSaveAndApprove: true,
    };

    function setupAddSectionMocks() {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        // Fetch parent section details
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return parentSection;
        // Create section
        if (opts.method === 'POST' && opts.path === '/hierarchy/en') return createdSection;
        // Metadata content creation on the new section
        if (opts.method === 'GET' && opts.path === '/content/type/75/500') return metaTemplate;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: metaTemplate.contentType.contentTypeElements };
        if (opts.method === 'POST' && opts.path === '/content/500/en') {
          const body = opts.body as { name: string; elements: Record<string, unknown> };
          return {
            id: 12481, contentTypeID: 75, name: body.name, language: 'en',
            status: 1, elements: body.elements,
            version: 1, owner: { id: 0, type: 'USER' }, channels: [],
          };
        }
        if (opts.path === '/type/') return [];
        // Fetch created child section (for the returned SectionItem)
        if (opts.method === 'GET' && opts.path === '/hierarchy/500/en') return createdSection;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });
    }

    it('fetches parent section details', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const fetchParent = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'GET' && o.path === '/hierarchy/233/en';
        },
      );
      expect(fetchParent).toBeDefined();
    });

    it('reads accessControl.type and metaData.type from parent', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: Record<string, unknown> }).body;
      expect(body.accessControlType).toBe(38);
      expect(body.metaDataType).toBe(75);
    });

    it('sends parent as string in body', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: { parent: unknown } }).body;
      expect(body.parent).toBe('233');
      expect(typeof body.parent).toBe('string');
    });

    it('defaults show to true', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: { show: boolean } }).body;
      expect(body.show).toBe(true);
    });

    it('accepts show: false', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child', show: false });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: { show: boolean } }).body;
      expect(body.show).toBe(false);
    });

    it('returns a SectionItem for the created child', async () => {
      setupAddSectionMocks();
      const child = await ref.addSection({ name: 'Child' });
      expect(child).toBeInstanceOf(SectionItem);
      expect(child.id).toBe(500);
      expect(child.name).toBe('Child');
    });

    it('defaults status to approved (0)', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: { status: string } }).body;
      expect(body.status).toBe('0');
    });

    it('accepts status: pending (1)', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child', status: 'pending' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: { status: string } }).body;
      expect(body.status).toBe('1');
    });

    it('accepts status: inactive (2)', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child', status: 'inactive' });

      const createCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/hierarchy/en';
        },
      );
      const body = (createCall![0] as { body: { status: string } }).body;
      expect(body.status).toBe('2');
    });

    it('returns customFields from metadata content when provided', async () => {
      const metaContentDTO = {
        id: -999, contentTypeID: 75, name: 'Child', language: 'en',
        status: 1, elements: { 'Name#1:1': 'Child', 'Title#2:1': 'My Section Title' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const template = {
        contentType: { id: 75, contentTypeElements: [
          { id: 1, name: 'Name', type: 1, sequence: 0 },
          { id: 2, name: 'Title', type: 1, sequence: 1 },
        ] },
        channels: [],
        canPublishNow: true,
        canSaveAndApprove: true,
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return parentSection;
        if (opts.method === 'POST' && opts.path === '/hierarchy/en') return createdSection;
        if (opts.method === 'GET' && opts.path === '/content/type/75/500') return template;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: template.contentType.contentTypeElements };
        if (opts.method === 'POST' && opts.path === '/content/500/en') return metaContentDTO;
        if (opts.method === 'GET' && opts.path === '/hierarchy/500/en') return createdSection;
        if (opts.path === '/type/') return [];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const child = await ref.addSection({
        name: 'Child',
        customFields: { 'Title': 'My Section Title' },
      });

      expect(child.customFields).not.toBeNull();
      expect(child.customFields?.Title).toBe('My Section Title');
      expect(child.customFields).not.toHaveProperty('Name');
    });

    it('always creates a metadata content instance when parent has a metadata type', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const metaCreate = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/500/en';
        },
      );
      expect(metaCreate).toBeDefined();
    });

    it('sets the metadata content Name element to the section name', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'My New Section' });

      const metaCreate = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/500/en';
        },
      );
      const body = (metaCreate![0] as { body: { name: string; elements: Record<string, unknown> } }).body;
      expect(body.name).toBe('My New Section');
      expect(body.elements['Name#1:1']).toBe('My New Section');
    });

    it('leaves non-Name metadata elements blank when no customFields provided', async () => {
      setupAddSectionMocks();
      await ref.addSection({ name: 'Child' });

      const metaCreate = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/500/en';
        },
      );
      const body = (metaCreate![0] as { body: { elements: Record<string, unknown> } }).body;
      expect(body.elements['Title#2:1']).toBeUndefined();
    });

    it('returns empty customFields when no customFields provided but metadata type exists', async () => {
      setupAddSectionMocks();
      const child = await ref.addSection({ name: 'Child' });
      expect(child.customFields).toEqual({});
    });

    it('does not create metadata content when no metadata type is configured system-wide', async () => {
      const parentNoMeta = { ...parentSection, metaData: { id: 0, type: 0, enabled: false, active: false } };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return parentNoMeta;
        if (opts.method === 'POST' && opts.path === '/hierarchy/en') return createdSection;
        if (opts.method === 'GET' && opts.path === '/hierarchy/500/en') return createdSection;
        // Instance-level config: no metadata content type configured
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '0' };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const child = await ref.addSection({ name: 'Child' });

      const metaCreate = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path.startsWith('/content/');
        },
      );
      expect(metaCreate).toBeUndefined();
      expect(child.customFields).toBeNull();
    });

    it('falls back to the instance metadata type when the parent has none', async () => {
      const parentNoMeta = { ...parentSection, metaData: { id: 0, type: 0, enabled: false, active: false } };
      const template = {
        contentType: { id: 75, contentTypeElements: [
          { id: 1, name: 'Name', type: 1, sequence: 0 },
          { id: 2, name: 'Title', type: 1, sequence: 1 },
        ] },
        channels: [],
        canPublishNow: true,
        canSaveAndApprove: true,
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return parentNoMeta;
        if (opts.method === 'POST' && opts.path === '/hierarchy/en') return createdSection;
        // Instance-level config: metadata content type 75 is configured
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '75' };
        if (opts.method === 'GET' && opts.path === '/content/type/75/500') return template;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: template.contentType.contentTypeElements };
        if (opts.method === 'POST' && opts.path === '/content/500/en') {
          const body = opts.body as { name: string; elements: Record<string, unknown> };
          return { id: 12481, contentTypeID: 75, name: body.name, elements: body.elements, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        if (opts.method === 'GET' && opts.path === '/hierarchy/500/en') return createdSection;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.addSection({ name: 'Child' });

      const metaCreate = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { method: string; path: string };
          return o.method === 'POST' && o.path === '/content/500/en';
        },
      );
      expect(metaCreate).toBeDefined();
    });

    it('throws when customFields provided but no metadata type is configured system-wide', async () => {
      const parentNoMeta = { ...parentSection, metaData: { id: 0, type: 0, enabled: false, active: false } };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return parentNoMeta;
        if (opts.method === 'POST' && opts.path === '/hierarchy/en') return createdSection;
        if (opts.method === 'GET' && opts.path === '/hierarchy/500/en') return createdSection;
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '0' };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.addSection({ name: 'Child', customFields: { Title: 'X' } }))
        .rejects.toThrow('no Section Meta Data content type is configured');
    });
  });

  describe('get() with customFields', () => {
    it('fetches custom fields when metaData is enabled with content ID', async () => {
      const sectionWithMeta = {
        id: 233, name: 'Home', parent: 100,
        metaData: { id: 42, type: 75, enabled: true, active: true },
      };
      const metaContentDTO = {
        id: 42, contentTypeID: 75, name: '', language: 'en',
        status: 1, elements: { 'Title#2:1': 'Section Title' },
        version: 1, owner: { id: 0, type: 'USER' }, channels: [],
      };
      const template = {
        contentType: { id: 75, contentTypeElements: [
          { id: 1, name: 'Name', type: 1, sequence: 0 },
          { id: 2, name: 'Title', type: 1, sequence: 1 },
        ] },
        channels: [],
        canPublishNow: true,
        canSaveAndApprove: true,
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionWithMeta;
        if (opts.method === 'GET' && opts.path === '/content/233/42/en') return metaContentDTO;
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') return template;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: template.contentType.contentTypeElements };
        if (opts.path === '/type/') return [];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const section = await ref.get();
      expect(section.customFields).not.toBeNull();
      expect(section.customFields?.Title).toBe('Section Title');
    });

    it('returns null customFields when metaData is not enabled', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 233, name: 'Section', parent: null,
      });

      const section = await ref.get();
      expect(section.customFields).toBeNull();
    });

    it('returns null customFields when metaData.id is 0', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        id: 233, name: 'Section', parent: null,
        metaData: { id: 0, type: 75, enabled: true, active: true },
      });

      const section = await ref.get();
      expect(section.customFields).toBeNull();
    });

    it('returns null customFields when metadata content fetch fails', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return {
          id: 233, name: 'Section', parent: null,
          metaData: { id: 99, type: 75, enabled: true, active: true },
        };
        throw new Error('Not found');
      });

      const section = await ref.get();
      expect(section.customFields).toBeNull();
    });
  });

  describe('update()', () => {
    const currentSection = {
      id: 233, name: 'Old Name', parent: 100, status: '0', show: true,
      channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
    };

    it('fetches current section, PUTs with merged updates, and returns SectionItem', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { ...currentSection, name: putBody ? 'New Name' : 'Old Name' };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.update({ name: 'New Name' });

      const body = putBody as Record<string, unknown>;
      expect(body.name).toBe('New Name');
      expect(body.channels).toEqual(currentSection.channels); // preserved
      expect(result.id).toBe(233);
      expect(result.name).toBe('New Name');
    });

    it('updates status to pending', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET') return { ...currentSection, status: putBody ? '1' : '0' };
        if (opts.method === 'PUT') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.update({ status: 'pending' });

      expect((putBody as Record<string, unknown>).status).toBe('1');
      expect(result.status).toBe('pending');
    });

    it('updates show to false', async () => {
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET') return { ...currentSection, show: putBody ? false : true };
        if (opts.method === 'PUT') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.update({ show: false });

      expect((putBody as Record<string, unknown>).show).toBe(false);
      expect(result.show).toBe(false);
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/fr') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/fr') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.update({ name: 'Nouveau' }, { language: 'fr' });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect((putCall![0] as { path: string }).path).toBe('/hierarchy/233/fr');
    });

    it('should update existing metadata content when customFields provided', async () => {
      const sectionWithMeta = {
        id: 233, name: 'Home', parent: 100, status: '0', show: true,
        metaData: { id: 42, type: 75, enabled: true, active: true },
        channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
      };
      const template = {
        contentType: { id: 75, contentTypeElements: [
          { id: 1, name: 'Name', type: 1, sequence: 0 },
          { id: 2, name: 'Title', type: 1, sequence: 1 },
        ] },
        channels: [],
        canPublishNow: true,
        canSaveAndApprove: true,
      };
      let contentUpdated = false;
      const calls: Array<{ method: string; path: string; body?: unknown }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        calls.push(opts);
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionWithMeta;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.method === 'GET' && opts.path === '/content/233/42/en') {
          const title = contentUpdated ? 'Updated' : 'Old';
          return { id: 42, contentTypeID: 75, name: '', elements: { 'Title#2:1': title }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') return template;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: template.contentType.contentTypeElements };
        if (opts.method === 'POST' && opts.path === '/content/233/42/en') {
          contentUpdated = true;
          return { id: 42, contentTypeID: 75, name: '', elements: { 'Title#2:1': 'Updated' }, version: 2, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const result = await ref.update({ customFields: { Title: 'Updated' } });

      const contentUpdate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/42/en');
      expect(contentUpdate).toBeDefined();
      expect(result.customFields?.Title).toBe('Updated');
    });

    it('should create metadata content when metaData.id is 0 and customFields provided', async () => {
      const sectionNoContent = {
        id: 233, name: 'Home', parent: 100, status: '0', show: true,
        metaData: { id: 0, type: 75, enabled: true, active: true },
        channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
      };
      const template = {
        contentType: { id: 75, contentTypeElements: [
          { id: 1, name: 'Name', type: 1, sequence: 0 },
          { id: 2, name: 'Title', type: 1, sequence: 1 },
        ] },
        channels: [],
        canPublishNow: true,
        canSaveAndApprove: true,
      };
      let getCount = 0;
      const calls: Array<{ method: string; path: string }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        calls.push(opts);
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') {
          getCount++;
          if (getCount === 1) return sectionNoContent;
          return { ...sectionNoContent, metaData: { id: 999, type: 75, enabled: true, active: true } };
        }
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') return template;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: template.contentType.contentTypeElements };
        if (opts.method === 'POST' && opts.path === '/content/233/en') {
          return { id: 999, contentTypeID: 75, name: '', elements: { 'Title#2:1': 'New' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.method === 'GET' && opts.path === '/content/233/999/en') {
          return { id: 999, contentTypeID: 75, name: '', elements: { 'Title#2:1': 'New' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        return undefined;
      });

      const result = await ref.update({ customFields: { Title: 'New' } });

      const contentCreate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/en');
      expect(contentCreate).toBeDefined();
      expect(result.customFields?.Title).toBe('New');
    });

    it('should throw when customFields provided but no metadata type is configured system-wide', async () => {
      const sectionNoMeta = {
        id: 233, name: 'Home', parent: 100, status: '0', show: true,
        channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return sectionNoMeta;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '0' };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.update({ customFields: { Title: 'Test' } })).rejects.toThrow('Cannot update customFields');
    });

    it('falls back to the instance metadata type when the section has none', async () => {
      // Section has no metadata content yet (metaData.type 0 / id 0), but the
      // instance has a metadata content type configured. update() should create it.
      const sectionNoMeta = {
        id: 233, name: 'Home', parent: 100, status: '0', show: true,
        metaData: { id: 0, type: 0, enabled: false, active: false },
        channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
      };
      const template = {
        contentType: { id: 75, contentTypeElements: [
          { id: 1, name: 'Name', type: 1, sequence: 0 },
          { id: 2, name: 'Title', type: 1, sequence: 1 },
        ] },
        channels: [],
        canPublishNow: true,
        canSaveAndApprove: true,
      };
      let created = false;
      const calls: Array<{ method: string; path: string; body?: unknown }> = [];
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        calls.push(opts);
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') {
          return created
            ? { ...sectionNoMeta, metaData: { id: 555, type: 75, enabled: true, active: true } }
            : sectionNoMeta;
        }
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '75' };
        if (opts.method === 'GET' && opts.path === '/content/type/75/233') return template;
        if (opts.method === 'GET' && opts.path === '/contenttype/75') return { id: 75, contentTypeElements: template.contentType.contentTypeElements };
        if (opts.method === 'POST' && opts.path === '/content/233/en') {
          created = true;
          const body = opts.body as { name: string; elements: Record<string, unknown> };
          return { id: 555, contentTypeID: 75, name: body.name, elements: body.elements, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.method === 'GET' && opts.path === '/content/233/555/en') {
          return { id: 555, contentTypeID: 75, name: 'Home', elements: { 'Name#1:1': 'Home', 'Title#2:1': 'Test' }, version: 1, owner: { id: 0, type: 'USER' }, channels: [] };
        }
        if (opts.path === '/type/') return [];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const result = await ref.update({ customFields: { Title: 'Test' } });

      const contentCreate = calls.find((c) => c.method === 'POST' && c.path === '/content/233/en');
      const body = (contentCreate as { body: { name: string } }).body;
      expect(contentCreate).toBeDefined();
      expect(body.name).toBe('Home');
      expect(result.customFields?.Title).toBe('Test');
    });
  });

  describe('delete()', () => {
    it('sets section status to inactive via update()', async () => {
      const currentSection = {
        id: 233, name: 'Home', parent: 100, status: '0', show: true,
        channels: [{ id: 1, pageLayout: 5, inheritedPageLayout: 6 }],
      };
      let putBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return currentSection;
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') { putBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.delete();

      expect((putBody as Record<string, unknown>).status).toBe('2');
    });
  });

  describe('purge()', () => {
    it('sends POST /hierarchy/purge with section ID', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { id: 233, status: 2 };
        if (opts.method === 'POST' && opts.path === '/hierarchy/purge') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.purge();

      const purgeCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { path: string }).path === '/hierarchy/purge',
      );
      expect(purgeCall).toBeDefined();
      const body = (purgeCall![0] as { body: { languageCode: string; contentIds: string[] } }).body;
      expect(body.languageCode).toBe('en');
      expect(body.contentIds).toEqual(['233']);
    });

    it('throws if section is not inactive (approved)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { id: 233, status: 0 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.purge()).rejects.toThrow('Cannot purge section 233');
      await expect(ref.purge()).rejects.toThrow('currently "approved"');
    });

    it('throws if section is pending', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { id: 233, status: 1 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.purge()).rejects.toThrow('currently "pending"');
    });
  });

  describe('move()', () => {
    it('sends MOVE /hierarchy/{sectionId}/{newParentId} with empty body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      await ref.move(8254);

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('MOVE');
      expect(callArgs.path).toBe('/hierarchy/233/8254');
      expect(callArgs.body).toEqual({});
    });
  });

  describe('content.list() works via content property', () => {
    it('content.list() works', async () => {
      const contentDTO = {
        id: 50, contentTypeID: 44, name: 'Test', language: 'en',
        status: 1, elements: {}, version: 1, owner: { id: 0, type: 'USER' }, channels: [1],
      };
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/contents')) return { children: [{ id: 50, content: contentDTO, printSequence: 1, sortLock: 'UNLOCKED' }], sortType: 0 };
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const items = await ref.content.list();
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(50);
    });
  });

  describe('tree()', () => {
    const treeResponse = [
      {
        id: 233,
        name: 'Home',
        hasChildren: true,
        isOpen: true,
        subsections: [
          {
            id: 6758,
            name: 'samplesite.terminalfour.com',
            hasChildren: true,
            isOpen: false,
            subsections: [
              { id: 246, name: 'About', hasChildren: false, isOpen: false, subsections: [] },
            ],
          },
          { id: 8257, name: 'alternate-site.com', hasChildren: false, isOpen: false, subsections: [] },
        ],
      },
    ];

    it('returns the section tree with children', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      const tree = await ref.tree();

      expect(tree.id).toBe(233);
      expect(tree.name).toBe('Home');
      expect(tree.children).toHaveLength(2);
      expect(tree.children![0].name).toBe('samplesite.terminalfour.com');
      expect(tree.children![0].children![0].name).toBe('About');
    });

    it('omits children key on leaf nodes', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      const tree = await ref.tree();

      expect(tree.children![1].children).toBeUndefined();
    });

    it('sends POST /hierarchy/section with correct body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      await ref.tree();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.path).toBe('/hierarchy/section');
      expect(callArgs.body.read.section).toEqual({ id: 233, language: 'en' });
      expect(callArgs.body.read.recursionDepth).toBe(1);
      expect(callArgs.body.read.showFullTree).toBe(true);
      expect(callArgs.body.read.showAllSections).toBe(true);
      expect(callArgs.body.read.explode).toBe(true);
      expect(callArgs.body.read.openNodes).toEqual([233]);
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      await ref.tree({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.body.read.section.language).toBe('fr');
    });

    it('returns minimal node when response is empty', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const tree = await ref.tree();

      expect(tree).toEqual({ id: 233, name: '' });
    });
  });

  describe('subsections()', () => {
    it('calls GET /hierarchy/{id}/{language}/subsections', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        children: [
          { id: 246, name: 'Child A', description: 'Desc A', lastModified: 1452597488000, sortLock: 'TOP' },
          { id: 247, name: 'Child B', description: 'Desc B', lastModified: 1452597517000, sortLock: 'TOP' },
        ],
        sortType: 0,
      });

      const subs = await ref.subsections();

      const call = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => {
          const o = c[0] as { path: string };
          return o.path.includes('/subsections');
        },
      );
      expect(call).toBeDefined();
      const opts = call![0] as { method: string; path: string };
      expect(opts.method).toBe('GET');
      expect(opts.path).toContain('/hierarchy/233/en/subsections');
    });

    it('returns mapped subsection objects with Date lastModified', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        children: [
          { id: 246, name: 'Child A', description: 'Desc A', lastModified: 1452597488000, sortLock: 'TOP' },
        ],
        sortType: 0,
      });

      const subs = await ref.subsections();
      expect(subs).toHaveLength(1);
      expect(subs[0].id).toBe(246);
      expect(subs[0].name).toBe('Child A');
      expect(subs[0].lastModified).toBeInstanceOf(Date);
      expect(subs[0].lastModified!.getTime()).toBe(1452597488000);
    });
  });

  describe('editRights()', () => {
    it('returns users and groups with inherited flag', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/233/en') return {
          ...parentSection,
          userIDs: [30],
          inheritedUserIDs: [61],
          groupIDs: [2],
          inheritedGroupIDs: [1],
        };
        if (opts.path === '/user/30') return { id: 30, username: 'admin', firstName: 'Admin', lastName: 'User', emailAddress: 'admin@example.com' };
        if (opts.path === '/user/61') return { id: 61, username: 'editor', firstName: 'Editor', lastName: 'Person', emailAddress: 'editor@example.com' };
        if (opts.path === '/group/topLevelGroups') return [
          { id: 1, name: 'Sample Site', groupChildren: [{ id: 2, name: 'Editors', groupChildren: [] }] },
        ];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const rights = await ref.editRights();

      expect(rights.users).toHaveLength(2);
      expect(rights.users[0]).toEqual({ id: 30, username: 'admin', firstName: 'Admin', lastName: 'User', emailAddress: 'admin@example.com', inherited: false });
      expect(rights.users[1]).toEqual({ id: 61, username: 'editor', firstName: 'Editor', lastName: 'Person', emailAddress: 'editor@example.com', inherited: true });

      expect(rights.groups).toHaveLength(2);
      expect(rights.groups[0]).toEqual({ id: 2, name: 'Editors', inherited: false });
      expect(rights.groups[1]).toEqual({ id: 1, name: 'Sample Site', inherited: true });
    });

    it('handles empty user/group lists', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [], inheritedUserIDs: [], groupIDs: [], inheritedGroupIDs: [] };
        if (opts.path === '/group/topLevelGroups') return [];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const rights = await ref.editRights();
      expect(rights.users).toEqual([]);
      expect(rights.groups).toEqual([]);
    });

    it('falls back gracefully when user lookup fails', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [99], inheritedUserIDs: [], groupIDs: [], inheritedGroupIDs: [] };
        if (opts.path === '/user/99') throw new Error('Not found');
        if (opts.path === '/group/topLevelGroups') return [];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const rights = await ref.editRights();
      expect(rights.users).toHaveLength(1);
      expect(rights.users[0].id).toBe(99);
      expect(rights.users[0].username).toBe('User 99');
      expect(rights.users[0].inherited).toBe(false);
    });
  });

  describe('setEditRights()', () => {
    it('merges new users into existing userIDs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [30], groupIDs: [1] };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setEditRights({ users: [61] });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { userIDs: number[]; groupIDs: number[] } }).body;
      expect(body.userIDs).toEqual([30, 61]);
      expect(body.groupIDs).toEqual([1]); // unchanged
    });

    it('merges new groups into existing groupIDs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [30], groupIDs: [1] };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setEditRights({ groups: [2, 3] });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { userIDs: number[]; groupIDs: number[] } }).body;
      expect(body.groupIDs).toEqual([1, 2, 3]);
      expect(body.userIDs).toEqual([30]); // unchanged
    });

    it('deduplicates when adding existing IDs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [30], groupIDs: [] };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setEditRights({ users: [30, 61] });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { userIDs: number[] } }).body;
      expect(body.userIDs).toEqual([30, 61]);
    });

    it('throws when neither users nor groups provided', async () => {
      await expect(ref.setEditRights({})).rejects.toThrow('setEditRights requires at least one of users or groups');
    });
  });

  describe('removeEditRights()', () => {
    it('removes specified users from userIDs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [30, 61], groupIDs: [1, 2] };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.removeEditRights({ users: [30] });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { userIDs: number[]; groupIDs: number[] } }).body;
      expect(body.userIDs).toEqual([61]);
      expect(body.groupIDs).toEqual([1, 2]); // unchanged
    });

    it('removes specified groups from groupIDs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return { ...parentSection, userIDs: [30], groupIDs: [1, 2] };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.removeEditRights({ groups: [1] });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { userIDs: number[]; groupIDs: number[] } }).body;
      expect(body.groupIDs).toEqual([2]);
      expect(body.userIDs).toEqual([30]); // unchanged
    });

    it('throws when neither users nor groups provided', async () => {
      await expect(ref.removeEditRights({})).rejects.toThrow('removeEditRights requires at least one of users or groups');
    });
  });

  describe('contentTypes()', () => {
    it('returns content types with name, description, and scope', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return {
          ...parentSection,
          contentTypeScopes: [
            { id: 44, scope: 1, inherited: true },
            { id: 343, scope: 0, inherited: false },
          ],
        };
        if (opts.path === '/contenttype') return [
          { id: 44, name: 'Article', description: 'A news article' },
          { id: 343, name: 'All Elements', description: 'Content type with all element types' },
        ];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const types = await ref.contentTypes();
      expect(types).toHaveLength(2);
      expect(types[0]).toEqual({ id: 44, name: 'Article', description: 'A news article', scope: 'branch' });
      expect(types[1]).toEqual({ id: 343, name: 'All Elements', description: 'Content type with all element types', scope: 'section' });
    });

    it('returns empty array when no content type scopes', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { ...parentSection, contentTypeScopes: [] };
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const types = await ref.contentTypes();
      expect(types).toEqual([]);
    });

    it('falls back to generic name when content type not found', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/233/en') return {
          ...parentSection,
          contentTypeScopes: [{ id: 999, scope: 0, inherited: false }],
        };
        if (opts.path === '/contenttype') return [];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const types = await ref.contentTypes();
      expect(types).toHaveLength(1);
      expect(types[0].name).toBe('Content Type 999');
      expect(types[0].description).toBe('');
    });
  });

  describe('setContentTypes()', () => {
    it('merges new content types into existing scopes and PUTs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return {
          ...parentSection,
          contentTypeScopes: [{ id: 44, scope: 1, inherited: true }],
        };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setContentTypes([{ id: 343, scope: 'section' }]);

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = (putCall![0] as { body: { contentTypeScopes: Array<{ id: number; scope: number }> } }).body;
      expect(body.contentTypeScopes).toHaveLength(2);
      expect(body.contentTypeScopes).toContainEqual({ id: 44, scope: 1, inherited: true });
      expect(body.contentTypeScopes).toContainEqual({ id: 343, scope: 0, inherited: false });
    });

    it('updates scope of existing content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return {
          ...parentSection,
          contentTypeScopes: [{ id: 44, scope: 0, inherited: false }],
        };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.setContentTypes([{ id: 44, scope: 'branch' }]);

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { contentTypeScopes: Array<{ id: number; scope: number }> } }).body;
      expect(body.contentTypeScopes).toHaveLength(1);
      expect(body.contentTypeScopes[0]).toEqual({ id: 44, scope: 1, inherited: false });
    });

    it('throws when empty array provided', async () => {
      await expect(ref.setContentTypes([])).rejects.toThrow('setContentTypes requires at least one content type');
    });
  });

  describe('removeContentTypes()', () => {
    it('removes specified content types and PUTs', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/hierarchy/233/en') return {
          ...parentSection,
          contentTypeScopes: [
            { id: 44, scope: 1, inherited: true },
            { id: 343, scope: 0, inherited: false },
            { id: 43, scope: 1, inherited: true },
          ],
        };
        if (opts.method === 'PUT' && opts.path === '/hierarchy/233/en') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.removeContentTypes([44, 343]);

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { contentTypeScopes: Array<{ id: number }> } }).body;
      expect(body.contentTypeScopes).toHaveLength(1);
      expect(body.contentTypeScopes[0].id).toBe(43);
    });

    it('throws when empty array provided', async () => {
      await expect(ref.removeContentTypes([])).rejects.toThrow('removeContentTypes requires at least one content type ID');
    });
  });

  describe('publish()', () => {
    const singleChannel = [{ id: 1, name: 'Sample Site', description: '' }];
    const multipleChannels = [
      { id: 1, name: 'Sample Site', description: '' },
      { id: 3, name: 'Example Channel', description: '' },
    ];

    it('auto-selects channel when section has only one', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return singleChannel;
        if (opts.method === 'POST' && opts.path === '/task/repository') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.publish();

      const body = postBody as Record<string, unknown>;
      expect(body.channel).toBe(1);
      expect(body.taskType).toBe('channelPublish');
      expect(body.sections).toEqual([233]);
      expect(body.branch).toBe(false);
      expect(body.taskLevel).toBe('section');
    });

    it('publishes branch when branch: true', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return singleChannel;
        if (opts.method === 'POST' && opts.path === '/task/repository') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.publish({ branch: true });

      const body = postBody as Record<string, unknown>;
      expect(body.branch).toBe(true);
      expect(body.taskLevel).toBe('branch');
    });

    it('uses explicit channelId when provided', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return multipleChannels;
        if (opts.method === 'POST' && opts.path === '/task/repository') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.publish({ channelId: 3 });

      expect((postBody as Record<string, unknown>).channel).toBe(3);
    });

    it('throws when section has multiple channels and no channelId provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return multipleChannels;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.publish()).rejects.toThrow('belongs to multiple channels');
      await expect(ref.publish()).rejects.toThrow('Sample Site (1)');
      await expect(ref.publish()).rejects.toThrow('Example Channel (3)');
    });

    it('throws when channelId is not in publishable channels', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return singleChannel;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.publish({ channelId: 99 })).rejects.toThrow('Channel 99 is not a publishable channel');
      await expect(ref.publish({ channelId: 99 })).rejects.toThrow('Sample Site (1)');
    });

    it('throws when section has no publishable channels', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return [];
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await expect(ref.publish()).rejects.toThrow('no publishable channels');
    });

    it('sends correct body shape', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return singleChannel;
        if (opts.method === 'POST' && opts.path === '/task/repository') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.publish();

      const body = postBody as Record<string, unknown>;
      expect(body).toEqual({
        taskType: 'channelPublish',
        channel: 1,
        sections: [233],
        branch: false,
        publishCompleteChannel: false,
        publishOptions: { publishArchiveSections: true },
        taskLevel: 'section',
        selectedLanguage: 'en',
      });
    });

    it('uses language override', async () => {
      let postBody: unknown = null;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string; body?: unknown }) => {
        if (opts.method === 'GET' && opts.path.includes('/channel/publishables/')) return singleChannel;
        if (opts.method === 'POST' && opts.path === '/task/repository') { postBody = opts.body; return undefined; }
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.publish({ language: 'fr' });

      expect((postBody as Record<string, unknown>).selectedLanguage).toBe('fr');
    });

    it('calls GET /channel/publishables/{sectionId}/publish', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/channel/publishables/233/publish') return singleChannel;
        if (opts.method === 'POST' && opts.path === '/task/repository') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await ref.publish();

      const getCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'GET',
      );
      expect((getCall![0] as { path: string }).path).toBe('/channel/publishables/233/publish');
    });
  });
});
