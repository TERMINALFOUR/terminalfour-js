# terminalfour-js

A TypeScript SDK for working with the [Terminalfour](https://www.terminalfour.com/) Platform REST API.

```bash
npm install @terminalfour/terminalfour-js
```

```typescript
import { T4Client } from '@terminalfour/terminalfour-js';

const t4 = new T4Client({
  baseUrl: 'https://mysite.edu/terminalfour/rs',
  apiToken: 'your-api-token',
});
```

## Why use terminalfour-js?

The Terminalfour REST API is powerful but verbose. Updating content can require more than five requests, negative random IDs, data merged from multiple endpoints, and element keys such as `"Title#2:1"`. terminalfour-js handles that API plumbing and lets you work with field names and typed values.

```typescript
await t4.section(482).content.create({
  type: 44,
  name: 'New Article',
  fields: {
    Title: 'Breaking News',
    Category: 'Featured',        // list value by name, not "listId:itemId"
    'Hero Image': './photo.jpg', // uploads the file automatically
    'Publish Date': new Date(),  // accepts a Date object
  },
});
```

Retrieve an item, change its fields, and save it:

```typescript
const article = await t4.section(482).content.get(9132);
article.fields['Title'] = 'Updated Headline';
article.status = 'approved';
await article.save();
```

Section operations start from a lightweight section reference:

```typescript
const section = t4.section(482);

await section.content.list();
await section.subsections();
await section.publish({ branch: true });
await section.addSection({ name: 'Child', customFields: { Title: 'Hello' } });
```

## Requirements

- **Node 18 or later (We recommend the latest LTS version):** The SDK uses the built-in `fetch`, `FormData`, and `Error.cause`.
- **Server-side execution:** Do not include the SDK or API token in front-end code.
- **ESM and CommonJS:** Use either `import` or `require`.
- **TypeScript declarations:** No `@types` package is needed.
- **Zero runtime dependencies.**

## Keep the API token server-side

Do not use this SDK in front-end code. The `apiToken` has all the privileges of its associated user, and browser bundles are publicly readable. The SDK throws if you construct a client in a browser.

Construct the client in server-side code and return only the data the browser needs. See [Getting Started](./docs/getting-started.md#keep-the-client-server-side) for an example and the full runtime check.

## Supported resources

| Resource | Operations |
|---|---|
| **Sections** | get, create, update, delete, purge, move, tree, subsections, channels, owner, metadata, page layouts, edit rights, content types, publish |
| **Content** | list, get, create, update, delete, purge, move, duplicate, approve, approveAll |
| **Content Types** | list, get, create, update, delete, add/remove fields, content layouts (CRUD) |
| **Lists** | list, get, create, update, delete, add/remove items |
| **Groups** | list, get, create, update, delete, add/remove members |
| **Users** | list, get, create, update, delete, auth methods, custom fields |
| **Page Layouts** | list, get, create, update, delete |
| **Channels** | list, get, publish |
| **Media** | get, create, update, delete, purge (auto-detects type, handles binary and text) |
| **Media Categories** | get, create, update, delete, purge, move, list items, subcategories |
| **Media Library** | full category tree |
| **Media Types** | list, get, create, update |
| **Navigation** | list, get, create, update, delete (all 19 core navigation objects) |
| **Handlebars** | helpers and partials: list, get, create, update, delete, purge |
| **Platform** | about, database, environment, licence |

The SDK supports every element type: plain text, HTML, dates, select boxes, checkboxes, radio buttons, multi-selects, cascading lists, files, images, media, section/content links, numbers, content owners, group selects, keyword selectors, and repeaters.

## Documentation

Start with [Getting Started](./docs/getting-started.md), then use the resource guides as references:

- [Sections](./docs/sections.md): CRUD, tree navigation, metadata, page layouts, edit rights, and publishing
- [Content](./docs/content.md): CRUD, move, duplicate, approve, and all element types
- [Content Types](./docs/content-types.md): types, fields, and content layouts
- [Lists](./docs/lists.md): list management and item changes
- [Groups & Users](./docs/groups-and-users.md): CRUD, authentication methods, and memberships
- [Page Layouts](./docs/page-layouts.md): CRUD with processor and syntax resolution
- [Media](./docs/media.md): items, categories, library trees, and uploads
- [Media Types](./docs/media-types.md): definitions, extensions, and layouts
- [Channels](./docs/channels.md): details and publishing
- [Navigation](./docs/navigation.md): all navigation object types, including A to Z, Breadcrumbs, and Site Map
- [Handlebars](./docs/handlebars.md): custom helpers and partials
- [Error Handling](./docs/error-handling.md): `T4ApiError`, debugging, and cache management
- [TypeScript Reference](./docs/typescript.md): exported types and interfaces

## More examples

```typescript
// Bulk approve all pending content in a section
const totalApprovedCount = await t4.section(482).content.approveAll();

// Duplicate a content item
const item = await t4.section(482).content.get(9132);
await item.duplicate();    // same section, auto-named "(1)"
await item.duplicate(500); // different section, original name

// Move a section
await t4.section(500).move(233);

// Create a content type with fields
await t4.contentTypes.create({
  name: 'Blog Post',
  elements: [
    { name: 'Title', type: 'Plain Text', required: true },
    { name: 'Body', type: 'HTML' },
    { name: 'Category', type: 'Select Box', listId: 71 },
  ],
});

// Upload media
const media = await t4.media.create({
  file: './hero-image.jpg',
  name: 'Hero Image',
  category: 391,
});

// Create a Handlebars custom helper
await t4.handlebars.helpers.create({
  name: 'truncate',
  code: `function(context, options) {
    return context.substring(0, options.hash('len')) + '...';
}`,
});
```

## Contributing

Pull requests are welcome. Before opening one, read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.

The SDK has no runtime dependencies, and the tests use a mocked HTTP client. You do not need a T4 instance to contribute:

```bash
npm install
npm test
npm run build
```

Every change to `src/` should have matching test coverage in `tests/`.

## License

See LICENSE.md.
