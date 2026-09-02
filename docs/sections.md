# Sections

`t4.section(id)` creates a lightweight `SectionRef` without making an API request. Use the reference to read or change that section.

## Contents

- [Read and update a section](#read-and-update-a-section)
- [Create, delete, purge, or move](#create-delete-purge-or-move)
- [Navigate the section tree](#navigate-the-section-tree)
- [Manage section configuration](#manage-section-configuration)
- [Publish](#publish)

## Read and update a section

```typescript
const section = await t4.section(233).get();
```

`get()` returns a mutable `SectionItem`:

| Property | Type | Mutable | Description |
|---|---|---|---|
| `id` | `number` | no | Section ID |
| `parentId` | `number \| null` | no | Parent section ID |
| `name` | `string` | yes | Section name |
| `show` | `boolean` | yes | Visible in navigation |
| `status` | `string` | yes | `'approved'`, `'pending'`, or `'inactive'` |
| `outputUri` | `string` | yes | Output URI for publishing |
| `filename` | `string` | yes | Output filename |
| `archive` | `boolean` | yes | Whether this is an archive section |
| `path` | `string \| null` | no | Breadcrumb path (`'Home » Site » Section'`) |
| `pathMembers` | `number[]` | no | Section IDs in the path |
| `lastModified` | `Date \| null` | no | Last modification date |
| `accessControl` | `{ active, enabled }` | no | Access control state |
| `customFields` | `Record<string, unknown> \| null` | yes | Resolved metadata content fields, or `null` |

### Direct update

Use `update()` when you already know the values to change:

```typescript
await t4.section(233).update({
  name: 'Renamed',
  show: false,
  status: 'pending',
  customFields: { 
    Title: 'New Title' 
  },
});
```

### Mutable item

Use `get()` and `save()` when you need to inspect the current section first:

```typescript
const section = await t4.section(233).get();
section.name = 'Renamed Section';
section.show = false;
section.outputUri = 'new-uri';
await section.save();
```
`customFields` is `null` only when the instance has no section metadata content type configured at all. When a metadata type exists, `customFields` is an object (empty if no fields are set).

The SDK will throw when no metadata content type is configured on the instance and you attempt add customFields.

## Create, delete, purge, or move

### Create a child section

```typescript
const child = await t4.section(233).addSection({
  name: 'New Section',
  show: true,                              // default: true
  status: 'approved',                      // default: 'approved'
  customFields: { Title: 'Custom Title' }, // optional
});
```

The new section inherits channels, page layouts, access control, and metadata types from its parent.

When the instance has a section metadata content type configured, `addSection()` always creates a metadata content instance for the new section, whether or not you pass `customFields`.

### Delete, purge, or move

```typescript
await t4.section(500).delete();   // soft delete: sets status to inactive
await t4.section(500).purge();    // permanent removal; section must be inactive first
await t4.section(500).move(233);  // move under section 233
```

## Navigate the section tree

### Direct children

Use `subsections()` for a one-level lookup:

```typescript
const children = await t4.section(233).subsections();
// [{ id: 500, name: 'Child', lastModified: Date }]
```

### Full tree or subtree

```typescript
const tree = await t4.siteStructure.tree(); // full site structure
const subTree = await t4.section(6758).tree(); // subtree from section 6758
```

Tree nodes contain `id`, `name`, `status`, and optional `children`. `siteStructure.tree()` retrieves the entire hierarchy in one request, so prefer `subsections()` for lighter lookups on large sites.

## Manage section configuration

### Channels

```typescript
const channels = await t4.section(233).channels();
// [{ id: 1, name: 'Default Channel' }]
```

### Owner

```typescript
const owner = await t4.section(233).owner();
// { id: 30, type: 'contributor', username: 'j.smith',
//   firstName: 'Jane', lastName: 'Smith', emailAddress: 'jane@example.com' }
```

`type` is the user's role: `'admin'`, `'power-user'`, `'moderator'`, `'contributor'`, or `'visitor'`.

### Metadata

```typescript
const meta = await t4.section(233).metaDatas();
// { 'og:title': 'Page Title', 'description': 'A description' }

await t4.section(233).setMetaDatas({
  'og:title': 'New Title',
  'description': 'Updated description',
});
```

`setMetaDatas()` merges the supplied values with existing metadata. It does not replace the whole object. Invalid tag names produce an error that lists the valid options.

### Page layouts

```typescript
const layouts = await t4.section(233).pageLayouts();
// [
//   {
//     channel: { id: 1, name: 'Default Channel' },
//     pageLayout: { id: 5, name: 'Main Layout', inherited: false },
//     childPageLayout: { id: 10, name: 'Child Layout' },
//   },
//   {
//     channel: { id: 3, name: 'Preview' },
//     pageLayout: { id: 3446, name: 'Preview Layout', inherited: true },
//     childPageLayout: null,
//   },
// ]
```

| Value | Meaning |
|---|---|
| `pageLayout` | Layout applied to this section. `inherited: true` means it comes from a parent. |
| `childPageLayout` | Layout that descendant sections inherit. |

Set layouts by channel. The operation is additive, so it changes only the channels you pass:

```typescript
await t4.section(233).setPageLayouts([
  { channelId: 1, pageLayout: 99 },
  { channelId: 3, childPageLayout: 200 },
]);

await t4.section(233).setPageLayouts([
  { channelId: 1, pageLayout: null }, // clear this layout
]);
```

### Edit rights

```typescript
const rights = await t4.section(233).editRights();
// {
//   users: [{ id, username, firstName, lastName, emailAddress, inherited: false }],
//   groups: [{ id, name, inherited: true }]
// }

await t4.section(233).setEditRights({ users: [30, 61], groups: [1] });
await t4.section(233).removeEditRights({ users: [30] });
```

`setEditRights()` adds and deduplicates rights.

### Content types

```typescript
const types = await t4.section(233).contentTypes();
// [{ id: 44, name: 'Article', description: '...', scope: 'branch' }]

await t4.section(233).setContentTypes([
  { id: 44, scope: 'branch' },
  { id: 343, scope: 'section' },
]);

await t4.section(233).removeContentTypes([44]);
```

`setContentTypes()` merges the supplied types with the existing configuration.

## Publish

```typescript
await t4.section(237).publish(); // single section; selects the channel if there is only one
await t4.section(237).publish({ branch: true }); // entire branch
await t4.section(237).publish({ channelId: 1, branch: true }); // selected channel
```

When a section belongs to multiple channels, you must supply `channelId`. Otherwise, the SDK throws an error that lists the available channels.

---

**Previous:** [Getting Started](./getting-started.md) · **Next:** [Content](./content.md)
