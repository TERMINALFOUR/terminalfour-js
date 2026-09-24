# Error Handling

The SDK distinguishes API failures from client-side validation errors. Enable debug logging when you need request-level detail.

## Handle API errors

API failures throw `T4ApiError`. Check its properties to identify the failed request and response:

```typescript
import { T4Client, T4ApiError } from '@terminalfour/terminalfour-js';

try {
  await t4.section(482).content.get(99999);
} catch (error) {
  if (error instanceof T4ApiError) {
    console.error(error.statusCode);    // 404
    console.error(error.statusText);    // '404'
    console.error(error.requestMethod); // 'GET'
    console.error(error.requestUrl);    // full URL
    console.error(error.responseBody);  // parsed response body
    console.error(error.cause);         // original error for network failures
  }
}
```

| Property | Description |
|---|---|
| `statusCode` | HTTP status code |
| `statusText` | HTTP status text |
| `requestMethod` | Request method |
| `requestUrl` | Full request URL |
| `responseBody` | Parsed response body |
| `cause` | Original error for network failures |

## Handle validation errors

Client-side validation throws standard `Error` instances. Messages include the value that failed and valid options when available.

```typescript
await t4.section(482).content.create({
  type: 44,
  name: 'Test',
  fields: { Nonexistent: 'value' },
});
// Error: Unknown field "Nonexistent" on this content type.
//        Valid fields are: "Title", "Body", "Category"
```

Other examples:

```text
Error: Invalid list value "Medium" for field "Size".
       Valid options are: "Large", "Small"

Error: Username is required
```

The final error can result from a call such as:

```typescript
await t4.users.create({ username: '', ... });
```

### Required fields

Creating an asset without its required `name` (or other required input) throws before any request is sent, so you get a clear message instead of an opaque API error:

```text
Error: Section name is required
Error: Content name is required
Error: Layout name is required
Error: Media name is required
Error: Media file is required
```

The same protection applies on update: you cannot blank out a name that is already set. Omitting `name` leaves it unchanged, but setting it to an empty or whitespace-only string is rejected — through both the resource `update()` method and the mutable `get()` → modify → `save()` pattern:

```typescript
const section = await t4.section(482).get();
section.name = '';
await section.save();
// Error: Section name is required

await t4.section(482).update({ name: '   ' });
// Error: Section name cannot be empty
```

This covers content types, content items, sections, lists, groups, page layouts, media, media types, media categories, navigation objects, and Handlebars helpers/partials.

## Enable debug logging

Set `T4_DEBUG=1` to print HTTP requests and internal warnings:

```bash
T4_DEBUG=1 node my-script.js
```

Graceful degradation paths, including failed media lookups and group name resolution, log through `debugWarn`. These messages appear only when `T4_DEBUG=1`.

## Clear stale cache data

Content type writes through the SDK — `contentTypes.create()`, `contentTypes.update()`, `contentTypes.delete()`, and `ContentType.save()` (including `addField`/`removeField`) — clear the SDK's caches automatically, so a content type edit is reflected on the next read without any extra step.

You still need to clear the cache manually when configuration changes **outside** this SDK instance — for example content type, list, or other changes made in the T4 UI or by another process while your client is running:

```typescript
t4.clearCache();
```

This clears cached content type templates, list values, element types, meta tags, group trees, and media types immediately.

---

**Previous:** [Handlebars](./handlebars.md) · **Next:** [TypeScript Reference](./typescript.md)
