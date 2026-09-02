import { HttpClient } from './http-client.js';
import { DEFAULT_CACHE_TTL, getCacheEpoch } from './utils.js';

/** Element type definition from GET /type/ */
interface ElementTypeDefinition {
  id: number;
  name: string;
  listType: boolean;
}

/**
 * Registry for element type definitions.
 * Fetches from GET /type/ and caches with a TTL.
 * Provides lookup by name to get the ID for a given element type.
 */
export class TypeRegistry {
  private readonly httpClient: HttpClient;
  private cache: ElementTypeDefinition[] | null = null;
  private nameToId: Map<string, number> | null = null;
  private idToName: Map<number, string> | null = null;
  private listTypeIds: Set<number> | null = null;
  private expiresAt = 0;
  private epoch = -1;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Ensures the type definitions are loaded and cached */
  private async ensureLoaded(): Promise<void> {
    if (this.cache && Date.now() < this.expiresAt && this.epoch >= getCacheEpoch()) return;

    this.cache = await this.httpClient.request<ElementTypeDefinition[]>({
      method: 'GET',
      path: '/type/',
    });

    this.nameToId = new Map();
    this.idToName = new Map();
    this.listTypeIds = new Set();

    for (const t of this.cache) {
      this.nameToId.set(t.name.toLowerCase(), t.id);
      this.idToName.set(t.id, t.name);
      if (t.listType) this.listTypeIds.add(t.id);
    }

    this.expiresAt = Date.now() + DEFAULT_CACHE_TTL;
    this.epoch = getCacheEpoch();
  }

  /** Gets the type ID for a given type name (e.g. "Radio Button" → 9) */
  async getIdByName(name: string): Promise<number> {
    await this.ensureLoaded();
    return this.nameToId!.get(name.toLowerCase()) ?? -1;
  }

  /** Gets the type name for a given type ID (e.g. 9 → "Radio Button") */
  async getNameById(id: number): Promise<string> {
    await this.ensureLoaded();
    return this.idToName!.get(id) ?? `unknown (${id})`;
  }

  /** Checks if a type ID is a list type (requires list value resolution) */
  async isListType(id: number): Promise<boolean> {
    await this.ensureLoaded();
    return this.listTypeIds!.has(id);
  }

  /** Gets all type IDs that are list types */
  async getListTypeIds(): Promise<Set<number>> {
    await this.ensureLoaded();
    return new Set(this.listTypeIds!);
  }

  /** Gets a map of type name → type ID for all known types */
  async getTypeMap(): Promise<Map<string, number>> {
    await this.ensureLoaded();
    return new Map(this.nameToId!);
  }

  /** Clears the cache, forcing a re-fetch on next access */
  clear(): void {
    this.cache = null;
    this.nameToId = null;
    this.idToName = null;
    this.listTypeIds = null;
    this.expiresAt = 0;
    this.epoch = -1;
  }
}
