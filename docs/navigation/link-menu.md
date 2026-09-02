# Link Menu

Build section links for main navigation menus or sidebars.

[Terminalfour Documentation](https://docs.terminalfour.com/documentation/navigation/create-a-new-navigation-object/link-menu-navigation-object/)

## Create

```typescript
// Branch at level
await t4.navigation.create({
  type: 'link-menu',
  name: 'Main Nav',
  properties: {
    menuType: 'branch-at-level',
    level: 2,
    numToRecurse: 3,
    subNavigationType: 'ul',
    menuDisplayType: 'normal',
    showNonCurrentChildren: true,
    useCurrentBranchClass: true,
    currentSectionLink: true,
    addSectionName: true,
    title: 'Navigation',
    beforeMenuHtml: '<ul>',
    afterMenuHtml: '</ul>',
    beforeLinkHtml: '<li>',
    afterLinkHtml: '</li>',
    betweenLink: '',
  },
});

// Children with specific branch
await t4.navigation.create({
  type: 'link-menu',
  name: 'Child Nav',
  properties: {
    menuType: 'children',
    displaySpecificBranch: true,
    specificBranchId: 233,
    showSiblingsIfNoChildren: true,
    showAncestorsIfNoChildren: false,
  },
});
```

## Menu type summary

| `menuType` | Mode-specific properties |
|---|---|
| `'branch-at-level'` | `level` and `numToRecurse` |
| `'children'` | `displaySpecificBranch`, `specificBranchId`, `showSiblingsIfNoChildren`, `showAncestorsIfNoChildren` |
| `'siblings'` | `n/a` |
| `'siblings-and-children'` | `subNavigationType` |

## Properties

### Common properties

| Property | Type | Default | Description |
|---|---|---|---|
| `menuType` | `string` | *required* | Menu scope: `'branch-at-level'`, `'children'`, `'siblings'`, or `'siblings-and-children'`. |
| `menuDisplayType` | `string` | `'normal'` | Display type: `'normal'` or `'dropdown'`. |
| `showNonCurrentChildren` | `boolean` | `false` | Shows children of non-current sections. |
| `useCurrentBranchClass` | `boolean` | `false` | Adds a CSS class to the current branch. |
| `currentSectionLink` | `boolean` | `false` | Turns the current section into a link. |
| `addSectionName` | `boolean` | `false` | Prepends the section name to the title. |
| `title` | `string` | `''` | Title text. |
| `beforeMenuHtml` | `string` | `''` | HTML before the menu. |
| `afterMenuHtml` | `string` | `''` | HTML after the menu. |
| `beforeLinkHtml` | `string` | `''` | HTML before each link. |
| `afterLinkHtml` | `string` | `''` | HTML after each link. |
| `betweenLink` | `string` | `''` | HTML between links. |

### When `menuType` is `'branch-at-level'`

| Property | Type | Default | Description |
|---|---|---|---|
| `level` | `number` | `0` | Starting level. |
| `numToRecurse` | `number` | `1` | Recursion depth. |
| `subNavigationType` | `string` | `'ul'` | Nested navigation type: `'ul'`, `'table'`, or `'div'`. |

### When `menuType` is `'children'`

| Property | Type | Default | Description |
|---|---|---|---|
| `displaySpecificBranch` | `boolean` | `false` | Displays a specific branch. |
| `specificBranchId` | `number` | `n/a` | Section ID of the specific branch. |
| `showSiblingsIfNoChildren` | `boolean` | `false` | Shows siblings when no children exist. |
| `showAncestorsIfNoChildren` | `boolean` | `false` | Shows ancestors when no children exist. |

### When `menuType` is `'siblings-and-children'`

| Property | Type | Default | Description |
|---|---|---|---|
| `subNavigationType` | `string` | `'ul'` | Nested navigation type: `'ul'`, `'table'`, or `'div'`. |

## Validation

- Set `level` and `numToRecurse` only for `'branch-at-level'`.
- Set `subNavigationType` for `'branch-at-level'` only when `numToRecurse` is greater than 1. You can also set it for `'siblings-and-children'`.
- Set `displaySpecificBranch`, `showSiblingsIfNoChildren`, and `showAncestorsIfNoChildren` only for `'children'`.
- Set `specificBranchId` only when `displaySpecificBranch` is `true`. The SDK validates the section ID.

[Back to Navigation](../navigation.md)
