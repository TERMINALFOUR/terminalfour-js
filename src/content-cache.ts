import { HttpClient } from './http-client.js';
import { TypeRegistry } from './type-registry.js';
import { ElementResolver, MediaCreateFn } from './element-resolver.js';
import { TtlMap } from './utils.js';

/**
 * Client-level shared caches for content operations.
 *
 * A single instance is created per `T4Client` and threaded into every
 * `ContentResource` (including the short-lived ones created by
 * `SectionRef.get()` / `addSection()`). This ensures that traversing the
 * hierarchy — which creates many `ContentResource` instances via
 * `t4.section(id)` — does not re-fetch instance-wide data on every hop.
 *
 * Two things previously lived on each `ContentResource` and were rebuilt per
 * section, causing repeated API calls (`GET /type/`, `GET /contenttype/{id}`,
 * `GET /content/type/{ct}/{section}`):
 *
 * - The element `TypeRegistry` (`GET /type/`) — instance-wide, so shared here
 *   as a single registry and a single `ElementResolver`.
 * - Content type templates — split into:
 *   - `contentTypeDefinitions`: the section-independent `GET /contenttype/{id}`
 *     response, keyed by content type ID.
 *   - `sectionTemplates`: the section-specific `GET /content/type/{ct}/{section}`
 *     response (carries channels), keyed by `"{contentTypeId}:{sectionId}"`.
 *
 * All caches respect the global cache epoch, so `T4Client.clearCache()`
 * invalidates them the same way it always has.
 */
export class ContentCache {
  readonly typeRegistry: TypeRegistry;
  readonly resolver: ElementResolver;

  /** `GET /content/type/{ct}/{section}` responses, keyed by `"{ct}:{section}"`. */
  readonly sectionTemplates: TtlMap<string, unknown> = new TtlMap();

  /** `GET /contenttype/{id}` responses, keyed by content type ID. */
  readonly contentTypeDefinitions: TtlMap<number, unknown> = new TtlMap();

  constructor(httpClient: HttpClient, defaultLanguage: string, mediaCreateFn?: MediaCreateFn | null) {
    this.typeRegistry = new TypeRegistry(httpClient);
    this.resolver = new ElementResolver(httpClient, defaultLanguage, this.typeRegistry, mediaCreateFn);
  }
}
