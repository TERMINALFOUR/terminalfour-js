# Content

Content operations are scoped to a section through `t4.section(id).content`.

## Contents

- [List and read content](#list-and-read-content)
- [Create content](#create-content)
- [Update content](#update-content)
- [Reorder content](#reorder-content)
- [Approve, duplicate, move, or remove](#approve-duplicate-move-or-remove)
- [Element values](#element-values)
- [Values returned on read](#values-returned-on-read)

## List and read content

### List content

```typescript
const items = await t4.section(482).content.list();
```

Each summary contains `id`, `name`, `status`, `contentTypeID`, `version`, `lastModified`, `publishDate`, `expiryDate`, `reviewDate`, and `archiveSection`. Summaries do not contain `fields`; call `content.get(id)` to retrieve a full item with resolved fields.

`list()` returns a `ContentList` — an array of content items that also carries `setOrder()` and `reorder()` for changing the display order of content in the section (see [Reorder content](#reorder-content)). It behaves like a normal array everywhere else (`.map()`, `.length`, indexing, `for…of`).

### Get a content item

```typescript
const item = await t4.section(482).content.get(9132);
console.log(item.name);
console.log(item.status);      // 'approved', 'pending', 'draft', 'inactive'
console.log(item.fields);      // { Title: 'Hello', Category: 'Featured', ... }
console.log(item.publishDate); // Date object or null
```

`get()` returns a mutable `ContentItem`:

| Property | Type | Mutable | Description |
|---|---|---|---|
| `id` | `number` | no | Content ID |
| `name` | `string` | yes | Content name |
| `contentTypeID` | `number` | no | Content type ID |
| `language` | `string` | no | Language code |
| `status` | `string` | yes | `'approved'`, `'pending'`, `'draft'`, or `'inactive'` |
| `version` | `number` | no | Version number |
| `lastModified` | `Date \| null` | no | Last modification date |
| `publishDate` | `Date \| null` | yes | Publish date |
| `expiryDate` | `Date \| null` | yes | Expiry date |
| `reviewDate` | `Date \| null` | yes | Review date |
| `archiveSection` | `number \| null` | yes | Archive section ID |
| `fields` | `Record<string, unknown>` | yes | Resolved content fields |

## Create content

```typescript
const article = await t4.section(482).content.create({
  type: 44,
  name: 'My Article',
  status: 'draft',                          // default: 'pending'
  fields: {
    Title: 'Breaking News',
    Body: '<p>Article content.</p>',
    Category: 'Featured',                   // list value by name
    'Publish Date': new Date(),
    'Hero Image': './photo.jpg',            // uploads the file automatically
    Related: { sectionId: 500, linkText: 'More' }, // SS link
  },
  publishDate: new Date('2025-07-01'),
  expiryDate: new Date('2025-12-31'),
  archiveSection: 500,
  owner: 38,
});
```

The SDK maps field names to element keys, resolves list values to IDs, uploads files, creates link records, and builds the full request body. An unknown field name produces an error that lists the valid fields.

Before creating or updating content, inspect the content type when you need its field constraints:

```typescript
const type = await t4.contentTypes.get(contentTypeId);
console.log(type.fields);
```

Each field includes `name`, `type`, `required`, `maxSize`, `listId`, `listName`, and repeater configuration. Check these values to confirm maximum lengths, list assignments for Select Box or Radio Button fields, required fields, and Repeater sub-fields.

## Update content

### Direct update

Pass only the values to change. `update()` fetches the existing item, merges your changes, and posts the full body:

```typescript
await t4.section(482).content.update(9132, {
  name: 'Updated Name',
  fields: { Title: 'New Title' },
  status: 'approved',
  publishDate: new Date('2025-08-01'),
  expiryDate: null,     // clear the value
  archiveSection: null, // clear the value
});
```

### Mutable item

Retrieve an item when you need to inspect or change several current values:

```typescript
const article = await t4.section(482).content.get(9132);
article.name = 'Updated Name';
article.fields['Title'] = 'New Title';
article.status = 'approved';
article.archiveSection = 236;
await article.save();
```

You can change one field at a time (`article.fields['Title'] = '...'`) or assign a whole new `fields` object at once:

```typescript
const article = await t4.section(482).content.get(9132);
article.fields = { Title: 'New Title', Summary: 'Rewritten' };
await article.save();
```

Both styles are tracked and validated the same way. Every field you assign is persisted on `save()`, and assigning a field that doesn't exist on the content type throws `Unknown field "X" on this content type. Valid fields are: ...` — exactly as `content.update()` and single-field mutation do.

`save()` defaults the status to `'pending'` to match T4's approval workflow. Set `item.status = 'approved'` before saving if the item must remain approved.

> Content in a mirrored section is read-only. `create`, `update`, `delete`, `purge`, `approveAll`, and a content item's `save`, `approve`, `move`, and `duplicate` throw an error naming the source section when the section is a mirror. Edit the content in the source section instead.

`save()` resolves every field type the same way `content.create()` and `content.update()` do — including Repeater fields. A repeater is read back as an array of `{ name, fields }` items (see [Values returned on read](#values-returned-on-read)), and you assign the same friendly shape back:

```typescript
const deck = await t4.section(482).content.get(9200);
deck.fields['Slides'] = [
  { name: 'Slide 1', fields: { Heading: 'Welcome' } },
  { name: 'Slide 2', fields: { Heading: 'Agenda' } },
];
await deck.save();
```

Each repeater item's sub-fields are resolved into the API's element format automatically, so the mutable `get()` → modify → `save()` path and `content.update()` produce identical results.

## Reorder content

The `ContentList` returned by `content.list()` can reorder content within its section. Both methods call the API immediately and keep the list's in-memory order in sync, so the array reflects the new order as soon as the promise resolves.

### Move a single item

Use `reorder(contentId, options)` with exactly one of `position`, `before`, `after`, or `to`:

```typescript
const items = await t4.section(482).content.list();

await items.reorder(9132, { position: 2 });   // move to the 2nd position (1-based)
await items.reorder(9132, { before: 9140 });   // place immediately before another item
await items.reorder(9132, { after: 9150 });    // place immediately after another item
await items.reorder(9132, { to: 'first' });    // move to the front
await items.reorder(9132, { to: 'last' });     // move to the end
```

`position` is 1-based: `position: 1` is the first slot. A position beyond the end is clamped to the last slot. The `before`/`after` sibling and the item being moved must both exist in the section.

### Set the full order

Use `setOrder(ids)` to replace the entire order at once. Pass every content ID in the section exactly once:

```typescript
const items = await t4.section(482).content.list();
await items.setOrder([9150, 9132, 9140]);
```

If the array omits an ID that is in the section, includes an ID that is not, or repeats an ID, `setOrder()` throws a descriptive error and makes no changes. T4 has no bulk-order endpoint, so `setOrder()` issues one move request per item in sequence.

> Reordering applies to content ordered manually. It does not override a section configured to sort its content automatically (for example alphabetically or by date).

> Content in a mirrored section is read-only, so `setOrder()` and `reorder()` throw when the section is a mirror.

## Approve, duplicate, move, or remove

### Approve one item

```typescript
const article = await t4.section(482).content.get(9132);
article.fields['Title'] = 'Reviewed Title';
await article.approve(); // saves with status 'approved'
```

### Approve all pending items

```typescript
const count = await t4.section(482).content.approveAll();
console.log(`Approved ${count} items`);
```

`approveAll()` lists the section content, filters pending items, and sends one bulk approval request. It returns `0` when no items are pending.

### Duplicate an item

```typescript
const item = await t4.section(482).content.get(9132);

await item.duplicate();    // same section: appends "(1)" to avoid a name collision
await item.duplicate(500); // another section: keeps the original name
```

For duplicates in the same section, the SDK checks existing names and chooses the next available `(n)` suffix.

### Delete, purge, move, or mirror

```typescript
await t4.section(482).content.delete(9132); // soft delete
await t4.section(482).content.purge(9132);  // permanent removal

const item = await t4.section(482).content.get(9132);
await item.move(500);   // move to section 500
await item.mirror(500); // mirror into section 500
```

Mirroring a content item is not a copy and has no "source": after `item.mirror(500)`, the same item (same ID) exists in both its current section and section 500, and editing it from either section updates both. The target must differ from the item's current section.

## Element values

| Type | Pass | SDK sends or performs |
|---|---|---|
| Plain Text | `"text"` | Pass-through |
| HTML | `"<p>html</p>"` | Reverts SS link anchors to T4 tags on save; otherwise pass-through |
| Date | `new Date()`, timestamp, or string | Millisecond timestamp |
| Select Box | `"Large"` | `listId:itemId` |
| Radio Button | `"Large"` | `listId:itemId` |
| Checkbox | `["Large", "Small"]` | `listId:id1,id2` |
| Multiple Select | `["Large", "Small"]` | `listId:id1,id2` |
| Multi-Select List | `["Large", "Small"]` | `listId:id1;listId:id2` |
| Cascading List | `["Soccer", "Liverpool"]` | Resolves sublists automatically |
| Media | `10928` | String ID |
| Media (inline) | `{ file: './photo.jpg', name: 'Photo', category: 391 }` | Uploads to the media library and uses the returned ID |
| File / Image | `"./path.jpg"`, URL, Blob, or `{ file, filename }` | Uploads through `/upload/` |
| Section/Content Link | `{ sectionId, contentId?, linkText? }` | Creates an SS record and T4 tag |
| Decimal | `3.14` | Pass-through |
| Whole Number | `42` | Pass-through |
| Content Owner | `38` | String; resolves to user details on read |
| Group Select | `[41, 34, 40]` | Comma-separated value; resolves to group objects on read |
| Keyword Selector | `{ or: ["Large", { and: ["Small", "Other"] }] }` | Formats OR/AND groups |
| Repeater | `[{ name: 'Slide 1', fields: { Heading: 'Hi' } }]` | Full nested resolution |

## Values returned on read

The SDK converts raw API values before assigning them to `ContentItem.fields`:

| Element | Returned value |
|---|---|
| List | Names, such as `"Large"` instead of `"1:2"` |
| Date | `Date` object |
| Media | Object with `id`, `name`, `filename`, `description`, `mediaType`, `downloadLink`, `path`, `fileSize`, and `lastModified` |
| File / Image | Object with `filename`, `fileSize`, and `downloadLink` |
| SS link | `{ sectionId, contentId?, linkText, path }` |
| HTML SS link | Inline `<a href="#" data-t4-sslink="..." data-section-id="..." data-content-id="...">linkText</a>` converted from a T4 `<t4 sslink_id="..." />` tag |
| Content Owner | User object with `id`, `type`, `username`, `firstName`, `lastName`, and `emailAddress` |
| Group Select | Array of `{ id, name, selected }` objects |
| Keyword Selector | `{ or: [...] }` structure |
| Repeater | Array of `{ name, fields }` with recursively resolved fields |

### Download a Media, File, or Image element

Media, File, and Image elements resolve to an object with a `downloadLink` — the URL the file is served from. The SDK gives you the URL, not the file bytes, so fetch them yourself when you need them server-side:

```typescript
const item = await t4.section(482).content.get(1234);

const photo = item.fields['Photo']; // a Media, File, or Image element
if (photo?.downloadLink) {
  const res = await fetch(photo.downloadLink);
  const buffer = Buffer.from(await res.arrayBuffer());
}
```

For File and Image elements, `downloadLink` is only present once the file is resolved — guard for it as above before fetching.

---

**Previous:** [Sections](./sections.md) · **Next:** [Content Types](./content-types.md)
