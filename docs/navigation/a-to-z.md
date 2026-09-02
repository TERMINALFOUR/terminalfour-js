# A to Z Navigation

Build an alphabetical section listing for a directory-style page.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/a-to-z-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'a-to-z',
  name: 'Department A-Z',
  properties: {
    startLevel: 2,
    endLevel: 5,
    useSectionMetaData: true,
    sectionMetaContentTypeElement: 'Title',
    microSite: 6,
    beforeMenu: '<ul class="az-nav">',
    afterMenu: '</ul>',
    beforeItem: '<li>',
    afterItem: '</li>',
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `startLevel` | `number` | `0` | Starts generation at this level. `0` starts at the root. |
| `endLevel` | `number` | `0` | Stops generation at this level. `0` includes all sections. |
| `useSectionMetaData` | `boolean` | `false` | Uses a Section Meta Data element instead of the section name. |
| `microSite` | `number \| null` | `null` | Restricts the navigation to this microsite ID. |
| `beforeMenu` | `string` | `''` | HTML before the menu. |
| `afterMenu` | `string` | `''` | HTML after the menu. |
| `beforeItem` | `string` | `''` | HTML before each item. |
| `afterItem` | `string` | `''` | HTML after each item. |

### When `useSectionMetaData` is `true`

| Property | Type | Default | Description |
|---|---|---|---|
| `sectionMetaContentTypeElement` | `string` | `''` | Names the element on the Section Meta Data content type. |

## Validation

- Set `sectionMetaContentTypeElement` only when `useSectionMetaData` is `true`.
- The SDK validates `sectionMetaContentTypeElement` against the elements on the Section Meta Data content type.
- The SDK validates `microSite` against the microsites configured on all channels.

## API notes

The SDK gets the Section Meta Data content type through `GET /config/hierarchy.metaDataContentType`.

## Caching

Caching is always disabled for this type.

[Back to Navigation](../navigation.md)
