# Top Stories

Display content from one section with optional links to fulltext pages.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/top-stories-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'top-stories',
  name: 'Latest News',
  properties: {
    section: 237,
    numToShow: 10,
    linkToFulltext: true,
    title: 'Latest',
    beforeMenuHtml: '<ul>',
    afterMenuHtml: '</ul>',
    beforeHtml: '<li>',
    afterHtml: '</li>',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `section` | `number` | *required* | Section ID. |
| `numToShow` | `number` | `0` | Number of items. `0` displays all items. |
| `linkToFulltext` | `boolean` | `false` | Links items to their fulltext pages. |
| `title` | `string` | `''` | Title text. |
| `beforeMenuHtml` | `string` | `''` | HTML before the menu. |
| `afterMenuHtml` | `string` | `''` | HTML after the menu. |
| `beforeHtml` | `string` | `''` | HTML before each item. |
| `afterHtml` | `string` | `''` | HTML after each item. |

## Validation

`section` is required and validated.

## Caching

Caching is enabled by default.

[Back to Navigation](../navigation.md)
