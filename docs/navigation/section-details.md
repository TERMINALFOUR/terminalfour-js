# Section Details

Output a section's ID, name, path, or link.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/section-details-navigation-object/)

## Create

```typescript
await t4.navigation.create({
  type: 'section-details',
  name: 'Show Section Path',
  properties: {
    detailMethod: 'section',
    section: 233,
    displayType: 'path',
  },
});
```

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `detailMethod` | `string` | `'current'` | Section selector: `'current'`, `'level'`, or `'section'`. |
| `displayType` | `string` | `'id'` | Output value: `'id'`, `'name'`, `'path'`, or `'link'`. |

### When `detailMethod` is `'level'`

| Property | Type | Default | Description |
|---|---|---|---|
| `level` | `number` | `0` | Section level. |

### When `detailMethod` is `'section'`

| Property | Type | Default | Description |
|---|---|---|---|
| `section` | `number` | `n/a` | Required section ID. |

## Validation

- Set `level` only when `detailMethod` is `'level'`.
- When `detailMethod` is `'section'`, `section` is required and validated. Do not set it for other methods.

## Read behavior

The SDK hides fields that do not apply to the current method.

[Back to Navigation](../navigation.md)
