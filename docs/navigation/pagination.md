# Pagination

Fetch content from a branch or section and split it across pages with navigation links.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/pagination-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'pagination',
  name: 'Article Pagination',
  properties: {
    contentTypeId: 67,
    fetchMethod: 'branch',
    section: 233,
    numToRecurse: 3,
    contentItemsPerPage: 10,
    maxContentItems: 100,
    maxLinksPerPage: 5,
    altLayoutName: 'text/json',
    searchHiddenSections: true,
    beforeHtml: '<nav>',
    afterHtml: '</nav>',
    beforePaginationHtml: '<ul>',
    afterPaginationHtml: '</ul>',
    betweenPaginationHtml: ' | ',
  },
});
```

## Fetch method summary

| `fetchMethod` | `section` | `level` | `numToRecurse` |
|---|---|---|---|
| `'current'` | The SDK sets it to `0`. | The SDK sets it to `0`. | The SDK sets it to `0`. |
| `'current-branch'` | The SDK sets it to `0`. | The SDK sets it to `0`. | You can set it. |
| `'branch'` | Required and validated. | The SDK sets it to `0`. | You can set it. |
| `'branch-at-level'` | Required and validated. | You can set it. | You can set it. |
| `'section'` | Required and validated. | The SDK sets it to `0`. | The SDK sets it to `0`. |

## Properties

### Fetch scope

| Property | Type | Default | Description |
|---|---|---|---|
| `contentTypeId` | `number` | *required* | Content Type ID to paginate. |
| `fetchMethod` | `string` | `'current'` | Fetch scope: `'current'`, `'current-branch'`, `'branch'`, `'branch-at-level'`, or `'section'`. |
| `section` | `number` | `n/a` | Section ID for `'branch'`, `'branch-at-level'`, or `'section'`. |
| `level` | `number` | `0` | Level for `'branch-at-level'`. |
| `numToRecurse` | `number` | `0` | Recursion depth for `'current-branch'`, `'branch'`, or `'branch-at-level'`. |
| `searchHiddenSections` | `boolean` | `false` | Includes hidden sections in the search. |

### Pagination and layout

| Property | Type | Default | Description |
|---|---|---|---|
| `contentItemsPerPage` | `number` | `0` | Items per page. `0` disables pagination. |
| `maxContentItems` | `number` | `0` | Maximum total items. `0` sets no limit. |
| `maxLinksPerPage` | `number` | `0` | Maximum pagination links. `0` shows all links. |
| `altLayoutName` | `string` | `''` | Alternative content layout name. |

### Output HTML

| Property | Type | Default | Description |
|---|---|---|---|
| `beforeHtml` | `string` | `''` | HTML before content. |
| `afterHtml` | `string` | `''` | HTML after content. |
| `beforePaginationHtml` | `string` | `''` | HTML before pagination links. |
| `afterPaginationHtml` | `string` | `''` | HTML after pagination links. |
| `betweenPaginationHtml` | `string` | `''` | HTML between pagination links. |

## Validation

- `contentTypeId` is required and validated.
- When provided, `altLayoutName` is validated against the content type's layouts.
- The SDK validates `section` when the selected fetch method requires it.

[Back to Navigation](../navigation.md)
