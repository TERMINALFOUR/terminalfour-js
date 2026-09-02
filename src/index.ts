// Main client
export { T4Client } from './t4-client.js';

// Error class
export { T4ApiError } from './errors.js';

// Models
export { ContentItem } from './models/content-item.js';
export { SectionItem } from './models/section-item.js';
export { MediaItem } from './models/media-item.js';
export type { MediaFileInput } from './models/media-item.js';
export { ContentType } from './resources/content-type-resource.js';
export { Layout } from './resources/content-type-resource.js';
export type { ListSummary, ListItemData } from './resources/list-resource.js';
export { List } from './resources/list-resource.js';
export type { GroupData, GroupMember } from './resources/group-resource.js';
export { Group } from './resources/group-resource.js';
export type { UserData } from './resources/user-resource.js';
export type { AuthMethods, AuthMethodValue } from './resources/user-resource.js';
export { User } from './resources/user-resource.js';
export type { PageLayoutSummary } from './resources/page-layout-resource.js';
export { PageLayout } from './resources/page-layout-resource.js';
export type { MediaTypeLayout, MediaTypeData } from './resources/media-type-resource.js';
export { MediaType, MediaTypeResource } from './resources/media-type-resource.js';
export type { NavigationType, NavigationSummary, CreateNavigationData, UpdateNavigationData } from './resources/navigation-resource.js';
export { NavigationResource, NavigationObject, NAVIGATION_TYPE_NAMES } from './resources/navigation-resource.js';
export { ChannelResource, Channel } from './resources/channel-resource.js';
export type { ChannelSummary, ChannelLanguage, Microsite } from './resources/channel-resource.js';
export { Handlebars, HandlebarsItem, HandlebarsContentResource } from './handlebars.js';
export type { HandlebarsItemSummary, HelperSummary, PartialSummary, Helper, Partial } from './handlebars.js';

// Section reference
export { SectionRef } from './section-ref.js';
export type { SectionTreeNode } from './section-ref.js';
export { SiteStructure } from './site-structure.js';

// Media category reference
export { MediaCategoryRef } from './media-category-ref.js';
export { MediaCategoryItem } from './models/media-category-item.js';
export { MediaLibrary } from './media-library.js';
export type { MediaCategoryNode } from './media-library.js';
export type { MediaListItem } from './media-category-ref.js';

// Types - export all public interfaces
export type {
  T4ClientConfig,
  LanguageOption,
  ContentDTO,
  ContentTypeData,
  ContentTypeFieldDef,
  HierarchyNode,
  GetTreeOptions,
  AddSectionData,
  Owner,
  DateInput,
  CreateContentData,
  UpdateContentData,
} from './types.js';

// Element types
export type { SectionContentLinkInput, MediaElementUpload } from './element-resolver.js';

// File utilities
export type { FileInput } from './utils.js';
