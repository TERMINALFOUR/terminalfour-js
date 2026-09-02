# Media

Use `t4.media` for files, `t4.mediaCategory(id)` for category operations, and `t4.mediaLibrary` for the complete category tree.

## Contents

- [Media items](#media-items)
- [Create and update media](#create-and-update-media)
- [Delete or purge media](#delete-or-purge-media)
- [Media categories](#media-categories)
- [Media library tree](#media-library-tree)

## Media items

### Get a media item

```typescript
const media = await t4.media.get(10928);
```

| Property | Example or meaning |
|---|---|
| `id` | `10928` |
| `name` | `'Cat Photo'` |
| `description` | `'A cat running through grass'` |
| `fileName` | `'cat-image.jpg'` |
| `fileSize` | `'28.7 KB'` |
| `mediaType` | `'Image'` |
| `mediaTypeId` | `1` |
| `language` | `'smxx'` |
| `version` | `'1.0'` |
| `status` | `'approved'` |
| `downloadUrl` | Download URL |
| `thumbnailUrl` | Thumbnail URL |
| `path` | `'Media Library » Images » Cats'` |
| `categories` | Category IDs, such as `[366]` |
| `fields` | Custom values, such as `{ 'Photo Credit': 'Jane Smith' }` |

### Non-binary media

CSS, JavaScript, PHP, and other non-binary media expose text content and a syntax type:

```typescript
const css = await t4.media.get(4635);
console.log(css.content);    // '* { box-sizing: border-box; }'
console.log(css.syntaxType); // 'css'

css.content = '* { color: red; }';
await css.save(); // increments the version
```

You can also replace a non-binary file. The save request includes both the file and text content:

```typescript
css.file = './new-styles.css';
await css.save();
```

## Create and update media

### Create media

The SDK detects the media type from the file extension:

```typescript
const image = await t4.media.create({
  file: './hero-image.jpg',
  name: 'Hero Image',
  category: 391,
  description: 'Homepage hero',
});

const stylesheet = await t4.media.create({
  file: { file: new Blob(['body { color: red; }']), filename: 'styles.css' },
  name: 'Main Stylesheet',
  category: 355,
});
```

### Direct update

```typescript
await t4.media.update(10928, {
  name: 'Renamed',
  description: 'Updated',
  file: './replacement.png', // optional replacement
});
```

### Mutable item

```typescript
const media = await t4.media.get(10928);
media.name = 'Updated Cat';
media.description = 'A fast cat';
media.fields['Photo Credit'] = 'New Photographer';
await media.save();
```

Assign `file` to replace the current file. A save increments the version automatically:

```typescript
media.file = './new-image.png';
await media.save();
```

`file` accepts a local path, HTTPS URL, Blob, or `{ file, filename }`. If the replacement has a different file type, such as replacing CSS with PNG, the SDK recalculates the media type and syntax type from the new extension.

## Delete or purge media

```typescript
await t4.media.delete(10928); // selects the category when the media is in one category
await t4.media.delete(10928, { categoryId: 366 }); // required for multiple categories
await t4.media.purge(10928); // permanent removal; media must be deleted first
```

## Media categories

`t4.mediaCategory(id)` creates a lightweight `MediaCategoryRef` without making an API request.

### Read and update a category

#### Direct update

```typescript
await t4.mediaCategory(367).update({ name: 'Renamed' });
```

#### Mutable item

```typescript
const category = await t4.mediaCategory(367).get();
console.log(category.id, category.name, category.path, category.lastModified);

category.name = 'Renamed';
await category.save();
```

### List media and subcategories

```typescript
const items = await t4.mediaCategory(367).list();
// [{ id, name, description, fileName, fileSize, mediaType, language, version, status, lastModified }]

const subcategories = await t4.mediaCategory(366).subcategories();
// [{ id, name, lastModified }]
```

### Create, delete, purge, or move a category

```typescript
const child = await t4.mediaCategory(367).addCategory({ name: 'New Folder' });

await t4.mediaCategory(500).delete();
await t4.mediaCategory(500).purge();
await t4.mediaCategory(500).move(367); // move under category 367
```

## Media library tree

```typescript
const tree = await t4.mediaLibrary.tree();
```

The result is the full category hierarchy as `MediaCategoryNode` objects with `id`, `name`, and optional `children`.

---

**Previous:** [Page Layouts](./page-layouts.md) · **Next:** [Media Types](./media-types.md)
