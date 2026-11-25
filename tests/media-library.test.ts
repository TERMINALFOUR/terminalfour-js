import { describe, it, expect, vi, beforeEach } from "vitest";
import { MediaLibrary } from "../src/media-library.js";
import { HttpClient } from "../src/http-client.js";
import { invalidateAllCaches } from "../src/utils.js";

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const treeResponse = [
  {
    id: 3,
    language: "en",
    name: "Categorised",
    accessLevel: 20,
    status: 0,
    children: [
      {
        id: 352,
        language: "en",
        name: "Sample Site",
        accessLevel: 20,
        status: 0,
        children: [
          {
            id: 366,
            language: "en",
            name: "Images",
            accessLevel: 20,
            status: 0,
            children: [
              {
                id: 367,
                language: "en",
                name: "Parallax Images",
                accessLevel: 20,
                status: 0,
                children: [],
                hasChildren: false,
                hasAccess: true,
                isOpen: false,
              },
            ],
            hasChildren: true,
            hasAccess: true,
            isOpen: true,
          },
        ],
        hasChildren: true,
        hasAccess: true,
        isOpen: true,
      },
      {
        id: 8342,
        language: "en",
        name: "Test &amp; Delete",
        accessLevel: 20,
        status: 0,
        children: [],
        hasChildren: false,
        hasAccess: true,
        isOpen: false,
      },
    ],
    hasChildren: true,
    hasAccess: true,
    isOpen: true,
  },
];

describe("MediaLibrary", () => {
  let http: HttpClient;
  let library: MediaLibrary;

  beforeEach(() => {
    http = mockHttpClient();
    library = new MediaLibrary(http, "en");
  });

  function setupTreeMocks() {
    (http.request as ReturnType<typeof vi.fn>).mockImplementation(
      async (opts: { method: string; path: string }) => {
        if (opts.path === "/config/mediaLibrary.section")
          return { name: "mediaLibrary.section", type: "section", value: "2" };
        if (opts.path.includes("/subsections"))
          return { children: [{ id: 3, name: "Categorised" }] };
        if (opts.method === "POST" && opts.path === "/mediacategory")
          return treeResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      },
    );
  }

  describe("tree()", () => {
    it("returns the full media category tree", async () => {
      setupTreeMocks();

      const tree = await library.tree();

      expect(tree.id).toBe(3);
      expect(tree.name).toBe("Categorised");
      expect(tree.children).toHaveLength(2);
      expect(tree.children![0].name).toBe("Sample Site");
      expect(tree.children![0].children![0].name).toBe("Images");
      expect(tree.children![0].children![0].children![0].name).toBe(
        "Parallax Images",
      );
    });

    it("decodes HTML entities in names", async () => {
      setupTreeMocks();

      const tree = await library.tree();

      expect(tree.children![1].name).toBe("Test & Delete");
    });

    it("fetches root ID from /config/mediaLibrary.section", async () => {
      setupTreeMocks();
      await library.tree();

      const configCall = (
        http.request as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (c: unknown[]) =>
          (c[0] as { path: string }).path === "/config/mediaLibrary.section",
      );
      expect(configCall).toBeDefined();
    });

    it("fetches subcategories of root to find top child", async () => {
      setupTreeMocks();
      await library.tree();

      const subsCall = (
        http.request as ReturnType<typeof vi.fn>
      ).mock.calls.find((c: unknown[]) =>
        (c[0] as { path: string }).path.includes("/hierarchy/2/en/subsections"),
      );
      expect(subsCall).toBeDefined();
    });

    it("sends POST /mediacategory with recursionDepth 30", async () => {
      setupTreeMocks();
      await library.tree();

      const postCall = (
        http.request as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (c: unknown[]) =>
          (c[0] as { method: string; path: string }).method === "POST" &&
          (c[0] as { path: string }).path === "/mediacategory",
      );
      expect(postCall).toBeDefined();
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.explode).toBe(false);
      expect(body.recursionDepth).toBe(30);
      expect(body.category).toEqual({ id: 3, language: "en" });
    });

    it("caches the root ID across calls", async () => {
      setupTreeMocks();
      await library.tree();
      await library.tree();

      const configCalls = (
        http.request as ReturnType<typeof vi.fn>
      ).mock.calls.filter(
        (c: unknown[]) =>
          (c[0] as { path: string }).path === "/config/mediaLibrary.section",
      );
      expect(configCalls).toHaveLength(1);
    });

    it("uses language override", async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(
        async (opts: { method: string; path: string }) => {
          if (opts.path === "/config/mediaLibrary.section")
            return {
              name: "mediaLibrary.section",
              type: "section",
              value: "2",
            };
          if (opts.path.includes("/hierarchy/2/fr/subsections"))
            return { children: [{ id: 3, name: "Catégorisé" }] };
          if (opts.method === "POST" && opts.path === "/mediacategory")
            return treeResponse;
          throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
        },
      );

      await library.tree({ language: "fr" });

      const postCall = (
        http.request as ReturnType<typeof vi.fn>
      ).mock.calls.find(
        (c: unknown[]) =>
          (c[0] as { method: string }).method === "POST" &&
          (c[0] as { path: string }).path === "/mediacategory",
      );
      const body = (
        postCall![0] as { body: { category: { language: string } } }
      ).body;
      expect(body.category.language).toBe("fr");
    });

    it("returns empty children when root has no subcategories", async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(
        async (opts: { path: string }) => {
          if (opts.path === "/config/mediaLibrary.section")
            return {
              name: "mediaLibrary.section",
              type: "section",
              value: "2",
            };
          if (opts.path.includes("/subsections")) return { children: [] };
          throw new Error(`Unexpected: ${opts.path}`);
        },
      );

      const tree = await library.tree();
      expect(tree).toEqual({ id: 2, name: "Media Library" });
    });

    it("omits children key on leaf nodes", async () => {
      setupTreeMocks();

      const tree = await library.tree();

      // Parallax Images has no children
      const parallax = tree.children![0].children![0].children![0];
      expect(parallax.name).toBe("Parallax Images");
      expect(parallax.children).toBeUndefined();
    });

    it("only includes id, name, and children (when present) in output", async () => {
      setupTreeMocks();

      const tree = await library.tree();

      expect(Object.keys(tree)).toEqual(["id", "name", "children"]);
      // Leaf node should only have id and name
      const leaf = tree.children![1]; // Test & Delete
      expect(Object.keys(leaf)).toEqual(["id", "name"]);
    });
  });

  describe("root id cache", () => {
    type RecordedCall = {
      method: string;
      path: string;
      body?: Record<string, unknown>;
    };

    const CONFIG_PATH = "/config/mediaLibrary.section";
    const RESPONSE_DELAY_MS = 20;
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const nth = <T>(responses: T[], n: number): T =>
      responses[Math.min(n, responses.length - 1)];
    const fetchesOf = (calls: RecordedCall[], path: string) =>
      calls.filter((c) => c.path === path);

    function mockRootConfig(rootIds: string[], delayMs = 0): RecordedCall[] {
      const calls: RecordedCall[] = [];
      let configCount = 0;
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(
        async (req: RecordedCall) => {
          calls.push(req);
          if (req.path === CONFIG_PATH) {
            const value = nth(rootIds, configCount++);
            if (delayMs > 0) await delay(delayMs);
            return { name: "mediaLibrary.section", type: "section", value };
          }
          if (/^\/hierarchy\/\d+\/en\/subsections/.test(req.path))
            return { children: [] };
          throw new Error(`Unexpected: ${req.method} ${req.path}`);
        },
      );
      return calls;
    }

    beforeEach(() => {
      invalidateAllCaches();
    });

    it("re-fetches GET /config/mediaLibrary.section after invalidateAllCaches()", async () => {
      const calls = mockRootConfig(["2", "5"]);

      const first = await library.tree();
      invalidateAllCaches();
      const second = await library.tree();

      expect(first).toEqual({ id: 2, name: "Media Library" });
      expect(second).toEqual({ id: 5, name: "Media Library" });
      expect(fetchesOf(calls, CONFIG_PATH)).toHaveLength(2);
    });

    it("shares one in-flight root id fetch across concurrent tree() calls", async () => {
      const calls = mockRootConfig(["2", "5"], RESPONSE_DELAY_MS);

      const [a, b] = await Promise.all([library.tree(), library.tree()]);

      expect(fetchesOf(calls, CONFIG_PATH)).toHaveLength(1);
      expect(a.id).toBe(2);
      expect(b.id).toBe(2);
    });
  });
});
