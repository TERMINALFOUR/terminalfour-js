# Top Content

Display recent or relevant content from a section or branch, ordered by date or name.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/top-content-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'top-content',
  name: 'Latest Articles',
  properties: {
    fetchMethod: 'section',
    section: 237,
    contentTypeIds: [67, 151],
    channelId: 5,
    upcomingContent: true,
    dateElement: 'Date released',
    ignoreDateOrdering: false,
    numToDisplay: 5,
    startAt: 10,
    altLayoutName: 'text/foo',
    title: 'Latest',
    beforeHtml: '<ul>',
    afterHtml: '</ul>',
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `fetchMethod` | `string` | `'current'` | Content source: `'current'`, `'current-branch'`, `'branch'`, or `'section'`. |
| `contentTypeIds` | `number[]` | `[]` | Content Type IDs by which to filter. An empty array includes all content types. |
| `channelId` | `number` | `0` | Channel ID. `0` applies no channel restriction. |

### When `fetchMethod` is `'branch'` or `'section'`

| Property | Type | Default | Description |
|---|---|---|---|
| `section` | `number` | `n/a` | Required section ID. |

### Ordering and filtering

| Property | Type | Default | Description |
|---|---|---|---|
| `upcomingContent` | `boolean` | `false` | Includes upcoming or future content. |
| `dateElement` | `string` | `''` | Date element name for ordering and filtering. |
| `ignoreDateOrdering` | `boolean` | `false` | Uses Terminalfour's section order instead of date order. |

### Results and output

| Property | Type | Default | Description |
|---|---|---|---|
| `numToDisplay` | `number` | `0` | Number of items. `0` displays all items. |
| `startAt` | `number` | `0` | Skips this many items from the start. |
| `altLayoutName` | `string` | `''` | Alternative content layout name. |
| `title` | `string` | `''` | Title text. |
| `beforeHtml` | `string` | `''` | HTML before content. |
| `afterHtml` | `string` | `''` | HTML after content. |

## Validation

- When `fetchMethod` is `'branch'` or `'section'`, `section` is required and validated. Do not set it for the other fetch methods.
- The SDK validates each ID in `contentTypeIds` and requires every content type to exist.
- The SDK validates `channelId` when it is a positive number.

## Read behavior

The SDK hides `section` when the fetch method does not use it.

## Caching

Caching is enabled by default.

[Back to Navigation](../navigation.md)
