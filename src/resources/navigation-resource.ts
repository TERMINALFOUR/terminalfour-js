import { HttpClient } from '../http-client.js';

/** SDK-friendly navigation type codes (consistent kebab-case) */
export type NavigationType =
  | 'a-to-z'
  | 'breadcrumbs'
  | 'css-selector'
  | 'generate-file'
  | 'keyword-search'
  | 'language-switcher'
  | 'link-menu'
  | 'pagination'
  | 'previous-next-fulltext'
  | 'publish-to-one-file'
  | 'related-content'
  | 'related-section-branch'
  | 'return-to-index'
  | 'section-details'
  | 'section-iterator'
  | 'section-meta-info'
  | 'site-map'
  | 'top-content'
  | 'top-stories';

/** Maps SDK type codes to API type codes */
const SDK_TO_API: Record<NavigationType, string> = {
  'a-to-z': 'a2z',
  'breadcrumbs': 'breadcrumbs',
  'css-selector': 'css-selector',
  'generate-file': 'Generate File',
  'keyword-search': 'keyword',
  'language-switcher': 'languageswitcher',
  'link-menu': 'linkmenu',
  'pagination': 'pagination',
  'previous-next-fulltext': 'previousNextFulltext',
  'publish-to-one-file': 'publishonefile',
  'related-content': 'relatedcontent',
  'related-section-branch': 'relatedSectionBranch',
  'return-to-index': 'return-to-index',
  'section-details': 'sectiondetails',
  'section-iterator': 'sectioniterator',
  'section-meta-info': 'meta',
  'site-map': 'sitemap',
  'top-content': 'topcontent',
  'top-stories': 'topstories',
};

/** Maps API type codes to SDK type codes */
const API_TO_SDK: Record<string, NavigationType> = Object.fromEntries(
  Object.entries(SDK_TO_API).map(([sdk, api]) => [api, sdk as NavigationType]),
) as Record<string, NavigationType>;

/** Human-readable type name mapping */
export const NAVIGATION_TYPE_NAMES: Record<NavigationType, string> = {
  'a-to-z': 'A to Z Navigation',
  'breadcrumbs': 'Breadcrumbs',
  'css-selector': 'CSS Selector',
  'generate-file': 'Generate File',
  'keyword-search': 'Keyword Search Content',
  'language-switcher': 'Language Switcher',
  'link-menu': 'Link Menu',
  'pagination': 'Pagination',
  'previous-next-fulltext': 'Previous/Next Fulltext Content',
  'publish-to-one-file': 'Publish to One File',
  'related-content': 'Related Content',
  'related-section-branch': 'Related Section Branch',
  'return-to-index': 'Return to Index',
  'section-details': 'Section Details',
  'section-iterator': 'Section Iterator',
  'section-meta-info': 'Section Meta Info',
  'site-map': 'Site Map',
  'top-content': 'Top Content',
  'top-stories': 'Top Stories',
};

/** Summary returned from list() */
export interface NavigationSummary {
  id: number;
  name: string;
  description: string;
  type: NavigationType;
  typeName: string;
  enabled: boolean;
}

/** Raw API response shape from GET /navigation */
interface RawNavigationListItem {
  id: number;
  name: string;
  description?: string;
  navigationType: string;
  navigationTypeName: string;
  navigationEnabled: boolean;
  [key: string]: unknown;
}

/** Raw API response shape from GET /navigation/{id} */
interface RawNavigationDetail {
  id: number;
  name: string;
  description?: string;
  navigationType: string;
  navigationTypeName?: string;
  isEnabled: boolean;
  isPreviewModeEnabled: boolean;
  isCachingEnabled: boolean;
  date?: string;
  properties: Record<string, { value?: string; attribute: string; navigationPropertyID: number }>;
  [key: string]: unknown;
}

/**
 * Converts a kebab-case, snake_case, or space-separated string to camelCase.
 * e.g. "before-menu" → "beforeMenu", "start_level" → "startLevel", "File Name" → "fileName"
 */
function toCamelCase(str: string): string {
  return str
    .replace(/[-_ ](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toLowerCase());
}

/**
 * Converts a camelCase string back to the API's original key format.
 * We store the original keys on the raw data so we can map back precisely.
 */
function fromCamelCase(camel: string, originalKeys: string[]): string {
  const lower = camel.toLowerCase();
  return originalKeys.find((k) => toCamelCase(k) === camel) ?? originalKeys.find((k) => k.toLowerCase().replace(/[-_]/g, '') === lower) ?? camel;
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for A to Z.
 * Hides no internal fields (A to Z has no hidden fields).
 */
function transformA2ZRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    startLevel: parseInt(raw.startLevel ?? '0', 10),
    endLevel: parseInt(raw.endLevel ?? '0', 10),
    useSectionMetaData: raw.useSectionMetaDataElement === 'yes',
    sectionMetaContentTypeElement: raw.sectionMetaDataTemplate ?? '',
    microSite: raw.selMicroSite ? parseInt(raw.selMicroSite, 10) || null : null,
    beforeMenu: raw.beforeMenu ?? '',
    afterMenu: raw.afterMenu ?? '',
    beforeItem: raw.beforeItem ?? '',
    afterItem: raw.afterItem ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for A to Z save.
 */
function transformA2ZWrite(props: Record<string, unknown>): Record<string, string> {
  return {
    startLevel: String(props.startLevel ?? 0),
    endLevel: String(props.endLevel ?? 0),
    useSectionMetaDataElement: props.useSectionMetaData ? 'yes' : 'no',
    sectionMetaDataTemplate: String(props.sectionMetaContentTypeElement ?? ''),
    selMicroSite: props.microSite != null ? String(props.microSite) : '',
    beforeMenu: String(props.beforeMenu ?? ''),
    afterMenu: String(props.afterMenu ?? ''),
    beforeItem: String(props.beforeItem ?? ''),
    afterItem: String(props.afterItem ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Breadcrumbs.
 * Hides internal fields: overSpillFlag, breadcrumbType, appendContentElement.
 * Renames: overSpillLength → maxLength.
 */
function transformBreadcrumbsRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    startLevel: parseInt(raw.startLevel ?? '0', 10),
    endLevel: parseInt(raw.endLevel ?? '0', 10),
    useLinks: raw.useLinks === 'yes',
    linkCurrent: raw.linkCurrent === 'yes',
    hideHome: raw.hideHome === 'yes',
    noSpace: raw.noSpace === 'yes',
    maxLength: parseInt(raw.overSpillLength ?? '0', 10),
    separator: raw.separatorHtml ?? '',
    elementToAppend: raw.elementToAppend ?? '',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Breadcrumbs save.
 * Derives hidden fields: overSpillFlag, breadcrumbType, appendContentElement.
 */
function transformBreadcrumbsWrite(props: Record<string, unknown>): Record<string, string> {
  const maxLength = Number(props.maxLength ?? 0);
  const elementToAppend = String(props.elementToAppend ?? '');
  return {
    startLevel: String(props.startLevel ?? 0),
    endLevel: String(props.endLevel ?? 0),
    useLinks: props.useLinks ? 'yes' : 'no',
    linkCurrent: props.linkCurrent ? 'yes' : 'no',
    hideHome: props.hideHome ? 'yes' : 'no',
    noSpace: props.noSpace ? 'yes' : 'no',
    overSpillLength: String(maxLength),
    overSpillFlag: maxLength > 0 ? 'yes' : 'no',
    breadcrumbType: maxLength > 0 ? '20' : '10',
    appendContentElement: elementToAppend ? 'yes' : 'no',
    elementToAppend,
    separatorHtml: String(props.separator ?? ''),
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for CSS Selector.
 * Reconstructs the branches array from numbered properties.
 */
function transformCssSelectorRead(raw: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    defaultStylesheet: parseInt(raw.defaultStyleSheet ?? '0', 10) || null,
    language: raw.language ?? '',
  };

  // Reconstruct branches from numbered properties (branch-1-name, branch-1-root, style-sheet-1, etc.)
  const branches: Array<{ stylesheet: number; name?: string; rootSection?: number }> = [];
  let i = 1;
  while (true) {
    const stylesheetKey = `styleSheet${i}`;
    if (!(stylesheetKey in raw) || !raw[stylesheetKey]) break;
    const branch: { stylesheet: number; name?: string; rootSection?: number } = {
      stylesheet: parseInt(raw[stylesheetKey], 10),
    };
    const nameKey = `branch${i}Name`;
    const rootKey = `branch${i}Root`;
    if (raw[nameKey]) branch.name = raw[nameKey];
    if (raw[rootKey]) branch.rootSection = parseInt(raw[rootKey], 10);
    branches.push(branch);
    i++;
  }
  if (branches.length > 0) result.branches = branches;

  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for CSS Selector save.
 */
function transformCssSelectorWrite(props: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {
    defaultStyleSheet: String(props.defaultStylesheet ?? ''),
    language: String(props.language ?? ''),
  };

  const branches = props.branches as Array<{ stylesheet: number; name?: string; rootSection?: number }> | undefined;
  if (branches && branches.length > 0) {
    for (let i = 0; i < branches.length; i++) {
      const n = i + 1;
      result[`styleSheet${n}`] = String(branches[i].stylesheet);
      result[`branch${n}Name`] = branches[i].name ?? '';
      result[`branch${n}Root`] = branches[i].rootSection != null ? String(branches[i].rootSection) : '';
    }
  }

  return result;
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Generate File.
 * Note: API keys like "File Name", "Append Content ID" become "fileName", "appendContentID" after toCamelCase.
 */
function transformGenerateFileRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    fileName: raw.fileName ?? '',
    appendContentId: raw.appendContentID === 'yes',
    fileExtension: raw.fileExtension ?? '',
    baseDirectory: raw.baseDirectory ?? '',
    layout: raw.formatter ?? '',
    appendDirectory: raw.appendDirectory === 'yes',
    mediaFile: raw.mediaFile ? parseInt(raw.mediaFile, 10) || null : null,
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Generate File save.
 * Keys match what toCamelCase produces from the API's space-separated keys.
 */
function transformGenerateFileWrite(props: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {
    fileName: String(props.fileName ?? ''),
    appendContentID: props.appendContentId ? 'yes' : 'no',
    fileExtension: String(props.fileExtension ?? ''),
    baseDirectory: String(props.baseDirectory ?? ''),
    formatter: String(props.layout ?? ''),
    appendDirectory: props.appendDirectory ? 'yes' : 'no',
  };
  // mediaFile needs special handling — empty object when not set
  if (props.mediaFile != null) {
    result.mediaFile = String(props.mediaFile);
  }
  return result;
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Language Switcher.
 * Hides: imageLink (derived field).
 */
function transformLanguageSwitcherRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    langCode: raw.langCode ?? '',
    alwaysOutput: raw.alwaysOutput === 'yes',
    imageUrl: raw.url ?? '',
    imageExtension: raw.imageExt ?? '',
    imageProperties: raw.imageProperties ?? '',
    beforeHtml: raw.before ?? '',
    afterHtml: raw.after ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Language Switcher save.
 * Derives: imageLink from whether any image fields are set.
 */
function transformLanguageSwitcherWrite(props: Record<string, unknown>): Record<string, string> {
  const imageUrl = String(props.imageUrl ?? '');
  const imageExtension = String(props.imageExtension ?? '');
  const imageProperties = String(props.imageProperties ?? '');
  const imageLink = imageUrl || imageExtension || imageProperties ? 'yes' : 'no';

  return {
    langCode: String(props.langCode ?? ''),
    alwaysOutput: props.alwaysOutput ? 'yes' : 'no',
    imageLink,
    url: imageUrl,
    imageExt: imageExtension,
    imageProperties,
    before: String(props.beforeHtml ?? ''),
    after: String(props.afterHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Pagination.
 * Hides: useAltFormatter (derived). Renames fields to SDK-friendly names.
 */
function transformPaginationRead(raw: Record<string, string>): Record<string, unknown> {
  const fetchMethodApi = raw.fetchMethod ?? 'fetch-method-current';
  return {
    contentTypeId: parseInt(raw.templateList ?? '0', 10),
    fetchMethod: FETCH_METHOD_FROM_API[fetchMethodApi] ?? 'current',
    section: parseInt(raw.section ?? '0', 10) || 0,
    level: parseInt(raw.level ?? '0', 10),
    numToRecurse: parseInt(raw.numToRecurse ?? '0', 10),
    contentItemsPerPage: parseInt(raw.numberOfPieces ?? '0', 10),
    maxContentItems: parseInt(raw.maxNumberOfPieces ?? '0', 10),
    maxLinksPerPage: parseInt(raw.numLinksToShow ?? '0', 10),
    altLayoutName: raw.altFormatterType ?? '',
    searchHiddenSections: raw.showHiddenSections === 'yes',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
    beforePaginationHtml: raw.beforePaginationHtml ?? '',
    afterPaginationHtml: raw.afterPaginationHtml ?? '',
    betweenPaginationHtml: raw.betweenPaginationHtml ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Pagination save.
 * Derives: useAltFormatter from altLayoutName.
 */
function transformPaginationWrite(props: Record<string, unknown>): Record<string, string> {
  const altLayoutName = String(props.altLayoutName ?? '');
  const fetchMethod = props.fetchMethod as PaginationFetchMethod ?? 'current';
  return {
    templateList: String(props.contentTypeId ?? '0'),
    fetchMethod: FETCH_METHOD_TO_API[fetchMethod] ?? 'fetch-method-current',
    section: String(props.section ?? 0),
    level: String(props.level ?? 0),
    numToRecurse: String(props.numToRecurse ?? 0),
    numberOfPieces: String(props.contentItemsPerPage ?? 0),
    maxNumberOfPieces: String(props.maxContentItems ?? 0),
    numLinksToShow: String(props.maxLinksPerPage ?? 0),
    useAltFormatter: altLayoutName ? 'yes' : 'no',
    altFormatterType: altLayoutName,
    showHiddenSections: props.searchHiddenSections ? 'yes' : 'no',
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
    beforePaginationHtml: String(props.beforePaginationHtml ?? ''),
    afterPaginationHtml: String(props.afterPaginationHtml ?? ''),
    betweenPaginationHtml: String(props.betweenPaginationHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Previous/Next Fulltext.
 * Hides: customFormatter (derived from altLayoutName).
 * Collapses previous/next/previousAndNext into a single `type` field.
 * Note: API keys start with "id_" so camelCased keys start with "id" (e.g. idPrevious, idNext).
 */
function transformPreviousNextRead(raw: Record<string, string>): Record<string, unknown> {
  let type: PreviousNextType = 'previous';
  if (raw.idPrevious === 'true') type = 'previous';
  else if (raw.idNext === 'true') type = 'next';
  else if (raw.idPreviousAndNext === 'true') type = 'both';

  return {
    type,
    altLayoutName: raw.idCustomFormatterTextarea ?? '',
    skipNonFulltextContent: raw.idSkipNonFulltextContent === 'yes',
    onlyLinkToContentWithNav: raw.idNextNavigationWithPreviousNextNavigation === 'yes',
    sameContentTypeRestriction: raw.idSameTemplateRestriction === 'yes',
    displayOnBoundary: raw.idDisplayOnBoundary === 'yes',
    displayContentNameAsTitle: raw.idDisplayContentNameAsTitle === 'yes',
    previousHtml: raw.idPreviousHtml ?? '',
    betweenHtml: raw.idBetweenHtml ?? '',
    nextHtml: raw.idNextHtml ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Previous/Next Fulltext save.
 * Derives: customFormatter from altLayoutName. Expands `type` to three boolean fields.
 * Keys use the camelCased form of the API keys (e.g. idPrevious, idNext).
 */
function transformPreviousNextWrite(props: Record<string, unknown>): Record<string, string> {
  const type = (props.type as PreviousNextType) ?? 'previous';
  const altLayoutName = String(props.altLayoutName ?? '');

  return {
    idPrevious: type === 'previous' ? 'true' : 'false',
    idNext: type === 'next' ? 'true' : 'false',
    idPreviousAndNext: type === 'both' ? 'true' : 'false',
    idCustomFormatter: altLayoutName ? 'yes' : 'no',
    idCustomFormatterTextarea: altLayoutName,
    idSkipNonFulltextContent: props.skipNonFulltextContent ? 'yes' : 'no',
    idNextNavigationWithPreviousNextNavigation: props.onlyLinkToContentWithNav ? 'yes' : 'no',
    idSameTemplateRestriction: props.sameContentTypeRestriction ? 'yes' : 'no',
    idDisplayOnBoundary: props.displayOnBoundary ? 'yes' : 'no',
    idDisplayContentNameAsTitle: props.displayContentNameAsTitle ? 'yes' : 'no',
    idPreviousHtml: String(props.previousHtml ?? ''),
    idBetweenHtml: String(props.betweenHtml ?? ''),
    idNextHtml: String(props.nextHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Section Iterator.
 */
function transformSectionIteratorRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    beforeHtml: raw.beforeHtml ?? '',
    betweenHtml: raw.betweenHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Section Iterator save.
 */
function transformSectionIteratorWrite(props: Record<string, unknown>): Record<string, string> {
  return {
    beforeHtml: String(props.beforeHtml ?? ''),
    betweenHtml: String(props.betweenHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Related Section Branch.
 */
function transformRelatedSectionBranchRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    childSectionName: raw.nameOfChildSection ?? '',
    linkText: raw.linkText ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Related Section Branch save.
 */
function transformRelatedSectionBranchWrite(props: Record<string, unknown>): Record<string, string> {
  return {
    nameOfChildSection: String(props.childSectionName ?? ''),
    linkText: String(props.linkText ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Return to Index.
 */
function transformReturnToIndexRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    linkText: raw.linkText ?? '',
    appendSectionName: raw.appendSectionName === 'yes',
    scrollToContent: raw.scrollToContent === 'yes',
    linkTarget: raw.linkTarget ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Return to Index save.
 */
function transformReturnToIndexWrite(props: Record<string, unknown>): Record<string, string> {
  return {
    linkText: String(props.linkText ?? ''),
    appendSectionName: props.appendSectionName ? 'yes' : 'no',
    scrollToContent: props.scrollToContent ? 'yes' : 'no',
    linkTarget: String(props.linkTarget ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Section Meta Info.
 * Note: metaType will be the raw ID string here — resolved to name in get().
 */
function transformSectionMetaInfoRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    metaType: raw.metaType ?? '',
    dateFormat: raw.dateFormat ?? '',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Section Meta Info save.
 * Note: metaType here could be a name (needs resolution) or already an ID string.
 */
function transformSectionMetaInfoWrite(props: Record<string, unknown>): Record<string, string> {
  return {
    metaType: String(props.metaType ?? ''),
    dateFormat: String(props.dateFormat ?? ''),
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Top Stories.
 */
function transformTopStoriesRead(raw: Record<string, string>): Record<string, unknown> {
  return {
    section: parseInt(raw.section ?? '0', 10),
    numToShow: parseInt(raw.numtoshow ?? '0', 10),
    linkToFulltext: raw.linkToFulltext === 'yes',
    title: raw.title ?? '',
    beforeMenuHtml: raw.beforeMenuHtml ?? '',
    afterMenuHtml: raw.afterMenuHtml ?? '',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
  };
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Top Stories save.
 */
function transformTopStoriesWrite(props: Record<string, unknown>): Record<string, string> {
  return {
    section: String(props.section ?? 0),
    numtoshow: String(props.numToShow ?? 0),
    linkToFulltext: props.linkToFulltext ? 'yes' : 'no',
    title: String(props.title ?? ''),
    beforeMenuHtml: String(props.beforeMenuHtml ?? ''),
    afterMenuHtml: String(props.afterMenuHtml ?? ''),
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Site Map.
 */
function transformSiteMapRead(raw: Record<string, string>): Record<string, unknown> {
  const enableContentCount = raw.enableContentCount === 'yes';
  const result: Record<string, unknown> = {
    startSection: parseInt(raw.section ?? '0', 10),
    levels: parseInt(raw.levels ?? '0', 10),
    childSectionLinks: raw.showRelativeChildSections === 'yes',
    enableContentCount,
  };
  if (enableContentCount) {
    const templateType = raw.templateType ?? '0';
    result.contentTypeIds = templateType && templateType !== '0'
      ? templateType.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0)
      : [];
    result.maxLevelsToCount = raw.maxLevelsToCount ? parseInt(raw.maxLevelsToCount, 10) : '';
    result.countRecursively = raw.countRecursively === 'yes';
    result.htmlBeforeContentCount = raw.htmlBeforeContentCount ?? '';
    result.htmlAfterContentCount = raw.htmlAfterContentCount ?? '';
  }
  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Site Map save.
 */
function transformSiteMapWrite(props: Record<string, unknown>): Record<string, string> {
  const enableContentCount = !!props.enableContentCount;
  return {
    section: String(props.startSection ?? 0),
    levels: String(props.levels ?? 0),
    showRelativeChildSections: props.childSectionLinks ? 'yes' : 'no',
    enableContentCount: enableContentCount ? 'yes' : 'no',
    templateType: enableContentCount ? (() => {
      const ids = props.contentTypeIds as number[] | undefined;
      return ids && ids.length > 0 ? ids.join(',') : '0';
    })() : '0',
    maxLevelsToCount: enableContentCount ? String(props.maxLevelsToCount ?? '') : '',
    countRecursively: enableContentCount ? (props.countRecursively ? 'yes' : 'no') : 'no',
    htmlBeforeContentCount: enableContentCount ? String(props.htmlBeforeContentCount ?? '') : '',
    htmlAfterContentCount: enableContentCount ? String(props.htmlAfterContentCount ?? '') : '',
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Section Details.
 * Hides irrelevant fields based on detailMethod.
 */
function transformSectionDetailsRead(raw: Record<string, string>): Record<string, unknown> {
  const methodApi = raw.detailsMethod ?? 'details-method-current';
  const method = DETAIL_METHOD_FROM_API[methodApi] ?? 'current';
  const result: Record<string, unknown> = {
    detailMethod: method,
    displayType: DISPLAY_TYPE_FROM_API[raw.displayType ?? ''] ?? 'id',
  };
  if (method === 'level') {
    result.level = parseInt(raw.level ?? '0', 10);
  }
  if (method === 'section') {
    result.section = parseInt(raw.section ?? '0', 10);
  }
  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Section Details save.
 */
function transformSectionDetailsWrite(props: Record<string, unknown>): Record<string, string> {
  const method = (props.detailMethod as SectionDetailMethod) ?? 'current';
  return {
    detailsMethod: DETAIL_METHOD_TO_API[method] ?? 'details-method-current',
    level: String(props.level ?? 0),
    section: String(props.section ?? 0),
    displayType: DISPLAY_TYPE_TO_API[(props.displayType as SectionDetailDisplayType) ?? 'id'] ?? 'display-type-id',
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Related Content.
 * Hides deprecated/internal fields.
 */
function transformRelatedContentRead(raw: Record<string, string>): Record<string, unknown> {
  const fetchMethodApi = raw.fetchMethod ?? 'fetch-method-current';
  const fetchMethod = RC_FETCH_METHOD_FROM_API[fetchMethodApi] ?? 'current';
  const altLayoutName = raw.altFormatterType ?? '';

  const result: Record<string, unknown> = {
    fetchMethod,
    title: raw.title ?? '',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
  };

  if (altLayoutName) result.altLayoutName = altLayoutName;

  if (fetchMethod === 'section') {
    result.section = parseInt(raw.section ?? '0', 10);
  } else if (fetchMethod === 'child') {
    const childName = raw.fetchChild ?? '';
    if (childName) result.childSectionName = childName;
    const templateIds = raw.templateIds ?? '';
    result.contentTypeIds = templateIds ? templateIds.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n)) : [];
    result.display = parseInt(raw.numberOfPieces ?? '0', 10);
    result.recurseChildSection = raw.recurseChildSection === 'yes';
  }

  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Related Content save.
 */
function transformRelatedContentWrite(props: Record<string, unknown>): Record<string, string> {
  const fetchMethod = (props.fetchMethod as RelatedContentFetchMethod) ?? 'current';
  const altLayoutName = String(props.altLayoutName ?? '');
  const contentTypeIds = props.contentTypeIds as number[] | undefined;

  return {
    fetchMethod: RC_FETCH_METHOD_TO_API[fetchMethod] ?? 'fetch-method-current',
    relatedcontentType: RC_TYPE_MAP[fetchMethod] ?? 'rc',
    section: fetchMethod === 'section' ? String(props.section ?? 0) : '0',
    fetchChild: fetchMethod === 'child' ? String(props.childSectionName ?? '') : '',
    templateIds: fetchMethod === 'child' && contentTypeIds ? contentTypeIds.join(',') : '',
    numberOfPieces: fetchMethod === 'child' ? String(props.display ?? 0) : '0',
    recurseChildSection: fetchMethod === 'child' ? (props.recurseChildSection ? 'yes' : 'no') : 'no',
    useAltFormatter: altLayoutName ? 'yes' : 'no',
    altFormatterType: altLayoutName,
    title: String(props.title ?? ''),
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
    searchUpwards: 'no',
    moreLink: 'no',
    moreLinkText: '',
    levelsToRecurse: '',
    showNameWhenHidden: 'no',
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Link Menu.
 * Conditionally shows fields based on menuType.
 */
function transformLinkMenuRead(raw: Record<string, string>): Record<string, unknown> {
  const menuTypeApi = raw.menutype ?? 'branch';
  const menuType = LINK_MENU_TYPE_FROM_API[menuTypeApi] ?? 'branch-at-level';
  const numToRecurse = parseInt(raw.numtorecurse ?? '1', 10);

  const result: Record<string, unknown> = {
    menuType,
    menuDisplayType: MENU_DISPLAY_FROM_API[raw.menuDisplayType ?? ''] ?? 'normal',
    showNonCurrentChildren: raw.showNonCurrentChildren === 'yes',
    useCurrentBranchClass: raw.classCurrentBranch === 'yes',
    currentSectionLink: raw.makeSectionLink === 'yes',
    addSectionName: raw.titlePrependSect === 'yes',
    title: raw.title ?? '',
    beforeMenuHtml: raw.beforeMenuHtml ?? '',
    afterMenuHtml: raw.afterMenuHtml ?? '',
    beforeLinkHtml: raw.beforeHtml ?? '',
    afterLinkHtml: raw.afterHtml ?? '',
    betweenLink: raw.betweenLink ?? '',
  };

  if (menuType === 'branch-at-level') {
    result.level = parseInt(raw.level ?? '0', 10);
    result.numToRecurse = numToRecurse;
    if (numToRecurse > 1) {
      result.subNavigationType = LINK_DISPLAY_FROM_API[raw.subNavigationType ?? ''] ?? 'ul';
    }
  }

  if (menuType === 'siblings-and-children') {
    result.subNavigationType = LINK_DISPLAY_FROM_API[raw.subNavigationType ?? ''] ?? 'ul';
  }

  if (menuType === 'children') {
    result.displaySpecificBranch = raw.displaySpecificBranch === 'yes';
    if (raw.displaySpecificBranch === 'yes') {
      result.specificBranchId = parseInt(raw.specificBranchId ?? '0', 10);
    }
    result.showSiblingsIfNoChildren = raw.sibIfNoChildren === 'yes';
    result.showAncestorsIfNoChildren = raw.ancIfNoChildren === 'yes';
  }

  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Link Menu save.
 */
function transformLinkMenuWrite(props: Record<string, unknown>): Record<string, string> {
  const menuType = (props.menuType as LinkMenuType) ?? 'branch-at-level';
  const numToRecurse = menuType === 'branch-at-level' ? Number(props.numToRecurse ?? 1) : 1;
  const showLinkDisplay = (menuType === 'branch-at-level' && numToRecurse > 1) || menuType === 'siblings-and-children';

  return {
    menutype: LINK_MENU_TYPE_TO_API[menuType] ?? 'branch',
    menuDisplayType: MENU_DISPLAY_TO_API[(props.menuDisplayType as LinkMenuDisplayType) ?? 'normal'] ?? 'menu-display-normal',
    level: menuType === 'branch-at-level' ? String(props.level ?? 0) : '0',
    numtorecurse: menuType === 'branch-at-level' ? String(numToRecurse) : '1',
    subNavigationType: showLinkDisplay ? (LINK_DISPLAY_TO_API[(props.subNavigationType as LinkDisplayType) ?? 'ul'] ?? 'link-display-ul') : 'link-display-ul',
    showNonCurrentChildren: props.showNonCurrentChildren ? 'yes' : 'no',
    classCurrentBranch: props.useCurrentBranchClass ? 'yes' : 'no',
    makeSectionLink: props.currentSectionLink ? 'yes' : 'no',
    titlePrependSect: props.addSectionName ? 'yes' : 'no',
    displaySpecificBranch: menuType === 'children' ? (props.displaySpecificBranch ? 'yes' : 'no') : 'no',
    specificBranchId: menuType === 'children' && props.displaySpecificBranch ? String(props.specificBranchId ?? 0) : '0',
    sibIfNoChildren: menuType === 'children' ? (props.showSiblingsIfNoChildren ? 'yes' : 'no') : 'no',
    ancIfNoChildren: menuType === 'children' ? (props.showAncestorsIfNoChildren ? 'yes' : 'no') : 'no',
    title: String(props.title ?? ''),
    beforeMenuHtml: String(props.beforeMenuHtml ?? ''),
    afterMenuHtml: String(props.afterMenuHtml ?? ''),
    beforeHtml: String(props.beforeLinkHtml ?? ''),
    afterHtml: String(props.afterLinkHtml ?? ''),
    betweenLink: String(props.betweenLink ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Publish to One File.
 * Conditionally shows fields based on startSection mode, showSectionName, and pagination.
 */
function transformPublishOneFileRead(raw: Record<string, string>): Record<string, unknown> {
  let startSection: PublishOneFileStartSection = 'current';
  if (raw.contentTypeSection === 'yes') {
    startSection = 'element';
  } else if (raw.startSection && raw.startSection !== '0') {
    startSection = 'specific';
  }

  const showSectionName = raw.showSectionName === 'yes';
  const pagination = raw.paginationAcrossPages === 'yes';
  const altLayoutName = raw.altFormatterType ?? '';

  const result: Record<string, unknown> = {
    contentTypeId: (() => { const v = parseInt(raw.templateList ?? '0', 10); return v > 0 ? v : null; })(),
    startSection,
    showHiddenSections: raw.showHiddenSections === 'yes',
    levelsToRecurse: parseInt(raw.levelsToRecurse ?? '1', 10),
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
    showSectionName,
    enableCaching: raw.enableCaching === 'yes',
    pagination,
  };

  if (altLayoutName) result.altLayoutName = altLayoutName;

  if (startSection === 'specific') {
    result.section = parseInt(raw.startSection ?? '0', 10);
  } else if (startSection === 'element') {
    result.startSectionElement = raw.startSectionElement ?? '';
  }

  if (showSectionName) {
    result.showNameForHidden = raw.showNameForHidden === 'yes';
    result.beforeSectionName = raw.beforeSectionName ?? '';
    result.afterSectionName = raw.afterSectionName ?? '';
  }

  const surroundingStyle = parseInt(raw.surroundingStyle ?? '0', 10);
  if (surroundingStyle > 0) result.surroundingPageLayout = surroundingStyle;

  if (pagination) {
    result.contentPerPage = parseInt(raw.contentPerPage ?? '0', 10);
    result.beforePaginationHtml = raw.beforePaginationHtml ?? '';
    result.betweenPaginationHtml = raw.betweenPaginationHtml ?? '';
    result.afterPaginationHtml = raw.afterPaginationHtml ?? '';
  }

  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Publish to One File save.
 */
function transformPublishOneFileWrite(props: Record<string, unknown>): Record<string, string> {
  const startSection = (props.startSection as PublishOneFileStartSection) ?? 'current';
  const showSectionName = !!props.showSectionName;
  const pagination = !!props.pagination;
  const altLayoutName = String(props.altLayoutName ?? '');

  return {
    templateList: String(props.contentTypeId && (props.contentTypeId as number) > 0 ? props.contentTypeId : 0),
    contentTypeSection: startSection === 'element' ? 'yes' : 'no',
    startSection: startSection === 'specific' ? String(props.section ?? 0) : '0',
    startSectionElement: startSection === 'element' ? String(props.startSectionElement ?? '') : '',
    showHiddenSections: props.showHiddenSections ? 'yes' : 'no',
    levelsToRecurse: String(props.levelsToRecurse ?? 1),
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
    showSectionName: showSectionName ? 'yes' : 'no',
    showNameForHidden: showSectionName ? (props.showNameForHidden ? 'yes' : 'no') : 'no',
    beforeSectionName: showSectionName ? String(props.beforeSectionName ?? '') : '',
    afterSectionName: showSectionName ? String(props.afterSectionName ?? '') : '',
    surroundingStyle: props.surroundingPageLayout ? String(props.surroundingPageLayout) : '',
    useAltFormatter: altLayoutName ? 'yes' : 'no',
    altFormatterType: altLayoutName,
    enableCaching: props.enableCaching !== false ? 'yes' : 'no',
    paginationAcrossPages: pagination ? 'yes' : 'no',
    contentPerPage: pagination ? String(props.contentPerPage ?? 0) : '0',
    beforePaginationHtml: pagination ? String(props.beforePaginationHtml ?? '') : '',
    betweenPaginationHtml: pagination ? String(props.betweenPaginationHtml ?? '') : '',
    afterPaginationHtml: pagination ? String(props.afterPaginationHtml ?? '') : '',
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Top Content.
 */
function transformTopContentRead(raw: Record<string, string>): Record<string, unknown> {
  const fetchMethodApi = raw.fetchMethod ?? 'fetch-method-current';
  const fetchMethod = TC_FETCH_METHOD_FROM_API[fetchMethodApi] ?? 'current';
  const altLayoutName = raw.altFormatterType ?? '';
  const templateIds = raw.templateIds ?? '';

  const result: Record<string, unknown> = {
    fetchMethod,
    contentTypeIds: templateIds ? templateIds.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0) : [],
    channelId: parseInt(raw.channelId ?? '0', 10),
    upcomingContent: raw.upcomingContent === 'yes',
    dateElement: raw.pubElement ?? '',
    ignoreDateOrdering: raw.dateOrderedContent === 'yes',
    numToDisplay: parseInt(raw.numberOfPieces ?? '0', 10),
    startAt: parseInt(raw.startingContent ?? '0', 10),
    title: raw.title ?? '',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
  };

  if (fetchMethod === 'branch' || fetchMethod === 'section') {
    result.section = parseInt(raw.section ?? '0', 10);
  }

  if (altLayoutName) result.altLayoutName = altLayoutName;

  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Top Content save.
 */
function transformTopContentWrite(props: Record<string, unknown>): Record<string, string> {
  const fetchMethod = (props.fetchMethod as TopContentFetchMethod) ?? 'current';
  const altLayoutName = String(props.altLayoutName ?? '');
  const contentTypeIds = props.contentTypeIds as number[] | undefined;

  return {
    fetchMethod: TC_FETCH_METHOD_TO_API[fetchMethod] ?? 'fetch-method-current',
    section: (fetchMethod === 'branch' || fetchMethod === 'section') ? String(props.section ?? 0) : '0',
    templateIds: contentTypeIds && contentTypeIds.length > 0 ? contentTypeIds.join(',') : '',
    channelId: String(props.channelId ?? 0),
    upcomingContent: props.upcomingContent ? 'yes' : 'no',
    pubElement: String(props.dateElement ?? ''),
    dateOrderedContent: props.ignoreDateOrdering ? 'yes' : 'no',
    numberOfPieces: String(props.numToDisplay ?? 0),
    startingContent: String(props.startAt ?? 0),
    useAltFormatter: altLayoutName ? 'yes' : 'no',
    altFormatterType: altLayoutName,
    title: String(props.title ?? ''),
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
  };
}

/**
 * Transforms raw camelCased string properties into friendly typed properties for Keyword Search Content.
 */
function transformKeywordSearchRead(raw: Record<string, string>): Record<string, unknown> {
  const keywordFetchMethod = KW_FETCH_FROM_API[raw.fetchMethod ?? ''] ?? 'current';
  const contentFetchMethod = KW_CONTENT_FETCH_FROM_API[raw.searchFetchMethod ?? ''] ?? 'section';
  const altLayoutName = raw.altFormatterType ?? '';
  const pagination = raw.paginationEnabled === 'yes';
  const sortByDateElement = raw.orderByDateElement === 'yes';

  const result: Record<string, unknown> = {
    keywordFetchMethod,
    narrowToSingleContentItem: raw.narrowOnFulltext === 'yes',
    keywordContentTypeId: (() => { const v = parseInt(raw.templateListGet ?? '-1', 10); return v > 0 ? v : null; })(),
    keywordElements: raw.templateElementGet ? raw.templateElementGet.split(',').map((s) => s.trim()).filter(Boolean) : [],
    contentFetchMethod,
    searchContentTypeId: (() => { const v = parseInt(raw.templateListSearch ?? '-1', 10); return v > 0 ? v : null; })(),
    searchElements: raw.templateElementSearch ? raw.templateElementSearch.split(',').map((s) => s.trim()).filter(Boolean) : [],
    numToDisplay: parseInt(raw.numberOfPieces ?? '0', 10) || 0,
    sortType: KW_SORT_FROM_API[raw.orderBy ?? ''] ?? 'name',
    sortByDateElement,
    showUpcomingContent: raw.showUpcomingContent === 'yes',
    showHiddenSections: raw.showHiddenSections === 'yes',
    matchCompositeKeywords: raw.matchCompositeKeywords === 'yes',
    matchSubItems: raw.matchSubItems === 'yes',
    crossLanguageSearch: raw.crossLanguageSearchingEnabled === 'yes',
    beforeHtml: raw.beforeHtml ?? '',
    afterHtml: raw.afterHtml ?? '',
    pagination,
  };

  // Keyword fetch method specific
  if (keywordFetchMethod === 'section') {
    result.keywordSection = parseInt(raw.section ?? '0', 10);
  }

  // Content fetch method specific
  if (contentFetchMethod === 'section' || contentFetchMethod === 'branch') {
    const searchSection = parseInt(raw.searchSection ?? '0', 10);
    const searchSectionElement = raw.templateElementForSearchSection ?? '';
    if (searchSection > 0) {
      result.searchSection = searchSection;
    } else if (searchSectionElement) {
      result.searchSectionElement = searchSectionElement;
    }
  }
  if (contentFetchMethod === 'branch-at-level') {
    result.startLevel = parseInt(raw.level ?? '0', 10);
    result.endLevel = parseInt(raw.numToRecurse ?? '0', 10);
  }

  // Conditional fields
  if (sortByDateElement) {
    result.dateElementName = raw.orderByDateElementName ?? '';
  }
  if (raw.crossLanguageSearchingEnabled === 'yes' && raw.crossLanguageSearchingLanguages) {
    result.crossLanguageLanguages = raw.crossLanguageSearchingLanguages.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (altLayoutName) result.altLayoutName = altLayoutName;
  if (pagination) {
    result.contentPerPage = parseInt(raw.contentPerPage ?? '0', 10);
    result.beforePaginationHtml = raw.beforePaginationHtml ?? '';
    result.betweenPaginationHtml = raw.betweenPaginationHtml ?? '';
    result.afterPaginationHtml = raw.afterPaginationHtml ?? '';
  }

  return result;
}

/**
 * Transforms friendly typed properties back to camelCased string properties for Keyword Search Content save.
 */
function transformKeywordSearchWrite(props: Record<string, unknown>): Record<string, string> {
  const keywordFetchMethod = (props.keywordFetchMethod as KeywordFetchMethod) ?? 'current';
  const contentFetchMethod = (props.contentFetchMethod as KeywordContentFetchMethod) ?? 'section';
  const altLayoutName = String(props.altLayoutName ?? '');
  const pagination = !!props.pagination;
  const crossLangs = props.crossLanguageLanguages as string[] | undefined;

  return {
    fetchMethod: KW_FETCH_TO_API[keywordFetchMethod] ?? 'fetch-method-current',
    narrowOnFulltext: props.narrowToSingleContentItem ? 'yes' : 'no',
    templateListGet: String(props.keywordContentTypeId && (props.keywordContentTypeId as number) > 0 ? props.keywordContentTypeId : -1),
    templateElementGet: Array.isArray(props.keywordElements) ? (props.keywordElements as string[]).join(',') : '',
    searchFetchMethod: KW_CONTENT_FETCH_TO_API[contentFetchMethod] ?? 'fetch-method-section',
    section: keywordFetchMethod === 'section' ? String(props.keywordSection ?? 0) : '0',
    searchSection: (contentFetchMethod === 'section' || contentFetchMethod === 'branch') && !props.searchSectionElement ? String(props.searchSection ?? 0) : '0',
    templateElementForSearchSection: String(props.searchSectionElement ?? ''),
    level: contentFetchMethod === 'branch-at-level' ? String(props.startLevel ?? 0) : '0',
    numToRecurse: contentFetchMethod === 'branch-at-level' ? String(props.endLevel ?? 0) : '0',
    templateListSearch: String(props.searchContentTypeId && (props.searchContentTypeId as number) > 0 ? props.searchContentTypeId : -1),
    templateElementSearch: Array.isArray(props.searchElements) ? (props.searchElements as string[]).join(',') : '',
    numberOfPieces: String(props.numToDisplay ?? ''),
    orderBy: KW_SORT_TO_API[(props.sortType as KeywordSortType) ?? 'name'] ?? 'order-name',
    orderByDateElement: props.sortByDateElement ? 'yes' : 'no',
    orderByDateElementName: props.sortByDateElement ? String(props.dateElementName ?? '') : '',
    showUpcomingContent: props.showUpcomingContent ? 'yes' : 'no',
    showHiddenSections: props.showHiddenSections ? 'yes' : 'no',
    matchCompositeKeywords: props.matchCompositeKeywords ? 'yes' : 'no',
    matchSubItems: props.matchSubItems ? 'yes' : 'no',
    crossLanguageSearchingEnabled: props.crossLanguageSearch ? 'yes' : 'no',
    crossLanguageSearchingLanguages: crossLangs && crossLangs.length > 0 ? crossLangs.join(',') : '',
    useAltFormatter: altLayoutName ? 'yes' : 'no',
    altFormatterType: altLayoutName,
    beforeHtml: String(props.beforeHtml ?? ''),
    afterHtml: String(props.afterHtml ?? ''),
    paginationEnabled: pagination ? 'yes' : 'no',
    contentPerPage: pagination ? String(props.contentPerPage ?? 0) : '0',
    beforePaginationHtml: pagination ? String(props.beforePaginationHtml ?? '') : '',
    betweenPaginationHtml: pagination ? String(props.betweenPaginationHtml ?? '') : '',
    afterPaginationHtml: pagination ? String(props.afterPaginationHtml ?? '') : '',
  };
}

/** Applies type-aware read transformation if available, otherwise returns raw camelCased strings. */
function transformPropertiesRead(type: NavigationType, raw: Record<string, string>): Record<string, unknown> {
  switch (type) {
    case 'a-to-z': return transformA2ZRead(raw);
    case 'breadcrumbs': return transformBreadcrumbsRead(raw);
    case 'css-selector': return transformCssSelectorRead(raw);
    case 'generate-file': return transformGenerateFileRead(raw);
    case 'language-switcher': return transformLanguageSwitcherRead(raw);
    case 'pagination': return transformPaginationRead(raw);
    case 'previous-next-fulltext': return transformPreviousNextRead(raw);
    case 'section-iterator': return transformSectionIteratorRead(raw);
    case 'related-section-branch': return transformRelatedSectionBranchRead(raw);
    case 'return-to-index': return transformReturnToIndexRead(raw);
    case 'section-meta-info': return transformSectionMetaInfoRead(raw);
    case 'top-stories': return transformTopStoriesRead(raw);
    case 'site-map': return transformSiteMapRead(raw);
    case 'section-details': return transformSectionDetailsRead(raw);
    case 'related-content': return transformRelatedContentRead(raw);
    case 'link-menu': return transformLinkMenuRead(raw);
    case 'publish-to-one-file': return transformPublishOneFileRead(raw);
    case 'top-content': return transformTopContentRead(raw);
    case 'keyword-search': return transformKeywordSearchRead(raw);
    default: return { ...raw };
  }
}

/** Applies type-aware write transformation if available, otherwise returns the values as strings. */
function transformPropertiesWrite(type: NavigationType, props: Record<string, unknown>): Record<string, string> {
  switch (type) {
    case 'a-to-z': return transformA2ZWrite(props);
    case 'breadcrumbs': return transformBreadcrumbsWrite(props);
    case 'css-selector': return transformCssSelectorWrite(props);
    case 'generate-file': return transformGenerateFileWrite(props);
    case 'language-switcher': return transformLanguageSwitcherWrite(props);
    case 'pagination': return transformPaginationWrite(props);
    case 'previous-next-fulltext': return transformPreviousNextWrite(props);
    case 'section-iterator': return transformSectionIteratorWrite(props);
    case 'related-section-branch': return transformRelatedSectionBranchWrite(props);
    case 'return-to-index': return transformReturnToIndexWrite(props);
    case 'section-meta-info': return transformSectionMetaInfoWrite(props);
    case 'top-stories': return transformTopStoriesWrite(props);
    case 'site-map': return transformSiteMapWrite(props);
    case 'section-details': return transformSectionDetailsWrite(props);
    case 'related-content': return transformRelatedContentWrite(props);
    case 'link-menu': return transformLinkMenuWrite(props);
    case 'publish-to-one-file': return transformPublishOneFileWrite(props);
    case 'top-content': return transformTopContentWrite(props);
    case 'keyword-search': return transformKeywordSearchWrite(props);
    default: {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(props)) result[k] = String(v ?? '');
      return result;
    }
  }
}

/**
 * A mutable navigation object. Modify properties and call save() to persist.
 */
export class NavigationObject {
  readonly id: number;
  name: string;
  description: string;
  readonly type: NavigationType;
  readonly typeName: string;
  enabled: boolean;
  cachingEnabled: boolean;
  previewEnabled: boolean;
  properties: Record<string, unknown>;

  private readonly _httpClient!: HttpClient;
  private _rawData!: RawNavigationDetail;
  private _originalPropertyKeys!: string[];

  constructor(raw: RawNavigationDetail, httpClient: HttpClient) {
    this.id = raw.id;
    this.name = raw.name;
    this.description = raw.description ?? '';
    this.type = API_TO_SDK[raw.navigationType] ?? raw.navigationType as NavigationType;
    this.typeName = NAVIGATION_TYPE_NAMES[this.type] || raw.navigationTypeName || raw.navigationType;
    this.enabled = raw.isEnabled;
    this.cachingEnabled = raw.isCachingEnabled;
    this.previewEnabled = raw.isPreviewModeEnabled;

    // Convert properties to camelCase keys with string values
    const originalKeys: string[] = [];
    const rawCamelProps: Record<string, string> = {};
    for (const [key, prop] of Object.entries(raw.properties ?? {})) {
      originalKeys.push(key);
      rawCamelProps[toCamelCase(key)] = prop.value ?? '';
    }

    // Apply type-aware read transformation
    this.properties = transformPropertiesRead(this.type, rawCamelProps);

    Object.defineProperty(this, '_httpClient', { value: httpClient, enumerable: false });
    Object.defineProperty(this, '_rawData', { value: raw, enumerable: false, writable: true });
    Object.defineProperty(this, '_originalPropertyKeys', { value: originalKeys, enumerable: false });
  }

  /** Persists current property values to the server via PUT. */
  async save(): Promise<void> {
    // Apply type-aware write transformation (coerce back to strings, derive hidden fields)
    const camelStringProps = transformPropertiesWrite(this.type, this.properties);

    // Rebuild properties in API format
    const apiProperties: Record<string, { value: string; attribute: string; navigationPropertyID: number }> = {};
    for (const [camelKey, value] of Object.entries(camelStringProps)) {
      const originalKey = fromCamelCase(camelKey, this._originalPropertyKeys);
      apiProperties[originalKey] = {
        value,
        attribute: originalKey,
        navigationPropertyID: this.id,
      };
    }

    const body = {
      ...this._rawData,
      name: this.name,
      description: this.description,
      isEnabled: this.enabled,
      isCachingEnabled: this.cachingEnabled,
      isPreviewModeEnabled: this.previewEnabled,
      properties: apiProperties,
    };

    await this._httpClient.request<void>({
      method: 'PUT',
      path: `/navigation/${this.id}`,
      body,
    });
  }
}

/** Properties for A to Z Navigation create */
export interface A2ZProperties {
  /** Level to start generating from. 0 = root. Defaults to 0. */
  startLevel?: number;
  /** Level to stop generating at. 0 = all sections. Defaults to 0. */
  endLevel?: number;
  /** Whether to use section meta data element for display. Defaults to false. */
  useSectionMetaData?: boolean;
  /** Element name on the Section Meta Data content type to display. Only valid when useSectionMetaData is true. Defaults to ''. */
  sectionMetaContentTypeElement?: string;
  /** Microsite ID to scope the navigation to, or null for no microsite. Defaults to null. */
  microSite?: number | null;
  /** HTML before the menu. Defaults to ''. */
  beforeMenu?: string;
  /** HTML after the menu. Defaults to ''. */
  afterMenu?: string;
  /** HTML before each item. Defaults to ''. */
  beforeItem?: string;
  /** HTML after each item. Defaults to ''. */
  afterItem?: string;
}

/** Properties for Breadcrumbs create */
export interface BreadcrumbsProperties {
  /** Level to start from. 0 = root. Defaults to 0. Must be >= 0. */
  startLevel?: number;
  /** Level to end at. 0 = all. Defaults to 0. Must be >= 0. */
  endLevel?: number;
  /** Whether breadcrumb items are links. Defaults to false. */
  useLinks?: boolean;
  /** Whether the current (last) item is a link. Defaults to false. */
  linkCurrent?: boolean;
  /** Whether to hide the home section from the breadcrumb trail. Defaults to false. */
  hideHome?: boolean;
  /** Whether to remove spaces from links. Only valid when useLinks is true. Defaults to false. */
  noSpace?: boolean;
  /** Maximum number of characters before truncation. 0 = no limit. Defaults to 0. Must be >= 0. */
  maxLength?: number;
  /** HTML separator between breadcrumb items. Defaults to ''. */
  separator?: string;
  /** Content element name to append to the breadcrumb trail. If set, enables content element appending. Defaults to ''. */
  elementToAppend?: string;
  /** HTML before the breadcrumb. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after the breadcrumb. Defaults to ''. */
  afterHtml?: string;
}

/** A branch override for CSS Selector */
export interface CssSelectorBranch {
  /** Media ID of the stylesheet for this branch. Required. */
  stylesheet: number;
  /** Section name to match for this branch. Cannot be combined with rootSection. */
  name?: string;
  /** Section ID to use as root for this branch. Cannot be combined with name. */
  rootSection?: number;
}

/** Properties for CSS Selector create */
export interface CssSelectorProperties {
  /** Media ID of the default stylesheet. Required. */
  defaultStylesheet: number;
  /** Language code. Optional, defaults to ''. */
  language?: string;
  /** Branch-specific stylesheet overrides. Optional. */
  branches?: CssSelectorBranch[];
}

/** Properties for Generate File create */
export interface GenerateFileProperties {
  /** Output file name. Optional, defaults to ''. */
  fileName?: string;
  /** Whether to append the content ID to the file name. Defaults to false. */
  appendContentId?: boolean;
  /** File extension for the generated file. Optional, defaults to ''. */
  fileExtension?: string;
  /** Base directory for output. Optional, defaults to ''. */
  baseDirectory?: string;
  /** Content layout name to use. Optional, defaults to ''. */
  layout?: string;
  /** Whether to append the directory path. Defaults to false. */
  appendDirectory?: boolean;
  /** Media ID to associate with the generated file. Optional. Validated if provided. */
  mediaFile?: number | null;
}

/** Properties for Language Switcher create */
export interface LanguageSwitcherProperties {
  /** Language code. Optional, defaults to ''. */
  langCode?: string;
  /** Whether to always output the switcher even when only one language exists. Defaults to false. */
  alwaysOutput?: boolean;
  /** URL for image-based language links. Optional, defaults to ''. */
  imageUrl?: string;
  /** File extension for language images (e.g. '.gif'). Optional, defaults to ''. */
  imageExtension?: string;
  /** HTML attributes for language images (e.g. 'width="30" height="30"'). Optional, defaults to ''. */
  imageProperties?: string;
  /** HTML before the switcher. Optional, defaults to ''. */
  beforeHtml?: string;
  /** HTML after the switcher. Optional, defaults to ''. */
  afterHtml?: string;
}

/** Fetch method options for Pagination */
export type PaginationFetchMethod = 'current' | 'current-branch' | 'branch' | 'branch-at-level' | 'section';

/** Maps SDK fetch method names to API values */
const FETCH_METHOD_TO_API: Record<PaginationFetchMethod, string> = {
  'current': 'fetch-method-current',
  'current-branch': 'fetch-method-current-branch',
  'branch': 'fetch-method-branch',
  'branch-at-level': 'fetch-method-branch-at-level',
  'section': 'fetch-method-section',
};

/** Maps API fetch method values to SDK names */
const FETCH_METHOD_FROM_API: Record<string, PaginationFetchMethod> = Object.fromEntries(
  Object.entries(FETCH_METHOD_TO_API).map(([sdk, api]) => [api, sdk as PaginationFetchMethod]),
) as Record<string, PaginationFetchMethod>;

/** Properties for Pagination create */
export interface PaginationProperties {
  /** Content Type ID to paginate. Required, validated. */
  contentTypeId: number;
  /** Fetch method. Defaults to 'current'. */
  fetchMethod?: PaginationFetchMethod;
  /** Section ID (required for 'branch', 'branch-at-level', 'section'). Validated. */
  section?: number;
  /** Level for 'branch-at-level'. Defaults to 0. */
  level?: number;
  /** Recursion depth for 'current-branch', 'branch', 'branch-at-level'. Defaults to 0. */
  numToRecurse?: number;
  /** Number of content items per page. Defaults to 0 (no pagination). */
  contentItemsPerPage?: number;
  /** Maximum total content items. Defaults to 0 (unlimited). */
  maxContentItems?: number;
  /** Maximum pagination links to show. Defaults to 0 (all). */
  maxLinksPerPage?: number;
  /** Alternative layout name. If set, validates against content type layouts. Defaults to ''. */
  altLayoutName?: string;
  /** Whether to search hidden sections. Defaults to false. */
  searchHiddenSections?: boolean;
  /** HTML before the content. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after the content. Defaults to ''. */
  afterHtml?: string;
  /** HTML before pagination links. Defaults to ''. */
  beforePaginationHtml?: string;
  /** HTML after pagination links. Defaults to ''. */
  afterPaginationHtml?: string;
  /** HTML between pagination links. Defaults to ''. */
  betweenPaginationHtml?: string;
}

/** Direction type for Previous/Next Fulltext Content */
export type PreviousNextType = 'previous' | 'next' | 'both';

/** Properties for Previous/Next Fulltext Content create */
export interface PreviousNextProperties {
  /** Which direction links to show. Defaults to 'previous'. */
  type?: PreviousNextType;
  /** Alternative layout name. If set, enables custom formatter. Defaults to ''. */
  altLayoutName?: string;
  /** Whether to skip content that doesn't have fulltext. Defaults to false. */
  skipNonFulltextContent?: boolean;
  /** Whether to only link to content that also has a prev/next navigation. Defaults to false. */
  onlyLinkToContentWithNav?: boolean;
  /** Whether to restrict to content of the same content type. Defaults to false. */
  sameContentTypeRestriction?: boolean;
  /** Whether to display links on boundaries (first/last item). Defaults to false. */
  displayOnBoundary?: boolean;
  /** Whether to display content name as the link title. Defaults to false. */
  displayContentNameAsTitle?: boolean;
  /** HTML for the previous link. Defaults to ''. */
  previousHtml?: string;
  /** HTML between previous and next links. Defaults to ''. */
  betweenHtml?: string;
  /** HTML for the next link. Defaults to ''. */
  nextHtml?: string;
}

/** Properties for Section Iterator create */
export interface SectionIteratorProperties {
  /** HTML before the iterator output. Defaults to ''. */
  beforeHtml?: string;
  /** HTML between each iterated section. Defaults to ''. */
  betweenHtml?: string;
  /** HTML after the iterator output. Defaults to ''. */
  afterHtml?: string;
}

/** Properties for Related Section Branch create */
export interface RelatedSectionBranchProperties {
  /** Name of the child section to link to. Defaults to ''. */
  childSectionName?: string;
  /** Link text to display. Defaults to ''. */
  linkText?: string;
}

/** Properties for Return to Index create */
export interface ReturnToIndexProperties {
  /** Link text. Defaults to ''. */
  linkText?: string;
  /** Whether to append the section name to the link text. Defaults to false. */
  appendSectionName?: boolean;
  /** Whether to scroll to the content on click. Defaults to false. */
  scrollToContent?: boolean;
  /** Link target attribute (e.g. '_blank'). Defaults to ''. */
  linkTarget?: string;
}

/** Properties for Section Meta Info create */
export interface SectionMetaInfoProperties {
  /** Meta tag name (e.g. 'description', 'og:title'). Required. Validated against GET /meta/level. */
  metaType: string;
  /** Date format string (e.g. 'dd.MM.yyyy'). Optional, defaults to ''. */
  dateFormat?: string;
  /** HTML before the meta output. Optional, defaults to ''. */
  beforeHtml?: string;
  /** HTML after the meta output. Optional, defaults to ''. */
  afterHtml?: string;
}

/** Properties for Top Stories create */
export interface TopStoriesProperties {
  /** Section ID to pull top stories from. Required, validated. */
  section: number;
  /** Number of items to show. 0 = all. Defaults to 0. */
  numToShow?: number;
  /** Whether to link items to their fulltext page. Defaults to false. */
  linkToFulltext?: boolean;
  /** Title text. Defaults to ''. */
  title?: string;
  /** HTML before the menu. Defaults to ''. */
  beforeMenuHtml?: string;
  /** HTML after the menu. Defaults to ''. */
  afterMenuHtml?: string;
  /** HTML before each item. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after each item. Defaults to ''. */
  afterHtml?: string;
}

/** Properties for Site Map create */
export interface SiteMapProperties {
  /** Section ID to start from. 0 = channel root. Optional, validated if non-zero. Defaults to 0. */
  startSection?: number;
  /** Number of levels to display. 0 = all. Defaults to 0. */
  levels?: number;
  /** Whether to show links to child sections. Defaults to false. */
  childSectionLinks?: boolean;
  /** Whether to enable content counting. Defaults to false. */
  enableContentCount?: boolean;
  /** Content Type IDs to count. Empty array or omitted = all types. Only valid when enableContentCount is true. Validated. */
  contentTypeIds?: number[];
  /** Maximum levels to recurse when counting. Only valid when enableContentCount is true. Defaults to ''. */
  maxLevelsToCount?: number | string;
  /** Whether to count content recursively through child sections. Only valid when enableContentCount is true. Defaults to false. */
  countRecursively?: boolean;
  /** HTML before the content count. Only valid when enableContentCount is true. Defaults to ''. */
  htmlBeforeContentCount?: string;
  /** HTML after the content count. Only valid when enableContentCount is true. Defaults to ''. */
  htmlAfterContentCount?: string;
}

/** Detail method for Section Details */
export type SectionDetailMethod = 'current' | 'level' | 'section';

/** Display type for Section Details */
export type SectionDetailDisplayType = 'id' | 'name' | 'path' | 'link';

/** Maps SDK detail method to API value */
const DETAIL_METHOD_TO_API: Record<SectionDetailMethod, string> = {
  'current': 'details-method-current',
  'level': 'details-method-level',
  'section': 'details-method-section',
};

/** Maps API detail method to SDK value */
const DETAIL_METHOD_FROM_API: Record<string, SectionDetailMethod> = Object.fromEntries(
  Object.entries(DETAIL_METHOD_TO_API).map(([sdk, api]) => [api, sdk as SectionDetailMethod]),
) as Record<string, SectionDetailMethod>;

/** Maps SDK display type to API value */
const DISPLAY_TYPE_TO_API: Record<SectionDetailDisplayType, string> = {
  'id': 'display-type-id',
  'name': 'display-type-name',
  'path': 'display-type-path',
  'link': 'display-type-link',
};

/** Maps API display type to SDK value */
const DISPLAY_TYPE_FROM_API: Record<string, SectionDetailDisplayType> = Object.fromEntries(
  Object.entries(DISPLAY_TYPE_TO_API).map(([sdk, api]) => [api, sdk as SectionDetailDisplayType]),
) as Record<string, SectionDetailDisplayType>;

/** Properties for Section Details create */
export interface SectionDetailsProperties {
  /** How to determine which section to display details for. Defaults to 'current'. */
  detailMethod?: SectionDetailMethod;
  /** Level to use when detailMethod is 'level'. Defaults to 0. */
  level?: number;
  /** Section ID when detailMethod is 'section'. Required and validated when method is 'section'. */
  section?: number;
  /** What to display about the section. Defaults to 'id'. */
  displayType?: SectionDetailDisplayType;
}

/** Fetch method for Related Content */
export type RelatedContentFetchMethod = 'current' | 'section' | 'child';

/** Maps SDK fetch method to API value for Related Content */
const RC_FETCH_METHOD_TO_API: Record<RelatedContentFetchMethod, string> = {
  'current': 'fetch-method-current',
  'section': 'fetch-method-section',
  'child': 'fetch-method-child',
};

/** Maps API fetch method to SDK value for Related Content */
const RC_FETCH_METHOD_FROM_API: Record<string, RelatedContentFetchMethod> = Object.fromEntries(
  Object.entries(RC_FETCH_METHOD_TO_API).map(([sdk, api]) => [api, sdk as RelatedContentFetchMethod]),
) as Record<string, RelatedContentFetchMethod>;

/** Maps fetch method to the relatedcontent-type value */
const RC_TYPE_MAP: Record<RelatedContentFetchMethod, string> = {
  'current': 'rc',
  'section': 'rcb',
  'child': 'rcbl',
};

/** Properties for Related Content create */
export interface RelatedContentProperties {
  /** Fetch method. Defaults to 'current'. */
  fetchMethod?: RelatedContentFetchMethod;
  /** Section ID (required for 'section' method). Validated. */
  section?: number;
  /** Child section name to search in (for 'child' method). Optional. */
  childSectionName?: string;
  /** Content Type IDs to filter by (required for 'child' method). Validated. */
  contentTypeIds?: number[];
  /** Number of items to display. 0 = all. Defaults to 0. */
  display?: number;
  /** Whether to recurse into child sections (for 'child' method). Defaults to false. */
  recurseChildSection?: boolean;
  /** Alternative layout name. If set, enables alt formatter. Defaults to ''. */
  altLayoutName?: string;
  /** Title text. Defaults to ''. */
  title?: string;
  /** HTML before the content. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after the content. Defaults to ''. */
  afterHtml?: string;
}

/** Menu type for Link Menu */
export type LinkMenuType = 'branch-at-level' | 'children' | 'siblings' | 'siblings-and-children';

/** Maps SDK menu type to API value */
const LINK_MENU_TYPE_TO_API: Record<LinkMenuType, string> = {
  'branch-at-level': 'branch',
  'children': 'children',
  'siblings': 'siblings',
  'siblings-and-children': 'siblings-and-children',
};

/** Maps API menu type to SDK value */
const LINK_MENU_TYPE_FROM_API: Record<string, LinkMenuType> = Object.fromEntries(
  Object.entries(LINK_MENU_TYPE_TO_API).map(([sdk, api]) => [api, sdk as LinkMenuType]),
) as Record<string, LinkMenuType>;

/** Menu display type for Link Menu */
export type LinkMenuDisplayType = 'normal' | 'dropdown';

const MENU_DISPLAY_TO_API: Record<LinkMenuDisplayType, string> = {
  'normal': 'menu-display-normal',
  'dropdown': 'menu-display-dropdown',
};
const MENU_DISPLAY_FROM_API: Record<string, LinkMenuDisplayType> = Object.fromEntries(
  Object.entries(MENU_DISPLAY_TO_API).map(([sdk, api]) => [api, sdk as LinkMenuDisplayType]),
) as Record<string, LinkMenuDisplayType>;

/** Link display type for Link Menu */
export type LinkDisplayType = 'ul' | 'table' | 'div';

const LINK_DISPLAY_TO_API: Record<LinkDisplayType, string> = {
  'ul': 'link-display-ul',
  'table': 'link-display-table',
  'div': 'link-display-div',
};
const LINK_DISPLAY_FROM_API: Record<string, LinkDisplayType> = Object.fromEntries(
  Object.entries(LINK_DISPLAY_TO_API).map(([sdk, api]) => [api, sdk as LinkDisplayType]),
) as Record<string, LinkDisplayType>;

/** Properties for Link Menu create */
export interface LinkMenuProperties {
  /** Menu type. Required. */
  menuType: LinkMenuType;
  /** Menu display type. Defaults to 'normal'. */
  menuDisplayType?: LinkMenuDisplayType;
  /** Level (only for 'branch-at-level'). Defaults to 0. */
  level?: number;
  /** Recursion depth (only for 'branch-at-level'). Defaults to 1. */
  numToRecurse?: number;
  /** Link display type (only when branch-at-level + numToRecurse>1, or siblings-and-children). */
  subNavigationType?: LinkDisplayType;
  /** Whether to show non-current children. Defaults to false. */
  showNonCurrentChildren?: boolean;
  /** Whether to add a CSS class to the current branch. Defaults to false. */
  useCurrentBranchClass?: boolean;
  /** Whether to make the current section a link. Defaults to false. */
  currentSectionLink?: boolean;
  /** Whether to prepend section name to the title. Defaults to false. */
  addSectionName?: boolean;
  /** Whether to display a specific branch (only for 'children'). Defaults to false. */
  displaySpecificBranch?: boolean;
  /** Section ID of the specific branch (only when displaySpecificBranch is true). Validated. */
  specificBranchId?: number;
  /** Whether to show siblings if no children (only for 'children'). Defaults to false. */
  showSiblingsIfNoChildren?: boolean;
  /** Whether to show ancestors if no children (only for 'children'). Defaults to false. */
  showAncestorsIfNoChildren?: boolean;
  /** Title text. Defaults to ''. */
  title?: string;
  /** HTML before the menu. Defaults to ''. */
  beforeMenuHtml?: string;
  /** HTML after the menu. Defaults to ''. */
  afterMenuHtml?: string;
  /** HTML before each link. Defaults to ''. */
  beforeLinkHtml?: string;
  /** HTML after each link. Defaults to ''. */
  afterLinkHtml?: string;
  /** HTML between links. Defaults to ''. */
  betweenLink?: string;
}

/** Start section mode for Publish to One File */
export type PublishOneFileStartSection = 'current' | 'specific' | 'element';

/** Properties for Publish to One File create */
export interface PublishToOneFileProperties {
  /** Content Type ID to filter by. null = all content types. Validated if provided. */
  contentTypeId?: number | null;
  /** Start section mode. Defaults to 'current'. */
  startSection?: PublishOneFileStartSection;
  /** Section ID (only for 'specific' mode). Required and validated. */
  section?: number;
  /** Element name to derive section from (only for 'element' mode). Free text. */
  startSectionElement?: string;
  /** Whether to include hidden sections. Defaults to false. */
  showHiddenSections?: boolean;
  /** Number of levels to recurse. Defaults to 1. */
  levelsToRecurse?: number;
  /** HTML before content. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after content. Defaults to ''. */
  afterHtml?: string;
  /** Whether to display section names in output. Defaults to false. */
  showSectionName?: boolean;
  /** Whether to show section name for hidden sections (only when showSectionName is true). Defaults to false. */
  showNameForHidden?: boolean;
  /** HTML before section name (only when showSectionName is true). Defaults to ''. */
  beforeSectionName?: string;
  /** HTML after section name (only when showSectionName is true). Defaults to ''. */
  afterSectionName?: string;
  /** Page Layout ID to wrap output in. Optional, validated if provided. */
  surroundingPageLayout?: number;
  /** Alternative content layout name. If set, enables alt formatter. Defaults to ''. */
  altLayoutName?: string;
  /** Whether to enable caching. Defaults to true. */
  enableCaching?: boolean;
  /** Whether to paginate output across pages. Defaults to false. */
  pagination?: boolean;
  /** Content items per page (only when pagination is true). Defaults to 0. */
  contentPerPage?: number;
  /** HTML before pagination (only when pagination is true). Defaults to ''. */
  beforePaginationHtml?: string;
  /** HTML between pagination links (only when pagination is true). Defaults to ''. */
  betweenPaginationHtml?: string;
  /** HTML after pagination (only when pagination is true). Defaults to ''. */
  afterPaginationHtml?: string;
}

/** Fetch method for Top Content */
export type TopContentFetchMethod = 'current' | 'current-branch' | 'branch' | 'section';

/** Maps SDK fetch method to API value for Top Content */
const TC_FETCH_METHOD_TO_API: Record<TopContentFetchMethod, string> = {
  'current': 'fetch-method-current',
  'current-branch': 'fetch-method-current-branch',
  'branch': 'fetch-method-branch',
  'section': 'fetch-method-section',
};

/** Maps API fetch method to SDK value for Top Content */
const TC_FETCH_METHOD_FROM_API: Record<string, TopContentFetchMethod> = Object.fromEntries(
  Object.entries(TC_FETCH_METHOD_TO_API).map(([sdk, api]) => [api, sdk as TopContentFetchMethod]),
) as Record<string, TopContentFetchMethod>;

/** Properties for Top Content create */
export interface TopContentProperties {
  /** Fetch method. Defaults to 'current'. */
  fetchMethod?: TopContentFetchMethod;
  /** Section ID (required for 'branch' and 'section'). Validated. */
  section?: number;
  /** Content Type IDs to filter by. Empty = all. Validated. */
  contentTypeIds?: number[];
  /** Channel ID to restrict to. 0 = no restriction. Validated if non-zero. */
  channelId?: number;
  /** Whether to show upcoming/future content instead of current. Defaults to false. */
  upcomingContent?: boolean;
  /** Date element name for ordering/filtering. Defaults to ''. */
  dateElement?: string;
  /** Whether to ignore date ordering and use T4's section order. Defaults to false. */
  ignoreDateOrdering?: boolean;
  /** Number of content items to display. 0 = all. Defaults to 0. */
  numToDisplay?: number;
  /** Number of content items to skip. Defaults to 0. */
  startAt?: number;
  /** Alternative content layout name. If set, enables alt formatter. Defaults to ''. */
  altLayoutName?: string;
  /** Title text. Defaults to ''. */
  title?: string;
  /** HTML before the content. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after the content. Defaults to ''. */
  afterHtml?: string;
}

/** Keyword fetch method for Keyword Search Content */
export type KeywordFetchMethod = 'current' | 'parent' | 'section';

/** Content fetch method for Keyword Search Content */
export type KeywordContentFetchMethod = 'section' | 'branch' | 'branch-at-level';

/** Sort type for Keyword Search Content */
export type KeywordSortType = 'name' | 'name-desc' | 'last-modified';

/** Maps SDK keyword fetch method to API */
const KW_FETCH_TO_API: Record<KeywordFetchMethod, string> = {
  'current': 'fetch-method-current',
  'parent': 'fetch-method-parent',
  'section': 'fetch-method-section',
};
const KW_FETCH_FROM_API: Record<string, KeywordFetchMethod> = Object.fromEntries(
  Object.entries(KW_FETCH_TO_API).map(([sdk, api]) => [api, sdk as KeywordFetchMethod]),
) as Record<string, KeywordFetchMethod>;

/** Maps SDK content fetch method to API */
const KW_CONTENT_FETCH_TO_API: Record<KeywordContentFetchMethod, string> = {
  'section': 'fetch-method-section',
  'branch': 'fetch-method-branch',
  'branch-at-level': 'fetch-method-branch-at-level',
};
const KW_CONTENT_FETCH_FROM_API: Record<string, KeywordContentFetchMethod> = Object.fromEntries(
  Object.entries(KW_CONTENT_FETCH_TO_API).map(([sdk, api]) => [api, sdk as KeywordContentFetchMethod]),
) as Record<string, KeywordContentFetchMethod>;

/** Maps SDK sort type to API */
const KW_SORT_TO_API: Record<KeywordSortType, string> = {
  'name': 'order-name',
  'name-desc': 'order-name-desc',
  'last-modified': 'order-last-modified',
};
const KW_SORT_FROM_API: Record<string, KeywordSortType> = Object.fromEntries(
  Object.entries(KW_SORT_TO_API).map(([sdk, api]) => [api, sdk as KeywordSortType]),
) as Record<string, KeywordSortType>;

/** Properties for Keyword Search Content create */
export interface KeywordSearchProperties {
  // ── Keyword Retrieval ──
  /** Keyword fetch method. Defaults to 'current'. */
  keywordFetchMethod?: KeywordFetchMethod;
  /** Section ID for keyword retrieval (required when keywordFetchMethod is 'section'). Validated. */
  keywordSection?: number;
  /** Whether to narrow keyword selection to single content item. Defaults to false. */
  narrowToSingleContentItem?: boolean;
  /** Content Type ID for keyword retrieval. null = any content type. Validated if provided. */
  keywordContentTypeId?: number | null;
  /** Element names to get keywords from. Array. */
  keywordElements?: string[];

  // ── Content Retrieval ──
  /** Content fetch method. Defaults to 'section'. */
  contentFetchMethod?: KeywordContentFetchMethod;
  /** Section ID to search in (for section/branch, when not using searchSectionElement). Validated. */
  searchSection?: number;
  /** Content element name to derive search section from (alternative to searchSection). */
  searchSectionElement?: string;
  /** Start level (only for 'branch-at-level'). Defaults to 0. */
  startLevel?: number;
  /** End level / recursion depth (only for 'branch-at-level'). Defaults to 0. */
  endLevel?: number;
  /** Content Type ID to search keywords in. null = any content type. Validated if provided. */
  searchContentTypeId?: number | null;
  /** Element names to search keywords in. Array. */
  searchElements?: string[];

  // ── Display ──
  /** Number of content items to display. Defaults to 0 (all). */
  numToDisplay?: number;
  /** Sort type. Defaults to 'name'. */
  sortType?: KeywordSortType;
  /** Whether to sort by a date element. Defaults to false. */
  sortByDateElement?: boolean;
  /** Date element name (only when sortByDateElement is true). */
  dateElementName?: string;
  /** Whether to show upcoming/future content. Defaults to false. */
  showUpcomingContent?: boolean;
  /** Whether to include hidden sections. Defaults to false. */
  showHiddenSections?: boolean;
  /** Whether to match composite keywords. Defaults to false. */
  matchCompositeKeywords?: boolean;
  /** Whether to match sub-items. Defaults to false. */
  matchSubItems?: boolean;
  /** Whether to enable cross-language searching. Defaults to false. */
  crossLanguageSearch?: boolean;
  /** Language codes for cross-language searching. Array. */
  crossLanguageLanguages?: string[];

  // ── Output ──
  /** Alternative content layout name. Defaults to ''. */
  altLayoutName?: string;
  /** HTML before content. Defaults to ''. */
  beforeHtml?: string;
  /** HTML after content. Defaults to ''. */
  afterHtml?: string;
  /** Whether to enable pagination. Defaults to false. */
  pagination?: boolean;
  /** Content items per page (only when pagination is true). Defaults to 0. */
  contentPerPage?: number;
  /** HTML before pagination. Defaults to ''. */
  beforePaginationHtml?: string;
  /** HTML between pagination links. Defaults to ''. */
  betweenPaginationHtml?: string;
  /** HTML after pagination. Defaults to ''. */
  afterPaginationHtml?: string;
}

/** Create data shape — type determines which properties are valid */
export interface CreateNavigationData {
  type: NavigationType;
  name: string;
  description?: string;
  enabled?: boolean;
  previewEnabled?: boolean;
  properties?: A2ZProperties | BreadcrumbsProperties | CssSelectorProperties | GenerateFileProperties | LanguageSwitcherProperties | PaginationProperties | PreviousNextProperties | SectionIteratorProperties | RelatedSectionBranchProperties | ReturnToIndexProperties | SectionMetaInfoProperties | TopStoriesProperties | SiteMapProperties | SectionDetailsProperties | RelatedContentProperties | LinkMenuProperties | PublishToOneFileProperties | TopContentProperties | KeywordSearchProperties | Record<string, unknown>;
}

/**
 * Data for updating a navigation object (immutable pattern).
 * `type` is omitted — a navigation object's type cannot be changed after creation.
 * `properties` is merged into the existing properties.
 */
export interface UpdateNavigationData {
  name?: string;
  description?: string;
  enabled?: boolean;
  previewEnabled?: boolean;
  cachingEnabled?: boolean;
  properties?: A2ZProperties | BreadcrumbsProperties | CssSelectorProperties | GenerateFileProperties | LanguageSwitcherProperties | PaginationProperties | PreviousNextProperties | SectionIteratorProperties | RelatedSectionBranchProperties | ReturnToIndexProperties | SectionMetaInfoProperties | TopStoriesProperties | SiteMapProperties | SectionDetailsProperties | RelatedContentProperties | LinkMenuProperties | PublishToOneFileProperties | TopContentProperties | KeywordSearchProperties | Record<string, unknown>;
}

/** Channel response shape for microsite validation */
interface ChannelListItem {
  id: number;
  microSites?: Array<{ id: number; name: string; microSites?: ChannelListItem[] }>;
}

/** Collects all microsite IDs from a channels response (recursively) */
function collectMicrositeIds(channels: ChannelListItem[]): Set<number> {
  const ids = new Set<number>();
  function walk(items: Array<{ id: number; microSites?: Array<{ id: number; name: string; microSites?: ChannelListItem[] }> }>) {
    for (const item of items) {
      if (item.microSites) {
        for (const ms of item.microSites) {
          ids.add(ms.id);
          if (ms.microSites) walk(ms.microSites as ChannelListItem[]);
        }
      }
    }
  }
  walk(channels);
  return ids;
}

/**
 * Resource for navigation object operations.
 * Accessible via `t4.navigation`.
 */
export class NavigationResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Lists all navigation objects.
   * Optionally filter by type.
   */
  async list(options?: { type?: NavigationType }): Promise<NavigationSummary[]> {
    const raw = await this.httpClient.request<RawNavigationListItem[]>({
      method: 'GET',
      path: '/navigation',
    });

    let items = raw.map((item) => {
      const sdkType = API_TO_SDK[item.navigationType] ?? item.navigationType as NavigationType;
      return {
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        type: sdkType,
        typeName: item.navigationTypeName || NAVIGATION_TYPE_NAMES[sdkType] || item.navigationType,
        enabled: item.navigationEnabled,
      };
    });

    if (options?.type) {
      items = items.filter((item) => item.type === options.type);
    }

    return items;
  }

  /** Gets a single navigation object by ID. Returns a mutable NavigationObject. */
  async get(id: number): Promise<NavigationObject> {
    const raw = await this.httpClient.request<RawNavigationDetail>({
      method: 'GET',
      path: `/navigation/${id}`,
    });
    const nav = new NavigationObject(raw, this.httpClient);

    return await this.resolveNavigationProperties(nav);
  }

  /** Post-construction async resolution — resolves IDs to names and raw element names to aliases. */
  private async resolveNavigationProperties(nav: NavigationObject): Promise<NavigationObject> {
    // Section Meta Info: resolve metaType ID to name
    if (nav.type === 'section-meta-info' && nav.properties.metaType) {
      const metaId = parseInt(String(nav.properties.metaType), 10);
      if (metaId) {
        try {
          const metaLevels = await this.getMetaLevels();
          const match = metaLevels.find((m) => m.id === metaId);
          if (match) nav.properties.metaType = match.name;
        } catch { /* leave as ID */ }
      }
    }

    // A to Z: resolve raw element name back to alias for sectionMetaContentTypeElement
    if (nav.type === 'a-to-z' && nav.properties.sectionMetaContentTypeElement) {
      const rawName = String(nav.properties.sectionMetaContentTypeElement);
      if (rawName) {
        nav.properties.sectionMetaContentTypeElement = await this.resolveMetaDataElementName(rawName);
      }
    }

    // Publish to One File: resolve raw element name back to alias for startSectionElement
    if (nav.type === 'publish-to-one-file' && nav.properties.startSectionElement) {
      const contentTypeId = nav.properties.contentTypeId as number | undefined;
      if (contentTypeId && contentTypeId > 0) {
        const rawName = String(nav.properties.startSectionElement);
        nav.properties.startSectionElement = await this.resolveElementNameToAlias(contentTypeId, rawName);
      }
    }

    // Keyword Search: resolve raw element names back to aliases
    if (nav.type === 'keyword-search') {
      const kwCtId = nav.properties.keywordContentTypeId as number | undefined;
      const searchCtId = nav.properties.searchContentTypeId as number | undefined;

      // Resolve keywordElements (names → aliases)
      if (kwCtId && kwCtId > 0 && Array.isArray(nav.properties.keywordElements) && (nav.properties.keywordElements as string[]).length > 0) {
        nav.properties.keywordElements = await this.resolveElementNamesToAliases(kwCtId, nav.properties.keywordElements as string[]);
      }

      // Resolve searchElements (names → aliases)
      if (searchCtId && searchCtId > 0 && Array.isArray(nav.properties.searchElements) && (nav.properties.searchElements as string[]).length > 0) {
        nav.properties.searchElements = await this.resolveElementNamesToAliases(searchCtId, nav.properties.searchElements as string[]);
      }

      // Resolve searchSectionElement (name → alias)
      if (kwCtId && kwCtId > 0 && nav.properties.searchSectionElement) {
        nav.properties.searchSectionElement = await this.resolveElementNameToAlias(kwCtId, nav.properties.searchSectionElement as string);
      }
    }

    return nav;
  }

  /** Creates a new navigation object. */
  async create(data: CreateNavigationData): Promise<NavigationObject> {
    if (!data.name?.trim()) throw new Error('Navigation object name is required');
    if (!data.type) throw new Error('Navigation object type is required');
    if (!NAVIGATION_TYPE_NAMES[data.type]) throw new Error(`Unknown navigation type "${data.type}"`);

    const apiType = SDK_TO_API[data.type];
    const properties = await this.buildProperties(data.type, (data.properties ?? {}) as Record<string, unknown>);

    const body: Record<string, unknown> = {
      isEnabled: data.enabled ?? true,
      isPreviewModeEnabled: data.previewEnabled ?? true,
      isCachingEnabled: this.getDefaultCaching(data.type),
      name: data.name,
      description: data.description ?? '',
      navigationType: apiType,
      sharedGroups: [],
      primaryGroup: { id: 0 },
      properties,
    };

    // CSS Selector quirk: requires "section-name": "on" at the top level
    if (data.type === 'css-selector') {
      body['section-name'] = 'on';
    }

    // Keyword Search quirk: "search-content-element-name" mirrors searchSectionElement at top level
    if (data.type === 'keyword-search') {
      const kwProps = data.properties as KeywordSearchProperties | undefined;
      if (kwProps?.searchSectionElement) {
        body['search-content-element-name'] = kwProps.searchSectionElement;
      }
    }

    const response = await this.httpClient.request<RawNavigationDetail>({
      method: 'POST',
      path: '/navigation',
      body,
    });

    return await this.resolveNavigationProperties(new NavigationObject(response, this.httpClient));
  }

  /**
   * Updates a navigation object's properties (immutable pattern).
   * Fetches the existing object, applies your changes, saves, and returns it.
   *
   * `properties` is merged into the existing properties — pass only the keys you
   * want to change. Everything else is preserved. The navigation `type` cannot be
   * changed after creation.
   */
  async update(id: number, data: UpdateNavigationData): Promise<NavigationObject> {
    const nav = await this.get(id);

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('Navigation object name cannot be empty');
      nav.name = data.name;
    }
    if (data.description !== undefined) nav.description = data.description;
    if (data.enabled !== undefined) nav.enabled = data.enabled;
    if (data.previewEnabled !== undefined) nav.previewEnabled = data.previewEnabled;
    if (data.cachingEnabled !== undefined) nav.cachingEnabled = data.cachingEnabled;

    // Merge properties rather than replace — callers pass only what changes
    if (data.properties !== undefined) {
      nav.properties = {
        ...nav.properties,
        ...(data.properties as Record<string, unknown>),
      };
    }

    await nav.save();
    return nav;
  }

  /** Deletes a navigation object by ID. */
  async delete(id: number): Promise<void> {
    await this.httpClient.request<void>({
      method: 'DELETE',
      path: `/navigation/${id}`,
    });
  }

  /** Returns the default caching value per type (some types always use false). */
  private getDefaultCaching(type: NavigationType): boolean {
    if (type === 'top-stories' || type === 'related-content' || type === 'top-content' || type === 'keyword-search') return true;
    return false;
  }

  /** Builds and validates properties for the given navigation type. */
  private async buildProperties(
    type: NavigationType,
    input: Record<string, unknown>,
  ): Promise<Record<string, { value: string } | Record<string, never>>> {
    switch (type) {
      case 'a-to-z':
        return this.buildA2ZProperties(input as unknown as A2ZProperties);
      case 'breadcrumbs':
        return this.buildBreadcrumbsProperties(input as unknown as BreadcrumbsProperties);
      case 'css-selector':
        return this.buildCssSelectorProperties(input as unknown as CssSelectorProperties);
      case 'generate-file':
        return this.buildGenerateFileProperties(input as unknown as GenerateFileProperties);
      case 'language-switcher':
        return this.buildLanguageSwitcherProperties(input as unknown as LanguageSwitcherProperties);
      case 'pagination':
        return this.buildPaginationProperties(input as unknown as PaginationProperties);
      case 'previous-next-fulltext':
        return this.buildPreviousNextProperties(input as unknown as PreviousNextProperties);
      case 'section-iterator':
        return this.buildSectionIteratorProperties(input as unknown as SectionIteratorProperties);
      case 'related-section-branch':
        return this.buildRelatedSectionBranchProperties(input as unknown as RelatedSectionBranchProperties);
      case 'return-to-index':
        return this.buildReturnToIndexProperties(input as unknown as ReturnToIndexProperties);
      case 'section-meta-info':
        return this.buildSectionMetaInfoProperties(input as unknown as SectionMetaInfoProperties);
      case 'top-stories':
        return this.buildTopStoriesProperties(input as unknown as TopStoriesProperties);
      case 'site-map':
        return this.buildSiteMapProperties(input as unknown as SiteMapProperties);
      case 'section-details':
        return this.buildSectionDetailsProperties(input as unknown as SectionDetailsProperties);
      case 'related-content':
        return this.buildRelatedContentProperties(input as unknown as RelatedContentProperties);
      case 'link-menu':
        return this.buildLinkMenuProperties(input as unknown as LinkMenuProperties);
      case 'publish-to-one-file':
        return this.buildPublishToOneFileProperties(input as unknown as PublishToOneFileProperties);
      case 'top-content':
        return this.buildTopContentProperties(input as unknown as TopContentProperties);
      case 'keyword-search':
        return this.buildKeywordSearchProperties(input as unknown as KeywordSearchProperties);
      default:
        // For types not yet implemented, pass properties through as-is
        return this.buildGenericProperties(input);
    }
  }

  /** Builds properties for A to Z Navigation with validation. */
  private async buildA2ZProperties(input: A2ZProperties): Promise<Record<string, { value: string }>> {
    const startLevel = input.startLevel ?? 0;
    const endLevel = input.endLevel ?? 0;
    const useSectionMetaData = input.useSectionMetaData ?? false;
    const sectionMetaContentTypeElement = input.sectionMetaContentTypeElement ?? '';
    const microSite = input.microSite ?? null;
    const beforeMenu = input.beforeMenu ?? '';
    const afterMenu = input.afterMenu ?? '';
    const beforeItem = input.beforeItem ?? '';
    const afterItem = input.afterItem ?? '';

    // Validate: sectionMetaContentTypeElement only valid when useSectionMetaData is true
    if (sectionMetaContentTypeElement && !useSectionMetaData) {
      throw new Error('sectionMetaContentTypeElement can only be set when useSectionMetaData is true');
    }

    // Validate sectionMetaContentTypeElement against the Section Meta Data content type
    // Resolve alias → raw name for the API
    let resolvedMetaElement = sectionMetaContentTypeElement;
    if (useSectionMetaData && sectionMetaContentTypeElement) {
      resolvedMetaElement = await this.resolveMetaDataElementAlias(sectionMetaContentTypeElement);
    }

    // Validate microsite ID
    if (microSite !== null) {
      await this.validateMicrositeId(microSite);
    }

    return {
      'start_level': { value: String(startLevel) },
      'end_level': { value: String(endLevel) },
      'use_section_meta_data_element': { value: useSectionMetaData ? 'yes' : 'no' },
      'section_meta_data_template': { value: resolvedMetaElement },
      'sel_micro_site': { value: microSite !== null ? String(microSite) : '' },
      'before_menu': { value: beforeMenu },
      'after_menu': { value: afterMenu },
      'before_item': { value: beforeItem },
      'after_item': { value: afterItem },
    };
  }

  /** Builds properties for Breadcrumbs with validation. */
  private buildBreadcrumbsProperties(input: BreadcrumbsProperties): Record<string, { value: string }> {
    const startLevel = input.startLevel ?? 0;
    const endLevel = input.endLevel ?? 0;
    const useLinks = input.useLinks ?? false;
    const linkCurrent = input.linkCurrent ?? false;
    const hideHome = input.hideHome ?? false;
    const noSpace = input.noSpace ?? false;
    const maxLength = input.maxLength ?? 0;
    const separator = input.separator ?? '';
    const elementToAppend = input.elementToAppend ?? '';
    const beforeHtml = input.beforeHtml ?? '';
    const afterHtml = input.afterHtml ?? '';

    // Validation
    if (startLevel < 0) throw new Error('startLevel must be 0 or greater');
    if (endLevel < 0) throw new Error('endLevel must be 0 or greater');
    if (maxLength < 0) throw new Error('maxLength must be 0 or greater');
    if (noSpace && !useLinks) throw new Error('noSpace can only be true when useLinks is true');
    if (maxLength > 0 && (startLevel > 0 || endLevel > 0)) {
      throw new Error('maxLength cannot be set when startLevel or endLevel are above 0. Use either startLevel/endLevel or maxLength, not both.');
    }

    // Derived values (hidden from developer)
    const overspillFlag = maxLength > 0 ? 'yes' : 'no';
    const breadcrumbType = maxLength > 0 ? '20' : '10';
    const appendContentElement = elementToAppend ? 'yes' : 'no';

    return {
      'start-level': { value: String(startLevel) },
      'end-level': { value: String(endLevel) },
      'use-links': { value: useLinks ? 'yes' : 'no' },
      'link-current': { value: linkCurrent ? 'yes' : 'no' },
      'hide-home': { value: hideHome ? 'yes' : 'no' },
      'no-space': { value: noSpace ? 'yes' : 'no' },
      'over_spill_length': { value: String(maxLength) },
      'over_spill_flag': { value: overspillFlag },
      'breadcrumb-type': { value: breadcrumbType },
      'append-content-element': { value: appendContentElement },
      'element-to-append': { value: elementToAppend },
      'separator-html': { value: separator },
      'before-html': { value: beforeHtml },
      'after-html': { value: afterHtml },
    };
  }

  /** Builds properties for Section Iterator. */
  private buildSectionIteratorProperties(input: SectionIteratorProperties): Record<string, { value: string }> {
    return {
      'before-html': { value: input.beforeHtml ?? '' },
      'between-html': { value: input.betweenHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
    };
  }

  /** Builds properties for Related Section Branch. */
  private buildRelatedSectionBranchProperties(input: RelatedSectionBranchProperties): Record<string, { value: string }> {
    return {
      'Name of child section': { value: input.childSectionName ?? '' },
      'Link Text': { value: input.linkText ?? '' },
    };
  }

  /** Builds properties for Return to Index. */
  private buildReturnToIndexProperties(input: ReturnToIndexProperties): Record<string, { value: string }> {
    return {
      'link-text': { value: input.linkText ?? '' },
      'append-section-name': { value: input.appendSectionName ? 'yes' : 'no' },
      'scroll-to-content': { value: input.scrollToContent ? 'yes' : 'no' },
      'link-target': { value: input.linkTarget ?? '' },
    };
  }

  /** Builds properties for Section Meta Info with meta type validation. */
  private async buildSectionMetaInfoProperties(input: SectionMetaInfoProperties): Promise<Record<string, { value: string }>> {
    if (!input.metaType?.trim()) throw new Error('metaType is required for Section Meta Info navigation');

    // Resolve meta type name to ID
    const metaLevels = await this.getMetaLevels();
    const match = metaLevels.find((m) => m.name.toLowerCase() === input.metaType.toLowerCase());
    if (!match) {
      const validNames = metaLevels.map((m) => `"${m.name}"`).join(', ');
      throw new Error(`Invalid metaType "${input.metaType}". Valid options: ${validNames}`);
    }

    return {
      'meta-type': { value: String(match.id) },
      'date-format': { value: input.dateFormat ?? '' },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
    };
  }

  /** Fetches meta tag level definitions from GET /meta/level. */
  private async getMetaLevels(): Promise<Array<{ id: number; name: string }>> {
    return this.httpClient.request<Array<{ id: number; name: string }>>({
      method: 'GET',
      path: '/meta/level',
    });
  }

  /** Builds properties for Section Details with validation. */
  private async buildSectionDetailsProperties(input: SectionDetailsProperties): Promise<Record<string, { value: string }>> {
    const method = input.detailMethod ?? 'current';
    const validMethods: SectionDetailMethod[] = ['current', 'level', 'section'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid detailMethod "${method}". Valid options: ${validMethods.join(', ')}`);
    }

    const validDisplayTypes: SectionDetailDisplayType[] = ['id', 'name', 'path', 'link'];
    const displayType = input.displayType ?? 'id';
    if (!validDisplayTypes.includes(displayType)) {
      throw new Error(`Invalid displayType "${displayType}". Valid options: ${validDisplayTypes.join(', ')}`);
    }

    let level = 0;
    let section = 0;

    if (method === 'level') {
      level = input.level ?? 0;
    } else if (input.level && input.level > 0) {
      throw new Error('level can only be set when detailMethod is "level"');
    }

    if (method === 'section') {
      if (!input.section) throw new Error('section is required when detailMethod is "section"');
      await this.validateSectionExists(input.section);
      section = input.section;
    } else if (input.section && input.section > 0) {
      throw new Error('section can only be set when detailMethod is "section"');
    }

    return {
      'details-method': { value: DETAIL_METHOD_TO_API[method] },
      'level': { value: String(level) },
      'section': { value: String(section) },
      'display-type': { value: DISPLAY_TYPE_TO_API[displayType] },
    };
  }

  /** Builds properties for Link Menu with validation. */
  private async buildLinkMenuProperties(input: LinkMenuProperties): Promise<Record<string, { value: string }>> {
    if (!input.menuType) throw new Error('menuType is required for Link Menu navigation');
    const validTypes: LinkMenuType[] = ['branch-at-level', 'children', 'siblings', 'siblings-and-children'];
    if (!validTypes.includes(input.menuType)) {
      throw new Error(`Invalid menuType "${input.menuType}". Valid options: ${validTypes.join(', ')}`);
    }

    const menuType = input.menuType;
    const numToRecurse = menuType === 'branch-at-level' ? (input.numToRecurse ?? 1) : 1;
    const showLinkDisplay = (menuType === 'branch-at-level' && numToRecurse > 1) || menuType === 'siblings-and-children';

    // Validate conditional fields
    if (menuType !== 'branch-at-level' && input.level && input.level > 0) {
      throw new Error('level can only be set when menuType is "branch-at-level"');
    }
    if (menuType !== 'branch-at-level' && input.numToRecurse && input.numToRecurse > 1) {
      throw new Error('numToRecurse can only be set when menuType is "branch-at-level"');
    }
    if (!showLinkDisplay && input.subNavigationType) {
      throw new Error('subNavigationType can only be set when menuType is "branch-at-level" with numToRecurse > 1, or "siblings-and-children"');
    }
    if (menuType !== 'children' && input.displaySpecificBranch) {
      throw new Error('displaySpecificBranch can only be set when menuType is "children"');
    }
    if (menuType !== 'children' && input.showSiblingsIfNoChildren) {
      throw new Error('showSiblingsIfNoChildren can only be set when menuType is "children"');
    }
    if (menuType !== 'children' && input.showAncestorsIfNoChildren) {
      throw new Error('showAncestorsIfNoChildren can only be set when menuType is "children"');
    }

    // Validate specificBranchId
    if (input.displaySpecificBranch && input.specificBranchId) {
      await this.validateSectionExists(input.specificBranchId);
    }
    if (input.specificBranchId && !input.displaySpecificBranch) {
      throw new Error('specificBranchId can only be set when displaySpecificBranch is true');
    }

    return {
      'menutype': { value: LINK_MENU_TYPE_TO_API[menuType] },
      'menu-display-type': { value: MENU_DISPLAY_TO_API[input.menuDisplayType ?? 'normal'] ?? 'menu-display-normal' },
      'level': { value: menuType === 'branch-at-level' ? String(input.level ?? 0) : '0' },
      'numtorecurse': { value: menuType === 'branch-at-level' ? String(numToRecurse) : '1' },
      'link-display-type': { value: showLinkDisplay ? (LINK_DISPLAY_TO_API[input.subNavigationType ?? 'ul'] ?? 'link-display-ul') : 'link-display-ul' },
      'show-non-current-children': { value: input.showNonCurrentChildren ? 'yes' : 'no' },
      'class_current_branch': { value: input.useCurrentBranchClass ? 'yes' : 'no' },
      'make-section-link': { value: input.currentSectionLink ? 'yes' : 'no' },
      'title-prepend-sect': { value: input.addSectionName ? 'yes' : 'no' },
      'display-specific-branch': { value: menuType === 'children' && input.displaySpecificBranch ? 'yes' : 'no' },
      'specific-branch-id': { value: menuType === 'children' && input.displaySpecificBranch ? String(input.specificBranchId ?? 0) : '0' },
      'sib-if-no-children': { value: menuType === 'children' ? (input.showSiblingsIfNoChildren ? 'yes' : 'no') : 'no' },
      'anc-if-no-children': { value: menuType === 'children' ? (input.showAncestorsIfNoChildren ? 'yes' : 'no') : 'no' },
      'title': { value: input.title ?? '' },
      'before-menu-html': { value: input.beforeMenuHtml ?? '' },
      'after-menu-html': { value: input.afterMenuHtml ?? '' },
      'before-html': { value: input.beforeLinkHtml ?? '' },
      'after-html': { value: input.afterLinkHtml ?? '' },
      'between-link': { value: input.betweenLink ?? '' },
    };
  }

  /** Builds properties for Publish to One File with validation. */
  private async buildPublishToOneFileProperties(input: PublishToOneFileProperties): Promise<Record<string, { value: string }>> {
    const startSection = input.startSection ?? 'current';
    const validModes: PublishOneFileStartSection[] = ['current', 'specific', 'element'];
    if (!validModes.includes(startSection)) {
      throw new Error(`Invalid startSection "${startSection}". Valid options: ${validModes.join(', ')}`);
    }

    // Validate contentTypeId if non-zero
    if (input.contentTypeId && input.contentTypeId > 0) {
      await this.validateContentTypeExists(input.contentTypeId);
    }

    // Validate section for 'specific' mode
    if (startSection === 'specific') {
      if (!input.section) throw new Error('section is required when startSection is "specific"');
      await this.validateSectionExists(input.section);
    } else if (input.section) {
      throw new Error('section can only be set when startSection is "specific"');
    }

    // Validate startSectionElement for 'element' mode
    if (startSection !== 'element' && input.startSectionElement) {
      throw new Error('startSectionElement can only be set when startSection is "element"');
    }

    // Validate and resolve startSectionElement against content type if contentTypeId > 0
    let resolvedStartSectionElement = input.startSectionElement ?? '';
    if (startSection === 'element' && resolvedStartSectionElement && input.contentTypeId && input.contentTypeId > 0) {
      const elements = await this.getContentTypeElements(input.contentTypeId);
      const sectionLinkTypeId = await this.getElementTypeId('Section/Content Link');
      const sectionLinkElements = elements.filter((el) => el.type === sectionLinkTypeId);
      const match = sectionLinkElements.find(
        (el) => (el.alias || el.name).toLowerCase() === resolvedStartSectionElement.toLowerCase(),
      );
      if (!match) {
        const validNames = sectionLinkElements.map((el) => `"${el.alias || el.name}"`).join(', ');
        throw new Error(`Invalid startSectionElement "${resolvedStartSectionElement}". Valid Section/Content Link elements on content type ${input.contentTypeId}: ${validNames || 'none'}`);
      }
      resolvedStartSectionElement = match.name; // alias → raw name for API
    }

    // Validate showSectionName-gated fields
    const showSectionName = input.showSectionName ?? false;
    if (!showSectionName) {
      if (input.showNameForHidden) throw new Error('showNameForHidden can only be set when showSectionName is true');
      if (input.beforeSectionName) throw new Error('beforeSectionName can only be set when showSectionName is true');
      if (input.afterSectionName) throw new Error('afterSectionName can only be set when showSectionName is true');
    }

    // Validate surroundingPageLayout
    if (input.surroundingPageLayout) {
      await this.validatePageLayoutExists(input.surroundingPageLayout);
    }

    // Validate pagination-gated fields
    const pagination = input.pagination ?? false;
    if (!pagination) {
      if (input.contentPerPage && input.contentPerPage > 0) throw new Error('contentPerPage can only be set when pagination is true');
      if (input.beforePaginationHtml) throw new Error('beforePaginationHtml can only be set when pagination is true');
      if (input.betweenPaginationHtml) throw new Error('betweenPaginationHtml can only be set when pagination is true');
      if (input.afterPaginationHtml) throw new Error('afterPaginationHtml can only be set when pagination is true');
    }

    const altLayoutName = input.altLayoutName ?? '';

    return {
      'template-list': { value: String(input.contentTypeId ?? 0) },
      'content-type-section': { value: startSection === 'element' ? 'yes' : 'no' },
      'start-section': { value: startSection === 'specific' ? String(input.section) : '0' },
      'start-section-element': { value: startSection === 'element' ? resolvedStartSectionElement : '' },
      'show-hidden-sections': { value: input.showHiddenSections ? 'yes' : 'no' },
      'levels-to-recurse': { value: String(input.levelsToRecurse ?? 1) },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
      'show-section-name': { value: showSectionName ? 'yes' : 'no' },
      'show-name-for-hidden': { value: showSectionName && input.showNameForHidden ? 'yes' : 'no' },
      'before-section-name': { value: showSectionName ? (input.beforeSectionName ?? '') : '' },
      'after-section-name': { value: showSectionName ? (input.afterSectionName ?? '') : '' },
      'surrounding-style': { value: input.surroundingPageLayout ? String(input.surroundingPageLayout) : '' },
      'use-alt-formatter': { value: altLayoutName ? 'yes' : 'no' },
      'alt-formatter-type': { value: altLayoutName },
      'enable-caching': { value: input.enableCaching !== false ? 'yes' : 'no' },
      'pagination-across-pages': { value: pagination ? 'yes' : 'no' },
      'content-per-page': { value: pagination ? String(input.contentPerPage ?? 0) : '0' },
      'before-pagination-html': { value: pagination ? (input.beforePaginationHtml ?? '') : '' },
      'between-pagination-html': { value: pagination ? (input.betweenPaginationHtml ?? '') : '' },
      'after-pagination-html': { value: pagination ? (input.afterPaginationHtml ?? '') : '' },
    };
  }

  /** Builds properties for Top Content with validation. */
  private async buildTopContentProperties(input: TopContentProperties): Promise<Record<string, { value: string }>> {
    const fetchMethod = input.fetchMethod ?? 'current';
    const validMethods: TopContentFetchMethod[] = ['current', 'current-branch', 'branch', 'section'];
    if (!validMethods.includes(fetchMethod)) {
      throw new Error(`Invalid fetchMethod "${fetchMethod}". Valid options: ${validMethods.join(', ')}`);
    }

    // Validate section for branch/section methods
    if (fetchMethod === 'branch' || fetchMethod === 'section') {
      if (!input.section) throw new Error(`section is required when fetchMethod is "${fetchMethod}"`);
      await this.validateSectionExists(input.section);
    } else if (input.section && input.section > 0) {
      throw new Error('section can only be set when fetchMethod is "branch" or "section"');
    }

    // Validate contentTypeIds
    if (input.contentTypeIds && input.contentTypeIds.length > 0) {
      for (const ctId of input.contentTypeIds) {
        await this.validateContentTypeExists(ctId);
      }
    }

    // Validate channelId
    if (input.channelId && input.channelId > 0) {
      await this.validateChannelExists(input.channelId);
    }

    const altLayoutName = input.altLayoutName ?? '';

    return {
      'fetch-method': { value: TC_FETCH_METHOD_TO_API[fetchMethod] },
      'section': { value: (fetchMethod === 'branch' || fetchMethod === 'section') ? String(input.section) : '0' },
      'template-ids': { value: input.contentTypeIds && input.contentTypeIds.length > 0 ? input.contentTypeIds.join(',') : '' },
      'channel-id': { value: String(input.channelId ?? 0) },
      'upcoming-content': { value: input.upcomingContent ? 'yes' : 'no' },
      'pub-element': { value: input.dateElement ?? '' },
      'date_ordered_content': { value: input.ignoreDateOrdering ? 'yes' : 'no' },
      'number-of-pieces': { value: String(input.numToDisplay ?? 0) },
      'starting-content': { value: String(input.startAt ?? 0) },
      'use-alt-formatter': { value: altLayoutName ? 'yes' : 'no' },
      'alt-formatter-type': { value: altLayoutName },
      'title': { value: input.title ?? '' },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
    };
  }

  /** Builds properties for Keyword Search Content with validation. */
  private async buildKeywordSearchProperties(input: KeywordSearchProperties): Promise<Record<string, { value: string }>> {
    const keywordFetchMethod = input.keywordFetchMethod ?? 'current';
    const contentFetchMethod = input.contentFetchMethod ?? 'section';
    const pagination = input.pagination ?? false;

    // Validate keyword fetch method
    if (keywordFetchMethod === 'section') {
      if (!input.keywordSection) throw new Error('keywordSection is required when keywordFetchMethod is "section"');
      await this.validateSectionExists(input.keywordSection);
    } else if (input.keywordSection && input.keywordSection > 0) {
      throw new Error('keywordSection can only be set when keywordFetchMethod is "section"');
    }

    // Validate keywordContentTypeId
    if (input.keywordContentTypeId && input.keywordContentTypeId > 0) {
      await this.validateContentTypeExists(input.keywordContentTypeId);
    }

    // Validate content fetch method
    if (contentFetchMethod === 'section' || contentFetchMethod === 'branch') {
      if (!input.searchSection && !input.searchSectionElement) {
        throw new Error(`searchSection or searchSectionElement is required when contentFetchMethod is "${contentFetchMethod}"`);
      }
      if (input.searchSection && input.searchSectionElement) {
        throw new Error('Cannot set both searchSection and searchSectionElement. Use one or the other.');
      }
      if (input.searchSection) {
        await this.validateSectionExists(input.searchSection);
      }
      // Validate searchSectionElement against content type if keywordContentTypeId > 0 — must be Section/Content Link (type 14)
      if (input.searchSectionElement && input.keywordContentTypeId && input.keywordContentTypeId > 0) {
        const elements = await this.getContentTypeElements(input.keywordContentTypeId);
        const sectionLinkTypeId = await this.getElementTypeId('Section/Content Link');
        const sectionLinkElements = elements.filter((el) => el.type === sectionLinkTypeId);
        const match = sectionLinkElements.find(
          (el) => (el.alias || el.name).toLowerCase() === input.searchSectionElement!.toLowerCase(),
        );
        if (!match) {
          const validNames = sectionLinkElements.map((el) => `"${el.alias || el.name}"`).join(', ');
          throw new Error(`Invalid searchSectionElement "${input.searchSectionElement}". Valid Section/Content Link elements on content type ${input.keywordContentTypeId}: ${validNames || 'none'}`);
        }
      }
    }

    // Validate branch-at-level fields
    if (contentFetchMethod !== 'branch-at-level') {
      if (input.startLevel && input.startLevel > 0) throw new Error('startLevel can only be set when contentFetchMethod is "branch-at-level"');
      if (input.endLevel && input.endLevel > 0) throw new Error('endLevel can only be set when contentFetchMethod is "branch-at-level"');
    }

    // Validate searchContentTypeId
    if (input.searchContentTypeId && input.searchContentTypeId > 0) {
      await this.validateContentTypeExists(input.searchContentTypeId);
    }

    // Validate date element fields
    if (!input.sortByDateElement && input.dateElementName) {
      throw new Error('dateElementName can only be set when sortByDateElement is true');
    }

    // Validate pagination fields
    if (!pagination) {
      if (input.contentPerPage && input.contentPerPage > 0) throw new Error('contentPerPage can only be set when pagination is true');
      if (input.beforePaginationHtml) throw new Error('beforePaginationHtml can only be set when pagination is true');
      if (input.betweenPaginationHtml) throw new Error('betweenPaginationHtml can only be set when pagination is true');
      if (input.afterPaginationHtml) throw new Error('afterPaginationHtml can only be set when pagination is true');
    }

    // Resolve element aliases to raw names for the API
    let resolvedKeywordElements = input.keywordElements ?? [];
    if (resolvedKeywordElements.length > 0 && input.keywordContentTypeId && input.keywordContentTypeId > 0) {
      resolvedKeywordElements = await this.resolveElementAliasesToNames(input.keywordContentTypeId, resolvedKeywordElements, 'keywordElements');
    }

    let resolvedSearchElements = input.searchElements ?? [];
    if (resolvedSearchElements.length > 0 && input.searchContentTypeId && input.searchContentTypeId > 0) {
      resolvedSearchElements = await this.resolveElementAliasesToNames(input.searchContentTypeId, resolvedSearchElements, 'searchElements');
    }

    let resolvedSearchSectionElement = input.searchSectionElement ?? '';
    if (resolvedSearchSectionElement && input.keywordContentTypeId && input.keywordContentTypeId > 0) {
      const elements = await this.getContentTypeElements(input.keywordContentTypeId);
      const sectionLinkTypeId = await this.getElementTypeId('Section/Content Link');
      const sectionLinkElements = elements.filter((el) => el.type === sectionLinkTypeId);
      const match = sectionLinkElements.find(
        (el) => (el.alias || el.name).toLowerCase() === resolvedSearchSectionElement.toLowerCase(),
      );
      if (match) {
        resolvedSearchSectionElement = match.name; // alias → raw name
      }
    }

    const altLayoutName = input.altLayoutName ?? '';
    const crossLangs = input.crossLanguageLanguages ?? [];

    return {
      'fetch-method': { value: KW_FETCH_TO_API[keywordFetchMethod] },
      'narrow-on-fulltext': { value: input.narrowToSingleContentItem ? 'yes' : 'no' },
      'template-list-get': { value: String(input.keywordContentTypeId && input.keywordContentTypeId > 0 ? input.keywordContentTypeId : -1) },
      'template-element-get': { value: resolvedKeywordElements.join(',') },
      'search-fetch-method': { value: KW_CONTENT_FETCH_TO_API[contentFetchMethod] },
      'section': { value: keywordFetchMethod === 'section' ? String(input.keywordSection) : '0' },
      'search-section': { value: (contentFetchMethod === 'section' || contentFetchMethod === 'branch') && input.searchSection ? String(input.searchSection) : '0' },
      'template-element-for-search-section': { value: resolvedSearchSectionElement },
      'level': { value: contentFetchMethod === 'branch-at-level' ? String(input.startLevel ?? 0) : '0' },
      'num-to-recurse': { value: contentFetchMethod === 'branch-at-level' ? String(input.endLevel ?? 0) : '0' },
      'template-list-search': { value: String(input.searchContentTypeId && input.searchContentTypeId > 0 ? input.searchContentTypeId : -1) },
      'template-element-search': { value: resolvedSearchElements.join(',') },
      'number-of-pieces': { value: String(input.numToDisplay ?? '') },
      'order-by': { value: KW_SORT_TO_API[input.sortType ?? 'name'] ?? 'order-name' },
      'order-by-date-element': { value: input.sortByDateElement ? 'yes' : 'no' },
      'order-by-date-element-name': { value: input.sortByDateElement ? (input.dateElementName ?? '') : '' },
      'show-upcoming-content': { value: input.showUpcomingContent ? 'yes' : 'no' },
      'show-hidden-sections': { value: input.showHiddenSections ? 'yes' : 'no' },
      'match-composite-keywords': { value: input.matchCompositeKeywords ? 'yes' : 'no' },
      'match-sub-items': { value: input.matchSubItems ? 'yes' : 'no' },
      'cross-language-searching-enabled': { value: input.crossLanguageSearch ? 'yes' : 'no' },
      'cross-language-searching-languages': { value: crossLangs.join(',') },
      'use-alt-formatter': { value: altLayoutName ? 'yes' : 'no' },
      'alt-formatter-type': { value: altLayoutName },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
      'pagination-enabled': { value: pagination ? 'yes' : 'no' },
      'content-per-page': { value: pagination ? String(input.contentPerPage ?? 0) : '0' },
      'before-pagination-html': { value: pagination ? (input.beforePaginationHtml ?? '') : '' },
      'between-pagination-html': { value: pagination ? (input.betweenPaginationHtml ?? '') : '' },
      'after-pagination-html': { value: pagination ? (input.afterPaginationHtml ?? '') : '' },
    };
  }

  /** Fetches content type elements. */
  private async getContentTypeElements(contentTypeId: number): Promise<Array<{ name: string; alias?: string; type?: number }>> {
    const ct = await this.httpClient.request<{ contentTypeElements?: Array<{ name: string; alias?: string; type?: number }> }>({
      method: 'GET',
      path: `/contenttype/${contentTypeId}`,
    });
    return ct.contentTypeElements ?? [];
  }

  /** Resolves an element type name (e.g. 'Plain Text', 'Section/Content Link') to its numeric ID via GET /type/. */
  private async getElementTypeId(typeName: string): Promise<number> {
    const types = await this.httpClient.request<Array<{ id: number; name: string }>>({
      method: 'GET',
      path: '/type/',
    });
    const match = types.find((t) => t.name.toLowerCase() === typeName.toLowerCase());
    if (!match) throw new Error(`Unknown element type "${typeName}"`);
    return match.id;
  }

  /**
   * Validates an element alias exists on a content type and returns the raw name.
   * Developer passes alias → SDK sends raw name to API.
   */
  private async resolveElementAliasToName(contentTypeId: number, alias: string, fieldLabel: string): Promise<string> {
    const elements = await this.getContentTypeElements(contentTypeId);
    const match = elements.find(
      (el) => (el.alias || el.name).toLowerCase() === alias.toLowerCase(),
    );
    if (!match) {
      const validNames = elements.map((el) => `"${el.alias || el.name}"`).join(', ');
      throw new Error(`Invalid ${fieldLabel} "${alias}". Valid elements on content type ${contentTypeId}: ${validNames}`);
    }
    return match.name;
  }

  /**
   * Resolves multiple element aliases to raw names.
   */
  private async resolveElementAliasesToNames(contentTypeId: number, aliases: string[], fieldLabel: string): Promise<string[]> {
    const elements = await this.getContentTypeElements(contentTypeId);
    const names: string[] = [];
    for (const alias of aliases) {
      const match = elements.find(
        (el) => (el.alias || el.name).toLowerCase() === alias.toLowerCase(),
      );
      if (!match) {
        const validNames = elements.map((el) => `"${el.alias || el.name}"`).join(', ');
        throw new Error(`Invalid ${fieldLabel} "${alias}". Valid elements on content type ${contentTypeId}: ${validNames}`);
      }
      names.push(match.name);
    }
    return names;
  }

  /**
   * Resolves raw element names back to aliases for display.
   * API stores raw name → SDK returns alias to developer.
   */
  private async resolveElementNamesToAliases(contentTypeId: number, names: string[]): Promise<string[]> {
    try {
      const elements = await this.getContentTypeElements(contentTypeId);
      return names.map((name) => {
        const match = elements.find((el) => el.name === name);
        return match ? (match.alias || match.name) : name;
      });
    } catch {
      return names; // If fetch fails, return raw names
    }
  }

  /**
   * Resolves a single raw element name back to its alias.
   */
  private async resolveElementNameToAlias(contentTypeId: number, name: string): Promise<string> {
    try {
      const elements = await this.getContentTypeElements(contentTypeId);
      const match = elements.find((el) => el.name === name);
      return match ? (match.alias || match.name) : name;
    } catch {
      return name;
    }
  }

  /** Validates that an element name exists on a content type (legacy — used by searchSectionElement validation in builder). */
  private async validateElementOnContentType(contentTypeId: number, elementName: string): Promise<void> {
    const elements = await this.getContentTypeElements(contentTypeId);
    const match = elements.find(
      (el) => (el.alias || el.name).toLowerCase() === elementName.toLowerCase() || el.name.toLowerCase() === elementName.toLowerCase(),
    );
    if (!match) {
      const validNames = elements.map((el) => `"${el.alias || el.name}"`).join(', ');
      throw new Error(`Invalid searchSectionElement "${elementName}". Valid elements on content type ${contentTypeId}: ${validNames}`);
    }
  }

  /** Validates that a channel exists by ID. */
  private async validateChannelExists(id: number): Promise<void> {
    try {
      await this.httpClient.request<unknown>({
        method: 'GET',
        path: `/channel/${id}`,
      });
    } catch {
      throw new Error(`Invalid channelId: channel ${id} not found`);
    }
  }

  /** Validates that a page layout exists by ID. */
  private async validatePageLayoutExists(id: number): Promise<void> {
    try {
      await this.httpClient.request<unknown>({
        method: 'GET',
        path: `/pageLayout/${id}`,
      });
    } catch {
      throw new Error(`Invalid surroundingPageLayout: page layout ${id} not found`);
    }
  }

  /** Builds properties for Related Content with validation. */
  private async buildRelatedContentProperties(input: RelatedContentProperties): Promise<Record<string, { value: string } | Record<string, never>>> {
    const fetchMethod = input.fetchMethod ?? 'current';
    const validMethods: RelatedContentFetchMethod[] = ['current', 'section', 'child'];
    if (!validMethods.includes(fetchMethod)) {
      throw new Error(`Invalid fetchMethod "${fetchMethod}". Valid options: ${validMethods.join(', ')}`);
    }

    const altLayoutName = input.altLayoutName ?? '';

    // Validate section for 'section' method
    if (fetchMethod === 'section') {
      if (!input.section) throw new Error('section is required when fetchMethod is "section"');
      await this.validateSectionExists(input.section);
    }

    // Validate contentTypeIds for 'child' method
    if (fetchMethod === 'child') {
      if (!input.contentTypeIds || input.contentTypeIds.length === 0) {
        throw new Error('contentTypeIds is required when fetchMethod is "child"');
      }
      for (const ctId of input.contentTypeIds) {
        await this.validateContentTypeExists(ctId);
      }
    }

    return {
      'fetch-method': { value: RC_FETCH_METHOD_TO_API[fetchMethod] },
      'relatedcontent-type': { value: RC_TYPE_MAP[fetchMethod] },
      'section': { value: fetchMethod === 'section' ? String(input.section) : '0' },
      'fetch-child': fetchMethod === 'child' && input.childSectionName ? { value: input.childSectionName } : {},
      'template-ids': { value: fetchMethod === 'child' ? (input.contentTypeIds ?? []).join(',') : '' },
      'number-of-pieces': { value: fetchMethod === 'child' ? String(input.display ?? 0) : '0' },
      'recurse-child-section': { value: fetchMethod === 'child' ? (input.recurseChildSection ? 'yes' : 'no') : 'no' },
      'use-alt-formatter': { value: altLayoutName ? 'yes' : 'no' },
      'alt-formatter-type': { value: altLayoutName },
      'title': { value: input.title ?? '' },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
      'search-upwards': { value: 'no' },
      'more-link': { value: 'no' },
      'more-link-text': {},
      'levels-to-recurse': {},
      'show-name-when-hidden': { value: 'no' },
    };
  }

  /** Builds properties for Top Stories with section validation. */
  private async buildTopStoriesProperties(input: TopStoriesProperties): Promise<Record<string, { value: string }>> {
    if (!input.section) throw new Error('section is required for Top Stories navigation');
    await this.validateSectionExists(input.section);

    return {
      'section': { value: String(input.section) },
      'numtoshow': { value: String(input.numToShow ?? 0) },
      'link-to-fulltext': { value: input.linkToFulltext ? 'yes' : 'no' },
      'title': { value: input.title ?? '' },
      'before-menu-html': { value: input.beforeMenuHtml ?? '' },
      'after-menu-html': { value: input.afterMenuHtml ?? '' },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
    };
  }

  /** Builds properties for Previous/Next Fulltext Content. */
  private buildPreviousNextProperties(input: PreviousNextProperties): Record<string, { value: string }> {
    const type = input.type ?? 'previous';
    const validTypes: PreviousNextType[] = ['previous', 'next', 'both'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid type "${type}". Valid options: ${validTypes.join(', ')}`);
    }

    const altLayoutName = input.altLayoutName ?? '';

    return {
      'id_previous': { value: type === 'previous' ? 'true' : 'false' },
      'id_next': { value: type === 'next' ? 'true' : 'false' },
      'id_previous_and_next': { value: type === 'both' ? 'true' : 'false' },
      'id_custom_formatter': { value: altLayoutName ? 'yes' : 'no' },
      'id_custom_formatter_textarea': { value: altLayoutName },
      'id_skip_non_fulltext_content': { value: input.skipNonFulltextContent ? 'yes' : 'no' },
      'id_next_navigation_with_previous_next_navigation': { value: input.onlyLinkToContentWithNav ? 'yes' : 'no' },
      'id_same_template_restriction': { value: input.sameContentTypeRestriction ? 'yes' : 'no' },
      'id_display_on_boundary': { value: input.displayOnBoundary ? 'yes' : 'no' },
      'id_display_content_name_as_title': { value: input.displayContentNameAsTitle ? 'yes' : 'no' },
      'id_previous_html': { value: input.previousHtml ?? '' },
      'id_between_html': { value: input.betweenHtml ?? '' },
      'id_next_html': { value: input.nextHtml ?? '' },
    };
  }

  /** Builds properties for Pagination with validation. */
  private async buildPaginationProperties(input: PaginationProperties): Promise<Record<string, { value: string }>> {
    if (!input.contentTypeId) throw new Error('contentTypeId is required for Pagination navigation');

    const fetchMethod = input.fetchMethod ?? 'current';
    const validMethods: PaginationFetchMethod[] = ['current', 'current-branch', 'branch', 'branch-at-level', 'section'];
    if (!validMethods.includes(fetchMethod)) {
      throw new Error(`Invalid fetchMethod "${fetchMethod}". Valid options: ${validMethods.join(', ')}`);
    }

    // Validate content type exists
    await this.validateContentTypeExists(input.contentTypeId);

    // Validate altLayoutName against content type layouts if provided
    const altLayoutName = input.altLayoutName ?? '';
    if (altLayoutName) {
      await this.validateLayoutOnContentType(input.contentTypeId, altLayoutName);
    }

    // Determine section/level/numToRecurse based on fetchMethod
    let section = 0;
    let level = 0;
    let numToRecurse = 0;

    switch (fetchMethod) {
      case 'current':
        // All forced to 0
        break;
      case 'current-branch':
        numToRecurse = input.numToRecurse ?? 0;
        break;
      case 'branch':
        if (!input.section) throw new Error('section is required when fetchMethod is "branch"');
        await this.validateSectionExists(input.section);
        section = input.section;
        numToRecurse = input.numToRecurse ?? 0;
        break;
      case 'branch-at-level':
        if (!input.section) throw new Error('section is required when fetchMethod is "branch-at-level"');
        await this.validateSectionExists(input.section);
        section = input.section;
        level = input.level ?? 0;
        numToRecurse = input.numToRecurse ?? 0;
        break;
      case 'section':
        if (!input.section) throw new Error('section is required when fetchMethod is "section"');
        await this.validateSectionExists(input.section);
        section = input.section;
        break;
    }

    return {
      'template-list': { value: String(input.contentTypeId) },
      'fetch-method': { value: FETCH_METHOD_TO_API[fetchMethod] },
      'section': { value: String(section) },
      'level': { value: String(level) },
      'num-to-recurse': { value: String(numToRecurse) },
      'number-of-pieces': { value: String(input.contentItemsPerPage ?? 0) },
      'max-number-of-pieces': { value: String(input.maxContentItems ?? 0) },
      'num-links-to-show': { value: String(input.maxLinksPerPage ?? 0) },
      'use-alt-formatter': { value: altLayoutName ? 'yes' : 'no' },
      'alt-formatter-type': { value: altLayoutName },
      'show-hidden-sections': { value: input.searchHiddenSections ? 'yes' : 'no' },
      'before-html': { value: input.beforeHtml ?? '' },
      'after-html': { value: input.afterHtml ?? '' },
      'before-pagination-html': { value: input.beforePaginationHtml ?? '' },
      'after-pagination-html': { value: input.afterPaginationHtml ?? '' },
      'between-pagination-html': { value: input.betweenPaginationHtml ?? '' },
    };
  }

  /** Builds properties for Site Map with validation. */
  private async buildSiteMapProperties(input: SiteMapProperties): Promise<Record<string, { value: string }>> {
    const startSection = input.startSection ?? 0;
    const enableContentCount = input.enableContentCount ?? false;

    // Validate section if non-zero
    if (startSection > 0) {
      await this.validateSectionExists(startSection);
    }

    // Validate content-count-only fields
    if (!enableContentCount) {
      if (input.contentTypeIds && input.contentTypeIds.length > 0) {
        throw new Error('contentTypeIds can only be set when enableContentCount is true');
      }
      if (input.countRecursively) {
        throw new Error('countRecursively can only be set when enableContentCount is true');
      }
      if (input.maxLevelsToCount) {
        throw new Error('maxLevelsToCount can only be set when enableContentCount is true');
      }
      if (input.htmlBeforeContentCount) {
        throw new Error('htmlBeforeContentCount can only be set when enableContentCount is true');
      }
      if (input.htmlAfterContentCount) {
        throw new Error('htmlAfterContentCount can only be set when enableContentCount is true');
      }
    }

    // Validate contentTypeIds
    if (enableContentCount && input.contentTypeIds && input.contentTypeIds.length > 0) {
      for (const ctId of input.contentTypeIds) {
        await this.validateContentTypeExists(ctId);
      }
    }

    const contentTypeIdsStr = enableContentCount && input.contentTypeIds && input.contentTypeIds.length > 0
      ? input.contentTypeIds.join(',')
      : '0';

    return {
      'section': { value: String(startSection) },
      'levels': { value: String(input.levels ?? 0) },
      'show_relative_child_sections': { value: input.childSectionLinks ? 'yes' : 'no' },
      'enable_content_count': { value: enableContentCount ? 'yes' : 'no' },
      'template_type': { value: contentTypeIdsStr },
      'max_levels_to_count': { value: enableContentCount ? String(input.maxLevelsToCount ?? '') : '' },
      'count_recursively': { value: enableContentCount ? (input.countRecursively ? 'yes' : 'no') : 'no' },
      'html_before_content_count': { value: enableContentCount ? (input.htmlBeforeContentCount ?? '') : '' },
      'html_after_content_count': { value: enableContentCount ? (input.htmlAfterContentCount ?? '') : '' },
    };
  }

  /** Validates that a content type exists by ID. */
  private async validateContentTypeExists(id: number): Promise<void> {
    try {
      await this.httpClient.request<unknown>({
        method: 'GET',
        path: `/contenttype/${id}`,
      });
    } catch {
      throw new Error(`Invalid contentTypeId: content type ${id} not found`);
    }
  }

  /** Validates that a layout name exists on a content type. */
  private async validateLayoutOnContentType(contentTypeId: number, layoutName: string): Promise<void> {
    try {
      const layouts = await this.httpClient.request<Array<{ name: string }>>({
        method: 'GET',
        path: `/layout/contenttype/${contentTypeId}/en`,
      });
      const match = layouts.find((l) => l.name === layoutName);
      if (!match) {
        const validNames = layouts.map((l) => `"${l.name}"`).join(', ');
        throw new Error(`Invalid altLayoutName "${layoutName}". Valid layouts for content type ${contentTypeId}: ${validNames || 'none'}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Invalid altLayoutName')) throw e;
      throw new Error(`Invalid altLayoutName "${layoutName}": could not verify layouts for content type ${contentTypeId}`);
    }
  }

  /** Builds properties for Language Switcher. */
  private buildLanguageSwitcherProperties(input: LanguageSwitcherProperties): Record<string, { value: string }> {
    const langCode = input.langCode ?? '';
    const alwaysOutput = input.alwaysOutput ?? false;
    const imageUrl = input.imageUrl ?? '';
    const imageExtension = input.imageExtension ?? '';
    const imageProperties = input.imageProperties ?? '';
    const beforeHtml = input.beforeHtml ?? '';
    const afterHtml = input.afterHtml ?? '';

    // Derive imageLink from whether any image fields are set
    const imageLink = imageUrl || imageExtension || imageProperties ? 'yes' : 'no';

    return {
      'lang-code': { value: langCode },
      'always-output': { value: alwaysOutput ? 'yes' : 'no' },
      'image-link': { value: imageLink },
      'url': { value: imageUrl },
      'image-ext': { value: imageExtension },
      'image-properties': { value: imageProperties },
      'before': { value: beforeHtml },
      'after': { value: afterHtml },
    };
  }

  /** Builds properties for Generate File with validation. */
  private async buildGenerateFileProperties(input: GenerateFileProperties): Promise<Record<string, { value: string } | Record<string, never>>> {
    const fileName = input.fileName ?? '';
    const appendContentId = input.appendContentId ?? false;
    const fileExtension = input.fileExtension ?? '';
    const baseDirectory = input.baseDirectory ?? '';
    const layout = input.layout ?? '';
    const appendDirectory = input.appendDirectory ?? false;
    const mediaFile = input.mediaFile ?? null;

    // Validate media file if provided
    if (mediaFile !== null) {
      await this.validateMediaExists(mediaFile, 'mediaFile');
    }

    const result: Record<string, { value: string } | Record<string, never>> = {
      'File Name': { value: fileName },
      'Append Content ID': { value: appendContentId ? 'yes' : 'no' },
      'File Extension': { value: fileExtension },
      'Base Directory': { value: baseDirectory },
      'Formatter': { value: layout },
      'Append Directory': { value: appendDirectory ? 'yes' : 'no' },
      'Media File': mediaFile !== null ? { value: mediaFile } as unknown as { value: string } : {},
    };

    return result;
  }

  /** Builds properties for CSS Selector with validation. */
  private async buildCssSelectorProperties(input: CssSelectorProperties): Promise<Record<string, { value: string }>> {
    if (!input.defaultStylesheet) throw new Error('defaultStylesheet is required for CSS Selector navigation');

    // Validate default stylesheet exists as a media item
    await this.validateMediaExists(input.defaultStylesheet, 'defaultStylesheet');

    const result: Record<string, { value: string }> = {
      'default-style-sheet': { value: String(input.defaultStylesheet) },
      'language': { value: input.language ?? '' },
    };

    if (input.branches && input.branches.length > 0) {
      for (let i = 0; i < input.branches.length; i++) {
        const branch = input.branches[i];
        const n = i + 1;

        if (!branch.stylesheet) throw new Error(`branches[${i}].stylesheet is required`);

        // Validate: name OR rootSection, not both
        if (branch.name && branch.rootSection != null) {
          throw new Error(`branches[${i}] cannot have both name and rootSection. Use one or the other.`);
        }

        // Validate stylesheet media exists
        await this.validateMediaExists(branch.stylesheet, `branches[${i}].stylesheet`);

        // Validate section exists if rootSection provided
        if (branch.rootSection != null) {
          await this.validateSectionExists(branch.rootSection);
        }

        result[`style-sheet-${n}`] = { value: String(branch.stylesheet) };
        result[`branch-${n}-name`] = { value: branch.name ?? '' };
        result[`branch-${n}-root`] = { value: branch.rootSection != null ? String(branch.rootSection) : '' };
      }
    }

    return result;
  }

  /** Validates that a media item exists by ID. */
  private async validateMediaExists(id: number, fieldName: string): Promise<void> {
    try {
      await this.httpClient.request<unknown>({
        method: 'GET',
        path: `/media/${id}/smxx`,
      });
    } catch {
      throw new Error(`Invalid ${fieldName}: media item ${id} not found`);
    }
  }

  /** Validates that a section exists by ID. */
  private async validateSectionExists(id: number): Promise<void> {
    try {
      await this.httpClient.request<unknown>({
        method: 'GET',
        path: `/hierarchy/${id}/en`,
      });
    } catch {
      throw new Error(`Invalid rootSection: section ${id} not found`);
    }
  }

  /** Passes properties through without type-specific validation. */
  private buildGenericProperties(input: Record<string, unknown>): Record<string, { value: string }> {
    const result: Record<string, { value: string }> = {};
    for (const [key, value] of Object.entries(input)) {
      // Convert camelCase to the likely API key format (snake_case or kebab-case)
      const apiKey = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      result[apiKey] = { value: String(value ?? '') };
    }
    return result;
  }

  /** Resolves a meta data element alias to its raw name. Returns the raw name for the API. Only Plain Text elements are valid. */
  private async resolveMetaDataElementAlias(elementAlias: string): Promise<string> {
    const config = await this.httpClient.request<{ name: string; type: string; value: string }>({
      method: 'GET',
      path: '/config/hierarchy.metaDataContentType',
    });
    const contentTypeId = parseInt(config.value, 10);
    if (!contentTypeId) return elementAlias; // No metadata content type configured — pass through

    const elements = await this.getContentTypeElements(contentTypeId);
    const plainTextTypeId = await this.getElementTypeId('Plain Text');
    const plainTextElements = elements.filter((el) => el.type === plainTextTypeId);
    const match = plainTextElements.find(
      (el) => (el.alias || el.name).toLowerCase() === elementAlias.toLowerCase(),
    );
    if (!match) {
      const validNames = plainTextElements.map((el) => `"${el.alias || el.name}"`).join(', ');
      throw new Error(`Invalid sectionMetaContentTypeElement "${elementAlias}". Valid Plain Text elements are: ${validNames}`);
    }
    return match.name;
  }

  /** Resolves a raw meta data element name back to its alias for display. */
  private async resolveMetaDataElementName(rawName: string): Promise<string> {
    try {
      const config = await this.httpClient.request<{ name: string; type: string; value: string }>({
        method: 'GET',
        path: '/config/hierarchy.metaDataContentType',
      });
      const contentTypeId = parseInt(config.value, 10);
      if (!contentTypeId) return rawName;

      const elements = await this.getContentTypeElements(contentTypeId);
      const match = elements.find((el) => el.name === rawName);
      return match ? (match.alias || match.name) : rawName;
    } catch {
      return rawName;
    }
  }

  /** Validates that a microsite ID exists. */
  private async validateMicrositeId(id: number): Promise<void> {
    const channels = await this.httpClient.request<ChannelListItem[]>({
      method: 'GET',
      path: '/channel',
    });
    const validIds = collectMicrositeIds(channels);
    if (!validIds.has(id)) {
      const validList = Array.from(validIds).join(', ');
      throw new Error(`Invalid microSite ID ${id}. Valid microsite IDs are: ${validList || 'none (no microsites configured)'}`);
    }
  }
}
