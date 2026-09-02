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
});
```

Processor options are `'handlebars'`, `'t4-tags'`, and `'programmable-layouts'`. The default is `'handlebars'`.

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
