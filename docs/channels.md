# Channels

Use `t4.channels` to list channel summaries, inspect channel configuration, and publish a channel.

## List channels

```typescript
const channels = await t4.channels.list();
// [{ id: 1, name: 'Sample Site', description: '...', rootSectionId: 233 }]
```

A channel with microsites includes a `microSites` array. The property is omitted when the channel has no microsites.

```typescript
const channel = channels.find(item => item.microSites);
if (channel?.microSites) {
  for (const microsite of channel.microSites) {
    console.log(microsite.id, microsite.name, microsite.rootSectionId, microsite.parentId);
  }
}
```

## Get channel details

```typescript
const channel = await t4.channels.get(1);
```

| Property | Example or meaning |
|---|---|
| `name` | `'Sample Site'` |
| `description` | Channel description |
| `defaultLayout` | `'text/html'` |
| `defaultLanguage` | `'en'` |
| `rootSectionId` | `233` |
| `fileOutputPath` | `'/web/stage/htdocs/'` |
| `indexFileName` | `'index.php'` |
| `baseHref` | `'https://example.com'` |
| `siteRoot` | `'/'` |
| `publishUrl` | `'https://example.com'` |
| `defaultFullTextLayout` | Default fulltext layout |
| `fullTextExtension` | Fulltext file extension |
| `fileExtensions` | `['php', 'xml', 'json']`, sorted by priority |
| `languages` | `[{ code: 'en', name: 'English', charset: 'ISO-8859-15' }]` |
| `microSites` | `[{ id: 6, name: 'Microsite Test' }]` or `undefined` |

## Publish a channel

```typescript
const channel = await t4.channels.get(1);
await channel.publish();

await channel.publish({
  includeArchives: true,
  overridePublishPeriodRestriction: true,
  language: 'fr',
});
```

---

**Previous:** [Media Types](./media-types.md) · **Next:** [Navigation](./navigation.md)
