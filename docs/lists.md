# Lists

Use `t4.lists` to manage list definitions and their items.

## List and read lists

```typescript
const lists = await t4.lists.list();
// [{ id: 71, name: 'Sizes', description: 'Size options' }]

const list = await t4.lists.get(71);
```

| Property | Example |
|---|---|
| `name` | `'Sizes'` |
| `description` | List description |
| `isForcedLanguage` | `false` |
| `isDefaultLanguage` | `false` |
| `primaryGroup` | `0` |
| `sharedGroups` | `[]` |
| `items` | Item definitions keyed by name |

Items are keyed by name:

```typescript
console.log(list.items);
// {
//   Large: { name: 'Large', value: 'lg', selected: true },
//   Small: { name: 'Small', value: 'sm', selected: false },
// }

list.items['Large'].value = 'updated';
list.items['Large'].selected = false;
await list.save();
```

## Create a list

```typescript
const newList = await t4.lists.create({
  name: 'Priorities',
  description: 'Priority levels',
  items: [
    { name: 'High', value: 'high', selected: true },
    { name: 'Medium', value: 'medium' },
    { name: 'Low', value: 'low' },
  ],
});
```

`isForcedLanguage` and `isDefaultLanguage` both default to `false`. They cannot both be `true`; the SDK validates this during create and save.

## Update a list

### Direct update

```typescript
await t4.lists.update(71, {
  name: 'Renamed',
  description: 'Updated',
});
```

### Mutable item

```typescript
const list = await t4.lists.get(71);
list.name = 'Renamed';
list.description = 'Updated';
await list.save();
```

## Add or remove items

```typescript
const list = await t4.lists.get(71);

list.addItem({ name: 'Extra Large', value: 'xl', selected: false });
list.removeItem('Small');
await list.save();
```

Add `sublistId` when an item opens a sublist:

```typescript
list.addItem({ name: 'Soccer', value: 'soccer', sublistId: 72 });
```

## Delete a list

```typescript
await t4.lists.delete(71);
```

---

**Previous:** [Content Types](./content-types.md) · **Next:** [Groups & Users](./groups-and-users.md)
