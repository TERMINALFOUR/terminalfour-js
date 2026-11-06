# Page Layouts

Use `t4.pageLayouts` to manage page layout code, syntax, processors, and file extensions.

## List and read page layouts

```typescript
const layouts = await t4.pageLayouts.list();
// [{ id: 5, name: 'Main Layout', description: 'Default page layout' }]

const layout = await t4.pageLayouts.get(5);
```

A full page layout includes:

| Property | Example or meaning |
|---|---|
| `name` | Layout name |
| `description` | Layout description |
| `headerCode` | Header markup or code |
| `footerCode` | Footer markup or code |
| `fileExtension` | Output file extension, or `''` for None |
| `syntax` | Syntax such as `'HTML/XML'` |
| `processor` | Processor such as `'handlebars'`. A processor outside the three supported keys reads back as its Terminalfour name (or `unknown (id)`). |
| `primaryGroup` | Owning group ID. `0` means no primary group (Global). |
| `sharedGroups` | Array of group IDs the layout is shared with |

## Create a page layout

```typescript
await t4.pageLayouts.create({
  name: 'My Layout',
  description: 'A custom page layout',
  headerCode: '<!DOCTYPE html><html><head></head><body>',
  footerCode: '</body></html>',
  syntax: 'HTML/XML',      // optional; default: 'HTML/XML'
  processor: 'handlebars', // optional; default: 'handlebars'
  fileExtension: 'html',   // optional; default: None
  primaryGroup: 35,        // optional; owning group ID
  sharedGroups: [34, 40],  // optional; group IDs to share with
});
```

## Processor, syntax, and file extension

These values are instance-specific, so the SDK always resolves them against what your Terminalfour instance actually has. Nothing is hardcoded, and nothing is silently substituted.

| Field | Accepted values | Default on `create()` | When it can't be resolved |
|---|---|---|---|
| `processor` | `'handlebars'`, `'t4-tags'`, `'programmable-layouts'` | `'handlebars'` | Throws `Unknown processor "x". Valid options: ...` for any other key, or `Processor "Handlebars Page" not found on this T4 instance. Available processors: ...` if the instance doesn't have it |
| `syntax` | Any syntax name on the instance (case-insensitive) | `'HTML/XML'` | Throws `Unknown syntax "x". Valid options: ...` |
| `fileExtension` | Any extension on the instance (case-insensitive; the instance's casing is used) | None (`''`), with no lookup | Throws `Unknown extension "x". Valid options: ...` |

If the list of valid file extensions can't be fetched, the SDK throws `Could not validate file extension "html": <reason>` rather than creating or saving the layout without the extension you asked for. The original error is available as `error.cause`:

```typescript
try {
  await t4.pageLayouts.create({ name: 'My Layout', fileExtension: 'html' });
} catch (error) {
  console.error(error.message); // Could not validate file extension "html": ...
  console.error(error.cause);   // the underlying T4ApiError
}
```

The same rules apply on `save()` and `update()`, but only to values you change. A field you don't touch is sent back exactly as it was read, so you can still rename a layout that uses a processor outside the three supported keys. Setting `fileExtension` to `''` clears it (None) without a lookup.

The lists of processors, syntaxes, and file extensions are cached for five minutes. `t4.clearCache()` clears them. A failed lookup is never cached, so the next call tries again.

## Group and visibility

`primaryGroup` is the layout's owning group and `sharedGroups` are the groups it is shared with. Both are read on `get()` and written on `save()`, `update()`, and `create()`. Set `primaryGroup` to `0` to remove the owning group (Global):

```typescript
const layout = await t4.pageLayouts.get(5);
console.log(layout.primaryGroup); // 35
console.log(layout.sharedGroups); // [34, 40]

layout.primaryGroup = 0;   // remove from its group (Global)
layout.sharedGroups = [];
await layout.save();
```

Or through `update()`:

```typescript
await t4.pageLayouts.update(5, { primaryGroup: 35, sharedGroups: [34] });
```

`sharedGroups` cannot contain the `primaryGroup` id: a group cannot be both the owning group and a shared group. The SDK throws a clear error before sending the request (Terminalfour otherwise returns an opaque 500).

## Update a page layout

### Direct update

```typescript
await t4.pageLayouts.update(5, {
  name: 'Renamed',
  headerCode: '<!-- updated -->',
});
```

### Mutable item

```typescript
const layout = await t4.pageLayouts.get(5);
layout.name = 'Renamed';
layout.headerCode = '<!-- updated -->';
layout.processor = 't4-tags';
await layout.save();
```

## Delete a page layout

```typescript
await t4.pageLayouts.delete(5);
```

---

**Previous:** [Groups & Users](./groups-and-users.md) · **Next:** [Media](./media.md)
