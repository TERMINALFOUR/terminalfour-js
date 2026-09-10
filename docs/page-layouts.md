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
| `fileExtension` | Output file extension |
| `syntax` | Syntax such as `'HTML/XML'` |
| `processor` | Processor such as `'handlebars'` |
| `primaryGroup` | Owning group ID. `0` means no primary group (Global). |
| `sharedGroups` | Array of group IDs the layout is shared with |

## Create a page layout

```typescript
await t4.pageLayouts.create({
  name: 'My Layout',
  description: 'A custom page layout',
  headerCode: '<!DOCTYPE html><html><head></head><body>',
  footerCode: '</body></html>',
  syntax: 'HTML/XML',      // optional
  processor: 'handlebars', // optional; default: 'handlebars'
  fileExtension: 'html',   // optional
  primaryGroup: 35,        // optional; owning group ID
  sharedGroups: [34, 40],  // optional; group IDs to share with
});
```

Processor options are `'handlebars'`, `'t4-tags'`, and `'programmable-layouts'`. The default is `'handlebars'`.

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
