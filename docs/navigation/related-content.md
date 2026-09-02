# Related Content

Fetch and display content from the current section, a specific section, or a named child section.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/related-content-navigation-object/)

## Create

```typescript
// Current section
await t4.navigation.create({
  type: 'related-content',
  name: 'Related',
  properties: { fetchMethod: 'current', title: 'Related Items' },
});

// Specific section
await t4.navigation.create({
  type: 'related-content',
  name: 'Related',
  properties: {
    fetchMethod: 'section',
    section: 235,
    altLayoutName: 'text/foo',
  },
});

// Child section
await t4.navigation.create({
  type: 'related-content',
  name: 'Related',
  properties: {
    fetchMethod: 'child',
    childSectionName: 'Related Child',
    contentTypeIds: [67, 363],
    display: 5,
    recurseChildSection: true,
    altLayoutName: 'text/foo',
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `fetchMethod` | `string` | `'current'` | Content source: `'current'`, `'section'`, or `'child'`. |
| `title` | `string` | `''` | Title text. |
| `altLayoutName` | `string` | `''` | Alternative content layout name. |
| `beforeHtml` | `string` | `''` | HTML before content. |
| `afterHtml` | `string` | `''` | HTML after content. |

### When `fetchMethod` is `'section'`

| Property | Type | Description |
|---|---|---|
| `section` | `number` | Required section ID. |

### When `fetchMethod` is `'child'`

| Property | Type | Default | Description |
|---|---|---|---|
| `childSectionName` | `string` | `''` | Child section name to search. |
| `contentTypeIds` | `number[]` | *required* | Content Type IDs by which to filter. |
| `display` | `number` | `0` | Number of items. `0` displays all items. |
| `recurseChildSection` | `boolean` | `false` | Searches recursively through child sections. |

## Validation

- When `fetchMethod` is `'section'`, `section` is required and validated.
- When `fetchMethod` is `'child'`, `contentTypeIds` is required and validated.

## Caching

Caching is enabled by default.

[Back to Navigation](../navigation.md)
