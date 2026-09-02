# Return to Index

Link from a fulltext content page back to its section index.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/return-to-index-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'return-to-index',
  name: 'Back Link',
  properties: {
    linkText: 'Back to...',
    appendSectionName: true,
    scrollToContent: true,
    linkTarget: '_blank',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `linkText` | `string` | `''` | Link text. |
| `appendSectionName` | `boolean` | `false` | Appends the section name to the link text. |
| `scrollToContent` | `boolean` | `false` | Scrolls to the content when clicked. |
| `linkTarget` | `string` | `''` | Link target attribute, such as `'_blank'`. |

## Validation

All fields are optional.

[Back to Navigation](../navigation.md)
