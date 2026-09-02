# Handlebars

Use `t4.handlebars.helpers` for custom helper functions and `t4.handlebars.partials` for reusable template fragments.

```typescript
t4.handlebars.helpers
t4.handlebars.partials
```

Helpers and partials are stored as content items in hidden sections. Both resources expose `list()`, `get(name)`, `create()`, `update(name)`, `delete(name)`, and `purge(name)`. Any method that accepts a name also accepts a numeric ID.

## Contents

- [Shared behavior](#shared-behavior)
- [Helpers](#helpers)
- [Partials](#partials)
- [Errors and operational notes](#errors-and-operational-notes)

## Shared behavior

| Operation | Behavior |
|---|---|
| `list()` | Returns summary objects with `id`, `name`, and `lastModified` |
| `get(nameOrId)` | Returns the full mutable item, including `code` |
| `create({ name, code })` | Requires both values, enforces a unique name, and creates an approved item |
| `update(nameOrId, data)` | Applies a direct update and saves with approved status |
| `save()` | Saves a mutable item with approved status |
| `delete(nameOrId)` | Soft deletes the item |
| `purge(nameOrId)` | Permanently removes the item |

## Helpers

Custom helpers are available in content layouts.

### List and get helpers

```typescript
const helpers = await t4.handlebars.helpers.list();
// [{ id: 100, name: 'formatDate', lastModified: Date }, ...]

const helper = await t4.handlebars.helpers.get('formatDate');
console.log(helper.name);         // 'formatDate'
console.log(helper.code);         // 'module.exports = function(date) { ... }'
console.log(helper.lastModified); // Date object
```

`list()` returns summaries. Call `get(name)` for the code. You can also retrieve the same helper by ID with `t4.handlebars.helpers.get(100)`.

### Create a helper

```typescript
const helper = await t4.handlebars.helpers.create({
  name: 'truncate',
  code: 'function(context, options) { return context.substring(0, options.hash('len')); }',
});
```

### Direct update

```typescript
const updated = await t4.handlebars.helpers.update('formatDate', {
  code: 'function(context, options) { return new Date(context).toISOString(); }',
});
```

### Mutable item

```typescript
const helper = await t4.handlebars.helpers.get('formatDate');
helper.name = 'formatDateISO';
helper.code = 'function(context, options) { return new Date(context).toISOString().split("T")[0]; }';
await helper.save();
```

### Delete or purge a helper

```typescript
await t4.handlebars.helpers.delete('truncate'); // soft delete
await t4.handlebars.helpers.purge('truncate');  // permanent removal
```

## Partials

Partials are reusable template fragments included in content layouts with `{{> partialName}}`.

### List and get partials

```typescript
const partials = await t4.handlebars.partials.list();
// [{ id: 200, name: 'header', lastModified: Date }, ...]

const partial = await t4.handlebars.partials.get('header');
console.log(partial.name);         // 'header'
console.log(partial.code);         // '<header><h1>{{sectionName}}</h1></header>'
console.log(partial.lastModified); // Date object
```

### Create a partial

```typescript
const partial = await t4.handlebars.partials.create({
  name: 'footer',
  code: '<footer><p>&copy; {{channelName}}</p></footer>',
});
```

### Direct update

```typescript
const updated = await t4.handlebars.partials.update('header', {
  code: '<header class="main"><h1>{{sectionName}}</h1></header>',
});
```

### Mutable item

```typescript
const partial = await t4.handlebars.partials.get('header');
partial.name = 'site-header';
partial.code = '<header class="main"><h1>{{sectionName}}</h1></header>';
await partial.save();
```

### Delete or purge a partial

```typescript
await t4.handlebars.partials.delete('footer'); // soft delete
await t4.handlebars.partials.purge('footer');  // permanent removal
```

## Errors and operational notes

- A duplicate name on create produces an error.
- A missing name produces an error that lists available names.
- If multiple items have the same name, the SDK reports their IDs so you can use a numeric ID.
- Names are the primary interface; IDs provide a fallback when a name is ambiguous.
- Every create, update, and save forces approved status so Handlebars can use the item immediately.
- Operations always use language `en`, regardless of the client's configured language. Helpers and partials are language-independent.
- Hidden section and content type IDs are read from configuration endpoints on first use and cached for five minutes.
- `t4.clearCache()` invalidates those cached configuration values.
- Helpers use a `Function Code` element; partials use a `Code` element. The SDK handles the difference.

---

**Previous:** [Navigation](./navigation.md) · **Next:** [Error Handling](./error-handling.md)
