# Getting Started

Install and configure terminalfour-js in server-side TypeScript code, then verify the connection and choose language and cache settings.

## Install

```bash
npm install terminalfour-js
```

The package includes TypeScript declarations and supports both ESM (`import`) and CommonJS (`require`). It requires **Node 18 or later** because it uses the built-in `fetch`, `FormData`, and `Error.cause`.

## Create a client

```typescript
import { T4Client } from 'terminalfour-js';

const t4 = new T4Client({
  baseUrl: 'https://mysite.edu/terminalfour/rs',
  apiToken: 'your-api-token',
});
```

### Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | required | T4 instance REST API URL |
| `apiToken` | `string` | required | API authentication token |
| `language` | `string` | `'en'` | Default language for supported operations |
| `concurrency` | `number` | `10` | Maximum parallel HTTP requests |

### `baseUrl` requirements

`baseUrl` must be an absolute `http` or `https` URL. The client strips trailing slashes, so these values are equivalent:

```typescript
baseUrl: 'https://mysite.edu/terminalfour/rs'
baseUrl: 'https://mysite.edu/terminalfour/rs/'
```

The constructor rejects a value that is not a parseable absolute URL or uses a protocol other than `http` or `https`:

```typescript
new T4Client({ baseUrl: 'mysite.edu/terminalfour/rs', apiToken: '...' });
// Error: T4Client baseUrl "mysite.edu/terminalfour/rs" is not a valid absolute URL.
```

**Important:** An `http://` URL logs a warning because every request sends the API token in an `Authorization` header, and plain HTTP transmits it in cleartext. Always use `https://` unless you are testing against a local instance.

## Keep the client server-side

The `apiToken` grants full read/write access to your T4 instance. Browser bundles are publicly readable, so sending the token to front-end code exposes it to every visitor, regardless of your application's authentication.

The SDK prevents this by throwing when code constructs a client in a browser. You cannot disable this check.

```typescript
// Browser code: throws
new T4Client({ baseUrl, apiToken });
// Error: T4Client cannot be used in a browser. The apiToken is a full-privilege
// credential and anything in front-end code is publicly readable...
```

Construct the client in an API route, serverless function, or backend service. Return only the data the browser needs:

```typescript
const t4 = new T4Client({
  baseUrl: process.env.T4_BASE_URL!,
  apiToken: process.env.T4_API_TOKEN!,
});

const items = await t4.section(482).content.list();
// Return `items` from your server endpoint. The token stays on the server.
```

The guard checks for both `window` and `window.document`, so it blocks only browser environments. Node, Deno, Bun, Cloudflare Workers, similar edge runtimes, and Web Workers continue to work.

## Set the language

Configure a client default when you need a language other than `en`:

```typescript
const t4 = new T4Client({
  baseUrl: 'https://mysite.edu/terminalfour/rs',
  apiToken: 'your-api-token',
  language: 'fr',
  concurrency: 5,
});
```

For sections, content, and lists, the SDK resolves language in this order:

1. Per-call `{ language }` option
2. Client `language`
3. `'en'`

```typescript
await t4.section(482).content.list();                  // uses client default 'fr'
await t4.section(482).content.list({ language: 'de' }); // overrides this call
```

Other resources use fixed languages:

| Resource | Language |
|---|---|
| Media items | `smxx` (language-independent) |
| Media categories and media library | `en` |
| Page layouts, content layouts, channels, groups, and users | `en` |

## Inspect the T4 instance

The client provides four read-only platform methods:

| Method | Returned data | Example property |
|---|---|---|
| `about()` | T4 version, uptime, OS, Java, and servlet details | `info.t4.version` is `'8.4.2-FINAL'`; `info.t4.uptime` is a `Date`; `info.os.name` is `'Linux'`; `info.java.version` is `'11.0.18'` |
| `database()` | Database connection details | `db.name` is `'MySQL'`; `db.version` is `'8.0.32'` |
| `environment()` | Environment configuration | `env['max_upload_size']` is `'50000'` |
| `licence()` | Licence usage | `lic.remaining` may be `14121` content items |

```typescript
const info = await t4.about();
const db = await t4.database();
const env = await t4.environment();
const lic = await t4.licence();
```

## Debug requests

Set `T4_DEBUG=1` to log HTTP requests and internal warnings:

```bash
T4_DEBUG=1 node my-script.js
```

## Refresh cached data

The SDK caches content type templates, list values, element type definitions, and other lookup data for five minutes. You can clear every SDK cache after changing configuration during with:

```typescript
t4.clearCache();
```

---

**Next:** [Sections](./sections.md)
