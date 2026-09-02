# Site Map

Output a hierarchical site map with optional content counts.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/site-map-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'site-map',
  name: 'Full Site Map',
  properties: {
    startSection: 233,
    levels: 5,
    childSectionLinks: true,
    enableContentCount: true,
    contentTypeIds: [67, 363],
    maxLevelsToCount: 10,
    countRecursively: true,
    htmlBeforeContentCount: '(',
    htmlAfterContentCount: ')',
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `startSection` | `number` | `0` | Starting section ID. `0` starts at the channel root. |
| `levels` | `number` | `0` | Number of levels. `0` includes all levels. |
| `childSectionLinks` | `boolean` | `false` | Shows links to child sections. |
| `enableContentCount` | `boolean` | `false` | Adds content counts. |

### When `enableContentCount` is `true`

| Property | Type | Default | Description |
|---|---|---|---|
| `contentTypeIds` | `number[]` | `[]` | Content Type IDs to count. An empty array includes all content types. |
| `maxLevelsToCount` | `number` | `''` | Maximum levels to recurse while counting. |
| `countRecursively` | `boolean` | `false` | Counts recursively through child sections. |
| `htmlBeforeContentCount` | `string` | `''` | HTML before the count. |
| `htmlAfterContentCount` | `string` | `''` | HTML after the count. |

## Validation

- The SDK validates `startSection` when it is a positive number.
- The SDK validates every ID in `contentTypeIds` and requires each content type to exist.
- Content-count fields throw when set without `enableContentCount: true`.

## Read behavior

The SDK hides content-count fields when `enableContentCount` is `false`.

[Back to Navigation](../navigation.md)
