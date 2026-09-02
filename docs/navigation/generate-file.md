# Generate File

Publish a file from a content layout or media item into a directory during publishing.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/generate-file--navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'generate-file',
  name: 'RSS Feed Generator',
  properties: {
    fileName: 'feed',
    fileExtension: 'xml',
    layout: 'text/rss',
    appendContentId: true,
    appendDirectory: true,
    baseDirectory: '/feeds',
    mediaFile: 4767,
  },
});
```

## Properties

### File and source

| Property | Type | Default | Description |
|---|---|---|---|
| `fileName` | `string` | `''` | Output file name. |
| `fileExtension` | `string` | `''` | Generated file extension. |
| `layout` | `string` | `''` | Content layout name. |
| `mediaFile` | `number \| null` | `null` | Media ID to associate. |

### Output path

| Property | Type | Default | Description |
|---|---|---|---|
| `appendContentId` | `boolean` | `false` | Appends the content ID to the file name. |
| `appendDirectory` | `boolean` | `false` | Appends the directory path. |
| `baseDirectory` | `string` | `''` | Base output directory. |

## Validation

When `mediaFile` is provided, the SDK validates it against the media library.

[Back to Navigation](../navigation.md)
