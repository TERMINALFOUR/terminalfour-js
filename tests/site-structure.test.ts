import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SiteStructure } from '../src/site-structure.js';
import { HttpClient } from '../src/http-client.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const treeResponse = [
  {
    id: 1,
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
          { id: 233, name: 'Home', hasChildren: false, isOpen: false, subsections: [] },
        ],
      },
      { id: 8257, name: 'alternate-site.com', hasChildren: false, isOpen: false, subsections: [] },
    ],
  },
];

describe('SiteStructure', () => {
  let http: HttpClient;
  let siteStructure: SiteStructure;

  beforeEach(() => {
    http = mockHttpClient();
    siteStructure = new SiteStructure(http, 'en');
  });

  describe('tree()', () => {
    it('returns the full section tree', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      const tree = await siteStructure.tree();

      expect(tree.id).toBe(1);
      expect(tree.name).toBe('Home');
      expect(tree.children).toHaveLength(2);
      expect(tree.children![0].name).toBe('samplesite.terminalfour.com');
      expect(tree.children![0].children![0].name).toBe('Home');
    });

    it('omits children key on leaf nodes', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      const tree = await siteStructure.tree();

      expect(tree.children![1].children).toBeUndefined();
    });

    it('sends POST /hierarchy/section with root section id 1', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      await siteStructure.tree();

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.path).toBe('/hierarchy/section');
      expect(callArgs.body.read.section).toEqual({ id: 1, language: 'en' });
      expect(callArgs.body.read.recursionDepth).toBe(1);
    });

    it('uses language override', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce(treeResponse);

      await siteStructure.tree({ language: 'fr' });

      const callArgs = (http.request as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.body.read.section.language).toBe('fr');
    });

    it('returns minimal node when response is empty', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

      const tree = await siteStructure.tree();

      expect(tree).toEqual({ id: 1, name: '' });
    });
  });
});
