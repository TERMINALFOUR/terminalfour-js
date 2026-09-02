# Breadcrumbs

Show the current page's hierarchy and link back through its parent sections.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/breadcrumbs-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'breadcrumbs',
  name: 'Main Breadcrumbs',
  properties: {
    startLevel: 1,
    endLevel: 0,
    useLinks: true,
    linkCurrent: false,
    hideHome: true,
    noSpace: true,
    maxLength: 50,
    separator: ' > ',
    elementToAppend: 'Title',
    beforeHtml: '<nav aria-label="breadcrumb">',
    afterHtml: '</nav>',
  },
});
```

## Properties

### Level range

| Property | Type | Default | Description |
|---|---|---|---|
| `startLevel` | `number` | `0` | Starts at this level. `0` starts at the root. |
| `endLevel` | `number` | `0` | Ends at this level. `0` includes all levels. |
| `maxLength` | `number` | `0` | Truncates after this many characters. `0` sets no limit. |

### Link behavior

| Property | Type | Default | Description |
|---|---|---|---|
| `useLinks` | `boolean` | `false` | Turns breadcrumb items into links. |
| `linkCurrent` | `boolean` | `false` | Turns the current, last item into a link. |
| `hideHome` | `boolean` | `false` | Hides the home section. |
| `noSpace` | `boolean` | `false` | Removes spaces from links. |

### Content and output

| Property | Type | Default | Description |
|---|---|---|---|
| `separator` | `string` | `''` | HTML between items. |
| `elementToAppend` | `string` | `''` | Names the content element to append. |
| `beforeHtml` | `string` | `''` | HTML before the breadcrumb. |
| `afterHtml` | `string` | `''` | HTML after the breadcrumb. |

## Validation

- `startLevel`, `endLevel`, and `maxLength` must be zero or greater.
- Set either a positive `startLevel` or `endLevel`, or a positive `maxLength`. Do not combine the level range with `maxLength`.
- Set `noSpace` to `true` only when `useLinks` is `true`.

## API behavior

Setting `elementToAppend` automatically enables the append-content-element flag.

[Back to Navigation](../navigation.md)
