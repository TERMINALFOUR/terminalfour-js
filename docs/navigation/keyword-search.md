# Keyword Search Content

Find and display content items that share keywords with the current content across sections.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/keyword-search-content-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'keyword-search',
  name: 'Keywords Search',
  properties: {
    // Keyword Retrieval
    keywordFetchMethod: 'section',
    keywordSection: 233,
    narrowToSingleContentItem: true,
    keywordContentTypeId: 343,
    keywordElements: ['Cascading List', 'Keyword Selector'],

    // Content Retrieval
    contentFetchMethod: 'section',
    searchSection: 7805,
    searchContentTypeId: 67,
    searchElements: ['Finditems'],

    // Display
    numToDisplay: 10,
    sortType: 'name',
    sortByDateElement: true,
    dateElementName: 'Release Date',
    showHiddenSections: true,
    matchCompositeKeywords: true,
    matchSubItems: true,
    crossLanguageSearch: true,
    crossLanguageLanguages: ['en', 'es'],

    // Output
    altLayoutName: 'text/bar',
    beforeHtml: '<div>',
    afterHtml: '</div>',
    pagination: true,
    contentPerPage: 20,
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `keywordFetchMethod` | `string` | `'current'` | Keyword source: `'current'`, `'parent'`, or `'section'`. |
| `narrowToSingleContentItem` | `boolean` | `false` | Narrows the keyword source to one content item. |
| `keywordContentTypeId` | `number \| null` | `null` | Content Type ID. `null` accepts any content type. |
| `keywordElements` | `string[]` | `[]` | Element names from which to get keywords. |
| `contentFetchMethod` | `string` | `'section'` | Content scope: `'section'`, `'branch'`, or `'branch-at-level'`. |
| `searchContentTypeId` | `number \| null` | `null` | Content Type ID to search. `null` accepts any content type. |
| `searchElements` | `string[]` | `[]` | Element names in which to search for keywords. |

### When `keywordFetchMethod` is `'section'`

| Property | Type | Default | Description |
|---|---|---|---|
| `keywordSection` | `number` | `n/a` | Section ID from which to get keywords. |

### When `contentFetchMethod` is `'section'` or `'branch'`

| Property | Type | Default | Description |
|---|---|---|---|
| `searchSection` | `number` | `n/a` | Section to search. Use this or `searchSectionElement`, not both. |
| `searchSectionElement` | `string` | `n/a` | Element name from which to derive the section. Use this or `searchSection`, not both. |

### When `contentFetchMethod` is `'branch-at-level'`

| Property | Type | Default | Description |
|---|---|---|---|
| `startLevel` | `number` | `0` | Starting level. |
| `endLevel` | `number` | `0` | Ending level or recursion depth. |

### Display

| Property | Type | Default | Description |
|---|---|---|---|
| `numToDisplay` | `number` | `0` | Number of items. `0` displays all items. |
| `sortType` | `string` | `'name'` | Sort order: `'name'`, `'name-desc'`, or `'last-modified'`. |
| `sortByDateElement` | `boolean` | `false` | Sorts by a date element. |
| `showUpcomingContent` | `boolean` | `false` | Includes upcoming or future content. |
| `showHiddenSections` | `boolean` | `false` | Includes hidden sections. |
| `matchCompositeKeywords` | `boolean` | `false` | Matches composite keywords. |
| `matchSubItems` | `boolean` | `false` | Matches sub-items. |
| `crossLanguageSearch` | `boolean` | `false` | Searches across languages. |
| `crossLanguageLanguages` | `string[]` | `[]` | Language codes, such as `['en', 'es']`. |

### When `sortByDateElement` is `true`

| Property | Type | Default | Description |
|---|---|---|---|
| `dateElementName` | `string` | `n/a` | Date element name. |

### Output

| Property | Type | Default | Description |
|---|---|---|---|
| `altLayoutName` | `string` | `''` | Alternative content layout name. |
| `beforeHtml` | `string` | `''` | HTML before content. |
| `afterHtml` | `string` | `''` | HTML after content. |
| `pagination` | `boolean` | `false` | Paginates the results. |

### When `pagination` is `true`

| Property | Type | Default | Description |
|---|---|---|---|
| `contentPerPage` | `number` | `0` | Items per page. |
| `beforePaginationHtml` | `string` | `''` | HTML before pagination. |
| `betweenPaginationHtml` | `string` | `''` | HTML between pagination links. |
| `afterPaginationHtml` | `string` | `''` | HTML after pagination. |

## Validation

- When `keywordFetchMethod` is `'section'`, `keywordSection` is required and validated.
- For a `'section'` or `'branch'` content search, set exactly one of `searchSection` and `searchSectionElement`.
- The SDK validates `searchSectionElement` against content type elements when `keywordContentTypeId` is a positive number.
- Provide `startLevel` and `endLevel` only for `'branch-at-level'`.
- Provide `dateElementName` only when `sortByDateElement` is `true`.
- Provide pagination fields only when `pagination` is `true`.
- The SDK validates non-null `keywordContentTypeId` and `searchContentTypeId` values.

## Caching

Caching is enabled by default.

[Back to Navigation](../navigation.md)
