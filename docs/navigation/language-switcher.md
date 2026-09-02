# Language Switcher

Link between language versions of the current page on a multilingual site.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/language-switcher-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'language-switcher',
  name: 'Language Nav',
  properties: {
    langCode: 'en',
    alwaysOutput: true,
    imageUrl: 'https://example.com/flags',
    imageExtension: '.gif',
    imageProperties: 'width="30" height="30"',
    beforeHtml: '<div class="langs">',
    afterHtml: '</div>',
  },
});
```

## Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `langCode` | `string` | `''` | Language code. |
| `alwaysOutput` | `boolean` | `false` | Outputs the switcher when only one language exists. |
| `imageUrl` | `string` | `''` | URL for image-based language links. |
| `imageExtension` | `string` | `''` | File extension for language images, such as `.gif`. |
| `imageProperties` | `string` | `''` | HTML image attributes, such as `width="30"`. |
| `beforeHtml` | `string` | `''` | HTML before the switcher. |
| `afterHtml` | `string` | `''` | HTML after the switcher. |

[Back to Navigation](../navigation.md)
