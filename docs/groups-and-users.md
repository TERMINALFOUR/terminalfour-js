# Groups and Users

Use `t4.groups` to manage memberships and `t4.users` to manage accounts, authentication methods, and custom fields.

## Groups

### List and read groups

```typescript
const groups = await t4.groups.list();
// [{ id, name, description, membersCount, enabled, children, parentIds }]

const group = await t4.groups.get(1);
```

A full group includes `name`, `description`, `enabled`, `emailAddress`, `children`, and `members`. `children` contains child group IDs. Each member includes `id`, `username`, `firstName`, `lastName`, `emailAddress`, and `userLevel`.

```typescript
for (const member of group.members) {
  console.log(
    member.id,
    member.username,
    member.firstName,
    member.lastName,
    member.emailAddress,
    member.userLevel,
  );
}
```

### Create a group

```typescript
await t4.groups.create({
  name: 'Editors',
  description: 'Content editors',
  members: [38, 61], // user IDs; the SDK resolves full user objects
  enabled: true,
});
```

A group requires at least one member.

### Update a group

#### Direct update

```typescript
await t4.groups.update(1, { name: 'Renamed', enabled: false });
```

#### Mutable item

```typescript
const group = await t4.groups.get(1);
group.name = 'Renamed';
group.addMembers([62, 63]);
group.removeMembers([66]);
await group.save();
```

After `save()`, the SDK refreshes `members` to reflect the changes.

### Delete a group

```typescript
await t4.groups.delete(42);
```

## Users

### List users

```typescript
const users = await t4.users.list();
// [{ id, username, firstName, lastName, emailAddress, userLevel, enabled, accountLocked, lastLogin }]

const admins = await t4.users.list({ userLevel: 'admin' });
```

User levels are `'admin'`, `'power-user'`, `'moderator'`, `'contributor'`, and `'visitor'`.

### Get a user

```typescript
const user = await t4.users.get(30);
```

| Property | Example or meaning |
|---|---|
| `username` | Account username |
| `firstName`, `lastName` | User's name |
| `emailAddress` | Email address |
| `userLevel` | `'contributor'` |
| `defaultLanguage` | `'en'` |
| `enabled` | Whether the account is enabled |
| `lastLogin` | `Date` or `null` when the user has never logged in |
| `groups` | `[{ id: 1, name: 'Editors' }]` |
| `customFields` | `{ Department: 'Engineering' }` or `null` |

### Authentication methods

```typescript
console.log(user.authMethods);
// {
//   local: true,
//   ldap: { enabled: true, identifier: 'uid=jsmith,ou=people,dc=example,dc=com' },
//   saml: false,
//   cas: false,
//   remoteuser: false,
// }

user.authMethods.saml = { enabled: true, identifier: 'saml-user-id' };
await user.save();
```

- `local` and `remoteuser` are booleans and never have identifiers.
- `ldap`, `saml`, and `cas` are `boolean | { enabled: boolean; identifier: string }`.

### Create a user

```typescript
await t4.users.create({
  username: 'new.user',
  firstName: 'New',
  lastName: 'User',
  emailAddress: 'new@example.com',
  password: 'SecureP@ss123!',
  userLevel: 'contributor',     // optional; default: 'contributor'
  defaultLanguage: 'en',        // optional; default: 'en'
  enabled: true,                // optional; default: true
  authMethods: { local: true }, // optional; default: { local: true }
});
```

### Update a user

#### Direct update

```typescript
await t4.users.update(30, {
  firstName: 'Updated',
  userLevel: 'moderator',
});
```

#### Mutable item

```typescript
const user = await t4.users.get(30);
user.firstName = 'Updated';
user.password = 'NewP@ssword456!';
if (user.customFields) {
  user.customFields['Department'] = 'Marketing';
}
await user.save();
```

### Delete a user

```typescript
await t4.users.delete(68);
```

---

**Previous:** [Lists](./lists.md) · **Next:** [Page Layouts](./page-layouts.md)
