# Section Meta Info

Output the value of one section metadata tag.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/section-meta-info-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'section-meta-info',
  name: 'OG Description',
  properties: {
    metaType: 'og:description',
    dateFormat: 'dd.MM.yyyy',
    beforeHtml: '<meta content="',
    afterHtml: '">',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `metaType` | `string` | *required* | Meta tag name, such as `'description'` or `'og:title'`. |
| `dateFormat` | `string` | `''` | Date format string, such as `'dd.MM.yyyy'`. |
| `beforeHtml` | `string` | `''` | HTML before the output. |
| `afterHtml` | `string` | `''` | HTML after the output. |

## Validation

`metaType` is required and validated against the meta tag definitions from `GET /meta/level`.

## Read behavior

The SDK resolves the numeric ID back to the metadata tag name.

[Back to Navigation](../navigation.md)
