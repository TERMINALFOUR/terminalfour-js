import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationResource } from '../src/resources/navigation-resource.js';
import { HttpClient } from '../src/http-client.js';
import { ELEMENT_TYPES } from './helpers.js';

function mockHttpClient() {
  return { request: vi.fn() } as unknown as HttpClient;
}

const rawListResponse = [
  {
    id: 181, name: 'A-Z Navigation Demo', description: 'Used to output an A-Z listing',
    navigationType: 'a2z', navigationTypeName: 'A to Z Navigation',
    navigationEnabled: true, editable: true, fullAccess: true, sharedGroupCount: 0, sharedGroups: [],
    primaryGroup: { id: 1, name: 'Sample Site' },
  },
  {
    id: 58, name: 'Accordion Content Getter', description: 'returns content that should be used in an accordion',
    navigationType: 'keyword', navigationTypeName: 'Keyword Search Content',
    navigationEnabled: true, editable: true, fullAccess: true, sharedGroupCount: 0, sharedGroups: [],
    primaryGroup: { id: 1, name: 'Sample Site' },
  },
  {
    id: 33, name: 'Advanced Program Notification', description: 'Returns Generic Notifications',
    navigationType: 'relatedcontent', navigationTypeName: 'Related Content',
    navigationEnabled: false, editable: true, fullAccess: true, sharedGroupCount: 0, sharedGroups: [],
    primaryGroup: { id: 1, name: 'Sample Site' },
  },
  {
    id: 10, name: 'Main Breadcrumbs', description: '',
    navigationType: 'breadcrumbs', navigationTypeName: 'Breadcrumbs',
    navigationEnabled: true, editable: true, fullAccess: true, sharedGroupCount: 0, sharedGroups: [],
    primaryGroup: { id: 1, name: 'Sample Site' },
  },
];

describe('NavigationResource', () => {
  let http: HttpClient;
  let resource: NavigationResource;

  beforeEach(() => {
    http = mockHttpClient();
    resource = new NavigationResource(http);
  });

  describe('list()', () => {
    it('returns flat summary objects', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const items = await resource.list();

      expect(items).toHaveLength(4);
      expect(items[0]).toEqual({
        id: 181,
        name: 'A-Z Navigation Demo',
        description: 'Used to output an A-Z listing',
        type: 'a-to-z',
        typeName: 'A to Z Navigation',
        enabled: true,
      });
    });

    it('maps all fields correctly', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const items = await resource.list();

      expect(items[2]).toEqual({
        id: 33,
        name: 'Advanced Program Notification',
        description: 'Returns Generic Notifications',
        type: 'related-content',
        typeName: 'Related Content',
        enabled: false,
      });
    });

    it('defaults description to empty string when missing', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 1, name: 'Test', navigationType: 'sitemap', navigationTypeName: 'Site Map', navigationEnabled: true },
      ]);

      const items = await resource.list();
      expect(items[0].description).toBe('');
      expect(items[0].type).toBe('site-map');
    });

    it('filters by type when option is provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const keywords = await resource.list({ type: 'keyword-search' });

      expect(keywords).toHaveLength(1);
      expect(keywords[0].name).toBe('Accordion Content Getter');
      expect(keywords[0].type).toBe('keyword-search');
    });

    it('returns empty array when filter matches nothing', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const results = await resource.list({ type: 'site-map' });
      expect(results).toHaveLength(0);
    });

    it('returns all items when no filter is provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawListResponse);

      const all = await resource.list();
      expect(all).toHaveLength(4);
    });

    it('calls GET /navigation', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await resource.list();

      expect(http.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/navigation',
      });
    });
  });

  describe('delete()', () => {
    it('sends DELETE /navigation/{id}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await resource.delete(270);

      expect(http.request).toHaveBeenCalledWith({
        method: 'DELETE',
        path: '/navigation/270',
      });
    });
  });

  const rawA2zDetail = {
    id: 181, name: 'A-Z Navigation Demo', description: 'Used to output an A-Z listing',
    navigationType: 'a2z', navigationTypeName: 'A to Z Navigation',
    isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
    date: '2016-12-10T02:03:26Z', editable: true, fullAccess: true,
    sharedGroupCount: 0, sharedGroups: [], isXHTMLCompliant: true,
    navigationKey: 'a2z', frontEndFileName: 'a2z',
    primaryGroup: { id: 1, name: 'Sample Site' },
    properties: {
      'before_menu': { value: '<ul>', attribute: 'before_menu', navigationPropertyID: 181 },
      'after_menu': { value: '</ul>', attribute: 'after_menu', navigationPropertyID: 181 },
      'before_item': { value: '<li>', attribute: 'before_item', navigationPropertyID: 181 },
      'after_item': { value: '</li>', attribute: 'after_item', navigationPropertyID: 181 },
      'start_level': { value: '0', attribute: 'start_level', navigationPropertyID: 181 },
      'end_level': { value: '0', attribute: 'end_level', navigationPropertyID: 181 },
      'use_section_meta_data_element': { value: 'no', attribute: 'use_section_meta_data_element', navigationPropertyID: 181 },
      'section_meta_data_template': { value: 'Title', attribute: 'section_meta_data_template', navigationPropertyID: 181 },
      'sel_micro_site': { value: '', attribute: 'sel_micro_site', navigationPropertyID: 181 },
    },
  };

  describe('get()', () => {
    it('returns a NavigationObject with shared fields', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawA2zDetail);

      const nav = await resource.get(181);

      expect(nav.id).toBe(181);
      expect(nav.name).toBe('A-Z Navigation Demo');
      expect(nav.description).toBe('Used to output an A-Z listing');
      expect(nav.type).toBe('a-to-z');
      expect(nav.typeName).toBe('A to Z Navigation');
      expect(nav.enabled).toBe(true);
      expect(nav.cachingEnabled).toBe(false);
      expect(nav.previewEnabled).toBe(true);
    });

    it('camelCases property keys from snake_case', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawA2zDetail);

      const nav = await resource.get(181);

      // A2Z type gets typed properties
      expect(nav.properties.beforeMenu).toBe('<ul>');
      expect(nav.properties.afterMenu).toBe('</ul>');
      expect(nav.properties.startLevel).toBe(0);
      expect(nav.properties.useSectionMetaData).toBe(false);
    });

    it('camelCases property keys from kebab-case', async () => {
      const rawKeyword = {
        ...rawA2zDetail, id: 58, navigationType: 'keyword',
        properties: {
          'match-sub-items': { value: 'no', attribute: 'match-sub-items', navigationPropertyID: 58 },
          'before-html': { value: '<div>', attribute: 'before-html', navigationPropertyID: 58 },
          'template-list-search': { value: '68', attribute: 'template-list-search', navigationPropertyID: 58 },
          'fetch-method': { value: 'fetch-method-current', attribute: 'fetch-method', navigationPropertyID: 58 },
          'search-fetch-method': { value: 'fetch-method-section', attribute: 'search-fetch-method', navigationPropertyID: 58 },
          'search-section': { value: '100', attribute: 'search-section', navigationPropertyID: 58 },
          'template-list-get': { value: '-1', attribute: 'template-list-get', navigationPropertyID: 58 },
          'template-element-get': { value: '', attribute: 'template-element-get', navigationPropertyID: 58 },
          'template-element-search': { value: '', attribute: 'template-element-search', navigationPropertyID: 58 },
          'template-element-for-search-section': { value: '', attribute: 'template-element-for-search-section', navigationPropertyID: 58 },
          'narrow-on-fulltext': { value: 'no', attribute: 'narrow-on-fulltext', navigationPropertyID: 58 },
          'number-of-pieces': { value: '', attribute: 'number-of-pieces', navigationPropertyID: 58 },
          'order-by': { value: 'order-name', attribute: 'order-by', navigationPropertyID: 58 },
          'order-by-date-element': { value: 'no', attribute: 'order-by-date-element', navigationPropertyID: 58 },
          'order-by-date-element-name': { value: '', attribute: 'order-by-date-element-name', navigationPropertyID: 58 },
          'show-upcoming-content': { value: 'no', attribute: 'show-upcoming-content', navigationPropertyID: 58 },
          'show-hidden-sections': { value: 'no', attribute: 'show-hidden-sections', navigationPropertyID: 58 },
          'match-composite-keywords': { value: 'no', attribute: 'match-composite-keywords', navigationPropertyID: 58 },
          'cross-language-searching-enabled': { value: 'no', attribute: 'cross-language-searching-enabled', navigationPropertyID: 58 },
          'cross-language-searching-languages': { value: '', attribute: 'cross-language-searching-languages', navigationPropertyID: 58 },
          'use-alt-formatter': { value: 'no', attribute: 'use-alt-formatter', navigationPropertyID: 58 },
          'alt-formatter-type': { value: '', attribute: 'alt-formatter-type', navigationPropertyID: 58 },
          'pagination-enabled': { value: 'no', attribute: 'pagination-enabled', navigationPropertyID: 58 },
          'content-per-page': { value: '0', attribute: 'content-per-page', navigationPropertyID: 58 },
          'before-pagination-html': { value: '', attribute: 'before-pagination-html', navigationPropertyID: 58 },
          'between-pagination-html': { value: '', attribute: 'between-pagination-html', navigationPropertyID: 58 },
          'after-pagination-html': { value: '', attribute: 'after-pagination-html', navigationPropertyID: 58 },
          'level': { value: '0', attribute: 'level', navigationPropertyID: 58 },
          'num-to-recurse': { value: '0', attribute: 'num-to-recurse', navigationPropertyID: 58 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawKeyword);

      const nav = await resource.get(58);

      // keyword type is now typed — booleans are coerced
      expect(nav.properties.matchSubItems).toBe(false);
      expect(nav.properties.beforeHtml).toBe('<div>');
      expect(nav.properties.searchContentTypeId).toBe(68);
    });

    it('defaults value to empty string when missing (untyped types)', async () => {
      // All 19 types are now implemented — test the generic fallback with a fake type
      // by testing that the raw camelCase pass-through still works for unknown navigationType
      const raw = {
        ...rawA2zDetail,
        navigationType: 'unknowntype',
        properties: {
          'some-field': { attribute: 'some-field', navigationPropertyID: 33 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(raw);

      const nav = await resource.get(33);
      expect(nav.properties.someField).toBe('');
    });

    it('calls GET /navigation/{id}', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawA2zDetail);

      await resource.get(181);

      expect(http.request).toHaveBeenCalledWith({
        method: 'GET',
        path: '/navigation/181',
      });
    });

    it('transforms breadcrumbs properties with typed values and hidden fields', async () => {
      const rawBreadcrumbs = {
        ...rawA2zDetail, id: 300, navigationType: 'breadcrumbs',
        properties: {
          'start-level': { value: '2', attribute: 'start-level', navigationPropertyID: 300 },
          'end-level': { value: '0', attribute: 'end-level', navigationPropertyID: 300 },
          'use-links': { value: 'yes', attribute: 'use-links', navigationPropertyID: 300 },
          'link-current': { value: 'no', attribute: 'link-current', navigationPropertyID: 300 },
          'hide-home': { value: 'yes', attribute: 'hide-home', navigationPropertyID: 300 },
          'no-space': { value: 'no', attribute: 'no-space', navigationPropertyID: 300 },
          'over_spill_length': { value: '50', attribute: 'over_spill_length', navigationPropertyID: 300 },
          'over_spill_flag': { value: 'yes', attribute: 'over_spill_flag', navigationPropertyID: 300 },
          'breadcrumb-type': { value: '20', attribute: 'breadcrumb-type', navigationPropertyID: 300 },
          'append-content-element': { value: 'yes', attribute: 'append-content-element', navigationPropertyID: 300 },
          'element-to-append': { value: 'Title', attribute: 'element-to-append', navigationPropertyID: 300 },
          'separator-html': { value: ' > ', attribute: 'separator-html', navigationPropertyID: 300 },
          'before-html': { value: '<nav>', attribute: 'before-html', navigationPropertyID: 300 },
          'after-html': { value: '</nav>', attribute: 'after-html', navigationPropertyID: 300 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rawBreadcrumbs);

      const nav = await resource.get(300);

      // Typed values
      expect(nav.properties.startLevel).toBe(2);
      expect(nav.properties.endLevel).toBe(0);
      expect(nav.properties.useLinks).toBe(true);
      expect(nav.properties.linkCurrent).toBe(false);
      expect(nav.properties.hideHome).toBe(true);
      expect(nav.properties.noSpace).toBe(false);
      expect(nav.properties.maxLength).toBe(50);
      expect(nav.properties.separator).toBe(' > ');
      expect(nav.properties.elementToAppend).toBe('Title');
      expect(nav.properties.beforeHtml).toBe('<nav>');
      expect(nav.properties.afterHtml).toBe('</nav>');

      // Hidden fields should NOT be present
      expect(nav.properties).not.toHaveProperty('overSpillLength');
      expect(nav.properties).not.toHaveProperty('overSpillFlag');
      expect(nav.properties).not.toHaveProperty('breadcrumbType');
      expect(nav.properties).not.toHaveProperty('appendContentElement');
    });
  });

  describe('create()', () => {
    const createResponse = {
      id: 271, name: 'A-Z Example', description: 'An example',
      navigationType: 'a2z', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'start_level': { value: '0', attribute: 'start_level', navigationPropertyID: 271 },
        'end_level': { value: '0', attribute: 'end_level', navigationPropertyID: 271 },
        'use_section_meta_data_element': { value: 'no', attribute: 'use_section_meta_data_element', navigationPropertyID: 271 },
        'section_meta_data_template': { value: '', attribute: 'section_meta_data_template', navigationPropertyID: 271 },
        'sel_micro_site': { value: '', attribute: 'sel_micro_site', navigationPropertyID: 271 },
        'before_menu': { value: '<ul>', attribute: 'before_menu', navigationPropertyID: 271 },
        'after_menu': { value: '</ul>', attribute: 'after_menu', navigationPropertyID: 271 },
        'before_item': { value: '<li>', attribute: 'before_item', navigationPropertyID: 271 },
        'after_item': { value: '</li>', attribute: 'after_item', navigationPropertyID: 271 },
      },
    };

    it('sends POST and returns a NavigationObject', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(createResponse);

      const nav = await resource.create({
        type: 'a-to-z',
        name: 'A-Z Example',
        description: 'An example',
        properties: {
          beforeMenu: '<ul>',
          afterMenu: '</ul>',
          beforeItem: '<li>',
          afterItem: '</li>',
        },
      });

      expect(nav.id).toBe(271);
      expect(nav.name).toBe('A-Z Example');
      expect(nav.type).toBe('a-to-z');
    });

    it('sends correct body shape for a2z', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(createResponse);

      await resource.create({
        type: 'a-to-z',
        name: 'A-Z Example',
        properties: { startLevel: 2, endLevel: 5 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      expect(postCall).toBeDefined();
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.navigationType).toBe('a2z');
      expect(body.name).toBe('A-Z Example');
      expect(body.isEnabled).toBe(true);
      expect(body.isCachingEnabled).toBe(false);
      expect(body.isPreviewModeEnabled).toBe(true);
      const props = body.properties as Record<string, { value: string }>;
      expect(props['start_level'].value).toBe('2');
      expect(props['end_level'].value).toBe('5');
      expect(props['use_section_meta_data_element'].value).toBe('no');
    });

    it('coerces useSectionMetaData boolean to yes/no', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'POST') return createResponse;
        if (opts.path === '/config/hierarchy.metaDataContentType') return { name: 'hierarchy.metaDataContentType', type: 'contentType', value: '75' };
        if (opts.path === '/contenttype/75') return { contentTypeElements: [{ name: 'Title', alias: 'Title', type: 1 }] };
        if (opts.path === '/type/') return ELEMENT_TYPES;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'a-to-z',
        name: 'Test',
        properties: { useSectionMetaData: true, sectionMetaContentTypeElement: 'Title' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['use_section_meta_data_element'].value).toBe('yes');
      expect(props['section_meta_data_template'].value).toBe('Title');
    });

    it('defaults all optional properties', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(createResponse);

      await resource.create({ type: 'a-to-z', name: 'Minimal' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.description).toBe('');
      expect(body.isEnabled).toBe(true);
      const props = body.properties as Record<string, { value: string }>;
      expect(props['start_level'].value).toBe('0');
      expect(props['end_level'].value).toBe('0');
      expect(props['use_section_meta_data_element'].value).toBe('no');
      expect(props['section_meta_data_template'].value).toBe('');
      expect(props['sel_micro_site'].value).toBe('');
      expect(props['before_menu'].value).toBe('');
      expect(props['after_menu'].value).toBe('');
      expect(props['before_item'].value).toBe('');
      expect(props['after_item'].value).toBe('');
    });

    it('throws if name is empty', async () => {
      await expect(resource.create({ type: 'a-to-z', name: '' })).rejects.toThrow('name is required');
    });

    it('throws if type is invalid', async () => {
      await expect(resource.create({ type: 'invalid' as never, name: 'Test' })).rejects.toThrow('Unknown navigation type');
    });

    it('throws if sectionMetaContentTypeElement set without useSectionMetaData', async () => {
      await expect(resource.create({
        type: 'a-to-z', name: 'Test',
        properties: { sectionMetaContentTypeElement: 'Title', useSectionMetaData: false },
      })).rejects.toThrow('sectionMetaContentTypeElement can only be set when useSectionMetaData is true');
    });

    it('validates sectionMetaContentTypeElement against content type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/config/hierarchy.metaDataContentType') return { value: '75' };
        if (opts.path === '/contenttype/75') return { contentTypeElements: [{ name: 'Title', alias: 'Title', type: 1 }, { name: 'Description', alias: 'Description', type: 1 }] };
        if (opts.path === '/type/') return ELEMENT_TYPES;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'a-to-z', name: 'Test',
        properties: { useSectionMetaData: true, sectionMetaContentTypeElement: 'NonExistent' },
      })).rejects.toThrow('Invalid sectionMetaContentTypeElement "NonExistent"');
    });

    it('validates microSite ID against channels', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/channel') return [
          { id: 1, microSites: [{ id: 6, name: 'Microsite Test', microSites: [] }] },
        ];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'a-to-z', name: 'Test',
        properties: { microSite: 999 },
      })).rejects.toThrow('Invalid microSite ID 999');
    });

    it('accepts valid microSite ID', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/channel') return [
          { id: 1, microSites: [{ id: 6, name: 'Microsite Test', microSites: [] }] },
        ];
        if (opts.method === 'POST') return createResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const nav = await resource.create({
        type: 'a-to-z', name: 'Test',
        properties: { microSite: 6 },
      });
      expect(nav).toBeDefined();
    });
  });

  describe('create() — breadcrumbs', () => {
    const breadcrumbsResponse = {
      id: 300, name: 'Breadcrumbs', description: '',
      navigationType: 'breadcrumbs', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'start-level': { value: '0', attribute: 'start-level', navigationPropertyID: 300 },
        'end-level': { value: '0', attribute: 'end-level', navigationPropertyID: 300 },
        'use-links': { value: 'no', attribute: 'use-links', navigationPropertyID: 300 },
        'link-current': { value: 'no', attribute: 'link-current', navigationPropertyID: 300 },
        'hide-home': { value: 'no', attribute: 'hide-home', navigationPropertyID: 300 },
        'no-space': { value: 'no', attribute: 'no-space', navigationPropertyID: 300 },
        'over_spill_length': { value: '0', attribute: 'over_spill_length', navigationPropertyID: 300 },
        'over_spill_flag': { value: 'no', attribute: 'over_spill_flag', navigationPropertyID: 300 },
        'breadcrumb-type': { value: '10', attribute: 'breadcrumb-type', navigationPropertyID: 300 },
        'append-content-element': { value: 'no', attribute: 'append-content-element', navigationPropertyID: 300 },
        'element-to-append': { value: '', attribute: 'element-to-append', navigationPropertyID: 300 },
        'separator-html': { value: ' > ', attribute: 'separator-html', navigationPropertyID: 300 },
        'before-html': { value: '', attribute: 'before-html', navigationPropertyID: 300 },
        'after-html': { value: '', attribute: 'after-html', navigationPropertyID: 300 },
      },
    };

    it('creates breadcrumbs with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(breadcrumbsResponse);

      await resource.create({ type: 'breadcrumbs', name: 'Trail' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.navigationType).toBe('breadcrumbs');
      const props = body.properties as Record<string, { value: string }>;
      expect(props['start-level'].value).toBe('0');
      expect(props['end-level'].value).toBe('0');
      expect(props['use-links'].value).toBe('no');
      expect(props['link-current'].value).toBe('no');
      expect(props['hide-home'].value).toBe('no');
      expect(props['no-space'].value).toBe('no');
      expect(props['over_spill_length'].value).toBe('0');
      expect(props['over_spill_flag'].value).toBe('no');
      expect(props['breadcrumb-type'].value).toBe('10');
      expect(props['append-content-element'].value).toBe('no');
      expect(props['element-to-append'].value).toBe('');
      expect(props['separator-html'].value).toBe('');
      expect(props['before-html'].value).toBe('');
      expect(props['after-html'].value).toBe('');
    });

    it('coerces booleans to yes/no', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(breadcrumbsResponse);

      await resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { useLinks: true, linkCurrent: true, hideHome: true, noSpace: true },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['use-links'].value).toBe('yes');
      expect(props['link-current'].value).toBe('yes');
      expect(props['hide-home'].value).toBe('yes');
      expect(props['no-space'].value).toBe('yes');
    });

    it('sets overspill and breadcrumb-type automatically from maxLength', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(breadcrumbsResponse);

      await resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { maxLength: 50 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['over_spill_length'].value).toBe('50');
      expect(props['over_spill_flag'].value).toBe('yes');
      expect(props['breadcrumb-type'].value).toBe('20');
    });

    it('sets append-content-element to yes when elementToAppend is provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(breadcrumbsResponse);

      await resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { elementToAppend: 'Title' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['append-content-element'].value).toBe('yes');
      expect(props['element-to-append'].value).toBe('Title');
    });

    it('throws if noSpace is true without useLinks', async () => {
      await expect(resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { noSpace: true, useLinks: false },
      })).rejects.toThrow('noSpace can only be true when useLinks is true');
    });

    it('throws if startLevel is negative', async () => {
      await expect(resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { startLevel: -1 },
      })).rejects.toThrow('startLevel must be 0 or greater');
    });

    it('throws if endLevel is negative', async () => {
      await expect(resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { endLevel: -2 },
      })).rejects.toThrow('endLevel must be 0 or greater');
    });

    it('throws if maxLength is negative', async () => {
      await expect(resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { maxLength: -5 },
      })).rejects.toThrow('maxLength must be 0 or greater');
    });

    it('throws if maxLength is set with startLevel above 0', async () => {
      await expect(resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { maxLength: 50, startLevel: 2 },
      })).rejects.toThrow('maxLength cannot be set when startLevel or endLevel are above 0');
    });

    it('throws if maxLength is set with endLevel above 0', async () => {
      await expect(resource.create({
        type: 'breadcrumbs', name: 'Trail',
        properties: { maxLength: 50, endLevel: 3 },
      })).rejects.toThrow('maxLength cannot be set when startLevel or endLevel are above 0');
    });
  });

  describe('create() — css-selector', () => {
    const cssResponse = {
      id: 400, name: 'CSS Nav', description: '',
      navigationType: 'css-selector', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'default-style-sheet': { value: '11299', attribute: 'default-style-sheet', navigationPropertyID: 400 },
        'language': { value: '', attribute: 'language', navigationPropertyID: 400 },
      },
    };

    it('creates css-selector with required defaultStylesheet', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/11299/smxx') return { id: 11299 };
        if (opts.method === 'POST') return cssResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const nav = await resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: { defaultStylesheet: 11299 },
      });
      expect(nav.id).toBe(400);
    });

    it('sends section-name: on at top level', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/11299/smxx') return { id: 11299 };
        if (opts.method === 'POST') return cssResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: { defaultStylesheet: 11299 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body['section-name']).toBe('on');
    });

    it('includes branch properties when branches provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/11299/smxx') return { id: 11299 };
        if (opts.path === '/media/4767/smxx') return { id: 4767 };
        if (opts.path === '/hierarchy/233/en') return { id: 233, name: 'Root' };
        if (opts.method === 'POST') return cssResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: {
          defaultStylesheet: 11299,
          branches: [{ stylesheet: 4767, rootSection: 233 }],
        },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['style-sheet-1'].value).toBe('4767');
      expect(props['branch-1-root'].value).toBe('233');
      expect(props['branch-1-name'].value).toBe('');
    });

    it('omits branch properties when no branches provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/11299/smxx') return { id: 11299 };
        if (opts.method === 'POST') return cssResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: { defaultStylesheet: 11299 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['style-sheet-1']).toBeUndefined();
      expect(props['branch-1-name']).toBeUndefined();
      expect(props['branch-1-root']).toBeUndefined();
    });

    it('throws if defaultStylesheet is missing', async () => {
      await expect(resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: {} as never,
      })).rejects.toThrow('defaultStylesheet is required');
    });

    it('throws if defaultStylesheet media not found', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/99999/smxx') throw new Error('Not found');
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: { defaultStylesheet: 99999 },
      })).rejects.toThrow('Invalid defaultStylesheet: media item 99999 not found');
    });

    it('throws if branch has both name and rootSection', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/11299/smxx') return { id: 11299 };
        if (opts.path === '/media/4767/smxx') return { id: 4767 };
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: {
          defaultStylesheet: 11299,
          branches: [{ stylesheet: 4767, name: 'Homepage', rootSection: 233 }],
        },
      })).rejects.toThrow('cannot have both name and rootSection');
    });

    it('throws if branch rootSection is invalid', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/11299/smxx') return { id: 11299 };
        if (opts.path === '/media/4767/smxx') return { id: 4767 };
        if (opts.path === '/hierarchy/99999/en') throw new Error('Not found');
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'css-selector', name: 'CSS Nav',
        properties: {
          defaultStylesheet: 11299,
          branches: [{ stylesheet: 4767, rootSection: 99999 }],
        },
      })).rejects.toThrow('Invalid rootSection: section 99999 not found');
    });
  });

  describe('create() — generate-file', () => {
    const genFileResponse = {
      id: 500, name: 'Gen File', description: '',
      navigationType: 'Generate File', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'File Name': { value: 'foo', attribute: 'File Name', navigationPropertyID: 500 },
        'Append Content ID': { value: 'yes', attribute: 'Append Content ID', navigationPropertyID: 500 },
        'File Extension': { value: 'html', attribute: 'File Extension', navigationPropertyID: 500 },
        'Base Directory': { value: '', attribute: 'Base Directory', navigationPropertyID: 500 },
        'Formatter': { value: 'text/html', attribute: 'Formatter', navigationPropertyID: 500 },
        'Append Directory': { value: 'no', attribute: 'Append Directory', navigationPropertyID: 500 },
        'Media File': { value: '4767', attribute: 'Media File', navigationPropertyID: 500 },
      },
    };

    it('creates generate-file with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(genFileResponse);

      await resource.create({ type: 'generate-file', name: 'Gen File' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.navigationType).toBe('Generate File');
      const props = body.properties as Record<string, { value?: string }>;
      expect(props['File Name'].value).toBe('');
      expect(props['Append Content ID'].value).toBe('no');
      expect(props['File Extension'].value).toBe('');
      expect(props['Base Directory'].value).toBe('');
      expect(props['Formatter'].value).toBe('');
      expect(props['Append Directory'].value).toBe('no');
      expect(props['Media File']).toEqual({});
    });

    it('sends media file as value when provided and valid', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/media/4767/smxx') return { id: 4767 };
        if (opts.method === 'POST') return genFileResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'generate-file', name: 'Gen File',
        properties: {
          fileName: 'output',
          fileExtension: 'html',
          layout: 'text/html',
          appendContentId: true,
          mediaFile: 4767,
        },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value?: string }> } }).body.properties;
      expect(props['File Name'].value).toBe('output');
      expect(props['File Extension'].value).toBe('html');
      expect(props['Formatter'].value).toBe('text/html');
      expect(props['Append Content ID'].value).toBe('yes');
      expect(props['Media File'].value).toBe(4767);
    });

    it('throws if mediaFile is invalid', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/media/99999/smxx') throw new Error('Not found');
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'generate-file', name: 'Gen File',
        properties: { mediaFile: 99999 },
      })).rejects.toThrow('Invalid mediaFile: media item 99999 not found');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(genFileResponse);

      const nav = await resource.get(500);

      expect(nav.properties.fileName).toBe('foo');
      expect(nav.properties.appendContentId).toBe(true);
      expect(nav.properties.fileExtension).toBe('html');
      expect(nav.properties.baseDirectory).toBe('');
      expect(nav.properties.layout).toBe('text/html');
      expect(nav.properties.appendDirectory).toBe(false);
      expect(nav.properties.mediaFile).toBe(4767);
    });
  });

  describe('create() — language-switcher', () => {
    const langSwitcherResponse = {
      id: 600, name: 'Lang Switch', description: '',
      navigationType: 'languageswitcher', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'lang-code': { value: 'en', attribute: 'lang-code', navigationPropertyID: 600 },
        'always-output': { value: 'yes', attribute: 'always-output', navigationPropertyID: 600 },
        'image-link': { value: 'yes', attribute: 'image-link', navigationPropertyID: 600 },
        'url': { value: 'https://example.com', attribute: 'url', navigationPropertyID: 600 },
        'image-ext': { value: '.gif', attribute: 'image-ext', navigationPropertyID: 600 },
        'image-properties': { value: 'width="30"', attribute: 'image-properties', navigationPropertyID: 600 },
        'before': { value: '<div>', attribute: 'before', navigationPropertyID: 600 },
        'after': { value: '</div>', attribute: 'after', navigationPropertyID: 600 },
      },
    };

    it('creates language-switcher with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(langSwitcherResponse);

      await resource.create({ type: 'language-switcher', name: 'Lang Switch' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['lang-code'].value).toBe('');
      expect(props['always-output'].value).toBe('no');
      expect(props['image-link'].value).toBe('no');
      expect(props['url'].value).toBe('');
      expect(props['image-ext'].value).toBe('');
      expect(props['image-properties'].value).toBe('');
      expect(props['before'].value).toBe('');
      expect(props['after'].value).toBe('');
    });

    it('derives image-link from image fields', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(langSwitcherResponse);

      await resource.create({
        type: 'language-switcher', name: 'Lang Switch',
        properties: { imageUrl: 'https://example.com' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['image-link'].value).toBe('yes');
    });

    it('sets image-link to no when no image fields set', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(langSwitcherResponse);

      await resource.create({
        type: 'language-switcher', name: 'Lang Switch',
        properties: { langCode: 'fr', alwaysOutput: true },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['image-link'].value).toBe('no');
      expect(props['always-output'].value).toBe('yes');
    });

    it('transforms properties on read with hidden imageLink', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(langSwitcherResponse);

      const nav = await resource.get(600);

      expect(nav.properties.langCode).toBe('en');
      expect(nav.properties.alwaysOutput).toBe(true);
      expect(nav.properties.imageUrl).toBe('https://example.com');
      expect(nav.properties.imageExtension).toBe('.gif');
      expect(nav.properties.imageProperties).toBe('width="30"');
      expect(nav.properties.beforeHtml).toBe('<div>');
      expect(nav.properties.afterHtml).toBe('</div>');
      // imageLink should be hidden
      expect(nav.properties).not.toHaveProperty('imageLink');
    });
  });

  describe('create() — pagination', () => {
    const paginationResponse = {
      id: 700, name: 'Pagination', description: '',
      navigationType: 'pagination', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'template-list': { value: '67', attribute: 'template-list', navigationPropertyID: 700 },
        'fetch-method': { value: 'fetch-method-current', attribute: 'fetch-method', navigationPropertyID: 700 },
        'section': { value: '0', attribute: 'section', navigationPropertyID: 700 },
        'level': { value: '0', attribute: 'level', navigationPropertyID: 700 },
        'num-to-recurse': { value: '0', attribute: 'num-to-recurse', navigationPropertyID: 700 },
        'number-of-pieces': { value: '10', attribute: 'number-of-pieces', navigationPropertyID: 700 },
        'max-number-of-pieces': { value: '100', attribute: 'max-number-of-pieces', navigationPropertyID: 700 },
        'num-links-to-show': { value: '5', attribute: 'num-links-to-show', navigationPropertyID: 700 },
        'use-alt-formatter': { value: 'no', attribute: 'use-alt-formatter', navigationPropertyID: 700 },
        'alt-formatter-type': { value: '', attribute: 'alt-formatter-type', navigationPropertyID: 700 },
        'show-hidden-sections': { value: 'yes', attribute: 'show-hidden-sections', navigationPropertyID: 700 },
        'before-html': { value: '<nav>', attribute: 'before-html', navigationPropertyID: 700 },
        'after-html': { value: '</nav>', attribute: 'after-html', navigationPropertyID: 700 },
        'before-pagination-html': { value: '', attribute: 'before-pagination-html', navigationPropertyID: 700 },
        'after-pagination-html': { value: '', attribute: 'after-pagination-html', navigationPropertyID: 700 },
        'between-pagination-html': { value: ' | ', attribute: 'between-pagination-html', navigationPropertyID: 700 },
      },
    };

    it('creates pagination with content type validation', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67, name: 'Article' };
        if (opts.method === 'POST') return paginationResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const nav = await resource.create({
        type: 'pagination', name: 'Pagination',
        properties: { contentTypeId: 67 },
      });
      expect(nav.id).toBe(700);
    });

    it('sends correct fetch-method and defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.method === 'POST') return paginationResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 67, fetchMethod: 'current', contentItemsPerPage: 10 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['fetch-method'].value).toBe('fetch-method-current');
      expect(props['section'].value).toBe('0');
      expect(props['level'].value).toBe('0');
      expect(props['num-to-recurse'].value).toBe('0');
      expect(props['number-of-pieces'].value).toBe('10');
    });

    it('requires section for branch fetch method', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 67, fetchMethod: 'branch' },
      })).rejects.toThrow('section is required when fetchMethod is "branch"');
    });

    it('requires section for section fetch method', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 67, fetchMethod: 'section' },
      })).rejects.toThrow('section is required when fetchMethod is "section"');
    });

    it('validates section and allows numToRecurse for branch-at-level', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.path === '/hierarchy/233/en') return { id: 233 };
        if (opts.method === 'POST') return paginationResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 67, fetchMethod: 'branch-at-level', section: 233, level: 2, numToRecurse: 3 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['fetch-method'].value).toBe('fetch-method-branch-at-level');
      expect(props['section'].value).toBe('233');
      expect(props['level'].value).toBe('2');
      expect(props['num-to-recurse'].value).toBe('3');
    });

    it('validates altLayoutName against content type layouts', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.path === '/layout/contenttype/67/en') return [{ name: 'text/html' }, { name: 'text/json' }];
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 67, altLayoutName: 'text/nonexistent' },
      })).rejects.toThrow('Invalid altLayoutName "text/nonexistent"');
    });

    it('sets use-alt-formatter when altLayoutName is provided', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.path === '/layout/contenttype/67/en') return [{ name: 'text/html' }, { name: 'text/json' }];
        if (opts.method === 'POST') return paginationResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 67, altLayoutName: 'text/json' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['use-alt-formatter'].value).toBe('yes');
      expect(props['alt-formatter-type'].value).toBe('text/json');
    });

    it('throws if contentTypeId is missing', async () => {
      await expect(resource.create({
        type: 'pagination', name: 'Pag',
        properties: {} as never,
      })).rejects.toThrow('contentTypeId is required');
    });

    it('throws if contentTypeId is invalid', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/contenttype/99999') throw new Error('Not found');
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'pagination', name: 'Pag',
        properties: { contentTypeId: 99999 },
      })).rejects.toThrow('Invalid contentTypeId: content type 99999 not found');
    });

    it('transforms properties on read with friendly names', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(paginationResponse);

      const nav = await resource.get(700);

      expect(nav.properties.contentTypeId).toBe(67);
      expect(nav.properties.fetchMethod).toBe('current');
      expect(nav.properties.section).toBe(0);
      expect(nav.properties.level).toBe(0);
      expect(nav.properties.numToRecurse).toBe(0);
      expect(nav.properties.contentItemsPerPage).toBe(10);
      expect(nav.properties.maxContentItems).toBe(100);
      expect(nav.properties.maxLinksPerPage).toBe(5);
      expect(nav.properties.searchHiddenSections).toBe(true);
      expect(nav.properties.altLayoutName).toBe('');
      expect(nav.properties.beforeHtml).toBe('<nav>');
      expect(nav.properties.afterHtml).toBe('</nav>');
      expect(nav.properties.betweenPaginationHtml).toBe(' | ');
      // useAltFormatter should be hidden
      expect(nav.properties).not.toHaveProperty('useAltFormatter');
    });
  });

  describe('create() — previous-next-fulltext', () => {
    const prevNextResponse = {
      id: 800, name: 'Prev/Next', description: '',
      navigationType: 'previousNextFulltext', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'id_previous': { value: 'true', attribute: 'id_previous', navigationPropertyID: 800 },
        'id_next': { value: 'false', attribute: 'id_next', navigationPropertyID: 800 },
        'id_previous_and_next': { value: 'false', attribute: 'id_previous_and_next', navigationPropertyID: 800 },
        'id_custom_formatter': { value: 'no', attribute: 'id_custom_formatter', navigationPropertyID: 800 },
        'id_custom_formatter_textarea': { value: '', attribute: 'id_custom_formatter_textarea', navigationPropertyID: 800 },
        'id_skip_non_fulltext_content': { value: 'yes', attribute: 'id_skip_non_fulltext_content', navigationPropertyID: 800 },
        'id_next_navigation_with_previous_next_navigation': { value: 'no', attribute: 'id_next_navigation_with_previous_next_navigation', navigationPropertyID: 800 },
        'id_same_template_restriction': { value: 'yes', attribute: 'id_same_template_restriction', navigationPropertyID: 800 },
        'id_display_on_boundary': { value: 'no', attribute: 'id_display_on_boundary', navigationPropertyID: 800 },
        'id_display_content_name_as_title': { value: 'yes', attribute: 'id_display_content_name_as_title', navigationPropertyID: 800 },
        'id_previous_html': { value: 'Prev', attribute: 'id_previous_html', navigationPropertyID: 800 },
        'id_between_html': { value: ' | ', attribute: 'id_between_html', navigationPropertyID: 800 },
        'id_next_html': { value: 'Next', attribute: 'id_next_html', navigationPropertyID: 800 },
      },
    };

    it('creates with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(prevNextResponse);

      await resource.create({ type: 'previous-next-fulltext', name: 'Prev/Next' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['id_previous'].value).toBe('true');
      expect(props['id_next'].value).toBe('false');
      expect(props['id_previous_and_next'].value).toBe('false');
      expect(props['id_custom_formatter'].value).toBe('no');
      expect(props['id_skip_non_fulltext_content'].value).toBe('no');
    });

    it('sets type to next correctly', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(prevNextResponse);

      await resource.create({
        type: 'previous-next-fulltext', name: 'Next Only',
        properties: { type: 'next' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['id_previous'].value).toBe('false');
      expect(props['id_next'].value).toBe('true');
      expect(props['id_previous_and_next'].value).toBe('false');
    });

    it('sets type to both correctly', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(prevNextResponse);

      await resource.create({
        type: 'previous-next-fulltext', name: 'Both',
        properties: { type: 'both' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['id_previous'].value).toBe('false');
      expect(props['id_next'].value).toBe('false');
      expect(props['id_previous_and_next'].value).toBe('true');
    });

    it('derives customFormatter from altLayoutName', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(prevNextResponse);

      await resource.create({
        type: 'previous-next-fulltext', name: 'Custom',
        properties: { altLayoutName: 'text/nav' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['id_custom_formatter'].value).toBe('yes');
      expect(props['id_custom_formatter_textarea'].value).toBe('text/nav');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(prevNextResponse);

      const nav = await resource.get(800);

      expect(nav.properties.type).toBe('previous');
      expect(nav.properties.altLayoutName).toBe('');
      expect(nav.properties.skipNonFulltextContent).toBe(true);
      expect(nav.properties.onlyLinkToContentWithNav).toBe(false);
      expect(nav.properties.sameContentTypeRestriction).toBe(true);
      expect(nav.properties.displayOnBoundary).toBe(false);
      expect(nav.properties.displayContentNameAsTitle).toBe(true);
      expect(nav.properties.previousHtml).toBe('Prev');
      expect(nav.properties.betweenHtml).toBe(' | ');
      expect(nav.properties.nextHtml).toBe('Next');
      // Hidden fields
      expect(nav.properties).not.toHaveProperty('customFormatter');
      expect(nav.properties).not.toHaveProperty('idCustomFormatter');
    });
  });

  describe('create() — section-iterator', () => {
    const sectionIterResponse = {
      id: 900, name: 'Section Iter', description: '',
      navigationType: 'sectioniterator', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'before-html': { value: '<ul>', attribute: 'before-html', navigationPropertyID: 900 },
        'between-html': { value: '<li>', attribute: 'between-html', navigationPropertyID: 900 },
        'after-html': { value: '</ul>', attribute: 'after-html', navigationPropertyID: 900 },
      },
    };

    it('creates with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(sectionIterResponse);

      await resource.create({ type: 'section-iterator', name: 'Iter' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['before-html'].value).toBe('');
      expect(props['between-html'].value).toBe('');
      expect(props['after-html'].value).toBe('');
    });

    it('passes through string values', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(sectionIterResponse);

      await resource.create({
        type: 'section-iterator', name: 'Iter',
        properties: { beforeHtml: '<ul>', betweenHtml: '<li>', afterHtml: '</ul>' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['before-html'].value).toBe('<ul>');
      expect(props['between-html'].value).toBe('<li>');
      expect(props['after-html'].value).toBe('</ul>');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(sectionIterResponse);

      const nav = await resource.get(900);
      expect(nav.properties.beforeHtml).toBe('<ul>');
      expect(nav.properties.betweenHtml).toBe('<li>');
      expect(nav.properties.afterHtml).toBe('</ul>');
    });
  });

  describe('create() — related-section-branch', () => {
    const rsbResponse = {
      id: 950, name: 'RSB', description: '',
      navigationType: 'relatedSectionBranch', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'Name of child section': { value: 'child-name', attribute: 'Name of child section', navigationPropertyID: 950 },
        'Link Text': { value: 'Click here', attribute: 'Link Text', navigationPropertyID: 950 },
      },
    };

    it('creates with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rsbResponse);

      await resource.create({ type: 'related-section-branch', name: 'RSB' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['Name of child section'].value).toBe('');
      expect(props['Link Text'].value).toBe('');
    });

    it('passes through string values', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rsbResponse);

      await resource.create({
        type: 'related-section-branch', name: 'RSB',
        properties: { childSectionName: 'news', linkText: 'View News' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['Name of child section'].value).toBe('news');
      expect(props['Link Text'].value).toBe('View News');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rsbResponse);

      const nav = await resource.get(950);
      expect(nav.properties.childSectionName).toBe('child-name');
      expect(nav.properties.linkText).toBe('Click here');
    });
  });

  describe('create() — return-to-index', () => {
    const rtiResponse = {
      id: 960, name: 'RTI', description: '',
      navigationType: 'return-to-index', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'link-text': { value: 'Back to...', attribute: 'link-text', navigationPropertyID: 960 },
        'append-section-name': { value: 'yes', attribute: 'append-section-name', navigationPropertyID: 960 },
        'scroll-to-content': { value: 'yes', attribute: 'scroll-to-content', navigationPropertyID: 960 },
        'link-target': { value: '_blank', attribute: 'link-target', navigationPropertyID: 960 },
      },
    };

    it('creates with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rtiResponse);

      await resource.create({ type: 'return-to-index', name: 'RTI' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['link-text'].value).toBe('');
      expect(props['append-section-name'].value).toBe('no');
      expect(props['scroll-to-content'].value).toBe('no');
      expect(props['link-target'].value).toBe('');
    });

    it('coerces booleans and passes strings', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rtiResponse);

      await resource.create({
        type: 'return-to-index', name: 'RTI',
        properties: { linkText: 'Back', appendSectionName: true, scrollToContent: true, linkTarget: '_blank' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['link-text'].value).toBe('Back');
      expect(props['append-section-name'].value).toBe('yes');
      expect(props['scroll-to-content'].value).toBe('yes');
      expect(props['link-target'].value).toBe('_blank');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rtiResponse);

      const nav = await resource.get(960);
      expect(nav.properties.linkText).toBe('Back to...');
      expect(nav.properties.appendSectionName).toBe(true);
      expect(nav.properties.scrollToContent).toBe(true);
      expect(nav.properties.linkTarget).toBe('_blank');
    });
  });

  describe('create() — section-meta-info', () => {
    const metaLevels = [
      { id: 34, name: 'article:author' },
      { id: 12, name: 'description' },
      { id: 14, name: 'keywords' },
    ];

    const smiResponse = {
      id: 970, name: 'Meta Nav', description: '',
      navigationType: 'meta', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'meta-type': { value: '34', attribute: 'meta-type', navigationPropertyID: 970 },
        'date-format': { value: 'dd.MM.yyyy', attribute: 'date-format', navigationPropertyID: 970 },
        'before-html': { value: '<div>', attribute: 'before-html', navigationPropertyID: 970 },
        'after-html': { value: '</div>', attribute: 'after-html', navigationPropertyID: 970 },
      },
    };

    it('creates with validated metaType name resolved to ID', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/meta/level') return metaLevels;
        if (opts.method === 'POST') return smiResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'section-meta-info', name: 'Meta Nav',
        properties: { metaType: 'article:author', dateFormat: 'dd.MM.yyyy' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['meta-type'].value).toBe('34');
      expect(props['date-format'].value).toBe('dd.MM.yyyy');
    });

    it('throws if metaType is invalid', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/meta/level') return metaLevels;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'section-meta-info', name: 'Meta Nav',
        properties: { metaType: 'nonexistent' },
      })).rejects.toThrow('Invalid metaType "nonexistent"');
    });

    it('throws if metaType is empty', async () => {
      await expect(resource.create({
        type: 'section-meta-info', name: 'Meta Nav',
        properties: { metaType: '' },
      })).rejects.toThrow('metaType is required');
    });

    it('resolves metaType ID to name on get', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/navigation/970') return smiResponse;
        if (opts.path === '/meta/level') return metaLevels;
        throw new Error(`Unexpected: ${opts.path}`);
      });

      const nav = await resource.get(970);
      expect(nav.properties.metaType).toBe('article:author');
      expect(nav.properties.dateFormat).toBe('dd.MM.yyyy');
      expect(nav.properties.beforeHtml).toBe('<div>');
      expect(nav.properties.afterHtml).toBe('</div>');
    });
  });

  describe('create() — top-stories', () => {
    const topStoriesResponse = {
      id: 980, name: 'Top Stories', description: '',
      navigationType: 'topstories', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: true,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'section': { value: '237', attribute: 'section', navigationPropertyID: 980 },
        'numtoshow': { value: '10', attribute: 'numtoshow', navigationPropertyID: 980 },
        'link-to-fulltext': { value: 'yes', attribute: 'link-to-fulltext', navigationPropertyID: 980 },
        'title': { value: 'Latest', attribute: 'title', navigationPropertyID: 980 },
        'before-menu-html': { value: '<ul>', attribute: 'before-menu-html', navigationPropertyID: 980 },
        'after-menu-html': { value: '</ul>', attribute: 'after-menu-html', navigationPropertyID: 980 },
        'before-html': { value: '<li>', attribute: 'before-html', navigationPropertyID: 980 },
        'after-html': { value: '</li>', attribute: 'after-html', navigationPropertyID: 980 },
      },
    };

    it('creates with section validation and caching enabled', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/237/en') return { id: 237 };
        if (opts.method === 'POST') return topStoriesResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'top-stories', name: 'Top Stories',
        properties: { section: 237, numToShow: 10, linkToFulltext: true },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.isCachingEnabled).toBe(true);
      const props = body.properties as Record<string, { value: string }>;
      expect(props['section'].value).toBe('237');
      expect(props['numtoshow'].value).toBe('10');
      expect(props['link-to-fulltext'].value).toBe('yes');
    });

    it('throws if section is missing', async () => {
      await expect(resource.create({
        type: 'top-stories', name: 'TS',
        properties: {} as never,
      })).rejects.toThrow('section is required');
    });

    it('throws if section is invalid', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { path: string }) => {
        if (opts.path === '/hierarchy/99999/en') throw new Error('Not found');
        throw new Error(`Unexpected: ${opts.path}`);
      });

      await expect(resource.create({
        type: 'top-stories', name: 'TS',
        properties: { section: 99999 },
      })).rejects.toThrow('Invalid rootSection: section 99999 not found');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(topStoriesResponse);

      const nav = await resource.get(980);
      expect(nav.properties.section).toBe(237);
      expect(nav.properties.numToShow).toBe(10);
      expect(nav.properties.linkToFulltext).toBe(true);
      expect(nav.properties.title).toBe('Latest');
      expect(nav.properties.beforeMenuHtml).toBe('<ul>');
      expect(nav.properties.afterMenuHtml).toBe('</ul>');
      expect(nav.properties.beforeHtml).toBe('<li>');
      expect(nav.properties.afterHtml).toBe('</li>');
    });
  });

  describe('create() — site-map', () => {
    const siteMapResponse = {
      id: 990, name: 'Site Map', description: '',
      navigationType: 'sitemap', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'section': { value: '0', attribute: 'section', navigationPropertyID: 990 },
        'levels': { value: '5', attribute: 'levels', navigationPropertyID: 990 },
        'show_relative_child_sections': { value: 'yes', attribute: 'show_relative_child_sections', navigationPropertyID: 990 },
        'enable_content_count': { value: 'yes', attribute: 'enable_content_count', navigationPropertyID: 990 },
        'template_type': { value: '67', attribute: 'template_type', navigationPropertyID: 990 },
        'max_levels_to_count': { value: '10', attribute: 'max_levels_to_count', navigationPropertyID: 990 },
        'count_recursively': { value: 'yes', attribute: 'count_recursively', navigationPropertyID: 990 },
        'html_before_content_count': { value: '(', attribute: 'html_before_content_count', navigationPropertyID: 990 },
        'html_after_content_count': { value: ')', attribute: 'html_after_content_count', navigationPropertyID: 990 },
      },
    };

    it('creates with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(siteMapResponse);

      await resource.create({ type: 'site-map', name: 'Site Map' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['section'].value).toBe('0');
      expect(props['levels'].value).toBe('0');
      expect(props['show_relative_child_sections'].value).toBe('no');
      expect(props['enable_content_count'].value).toBe('no');
    });

    it('validates section when non-zero', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { id: 233 };
        if (opts.method === 'POST') return siteMapResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'site-map', name: 'Site Map',
        properties: { startSection: 233 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['section'].value).toBe('233');
    });

    it('validates contentTypeIds when enableContentCount is true', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.method === 'POST') return siteMapResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'site-map', name: 'Site Map',
        properties: { enableContentCount: true, contentTypeIds: [67], countRecursively: true },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['enable_content_count'].value).toBe('yes');
      expect(props['template_type'].value).toBe('67');
      expect(props['count_recursively'].value).toBe('yes');
    });

    it('throws if contentTypeIds set without enableContentCount', async () => {
      await expect(resource.create({
        type: 'site-map', name: 'Site Map',
        properties: { contentTypeIds: [67] },
      })).rejects.toThrow('contentTypeIds can only be set when enableContentCount is true');
    });

    it('throws if countRecursively set without enableContentCount', async () => {
      await expect(resource.create({
        type: 'site-map', name: 'Site Map',
        properties: { countRecursively: true },
      })).rejects.toThrow('countRecursively can only be set when enableContentCount is true');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(siteMapResponse);

      const nav = await resource.get(990);
      expect(nav.properties.startSection).toBe(0);
      expect(nav.properties.levels).toBe(5);
      expect(nav.properties.childSectionLinks).toBe(true);
      expect(nav.properties.enableContentCount).toBe(true);
      expect(nav.properties.contentTypeIds).toEqual([67]);
      expect(nav.properties.maxLevelsToCount).toBe(10);
      expect(nav.properties.countRecursively).toBe(true);
      expect(nav.properties.htmlBeforeContentCount).toBe('(');
      expect(nav.properties.htmlAfterContentCount).toBe(')');
    });

    it('hides content count fields on read when disabled', async () => {
      const disabledResponse = {
        ...siteMapResponse,
        properties: {
          ...siteMapResponse.properties,
          'enable_content_count': { value: 'no', attribute: 'enable_content_count', navigationPropertyID: 990 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(disabledResponse);

      const nav = await resource.get(990);
      expect(nav.properties.enableContentCount).toBe(false);
      expect(nav.properties).not.toHaveProperty('contentTypeIds');
      expect(nav.properties).not.toHaveProperty('maxLevelsToCount');
      expect(nav.properties).not.toHaveProperty('countRecursively');
    });
  });

  describe('create() — section-details', () => {
    const sectionDetailsResponse = {
      id: 1000, name: 'Section Details', description: '',
      navigationType: 'sectiondetails', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'details-method': { value: 'details-method-current', attribute: 'details-method', navigationPropertyID: 1000 },
        'level': { value: '0', attribute: 'level', navigationPropertyID: 1000 },
        'section': { value: '0', attribute: 'section', navigationPropertyID: 1000 },
        'display-type': { value: 'display-type-id', attribute: 'display-type', navigationPropertyID: 1000 },
      },
    };

    it('creates with defaults', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(sectionDetailsResponse);

      await resource.create({ type: 'section-details', name: 'Details' });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['details-method'].value).toBe('details-method-current');
      expect(props['level'].value).toBe('0');
      expect(props['section'].value).toBe('0');
      expect(props['display-type'].value).toBe('display-type-id');
    });

    it('allows level when detailMethod is level', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(sectionDetailsResponse);

      await resource.create({
        type: 'section-details', name: 'Details',
        properties: { detailMethod: 'level', level: 3, displayType: 'name' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['details-method'].value).toBe('details-method-level');
      expect(props['level'].value).toBe('3');
      expect(props['display-type'].value).toBe('display-type-name');
    });

    it('requires and validates section when detailMethod is section', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { id: 233 };
        if (opts.method === 'POST') return sectionDetailsResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'section-details', name: 'Details',
        properties: { detailMethod: 'section', section: 233, displayType: 'path' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['details-method'].value).toBe('details-method-section');
      expect(props['section'].value).toBe('233');
    });

    it('throws if section missing for detailMethod section', async () => {
      await expect(resource.create({
        type: 'section-details', name: 'Details',
        properties: { detailMethod: 'section' },
      })).rejects.toThrow('section is required when detailMethod is "section"');
    });

    it('throws if level set without detailMethod level', async () => {
      await expect(resource.create({
        type: 'section-details', name: 'Details',
        properties: { detailMethod: 'current', level: 3 },
      })).rejects.toThrow('level can only be set when detailMethod is "level"');
    });

    it('throws if section set without detailMethod section', async () => {
      await expect(resource.create({
        type: 'section-details', name: 'Details',
        properties: { detailMethod: 'current', section: 233 },
      })).rejects.toThrow('section can only be set when detailMethod is "section"');
    });

    it('transforms properties on read with friendly enums', async () => {
      const readResponse = {
        ...sectionDetailsResponse,
        properties: {
          'details-method': { value: 'details-method-section', attribute: 'details-method', navigationPropertyID: 1000 },
          'level': { value: '0', attribute: 'level', navigationPropertyID: 1000 },
          'section': { value: '233', attribute: 'section', navigationPropertyID: 1000 },
          'display-type': { value: 'display-type-link', attribute: 'display-type', navigationPropertyID: 1000 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(readResponse);

      const nav = await resource.get(1000);
      expect(nav.properties.detailMethod).toBe('section');
      expect(nav.properties.section).toBe(233);
      expect(nav.properties.displayType).toBe('link');
      // level should be hidden for 'section' method
      expect(nav.properties).not.toHaveProperty('level');
    });

    it('hides section and shows level when method is level', async () => {
      const readResponse = {
        ...sectionDetailsResponse,
        properties: {
          'details-method': { value: 'details-method-level', attribute: 'details-method', navigationPropertyID: 1000 },
          'level': { value: '3', attribute: 'level', navigationPropertyID: 1000 },
          'section': { value: '0', attribute: 'section', navigationPropertyID: 1000 },
          'display-type': { value: 'display-type-name', attribute: 'display-type', navigationPropertyID: 1000 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(readResponse);

      const nav = await resource.get(1000);
      expect(nav.properties.detailMethod).toBe('level');
      expect(nav.properties.level).toBe(3);
      expect(nav.properties).not.toHaveProperty('section');
    });

    it('hides both level and section when method is current', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(sectionDetailsResponse);

      const nav = await resource.get(1000);
      expect(nav.properties.detailMethod).toBe('current');
      expect(nav.properties.displayType).toBe('id');
      expect(nav.properties).not.toHaveProperty('level');
      expect(nav.properties).not.toHaveProperty('section');
    });
  });

  describe('create() — related-content', () => {
    const rcCurrentResponse = {
      id: 1100, name: 'RC Current', description: '',
      navigationType: 'relatedcontent', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: true,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'fetch-method': { value: 'fetch-method-current', attribute: 'fetch-method', navigationPropertyID: 1100 },
        'relatedcontent-type': { value: 'rc', attribute: 'relatedcontent-type', navigationPropertyID: 1100 },
        'title': { value: 'Related', attribute: 'title', navigationPropertyID: 1100 },
        'before-html': { value: '', attribute: 'before-html', navigationPropertyID: 1100 },
        'after-html': { value: '', attribute: 'after-html', navigationPropertyID: 1100 },
        'use-alt-formatter': { value: 'no', attribute: 'use-alt-formatter', navigationPropertyID: 1100 },
        'alt-formatter-type': { value: '', attribute: 'alt-formatter-type', navigationPropertyID: 1100 },
        'section': { value: '0', attribute: 'section', navigationPropertyID: 1100 },
        'fetch-child': { attribute: 'fetch-child', navigationPropertyID: 1100 },
        'template-ids': { value: '', attribute: 'template-ids', navigationPropertyID: 1100 },
        'number-of-pieces': { value: '0', attribute: 'number-of-pieces', navigationPropertyID: 1100 },
        'recurse-child-section': { value: 'no', attribute: 'recurse-child-section', navigationPropertyID: 1100 },
        'search-upwards': { value: 'no', attribute: 'search-upwards', navigationPropertyID: 1100 },
        'more-link': { value: 'no', attribute: 'more-link', navigationPropertyID: 1100 },
        'more-link-text': { attribute: 'more-link-text', navigationPropertyID: 1100 },
        'levels-to-recurse': { attribute: 'levels-to-recurse', navigationPropertyID: 1100 },
        'show-name-when-hidden': { value: 'no', attribute: 'show-name-when-hidden', navigationPropertyID: 1100 },
      },
    };

    it('creates with current fetch method and derives relatedcontent-type', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rcCurrentResponse);

      await resource.create({
        type: 'related-content', name: 'RC',
        properties: { fetchMethod: 'current', title: 'Related' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.isCachingEnabled).toBe(true);
      const props = body.properties as Record<string, { value?: string }>;
      expect(props['fetch-method'].value).toBe('fetch-method-current');
      expect(props['relatedcontent-type'].value).toBe('rc');
      expect(props['section'].value).toBe('0');
    });

    it('creates with section fetch method', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/235/en') return { id: 235 };
        if (opts.method === 'POST') return rcCurrentResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'related-content', name: 'RC',
        properties: { fetchMethod: 'section', section: 235 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value?: string }> } }).body.properties;
      expect(props['fetch-method'].value).toBe('fetch-method-section');
      expect(props['relatedcontent-type'].value).toBe('rcb');
      expect(props['section'].value).toBe('235');
    });

    it('creates with child fetch method and validates contentTypeIds', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.method === 'POST') return rcCurrentResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'related-content', name: 'RC',
        properties: { fetchMethod: 'child', contentTypeIds: [67], childSectionName: 'News', display: 5 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value?: string }> } }).body.properties;
      expect(props['fetch-method'].value).toBe('fetch-method-child');
      expect(props['relatedcontent-type'].value).toBe('rcbl');
      expect(props['template-ids'].value).toBe('67');
      expect(props['number-of-pieces'].value).toBe('5');
    });

    it('throws if section missing for section method', async () => {
      await expect(resource.create({
        type: 'related-content', name: 'RC',
        properties: { fetchMethod: 'section' },
      })).rejects.toThrow('section is required when fetchMethod is "section"');
    });

    it('throws if contentTypeIds missing for child method', async () => {
      await expect(resource.create({
        type: 'related-content', name: 'RC',
        properties: { fetchMethod: 'child' },
      })).rejects.toThrow('contentTypeIds is required when fetchMethod is "child"');
    });

    it('transforms properties on read for current method', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rcCurrentResponse);

      const nav = await resource.get(1100);
      expect(nav.properties.fetchMethod).toBe('current');
      expect(nav.properties.title).toBe('Related');
      // Hidden deprecated fields
      expect(nav.properties).not.toHaveProperty('searchUpwards');
      expect(nav.properties).not.toHaveProperty('moreLink');
      expect(nav.properties).not.toHaveProperty('showNameWhenHidden');
      // Child-only fields hidden for current
      expect(nav.properties).not.toHaveProperty('section');
      expect(nav.properties).not.toHaveProperty('contentTypeIds');
      expect(nav.properties).not.toHaveProperty('display');
    });

    it('transforms properties on read for child method', async () => {
      const rcChildResponse = {
        ...rcCurrentResponse,
        properties: {
          ...rcCurrentResponse.properties,
          'fetch-method': { value: 'fetch-method-child', attribute: 'fetch-method', navigationPropertyID: 1100 },
          'fetch-child': { value: 'News', attribute: 'fetch-child', navigationPropertyID: 1100 },
          'template-ids': { value: '67,363', attribute: 'template-ids', navigationPropertyID: 1100 },
          'number-of-pieces': { value: '5', attribute: 'number-of-pieces', navigationPropertyID: 1100 },
          'recurse-child-section': { value: 'yes', attribute: 'recurse-child-section', navigationPropertyID: 1100 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(rcChildResponse);

      const nav = await resource.get(1100);
      expect(nav.properties.fetchMethod).toBe('child');
      expect(nav.properties.childSectionName).toBe('News');
      expect(nav.properties.contentTypeIds).toEqual([67, 363]);
      expect(nav.properties.display).toBe(5);
      expect(nav.properties.recurseChildSection).toBe(true);
    });
  });

  describe('create() — link-menu', () => {
    const linkMenuResponse = {
      id: 1200, name: 'Link Menu', description: '',
      navigationType: 'linkmenu', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'menutype': { value: 'branch', attribute: 'menutype', navigationPropertyID: 1200 },
        'menu-display-type': { value: 'menu-display-normal', attribute: 'menu-display-type', navigationPropertyID: 1200 },
        'level': { value: '2', attribute: 'level', navigationPropertyID: 1200 },
        'numtorecurse': { value: '3', attribute: 'numtorecurse', navigationPropertyID: 1200 },
        'link-display-type': { value: 'link-display-ul', attribute: 'link-display-type', navigationPropertyID: 1200 },
        'show-non-current-children': { value: 'yes', attribute: 'show-non-current-children', navigationPropertyID: 1200 },
        'class_current_branch': { value: 'yes', attribute: 'class_current_branch', navigationPropertyID: 1200 },
        'make-section-link': { value: 'no', attribute: 'make-section-link', navigationPropertyID: 1200 },
        'title-prepend-sect': { value: 'no', attribute: 'title-prepend-sect', navigationPropertyID: 1200 },
        'display-specific-branch': { value: 'no', attribute: 'display-specific-branch', navigationPropertyID: 1200 },
        'specific-branch-id': { value: '0', attribute: 'specific-branch-id', navigationPropertyID: 1200 },
        'sib-if-no-children': { value: 'no', attribute: 'sib-if-no-children', navigationPropertyID: 1200 },
        'anc-if-no-children': { value: 'no', attribute: 'anc-if-no-children', navigationPropertyID: 1200 },
        'title': { value: 'Nav', attribute: 'title', navigationPropertyID: 1200 },
        'before-menu-html': { value: '<ul>', attribute: 'before-menu-html', navigationPropertyID: 1200 },
        'after-menu-html': { value: '</ul>', attribute: 'after-menu-html', navigationPropertyID: 1200 },
        'before-html': { value: '<li>', attribute: 'before-html', navigationPropertyID: 1200 },
        'after-html': { value: '</li>', attribute: 'after-html', navigationPropertyID: 1200 },
        'between-link': { value: '', attribute: 'between-link', navigationPropertyID: 1200 },
      },
    };

    it('creates branch-at-level with level and numToRecurse', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(linkMenuResponse);

      await resource.create({
        type: 'link-menu', name: 'Nav',
        properties: { menuType: 'branch-at-level', level: 2, numToRecurse: 3 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['menutype'].value).toBe('branch');
      expect(props['level'].value).toBe('2');
      expect(props['numtorecurse'].value).toBe('3');
      expect(props['link-display-type'].value).toBe('link-display-ul');
    });

    it('creates children with specific branch validation', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { id: 233 };
        if (opts.method === 'POST') return linkMenuResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'link-menu', name: 'Nav',
        properties: { menuType: 'children', displaySpecificBranch: true, specificBranchId: 233 },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['menutype'].value).toBe('children');
      expect(props['display-specific-branch'].value).toBe('yes');
      expect(props['specific-branch-id'].value).toBe('233');
    });

    it('throws if level set without branch-at-level', async () => {
      await expect(resource.create({
        type: 'link-menu', name: 'Nav',
        properties: { menuType: 'children', level: 3 },
      })).rejects.toThrow('level can only be set when menuType is "branch-at-level"');
    });

    it('throws if displaySpecificBranch set without children', async () => {
      await expect(resource.create({
        type: 'link-menu', name: 'Nav',
        properties: { menuType: 'siblings', displaySpecificBranch: true },
      })).rejects.toThrow('displaySpecificBranch can only be set when menuType is "children"');
    });

    it('throws if subNavigationType set without valid context', async () => {
      await expect(resource.create({
        type: 'link-menu', name: 'Nav',
        properties: { menuType: 'siblings', subNavigationType: 'div' },
      })).rejects.toThrow('subNavigationType can only be set when');
    });

    it('transforms branch-at-level properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(linkMenuResponse);

      const nav = await resource.get(1200);
      expect(nav.properties.menuType).toBe('branch-at-level');
      expect(nav.properties.level).toBe(2);
      expect(nav.properties.numToRecurse).toBe(3);
      expect(nav.properties.subNavigationType).toBe('ul');
      expect(nav.properties.showNonCurrentChildren).toBe(true);
      expect(nav.properties.useCurrentBranchClass).toBe(true);
      expect(nav.properties.title).toBe('Nav');
      expect(nav.properties.beforeLinkHtml).toBe('<li>');
      expect(nav.properties.afterLinkHtml).toBe('</li>');
      // Children-only fields hidden
      expect(nav.properties).not.toHaveProperty('displaySpecificBranch');
      expect(nav.properties).not.toHaveProperty('showSiblingsIfNoChildren');
      expect(nav.properties).not.toHaveProperty('showAncestorsIfNoChildren');
    });

    it('transforms children properties on read', async () => {
      const childrenResponse = {
        ...linkMenuResponse,
        properties: {
          ...linkMenuResponse.properties,
          'menutype': { value: 'children', attribute: 'menutype', navigationPropertyID: 1200 },
          'display-specific-branch': { value: 'yes', attribute: 'display-specific-branch', navigationPropertyID: 1200 },
          'specific-branch-id': { value: '233', attribute: 'specific-branch-id', navigationPropertyID: 1200 },
          'sib-if-no-children': { value: 'yes', attribute: 'sib-if-no-children', navigationPropertyID: 1200 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(childrenResponse);

      const nav = await resource.get(1200);
      expect(nav.properties.menuType).toBe('children');
      expect(nav.properties.displaySpecificBranch).toBe(true);
      expect(nav.properties.specificBranchId).toBe(233);
      expect(nav.properties.showSiblingsIfNoChildren).toBe(true);
      // Branch-only fields hidden
      expect(nav.properties).not.toHaveProperty('level');
      expect(nav.properties).not.toHaveProperty('numToRecurse');
    });
  });

  describe('create() — publish-to-one-file', () => {
    const pofResponse = {
      id: 1300, name: 'POF', description: '',
      navigationType: 'publishonefile', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: false,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'template-list': { value: '38', attribute: 'template-list', navigationPropertyID: 1300 },
        'content-type-section': { value: 'no', attribute: 'content-type-section', navigationPropertyID: 1300 },
        'start-section-element': { value: '', attribute: 'start-section-element', navigationPropertyID: 1300 },
        'show-hidden-sections': { value: 'yes', attribute: 'show-hidden-sections', navigationPropertyID: 1300 },
        'levels-to-recurse': { value: '10', attribute: 'levels-to-recurse', navigationPropertyID: 1300 },
        'before-html': { value: '<div>', attribute: 'before-html', navigationPropertyID: 1300 },
        'after-html': { value: '</div>', attribute: 'after-html', navigationPropertyID: 1300 },
        'show-section-name': { value: 'yes', attribute: 'show-section-name', navigationPropertyID: 1300 },
        'show-name-for-hidden': { value: 'yes', attribute: 'show-name-for-hidden', navigationPropertyID: 1300 },
        'before-section-name': { value: '<h3>', attribute: 'before-section-name', navigationPropertyID: 1300 },
        'after-section-name': { value: '</h3>', attribute: 'after-section-name', navigationPropertyID: 1300 },
        'surrounding-style': { value: '344', attribute: 'surrounding-style', navigationPropertyID: 1300 },
        'use-alt-formatter': { value: 'yes', attribute: 'use-alt-formatter', navigationPropertyID: 1300 },
        'alt-formatter-type': { value: 'text/foo', attribute: 'alt-formatter-type', navigationPropertyID: 1300 },
        'enable-caching': { value: 'yes', attribute: 'enable-caching', navigationPropertyID: 1300 },
        'pagination-across-pages': { value: 'yes', attribute: 'pagination-across-pages', navigationPropertyID: 1300 },
        'content-per-page': { value: '10', attribute: 'content-per-page', navigationPropertyID: 1300 },
        'before-pagination-html': { value: '<nav>', attribute: 'before-pagination-html', navigationPropertyID: 1300 },
        'between-pagination-html': { value: '|', attribute: 'between-pagination-html', navigationPropertyID: 1300 },
        'after-pagination-html': { value: '</nav>', attribute: 'after-pagination-html', navigationPropertyID: 1300 },
        'start-section': { value: '7725', attribute: 'start-section', navigationPropertyID: 1300 },
      },
    };

    it('creates with specific section and all options enabled', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/contenttype/38') return { id: 38 };
        if (opts.path === '/hierarchy/7725/en') return { id: 7725 };
        if (opts.path === '/pageLayout/344') return { id: 344 };
        if (opts.method === 'POST') return pofResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'publish-to-one-file', name: 'POF',
        properties: {
          contentTypeId: 38,
          startSection: 'specific',
          section: 7725,
          showHiddenSections: true,
          levelsToRecurse: 10,
          showSectionName: true,
          showNameForHidden: true,
          beforeSectionName: '<h3>',
          afterSectionName: '</h3>',
          surroundingPageLayout: 344,
          altLayoutName: 'text/foo',
          pagination: true,
          contentPerPage: 10,
          beforePaginationHtml: '<nav>',
          betweenPaginationHtml: '|',
          afterPaginationHtml: '</nav>',
        },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['start-section'].value).toBe('7725');
      expect(props['content-type-section'].value).toBe('no');
      expect(props['show-section-name'].value).toBe('yes');
      expect(props['pagination-across-pages'].value).toBe('yes');
      expect(props['surrounding-style'].value).toBe('344');
    });

    it('creates with element mode', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(pofResponse);

      await resource.create({
        type: 'publish-to-one-file', name: 'POF',
        properties: { startSection: 'element', startSectionElement: 'Find Section' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['content-type-section'].value).toBe('yes');
      expect(props['start-section-element'].value).toBe('Find Section');
      expect(props['start-section'].value).toBe('0');
    });

    it('throws if section set without specific mode', async () => {
      await expect(resource.create({
        type: 'publish-to-one-file', name: 'POF',
        properties: { startSection: 'current', section: 123 },
      })).rejects.toThrow('section can only be set when startSection is "specific"');
    });

    it('throws if section missing for specific mode', async () => {
      await expect(resource.create({
        type: 'publish-to-one-file', name: 'POF',
        properties: { startSection: 'specific' },
      })).rejects.toThrow('section is required when startSection is "specific"');
    });

    it('throws if showNameForHidden set without showSectionName', async () => {
      await expect(resource.create({
        type: 'publish-to-one-file', name: 'POF',
        properties: { showNameForHidden: true },
      })).rejects.toThrow('showNameForHidden can only be set when showSectionName is true');
    });

    it('throws if contentPerPage set without pagination', async () => {
      await expect(resource.create({
        type: 'publish-to-one-file', name: 'POF',
        properties: { contentPerPage: 10 },
      })).rejects.toThrow('contentPerPage can only be set when pagination is true');
    });

    it('transforms properties on read with conditional visibility', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(pofResponse);

      const nav = await resource.get(1300);
      expect(nav.properties.contentTypeId).toBe(38);
      expect(nav.properties.startSection).toBe('specific');
      expect(nav.properties.section).toBe(7725);
      expect(nav.properties.showSectionName).toBe(true);
      expect(nav.properties.showNameForHidden).toBe(true);
      expect(nav.properties.beforeSectionName).toBe('<h3>');
      expect(nav.properties.surroundingPageLayout).toBe(344);
      expect(nav.properties.altLayoutName).toBe('text/foo');
      expect(nav.properties.pagination).toBe(true);
      expect(nav.properties.contentPerPage).toBe(10);
      expect(nav.properties.enableCaching).toBe(true);
      // Hidden internal fields
      expect(nav.properties).not.toHaveProperty('useAltFormatter');
      expect(nav.properties).not.toHaveProperty('contentTypeSection');
    });

    it('hides pagination fields when disabled on read', async () => {
      const noPagResponse = { ...pofResponse, properties: { ...pofResponse.properties, 'pagination-across-pages': { value: 'no', attribute: 'pagination-across-pages', navigationPropertyID: 1300 } } };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(noPagResponse);

      const nav = await resource.get(1300);
      expect(nav.properties.pagination).toBe(false);
      expect(nav.properties).not.toHaveProperty('contentPerPage');
      expect(nav.properties).not.toHaveProperty('beforePaginationHtml');
    });

    it('hides section name fields when disabled on read', async () => {
      const noNameResponse = { ...pofResponse, properties: { ...pofResponse.properties, 'show-section-name': { value: 'no', attribute: 'show-section-name', navigationPropertyID: 1300 } } };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(noNameResponse);

      const nav = await resource.get(1300);
      expect(nav.properties.showSectionName).toBe(false);
      expect(nav.properties).not.toHaveProperty('showNameForHidden');
      expect(nav.properties).not.toHaveProperty('beforeSectionName');
    });
  });

  describe('create() — top-content', () => {
    const topContentResponse = {
      id: 1400, name: 'Top Content', description: '',
      navigationType: 'topcontent', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: true,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'fetch-method': { value: 'fetch-method-section', attribute: 'fetch-method', navigationPropertyID: 1400 },
        'section': { value: '237', attribute: 'section', navigationPropertyID: 1400 },
        'template-ids': { value: '67,151', attribute: 'template-ids', navigationPropertyID: 1400 },
        'channel-id': { value: '5', attribute: 'channel-id', navigationPropertyID: 1400 },
        'upcoming-content': { value: 'yes', attribute: 'upcoming-content', navigationPropertyID: 1400 },
        'pub-element': { value: 'Date released', attribute: 'pub-element', navigationPropertyID: 1400 },
        'date_ordered_content': { value: 'no', attribute: 'date_ordered_content', navigationPropertyID: 1400 },
        'number-of-pieces': { value: '5', attribute: 'number-of-pieces', navigationPropertyID: 1400 },
        'starting-content': { value: '10', attribute: 'starting-content', navigationPropertyID: 1400 },
        'use-alt-formatter': { value: 'yes', attribute: 'use-alt-formatter', navigationPropertyID: 1400 },
        'alt-formatter-type': { value: 'text/foo', attribute: 'alt-formatter-type', navigationPropertyID: 1400 },
        'title': { value: 'Title', attribute: 'title', navigationPropertyID: 1400 },
        'before-html': { value: '<ul>', attribute: 'before-html', navigationPropertyID: 1400 },
        'after-html': { value: '</ul>', attribute: 'after-html', navigationPropertyID: 1400 },
      },
    };

    it('creates with section fetch method and full options', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/237/en') return { id: 237 };
        if (opts.path === '/contenttype/67') return { id: 67 };
        if (opts.path === '/contenttype/151') return { id: 151 };
        if (opts.path === '/channel/5') return { id: 5 };
        if (opts.method === 'POST') return topContentResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'top-content', name: 'Top Content',
        properties: {
          fetchMethod: 'section',
          section: 237,
          contentTypeIds: [67, 151],
          channelId: 5,
          upcomingContent: true,
          dateElement: 'Date released',
          numToDisplay: 5,
          startAt: 10,
          altLayoutName: 'text/foo',
        },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.isCachingEnabled).toBe(true);
      const props = body.properties as Record<string, { value: string }>;
      expect(props['fetch-method'].value).toBe('fetch-method-section');
      expect(props['section'].value).toBe('237');
      expect(props['template-ids'].value).toBe('67,151');
      expect(props['channel-id'].value).toBe('5');
      expect(props['upcoming-content'].value).toBe('yes');
      expect(props['use-alt-formatter'].value).toBe('yes');
    });

    it('creates with current fetch method (section = 0)', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(topContentResponse);

      await resource.create({
        type: 'top-content', name: 'TC',
        properties: { fetchMethod: 'current' },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const props = (postCall![0] as { body: { properties: Record<string, { value: string }> } }).body.properties;
      expect(props['fetch-method'].value).toBe('fetch-method-current');
      expect(props['section'].value).toBe('0');
    });

    it('throws if section missing for branch method', async () => {
      await expect(resource.create({
        type: 'top-content', name: 'TC',
        properties: { fetchMethod: 'branch' },
      })).rejects.toThrow('section is required when fetchMethod is "branch"');
    });

    it('throws if section set for current method', async () => {
      await expect(resource.create({
        type: 'top-content', name: 'TC',
        properties: { fetchMethod: 'current', section: 123 },
      })).rejects.toThrow('section can only be set when fetchMethod is "branch" or "section"');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(topContentResponse);

      const nav = await resource.get(1400);
      expect(nav.properties.fetchMethod).toBe('section');
      expect(nav.properties.section).toBe(237);
      expect(nav.properties.contentTypeIds).toEqual([67, 151]);
      expect(nav.properties.channelId).toBe(5);
      expect(nav.properties.upcomingContent).toBe(true);
      expect(nav.properties.dateElement).toBe('Date released');
      expect(nav.properties.ignoreDateOrdering).toBe(false);
      expect(nav.properties.numToDisplay).toBe(5);
      expect(nav.properties.startAt).toBe(10);
      expect(nav.properties.altLayoutName).toBe('text/foo');
      expect(nav.properties.title).toBe('Title');
      // Hidden
      expect(nav.properties).not.toHaveProperty('useAltFormatter');
    });

    it('hides section on read when fetch method is current', async () => {
      const currentResponse = {
        ...topContentResponse,
        properties: {
          ...topContentResponse.properties,
          'fetch-method': { value: 'fetch-method-current', attribute: 'fetch-method', navigationPropertyID: 1400 },
          'section': { value: '0', attribute: 'section', navigationPropertyID: 1400 },
        },
      };
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(currentResponse);

      const nav = await resource.get(1400);
      expect(nav.properties.fetchMethod).toBe('current');
      expect(nav.properties).not.toHaveProperty('section');
    });
  });

  describe('create() — keyword-search', () => {
    const kwResponse = {
      id: 1500, name: 'KW Search', description: '',
      navigationType: 'keyword', isEnabled: true, isPreviewModeEnabled: true, isCachingEnabled: true,
      isXHTMLCompliant: false, fullAccess: false, editable: false,
      sharedGroupCount: 0, sharedGroups: [], primaryGroup: { id: 0, name: '' },
      properties: {
        'fetch-method': { value: 'fetch-method-section', attribute: 'fetch-method', navigationPropertyID: 1500 },
        'narrow-on-fulltext': { value: 'yes', attribute: 'narrow-on-fulltext', navigationPropertyID: 1500 },
        'template-list-get': { value: '343', attribute: 'template-list-get', navigationPropertyID: 1500 },
        'template-element-get': { value: 'Cascading List,Keyword Selector', attribute: 'template-element-get', navigationPropertyID: 1500 },
        'search-fetch-method': { value: 'fetch-method-section', attribute: 'search-fetch-method', navigationPropertyID: 1500 },
        'section': { value: '233', attribute: 'section', navigationPropertyID: 1500 },
        'search-section': { value: '7805', attribute: 'search-section', navigationPropertyID: 1500 },
        'template-element-for-search-section': { value: '', attribute: 'template-element-for-search-section', navigationPropertyID: 1500 },
        'level': { value: '0', attribute: 'level', navigationPropertyID: 1500 },
        'num-to-recurse': { value: '0', attribute: 'num-to-recurse', navigationPropertyID: 1500 },
        'template-list-search': { value: '67', attribute: 'template-list-search', navigationPropertyID: 1500 },
        'template-element-search': { value: 'Finditems', attribute: 'template-element-search', navigationPropertyID: 1500 },
        'number-of-pieces': { value: '10', attribute: 'number-of-pieces', navigationPropertyID: 1500 },
        'order-by': { value: 'order-name', attribute: 'order-by', navigationPropertyID: 1500 },
        'order-by-date-element': { value: 'no', attribute: 'order-by-date-element', navigationPropertyID: 1500 },
        'order-by-date-element-name': { value: '', attribute: 'order-by-date-element-name', navigationPropertyID: 1500 },
        'show-upcoming-content': { value: 'no', attribute: 'show-upcoming-content', navigationPropertyID: 1500 },
        'show-hidden-sections': { value: 'yes', attribute: 'show-hidden-sections', navigationPropertyID: 1500 },
        'match-composite-keywords': { value: 'yes', attribute: 'match-composite-keywords', navigationPropertyID: 1500 },
        'match-sub-items': { value: 'yes', attribute: 'match-sub-items', navigationPropertyID: 1500 },
        'cross-language-searching-enabled': { value: 'yes', attribute: 'cross-language-searching-enabled', navigationPropertyID: 1500 },
        'cross-language-searching-languages': { value: 'en,es', attribute: 'cross-language-searching-languages', navigationPropertyID: 1500 },
        'use-alt-formatter': { value: 'yes', attribute: 'use-alt-formatter', navigationPropertyID: 1500 },
        'alt-formatter-type': { value: 'text/bar', attribute: 'alt-formatter-type', navigationPropertyID: 1500 },
        'before-html': { value: '<div>', attribute: 'before-html', navigationPropertyID: 1500 },
        'after-html': { value: '</div>', attribute: 'after-html', navigationPropertyID: 1500 },
        'pagination-enabled': { value: 'yes', attribute: 'pagination-enabled', navigationPropertyID: 1500 },
        'content-per-page': { value: '20', attribute: 'content-per-page', navigationPropertyID: 1500 },
        'before-pagination-html': { value: '<nav>', attribute: 'before-pagination-html', navigationPropertyID: 1500 },
        'between-pagination-html': { value: '|', attribute: 'between-pagination-html', navigationPropertyID: 1500 },
        'after-pagination-html': { value: '</nav>', attribute: 'after-pagination-html', navigationPropertyID: 1500 },
      },
    };

    it('creates with full options', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path === '/hierarchy/233/en') return { id: 233 };
        if (opts.path === '/hierarchy/7805/en') return { id: 7805 };
        if (opts.path === '/contenttype/343') return { id: 343, contentTypeElements: [{ name: 'Cascading List', alias: 'Cascading List' }, { name: 'Keyword Selector', alias: 'Keyword Selector' }] };
        if (opts.path === '/contenttype/67') return { id: 67, contentTypeElements: [{ name: 'Finditems', alias: 'Finditems' }] };
        if (opts.method === 'POST') return kwResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'keyword-search', name: 'KW Search',
        properties: {
          keywordFetchMethod: 'section',
          keywordSection: 233,
          narrowToSingleContentItem: true,
          keywordContentTypeId: 343,
          keywordElements: ['Cascading List', 'Keyword Selector'],
          contentFetchMethod: 'section',
          searchSection: 7805,
          searchContentTypeId: 67,
          searchElements: ['Finditems'],
          numToDisplay: 10,
          showHiddenSections: true,
          matchCompositeKeywords: true,
          matchSubItems: true,
          crossLanguageSearch: true,
          crossLanguageLanguages: ['en', 'es'],
          altLayoutName: 'text/bar',
          pagination: true,
          contentPerPage: 20,
        },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body.isCachingEnabled).toBe(true);
      const props = body.properties as Record<string, { value: string }>;
      expect(props['fetch-method'].value).toBe('fetch-method-section');
      expect(props['section'].value).toBe('233');
      expect(props['template-list-get'].value).toBe('343');
      expect(props['template-element-get'].value).toBe('Cascading List,Keyword Selector');
      expect(props['search-fetch-method'].value).toBe('fetch-method-section');
      expect(props['search-section'].value).toBe('7805');
      expect(props['template-list-search'].value).toBe('67');
      expect(props['template-element-search'].value).toBe('Finditems');
      expect(props['pagination-enabled'].value).toBe('yes');
    });

    it('includes search-content-element-name at top level when searchSectionElement is set', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.path.startsWith('/contenttype/')) return { id: 343, contentTypeElements: [{ name: 'FindItems', alias: 'FindItems', type: 14 }] };
        if (opts.path === '/type/') return ELEMENT_TYPES;
        if (opts.method === 'POST') return kwResponse;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      await resource.create({
        type: 'keyword-search', name: 'KW',
        properties: {
          contentFetchMethod: 'section',
          searchSectionElement: 'FindItems',
          keywordContentTypeId: 343,
        },
      });

      const postCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'POST',
      );
      const body = (postCall![0] as { body: Record<string, unknown> }).body;
      expect(body['search-content-element-name']).toBe('FindItems');
    });

    it('throws if keywordSection missing for section fetch method', async () => {
      await expect(resource.create({
        type: 'keyword-search', name: 'KW',
        properties: { keywordFetchMethod: 'section', contentFetchMethod: 'section', searchSection: 1 },
      })).rejects.toThrow('keywordSection is required');
    });

    it('throws if neither searchSection nor searchSectionElement for content section/branch', async () => {
      await expect(resource.create({
        type: 'keyword-search', name: 'KW',
        properties: { contentFetchMethod: 'section' },
      })).rejects.toThrow('searchSection or searchSectionElement is required');
    });

    it('throws if both searchSection and searchSectionElement set', async () => {
      await expect(resource.create({
        type: 'keyword-search', name: 'KW',
        properties: { contentFetchMethod: 'section', searchSection: 1, searchSectionElement: 'Foo' },
      })).rejects.toThrow('Cannot set both searchSection and searchSectionElement');
    });

    it('transforms properties on read', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockResolvedValue(kwResponse);

      const nav = await resource.get(1500);
      expect(nav.properties.keywordFetchMethod).toBe('section');
      expect(nav.properties.keywordSection).toBe(233);
      expect(nav.properties.narrowToSingleContentItem).toBe(true);
      expect(nav.properties.keywordContentTypeId).toBe(343);
      expect(nav.properties.keywordElements).toEqual(['Cascading List', 'Keyword Selector']);
      expect(nav.properties.contentFetchMethod).toBe('section');
      expect(nav.properties.searchSection).toBe(7805);
      expect(nav.properties.searchContentTypeId).toBe(67);
      expect(nav.properties.searchElements).toEqual(['Finditems']);
      expect(nav.properties.numToDisplay).toBe(10);
      expect(nav.properties.showHiddenSections).toBe(true);
      expect(nav.properties.matchCompositeKeywords).toBe(true);
      expect(nav.properties.crossLanguageSearch).toBe(true);
      expect(nav.properties.crossLanguageLanguages).toEqual(['en', 'es']);
      expect(nav.properties.altLayoutName).toBe('text/bar');
      expect(nav.properties.pagination).toBe(true);
      expect(nav.properties.contentPerPage).toBe(20);
      // Hidden
      expect(nav.properties).not.toHaveProperty('useAltFormatter');
      expect(nav.properties).not.toHaveProperty('paginationEnabled');
    });
  });

  describe('NavigationObject.save()', () => {
    it('sends PUT with updated shared fields', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/navigation/181') return rawA2zDetail;
        if (opts.method === 'PUT' && opts.path === '/navigation/181') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const nav = await resource.get(181);
      nav.name = 'Renamed';
      nav.enabled = false;
      nav.cachingEnabled = true;
      await nav.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      const body = (putCall![0] as { body: Record<string, unknown> }).body;
      expect(body.name).toBe('Renamed');
      expect(body.isEnabled).toBe(false);
      expect(body.isCachingEnabled).toBe(true);
    });

    it('converts camelCase properties back to original keys', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/navigation/181') return rawA2zDetail;
        if (opts.method === 'PUT' && opts.path === '/navigation/181') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const nav = await resource.get(181);
      nav.properties.beforeMenu = '<ol>';
      nav.properties.startLevel = 2;
      await nav.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: { properties: Record<string, { value: string; attribute: string }> } }).body;
      expect(body.properties['before_menu'].value).toBe('<ol>');
      expect(body.properties['before_menu'].attribute).toBe('before_menu');
      expect(body.properties['start_level'].value).toBe('2');
    });

    it('preserves full raw structure in the PUT body', async () => {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/navigation/181') return rawA2zDetail;
        if (opts.method === 'PUT' && opts.path === '/navigation/181') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });

      const nav = await resource.get(181);
      await nav.save();

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      const body = (putCall![0] as { body: Record<string, unknown> }).body;
      // Should preserve fields from the raw response
      expect(body.navigationKey).toBe('a2z');
      expect(body.frontEndFileName).toBe('a2z');
      expect(body.isXHTMLCompliant).toBe(true);
    });
  });

  describe('update()', () => {
    function mockGetAndPut() {
      (http.request as ReturnType<typeof vi.fn>).mockImplementation(async (opts: { method: string; path: string }) => {
        if (opts.method === 'GET' && opts.path === '/navigation/181') return rawA2zDetail;
        if (opts.method === 'PUT' && opts.path === '/navigation/181') return undefined;
        throw new Error(`Unexpected: ${opts.method} ${opts.path}`);
      });
    }

    function putBody() {
      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect(putCall).toBeDefined();
      return (putCall![0] as { body: Record<string, unknown> }).body;
    }

    it('updates shared fields and returns the NavigationObject', async () => {
      mockGetAndPut();

      const nav = await resource.update(181, {
        name: 'Renamed via update',
        description: 'New description',
        enabled: false,
        previewEnabled: false,
        cachingEnabled: true,
      });

      expect(nav.id).toBe(181);
      expect(nav.name).toBe('Renamed via update');

      const body = putBody();
      expect(body.name).toBe('Renamed via update');
      expect(body.description).toBe('New description');
      expect(body.isEnabled).toBe(false);
      expect(body.isPreviewModeEnabled).toBe(false);
      expect(body.isCachingEnabled).toBe(true);
    });

    it('merges properties instead of replacing them', async () => {
      mockGetAndPut();

      await resource.update(181, { properties: { beforeMenu: '<ol>' } });

      const body = putBody() as unknown as { properties: Record<string, { value: string }> };
      // Changed
      expect(body.properties['before_menu'].value).toBe('<ol>');
      // Untouched properties are preserved
      expect(body.properties['after_menu'].value).toBe('</ul>');
      expect(body.properties['before_item'].value).toBe('<li>');
      expect(body.properties['section_meta_data_template'].value).toBe('Title');
    });

    it('leaves fields untouched when not provided', async () => {
      mockGetAndPut();

      await resource.update(181, { description: 'Only description changed' });

      const body = putBody();
      expect(body.name).toBe('A-Z Navigation Demo');
      expect(body.isEnabled).toBe(true);
      expect(body.description).toBe('Only description changed');
    });

    it('throws when name is set to an empty string', async () => {
      mockGetAndPut();

      await expect(resource.update(181, { name: '   ' }))
        .rejects.toThrow('name cannot be empty');
    });

    it('sends PUT to the correct path', async () => {
      mockGetAndPut();

      await resource.update(181, { enabled: false });

      const putCall = (http.request as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => (c[0] as { method: string }).method === 'PUT',
      );
      expect((putCall![0] as { path: string }).path).toBe('/navigation/181');
    });
  });
});
