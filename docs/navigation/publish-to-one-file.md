# Publish to One File

Draw all content below a section, including content from child sections, into one page.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/publish-to-one-file-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'publish-to-one-file',
  name: 'All Content',
  properties: {
    contentTypeId: 38,
    startSection: 'specific',
    section: 7725,
    showHiddenSections: true,
    levelsToRecurse: 10,
    beforeHtml: '<div>',
    afterHtml: '</div>',
    showSectionName: true,
    showNameForHidden: true,
    beforeSectionName: '<h3>',
    afterSectionName: '</h3>',
    surroundingPageLayout: 344,
    altLayoutName: 'text/foo',
    enableCaching: true,
    pagination: true,
    contentPerPage: 10,
    beforePaginationHtml: '<div class="pagination">',
    betweenPaginationHtml: '|',
    afterPaginationHtml: '</div>',
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `contentTypeId` | `number \| null` | `null` | Content Type ID. `null` includes all content types. |
| `startSection` | `string` | `'current'` | Content source: `'current'`, `'specific'`, or `'element'`. |
| `showHiddenSections` | `boolean` | `false` | Includes hidden sections. |
| `levelsToRecurse` | `number` | `1` | Number of levels to recurse. |
| `beforeHtml` | `string` | `''` | HTML before content. |
| `afterHtml` | `string` | `''` | HTML after content. |
| `showSectionName` | `boolean` | `false` | Displays section names in the output. |
| `surroundingPageLayout` | `number` | `n/a` | Page Layout ID. |
| `altLayoutName` | `string` | `''` | Alternative content layout name. |
| `enableCaching` | `boolean` | `true` | Controls output caching. |
| `pagination` | `boolean` | `false` | Splits output across pages. |

### When `startSection` is `'specific'`

| Property | Type | Description |
|---|---|---|
| `section` | `number` | Required section ID. |

### When `startSection` is `'element'`

| Property | Type | Description |
|---|---|---|
| `startSectionElement` | `string` | Free-text content element name from which to derive the section. |

### When `showSectionName` is `true`

| Property | Type | Default | Description |
|---|---|---|---|
| `showNameForHidden` | `boolean` | `false` | Shows names for hidden sections. |
| `beforeSectionName` | `string` | `''` | HTML before each section name. |
| `afterSectionName` | `string` | `''` | HTML after each section name. |

### When `pagination` is `true`

| Property | Type | Default | Description |
|---|---|---|---|
| `contentPerPage` | `number` | `0` | Items per page. |
| `beforePaginationHtml` | `string` | `''` | HTML before pagination. |
| `betweenPaginationHtml` | `string` | `''` | HTML between pagination links. |
| `afterPaginationHtml` | `string` | `''` | HTML after pagination. |

## Validation

- When `startSection` is `'specific'`, `section` is required and validated. Do not set it for other start-section modes.
- Set `startSectionElement` only when `startSection` is `'element'`.
- Set `showNameForHidden`, `beforeSectionName`, and `afterSectionName` only when `showSectionName` is `true`.
- Set `contentPerPage` and the pagination HTML fields only when `pagination` is `true`.
- The SDK validates `surroundingPageLayout` against page layouts.
- The SDK validates `contentTypeId` when it is not `null`.

[Back to Navigation](../navigation.md)
