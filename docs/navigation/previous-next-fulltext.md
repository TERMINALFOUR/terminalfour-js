# Previous/Next Fulltext Content

Link sequential fulltext content items within a section.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/previousnext-fulltext-content-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'previous-next-fulltext',
  name: 'Article Nav',
  properties: {
    type: 'both',
    altLayoutName: 'text/nav',
    skipNonFulltextContent: true,
    onlyLinkToContentWithNav: false,
    sameContentTypeRestriction: true,
    displayOnBoundary: false,
    displayContentNameAsTitle: true,
    previousHtml: '&laquo; Previous',
    betweenHtml: ' | ',
    nextHtml: 'Next &raquo;',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `type` | `string` | `'previous'` | Link direction: `'previous'`, `'next'`, or `'both'`. |
| `altLayoutName` | `string` | `''` | Alternative content layout name. |
| `skipNonFulltextContent` | `boolean` | `false` | Skips content without fulltext. |
| `onlyLinkToContentWithNav` | `boolean` | `false` | Links only to content that also has previous/next navigation. |
| `sameContentTypeRestriction` | `boolean` | `false` | Restricts links to the same content type. |
| `displayOnBoundary` | `boolean` | `false` | Displays links at the first and last boundaries. |
| `displayContentNameAsTitle` | `boolean` | `false` | Uses the content name as the link title. |
| `previousHtml` | `string` | `''` | HTML for the previous link. |
| `betweenHtml` | `string` | `''` | HTML between links. |
| `nextHtml` | `string` | `''` | HTML for the next link. |

[Back to Navigation](../navigation.md)
