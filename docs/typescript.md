# TypeScript Reference

The package exports its public classes, interfaces, and type aliases. Import runtime values normally and use `import type` for type-only imports.

## Runtime exports

```typescript
import {
  T4Client,
  T4ApiError,
  ContentItem,
  SectionItem,
  SectionRef,
  SiteStructure,
  MediaCategoryRef,
  MediaCategoryItem,
  MediaItem,
  MediaLibrary,
  ContentType,
  Layout,
  List,
  Group,
  User,
  PageLayout,
  MediaType,
  MediaTypeResource,
  NavigationResource,
  NavigationObject,
  Channel,
  ChannelResource,
  Handlebars,
  HandlebarsItem,
  HandlebarsContentResource,
  NAVIGATION_TYPE_NAMES,
} from 'terminalfour-js';
```

## Type-only exports

```typescript
import type {
  // Client configuration
  T4ClientConfig,
  LanguageOption,

  // Content
  ContentDTO,
  CreateContentData,
  UpdateContentData,
  DateInput,

  // Content types
  ContentTypeData,
  ContentTypeFieldDef,

  // Sections
  AddSectionData,
  HierarchyNode,
  GetTreeOptions,
  SectionTreeNode,
  Owner,

  // Media
  FileInput,
  MediaFileInput,
  MediaListItem,
  MediaCategoryNode,
  MediaElementUpload,
  SectionContentLinkInput,

  // Media types
  MediaTypeLayout,
  MediaTypeData,

  // Navigation
  NavigationType,
  NavigationSummary,

  // Channels
  ChannelSummary,
  ChannelLanguage,
  Microsite,

  // Lists
  ListSummary,
  ListItemData,

  // Groups
  GroupData,
  GroupMember,

  // Users
  UserData,
  AuthMethods,
  AuthMethodValue,

  // Page layouts
  PageLayoutSummary,

  // Handlebars
  HandlebarsItemSummary,
  HelperSummary,
  PartialSummary,
  Helper,
  Partial,
} from 'terminalfour-js';
```

## Module formats

The package supports `import` with ESM and `require` with CommonJS. TypeScript declaration files (`.d.ts`) are included for both output formats.

The shared `tsconfig.json` uses the ES2020 module mode so editors can check source files that use dynamic imports. `tsconfig.cjs.json` overrides that setting with CommonJS for the CJS build.

## Build and test

```bash
npm run build # writes dual ESM/CJS output to dist/
npm test      # runs Vitest
```

---

**Previous:** [Error Handling](./error-handling.md)
