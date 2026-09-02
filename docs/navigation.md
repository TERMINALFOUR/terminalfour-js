# Navigation Objects

Navigation objects control site navigation during publishing. terminalfour-js supports all 19 types, including each type's configuration and validation rules.

## List and filter navigation objects

```typescript
const all = await t4.navigation.list();
for (const navigation of all) {
  console.log(navigation.id, navigation.name, navigation.type, navigation.enabled);
}

const breadcrumbs = await t4.navigation.list({ type: 'breadcrumbs' });
const sitemaps = await t4.navigation.list({ type: 'site-map' });
```

Each `NavigationSummary` contains:

| Property | Type | Description |
|---|---|---|
| `id` | `number` | Navigation object ID |
| `name` | `string` | Display name |
| `description` | `string` | Description |
| `type` | `string` | Type code listed below |
| `typeName` | `string` | Human-readable type name |
| `enabled` | `boolean` | Whether the navigation is active |

## Get a navigation object

```typescript
const navigation = await t4.navigation.get(181);
console.log(navigation.name);            // 'A-Z Navigation Demo'
console.log(navigation.type);            // 'a-to-z'
console.log(navigation.enabled);         // true
console.log(navigation.cachingEnabled);  // false
console.log(navigation.previewEnabled);  // true
console.log(navigation.properties);      // properties vary by type
```

Type-specific properties use JavaScript booleans, numbers, and arrays. The SDK omits internal and derived fields.

| Shared property | Mutable | Description |
|---|---|---|
| `name` | yes | Display name |
| `description` | yes | Description |
| `enabled` | yes | Whether the navigation is active |
| `cachingEnabled` | yes | Whether output caching is enabled |
| `previewEnabled` | yes | Whether preview mode is enabled |
| `properties` | yes | Type-specific configuration |

## Create a navigation object

```typescript
await t4.navigation.create({
  type: 'breadcrumbs',
  name: 'Main Breadcrumbs',
  description: 'Site breadcrumb trail',
  properties: {
    separator: ' > ',
    useLinks: true,
    hideHome: true,
  },
});
```

Only `type` and `name` are required. Properties have default values.

## Update a navigation object

### Direct update

```typescript
const navigation = await t4.navigation.update(181, {
  name: 'Renamed',
  enabled: false,
  properties: {
    beforeHtml: '<div>',
  },
});
```

`update()` merges `properties` with existing values. Pass only the keys to change:

```typescript
await t4.navigation.update(10, {
  properties: { separator: ' / ' },
});
```

Every other property remains unchanged. A navigation object's `type` cannot change after creation, so `update()` does not accept it.

### Mutable item

```typescript
const navigation = await t4.navigation.get(181);
navigation.name = 'Renamed';
navigation.enabled = false;
navigation.properties.beforeHtml = '<div>';
await navigation.save();
```

## Delete a navigation object

```typescript
await t4.navigation.delete(181);
```

## Navigation types

| Type name | Code | Guide |
|---|---|---|
| A to Z Navigation | `a-to-z` | [Details](./navigation/a-to-z.md) |
| Breadcrumbs | `breadcrumbs` | [Details](./navigation/breadcrumbs.md) |
| CSS Selector | `css-selector` | [Details](./navigation/css-selector.md) |
| Generate File | `generate-file` | [Details](./navigation/generate-file.md) |
| Keyword Search Content | `keyword-search` | [Details](./navigation/keyword-search.md) |
| Language Switcher | `language-switcher` | [Details](./navigation/language-switcher.md) |
| Link Menu | `link-menu` | [Details](./navigation/link-menu.md) |
| Pagination | `pagination` | [Details](./navigation/pagination.md) |
| Previous/Next Fulltext Content | `previous-next-fulltext` | [Details](./navigation/previous-next-fulltext.md) |
| Publish to One File | `publish-to-one-file` | [Details](./navigation/publish-to-one-file.md) |
| Related Content | `related-content` | [Details](./navigation/related-content.md) |
| Related Section Branch | `related-section-branch` | [Details](./navigation/related-section-branch.md) |
| Return to Index | `return-to-index` | [Details](./navigation/return-to-index.md) |
| Section Details | `section-details` | [Details](./navigation/section-details.md) |
| Section Iterator | `section-iterator` | [Details](./navigation/section-iterator.md) |
| Section Meta Info | `section-meta-info` | [Details](./navigation/section-meta-info.md) |
| Site Map | `site-map` | [Details](./navigation/site-map.md) |
| Top Content | `top-content` | [Details](./navigation/top-content.md) |
| Top Stories | `top-stories` | [Details](./navigation/top-stories.md) |

---

**Previous:** [Channels](./channels.md) · **Next:** [Handlebars](./handlebars.md)
