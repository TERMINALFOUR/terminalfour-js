# Related Section Branch

Link to a named child section across branches.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/related-section-branch-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'related-section-branch',
  name: 'News Link',
  properties: {
    childSectionName: 'news',
    linkText: 'View News',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `childSectionName` | `string` | `''` | Name of the child section to link to. |
| `linkText` | `string` | `''` | Displayed link text. |

## Validation

No validation applies. Both fields are optional free-text strings.

[Back to Navigation](../navigation.md)
