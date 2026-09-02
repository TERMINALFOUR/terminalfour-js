# Media Types

Media types define permitted file extensions, whether files are binary or text-based, and which layouts can render them.

## List and read media types

```typescript
const types = await t4.mediaTypes.list();
for (const mediaType of types) {
  console.log(mediaType.name, mediaType.extensions, mediaType.defaultLayout);
}

const images = await t4.mediaTypes.get(1);
```

`get()` returns a mutable `MediaType`:

| Property | Type | Mutable | Description |
|---|---|---|---|
| `id` | `number` | no | Media type ID |
| `name` | `string` | yes | Display name, such as `'Image'` |
| `extensions` | `string[]` | yes | Permitted extensions, such as `['gif', 'jpg', 'jpeg', 'png', 'svg', 'webp']` |
| `binary` | `boolean` | yes | Whether files are binary rather than text-based |
| `parseForTags` | `boolean` | yes | Whether T4 parses tags; valid only when `binary` is `false` |
| `maxSize` | `string \| null` | yes | Formatted maximum size, such as `'5.0 KB'`, or `null` for unlimited |
| `layouts` | `MediaTypeLayout[]` | yes | Layouts with `name` and `default` |
| `defaultLayout` | `string` | yes | Default layout name, such as `'image/normal'` |

## Create a media type

```typescript
const video = await t4.mediaTypes.create({
  name: 'Video',
  extensions: ['mp4', 'webm', 'mov'],
  binary: true,
  maxSize: '50 MB', // also accepts 52428800 bytes or null for unlimited
  layouts: [
    { name: 'video/*', default: false },
    { name: 'video/looping', default: true },
  ],
});
```

Instead of setting `default: true`, pass `defaultLayout`:

```typescript
await t4.mediaTypes.create({
  name: 'Video',
  extensions: ['mp4', 'webm'],
  binary: true,
  layouts: [
    { name: 'video/*', default: false },
    { name: 'video/looping', default: false },
  ],
  defaultLayout: 'video/looping',
});
```

## Update a media type

### Direct update

```typescript
await t4.mediaTypes.update(1, {
  name: 'Image Updated',
  extensions: ['gif', 'jpg', 'jpeg', 'png', 'svg', 'webp', 'avif'],
  maxSize: '10 MB',
});
```

### Mutable item

```typescript
const mediaType = await t4.mediaTypes.get(1);
mediaType.name = 'Image Updated';
mediaType.extensions = [...mediaType.extensions, 'avif'];
mediaType.maxSize = '10 MB';
mediaType.defaultLayout = 'image/*';
await mediaType.save();
```

## Set the maximum size

`maxSize` accepts:

- A formatted string: `'2 KB'`, `'5 MB'`, or `'512 B'`
- A number of bytes: `2048` or `5242880`
- `null` for unlimited size

On read, `maxSize` is a formatted string or `null`.

## Validation rules

1. `parseForTags` cannot be `true` when `binary` is `true`. Tag parsing applies only to text-based media such as CSS, JavaScript, and PHP.
2. Every media type requires at least one default layout.

For a non-binary type, enable `parseForTags` to let T4 process tags in the file content:

```typescript
await t4.mediaTypes.create({
  name: 'CSS Stylesheet',
  extensions: ['css'],
  binary: false,
  parseForTags: true,
  layouts: [{ name: 'css/*', default: true }],
});
```

---

**Previous:** [Media](./media.md) · **Next:** [Channels](./channels.md)
