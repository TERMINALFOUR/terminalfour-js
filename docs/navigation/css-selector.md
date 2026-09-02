# CSS Selector

Apply different CSS stylesheets to different branches of the site hierarchy.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/css-selector-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'css-selector',
  name: 'My CSS Selector',
  properties: {
    defaultStylesheet: 11299,
    language: 'en',
    branches: [
      { stylesheet: 4767, rootSection: 233 },
      { stylesheet: 4768, name: 'Homepage' },
    ],
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `defaultStylesheet` | `number` | *required* | Media ID of the default stylesheet. |
| `language` | `string` | `''` | Language code. |
| `branches` | `array` | `[]` | Branch-specific stylesheet overrides. |

### Branch object

| Property | Type | Description |
|---|---|---|
| `stylesheet` | `number` | Media ID of the stylesheet for this branch. Required. |
| `name` | `string` | Section name to match. Do not combine it with `rootSection`. |
| `rootSection` | `number` | Section ID to use as the root. Do not combine it with `name`. |

## Validation

- `defaultStylesheet` is required, and its media item must exist.
- The SDK validates each branch `stylesheet`.
- The SDK validates each branch `rootSection` and requires the section to exist.
- A branch cannot contain both `name` and `rootSection`.

## API notes

The SDK sends branch properties only when `branches` is provided.

[Back to Navigation](../navigation.md)
