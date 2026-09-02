# Error Handling

The SDK distinguishes API failures from client-side validation errors. Enable debug logging when you need request-level detail.

## Handle API errors

API failures throw `T4ApiError`. Check its properties to identify the failed request and response:

```typescript
import { T4Client, T4ApiError } from 'terminalfour-js';

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

## Enable debug logging

Set `T4_DEBUG=1` to print HTTP requests and internal warnings:

```bash
T4_DEBUG=1 node my-script.js
```

Graceful degradation paths, including failed media lookups and group name resolution, log through `debugWarn`. These messages appear only when `T4_DEBUG=1`.

## Clear stale cache data

After changing content types, lists, or other configuration, invalidate every SDK cache:

```typescript
t4.clearCache();
```

This clears cached content type templates, list values, element types, meta tags, group trees, and media types immediately.

---

**Previous:** [Handlebars](./handlebars.md) · **Next:** [TypeScript Reference](./typescript.md)
