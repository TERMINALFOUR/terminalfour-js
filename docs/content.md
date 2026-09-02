# Content

Content operations are scoped to a section through `t4.section(id).content`.

## Contents

- [List and read content](#list-and-read-content)
- [Create content](#create-content)
- [Update content](#update-content)
- [Approve, duplicate, move, or remove](#approve-duplicate-move-or-remove)
- [Element values](#element-values)
- [Values returned on read](#values-returned-on-read)

## List and read content

### List content

```typescript
const items = await t4.section(482).content.list();
```

Each summary contains `id`, `name`, `status`, `contentTypeID`, `version`, `lastModified`, `publishDate`, `expiryDate`, `reviewDate`, and `archiveSection`. Summaries do not contain `fields`; call `content.get(id)` to retrieve a full item with resolved fields.

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

`save()` defaults the status to `'pending'` to match T4's approval workflow. Set `item.status = 'approved'` before saving if the item must remain approved.

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

### Delete, purge, or move

```typescript
await t4.section(482).content.delete(9132); // soft delete
await t4.section(482).content.purge(9132);  // permanent removal

const item = await t4.section(482).content.get(9132);
await item.move(500); // move to section 500
```

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

---

**Previous:** [Sections](./sections.md) · **Next:** [Content Types](./content-types.md)
