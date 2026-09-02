# Section Iterator

Iterate over sections to output content from multiple sections, with configurable HTML around and between them.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/section-iterator-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'section-iterator',
  name: 'My Iterator',
  properties: {
    beforeHtml: '<ul>',
    betweenHtml: '<li>',
    afterHtml: '</ul>',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `beforeHtml` | `string` | `''` | HTML before the output. |
| `betweenHtml` | `string` | `''` | HTML between sections. |
| `afterHtml` | `string` | `''` | HTML after the output. |

## Validation

No validation applies. All fields are optional strings.

[Back to Navigation](../navigation.md)
