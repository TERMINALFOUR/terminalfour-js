# Content Types

Use `t4.contentTypes` to inspect and manage content type fields and layouts.

## Contents

- [List and read content types](#list-and-read-content-types)
- [Create a content type](#create-a-content-type)
- [Update a content type](#update-a-content-type)
- [Add or remove fields](#add-or-remove-fields)
- [Manage content layouts](#manage-content-layouts)

## List and read content types

### List content types

```typescript
const types = await t4.contentTypes.list();
for (const contentType of types) {
  console.log(contentType.id, contentType.name, Object.keys(contentType.fields).length);
}
```

### Get a content type

```typescript
const news = await t4.contentTypes.get(44);
```

The returned `ContentType` includes these main properties:

| Property | Example or purpose |
|---|---|
| `name` | `'News Article'` |
| `description` | Content type description |
| `minUserLevel` | `'contributor'` |
| `workflow` | Assigned workflow |
| `directEdit` | Direct edit setting |
| `primaryGroup` | Primary group |
| `sharedGroups` | Shared groups |
| `fields` | Field definitions keyed by name |

Each entry in `news.fields` can include:

| Property | Meaning |
|---|---|
| `type` | Element type, such as `'Plain Text'` |
| `required` | Whether a value is required |
| `maxSize` | Maximum size, such as `200` |
| `shown` | Whether the field is shown |
| `listId` | List ID; `0` for non-list fields |
| `listName` | Resolved list name when `listId > 0`; otherwise `''` |
| `useAsFilename` | Whether the field supplies the filename |
| `config` | Repeater settings, including `contentTypeName`, `minRepeats`, and `maxRepeats` |
| `editor` | HTML editor, such as `'TinyMCE'` or `'Standard Textarea'` |

```typescript
for (const [name, field] of Object.entries(news.fields)) {
  console.log(name, field.type, field.required, field.maxSize);
}
```

## Create a content type

```typescript
const contentType = await t4.contentTypes.create({
  name: 'Blog Post',
  description: 'A blog post with title and body',
  elements: [
    { name: 'Title', type: 'Plain Text', required: true, maxSize: 200 },
    { name: 'Body', type: 'HTML' },
    { name: 'Summary', type: 'Plain Text', maxSize: 500, shown: false },
  ],
  minUserLevel: 'contributor',
  directEdit: true,
});
```

The SDK always inserts a `Name` element as the first element.

### List-based fields

`Select Box`, `Radio Button`, `Check Box`, `Multiple Select`, `Multi-select List`, `Cascading List`, and `Keyword Selector` fields require `listId`:

```typescript
await t4.contentTypes.create({
  name: 'Categorised Article',
  elements: [
    { name: 'Title', type: 'Plain Text', required: true },
    { name: 'Body', type: 'HTML' },
    { name: 'Category', type: 'Select Box', listId: 71 },
    { name: 'Tags', type: 'Check Box', listId: 72 },
  ],
});
```

### Repeater fields

A Repeater requires the sub-content type that defines its fields:

```typescript
await t4.contentTypes.create({
  name: 'Page with Slides',
  elements: [
    { name: 'Title', type: 'Plain Text', required: true },
    {
      name: 'Slides',
      type: 'Repeater',
      repeater: {
        contentTypeId: 99,      // required: content type that defines repeater fields
        layout: 'text/slides',  // optional; default: ''
        minRepeats: 1,          // optional; default: 0
        maxRepeats: 10,         // optional; default: 100
      },
    },
  ],
});
```

### HTML editors

Set `editor` to choose the editor shown in the T4 content editing UI:

```typescript
await t4.contentTypes.create({
  name: 'Article',
  elements: [
    { name: 'Title', type: 'Plain Text', required: true },
    { name: 'Body', type: 'HTML', editor: 'TinyMCE' },
    { name: 'Notes', type: 'HTML', editor: 'Standard Textarea' },
  ],
});
```

The editor name must exist on the T4 instance. An invalid name produces an error that lists the available options.

## Update a content type

### Direct update

```typescript
await t4.contentTypes.update(44, {
  name: 'Renamed',
  description: 'Updated',
  directEdit: false,
});
```

Add and remove fields in the same call:

```typescript
await t4.contentTypes.update(44, {
  addFields: [
    { name: 'Subtitle', type: 'Plain Text', maxSize: 200 },
    {
      name: 'Slides',
      type: 'Repeater',
      repeater: {
        contentTypeId: 99,
        layout: 'text/slides',
        minRepeats: 1,
        maxRepeats: 10,
      },
    },
  ],
  removeFields: ['Old Field'],
});
```

### Mutable item

```typescript
const contentType = await t4.contentTypes.get(44);
contentType.name = 'Renamed';
contentType.description = 'Updated description';
contentType.minUserLevel = 'moderator';
contentType.fields['Title'].maxSize = 300;
contentType.fields['Title'].required = false;
contentType.fields['Body'].editor = 'Standard Textarea';
await contentType.save();
```

Set an HTML field's `editor` to `null` when you want to use the instance default.

## Add or remove fields

`addField()` is asynchronous because it resolves the element type name to an ID. Field additions and removals take effect when you call `save()`.

```typescript
const contentType = await t4.contentTypes.get(44);

await contentType.addField({
  name: 'Subtitle',
  type: 'Plain Text',
  description: 'Optional subtitle',
  maxSize: 200,
  required: false,
  shown: true,
});

await contentType.addField({
  name: 'Category',
  type: 'Select Box',
  listId: 71,
});

await contentType.addField({
  name: 'Slides',
  type: 'Repeater',
  repeater: {
    contentTypeId: 99,
    layout: 'text/slides',
    minRepeats: 1,
    maxRepeats: 10,
  },
});

await contentType.addField({
  name: 'Body',
  type: 'HTML',
  editor: 'TinyMCE',
});

contentType.removeField('Old Field');
await contentType.save();
```

Delete a content type through the resource:

```typescript
await t4.contentTypes.delete(44);
```

## System content types

System content types are managed by T4 and back core features. Removing or renaming their elements can break the instance, so the SDK blocks both on `save()` (and through `update({ removeFields })`):

```typescript
const systemType = await t4.contentTypes.get(systemTypeId);
systemType.removeField('Some Element');
await systemType.save();
// Error: Cannot remove element "Some Element" from content type "..." because it
// is a system content type. Removing elements from system content types is not allowed.
```

On a system content type you can still:

- Add new elements with `addField()` or `update({ addFields })`
- Change an element's `maxSize`
- Change the content type's `description` and any element's `description`

Two system content types are exempt, because removing and renaming their elements is safe: the **Section Metadata** content type and the **Extended User** content type. On those two, removal and renaming work exactly like a regular content type.

The check runs when you call `save()` or `update()`, not when you call `removeField()`. Because `removeField()` only stages the change in memory, nothing is sent to T4 when the guard blocks a save.

## Manage content layouts

Access layouts through `layouts` on a `ContentType`. Layout operations use names; layout IDs are not exposed.

### List and read layouts

```typescript
const contentType = await t4.contentTypes.get(44);
const layouts = await contentType.layouts.list();
// [{ name: 'text/html', lastModified: Date }]

const layout = await contentType.layouts.get('text/html');
console.log(layout.name);         // 'text/html'
console.log(layout.code);         // '<h1>{{Title}}</h1>'
console.log(layout.lastModified); // Date
```

### Create a layout

```typescript
await contentType.layouts.create({
  name: 'text/json',
  code: '{ "title": "{{Title}}" }',
  syntax: 'HTML/XML',      // optional; default: 'HTML/XML'
  processor: 'handlebars', // optional; default: 'handlebars'
  extension: 'json',       // optional; default: ''
});
```

Processor options are `'handlebars'`, `'t4-tags'`, and `'programmable-layouts'`. The default is `'handlebars'`. The SDK enforces unique layout names.

### Direct update

```typescript
await contentType.layouts.update('text/html', {
  code: '<div>{{Title}}</div>',
  processor: 't4-tags',
});
```

### Mutable item

```typescript
const layout = await contentType.layouts.get('text/html');
layout.code = '<div>Updated</div>';
layout.name = 'text/renamed';
await layout.save();
```

### Delete a layout

```typescript
await contentType.layouts.delete('text/old-layout');
```

---

**Previous:** [Content](./content.md) · **Next:** [Lists](./lists.md)
