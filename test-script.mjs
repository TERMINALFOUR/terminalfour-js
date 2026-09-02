import { T4Client, T4ApiError } from './dist/esm/index.js';

const t4 = new T4Client({
  baseUrl: process.env.T4_BASE_URL,
  apiToken: process.env.T4_API_TOKEN,
});

// ─── Dummy IDs — replace with real ones before running ───
const SECTION_ID = 8796;
const CHILD_SECTION_ID = 8448;
const CONTENT_ID = 11801;
const CONTENT_TYPE_ID = 512;
const CHILD_CONTENT_TYPE_ID = 67
const CHILD_CONTENT_TYPE_LAYOUT = 'text/html'
const CHANNEL_ID = 1;
const LIST_ID = 77;
const GROUP_ID = 44;
const USER_ID = 73;
const SECOND_USER_ID = 38;
const PAGE_LAYOUT_ID = 11798;
const MEDIA_ID = 10928;
const MEDIA_CATEGORY_ID = 354;

// ─── Helper to run a single test ───
async function run(label, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${label}`);
    if (result !== undefined) console.log(JSON.stringify(result, null, 2));
    return JSON.stringify(result);
  } catch (error) {
    if (error instanceof T4ApiError) {
      console.error(`❌ ${label} — API Error: ${error.statusCode} ${error.statusText}`);
      console.error(`   URL: ${error.requestMethod} ${error.requestUrl}`);
      console.error(`   Response: ${JSON.stringify(error.responseBody)}`);
    } else {
      console.error(`❌ ${label} — ${error.message}`);
    }
  }
}

// Uncomment the section you want to test, then run:
//   node --env-file=.env test-script.mjs


// ═══════════════════════════════════════════════════════════
// 1. SITE STRUCTURE
// ═══════════════════════════════════════════════════════════

// await run('siteStructure.tree', async () => {
//   return t4.siteStructure.tree();
// });

// ═══════════════════════════════════════════════════════════
// 2. SECTIONS (via SectionRef)
// ═══════════════════════════════════════════════════════════

// ── 2a. Get section details (mutable — can call .save()) ──
// await run('section.get', async () => {
//   const section = await t4.section(SECTION_ID).get();
//   console.log('  name:', section.name);
//   console.log('  status:', section.status);
//   console.log('  show:', section.show);
//   console.log('  path:', section.path);
//   console.log('  outputUri:', section.outputUri);
//   console.log('  filename:', section.filename);
//   console.log('  archive:', section.archive);
//   console.log('  accessControl:', section.accessControl);
//   return section;
// });

// ── 2b. Save section (modify then save) ──
// await run('section.get + save', async () => {
//   const section = await t4.section(SECTION_ID).get();
//   section.name = 'Updated Section Name';
//   section.show = true;
//   section.outputUri = 'my-section';
//   section.filename = 'index';
//   await section.save();
//   return { saved: true };
// });

// ── 2c. Update section (one-shot) ──
// await run('section.update', async () => {
//   return t4.section(SECTION_ID).update({
//     name: 'Renamed Section',
//     show: true,
//     status: 'approved',
//   });
// });

// ── 2d. Section channels ──
// await run('section.channels', async () => {
//   return t4.section(SECTION_ID).channels();
// });

// ── 2e. Section page layouts ──
// await run('section.pageLayouts', async () => {
//   return t4.section(SECTION_ID).pageLayouts();
// });

// ── 2f. Set page layouts ──
// await run('section.setPageLayouts', async () => {
//   await t4.section(SECTION_ID).setPageLayouts([
//     { channelId: CHANNEL_ID, pageLayout: PAGE_LAYOUT_ID },
//     { channelId: CHANNEL_ID, childPageLayout: PAGE_LAYOUT_ID },
//   ]);
//   return { set: true };
// });

// ── 2g. Section owner ──
// await run('section.owner', async () => {
//   return t4.section(SECTION_ID).owner();
// });

// ── 2h. Section meta data ──
// await run('section.metaDatas', async () => {
//   return t4.section(SECTION_ID).metaDatas();
// });

// ── 2i. Set meta data ──
// await run('section.setMetaDatas', async () => {
//   await t4.section(SECTION_ID).setMetaDatas({
//     'description': 'My section description',
//     'keywords': 'test, example',
//   });
//   return { set: true };
// });

// ── 2j. Section tree ──
// await run('section.tree', async () => {
//   return t4.section(SECTION_ID).tree();
// });

// ── 2k. Subsections ──
// await run('section.subsections', async () => {
//   return t4.section(SECTION_ID).subsections();
// });

// ── 2l. Edit rights ──
// await run('section.editRights', async () => {
//   return t4.section(SECTION_ID).editRights();
// });

// ── 2m. Set edit rights ──
// await run('section.setEditRights', async () => {
//   await t4.section(SECTION_ID).setEditRights({
//     users: [USER_ID],
//     groups: [GROUP_ID],
//   });
//   return { set: true };
// });

// ── 2n. Remove edit rights ──
// await run('section.removeEditRights', async () => {
//   await t4.section(SECTION_ID).removeEditRights({
//     users: [USER_ID],
//     groups: [GROUP_ID],
//   });
//   return { removed: true };
// });

// ── 2o. Content types on section ──
// await run('section.contentTypes', async () => {
//   return t4.section(SECTION_ID).contentTypes();
// });

// ── 2p. Set content types on section ──
// await run('section.setContentTypes', async () => {
//   await t4.section(SECTION_ID).setContentTypes([
//     { id: CONTENT_TYPE_ID, scope: 'branch' },
//   ]);
//   return { set: true };
// });

// ── 2q. Remove content types from section ──
// await run('section.removeContentTypes', async () => {
//   await t4.section(SECTION_ID).removeContentTypes([CONTENT_TYPE_ID]);
//   return { removed: true };
// });

// ── 2r. Add child section ──
await run('section.addSection', async () => {
  return t4.section(SECTION_ID).addSection({
    name: 'New Child Section',
    show: true,
    status: 'approved',
  });
});

// ── 2s. Add child section with custom fields ──
// await run('section.addSection (with customFields)', async () => {
//   return t4.section(SECTION_ID).addSection({
//     name: 'Section With Metadata Test',
//     show: true,
//     status: 'approved',
//     customFields: {
//       'Title': 'My Section Title',
//     },
//   });
// });

// ── 2t. Delete section (soft — sets inactive) ──
// await run('section.delete', async () => {
//   await t4.section(CHILD_SECTION_ID).delete();
//   return { deleted: true };
// });

// ── 2u. Purge section (permanent — must be inactive first) ──
// await run('section.purge', async () => {
//   await t4.section(CHILD_SECTION_ID).purge();
//   return { purged: true };
// });

// ── 2u2. Move section under a new parent ──
// await run('section.move', async () => {
//   await t4.section(CHILD_SECTION_ID).move(SECTION_ID);
//   return { moved: true };
// });

// ── 2v. Publish section ──
// await run('section.publish', async () => {
//   await t4.section(SECTION_ID).publish();
//   return { published: true };
// });

// ── 2w. Publish section (explicit channel) ──
// await run('section.publish (with channel)', async () => {
//   await t4.section(SECTION_ID).publish({ channelId: CHANNEL_ID });
//   return { published: true };
// });

// ── 2x. Publish branch ──
// await run('section.publish (branch)', async () => {
//   await t4.section(SECTION_ID).publish({ branch: true });
//   return { published: true };
// });


// ═══════════════════════════════════════════════════════════
// 3. CONTENT (via section.content)
// ═══════════════════════════════════════════════════════════

// ── 3a. List content in section ──
// await run('content.list', async () => {
//   const items = await t4.section(SECTION_ID).content.list();
//   for (const item of items) {
//     console.log(`  [${item.id}] ${item.name} — ${item.status}`);
//   }
//   return items;
// });

// ── 3b. Get single content item (with resolved fields) ──
// await run('content.get', async () => {
//   const item = await t4.section(SECTION_ID).content.get(CONTENT_ID);
//   console.log('  name:', item.name);
//   console.log('  status:', item.status);
//   console.log('  contentTypeID:', item.contentTypeID);
//   console.log('  version:', item.version);
//   console.log('  lastModified:', item.lastModified);
//   console.log('  publishDate:', item.publishDate);
//   console.log('  expiryDate:', item.expiryDate);
//   console.log('  fields:', JSON.stringify(item.fields, null, 2));
//   return item;
// });

// ── 3c. Create content (plain text fields) ──
// await run('content.create (plain text)', async () => {
//   return t4.section(SECTION_ID).content.create({
//     type: CONTENT_TYPE_ID,
//     name: 'Test Content Item',
//     fields: {
//       'Example Element': 'Foo',
//     },
//     status: 'draft',
//   });
// });

// ── 3d. Create content with dates ──
// await run('content.create (with dates)', async () => {
//   return t4.section(SECTION_ID).content.create({
//     type: CONTENT_TYPE_ID,
//     name: 'Scheduled Content',
//     fields: {
//       'Example Element': 'Scheduled Post',
//     },
//     status: 'approved',
//     publishDate: new Date('2025-06-01'),
//     expiryDate: new Date('2025-12-31'),
//     reviewDate: new Date('2025-09-01'),
//     archiveSection: CHILD_SECTION_ID,
//   });
// });

// ── 3e. Create content with select box / checkbox / radio ──
// await run('content.create (list fields)', async () => {
//   return t4.section(SECTION_ID).content.create({
//     type: CONTENT_TYPE_ID,
//     name: 'Content With Lists',
//     fields: {
//       'Plain Text': 'List Test',
//       'HTML': '<p>This worked too :D</p>',
//       'Select Box': 'Large',                    // Select Box / Radio Button
//       'Radio Button': 'Small',
//       'Check Box': ['Large', 'Small'],           // Checkbox / Multiple Select
//       'Multiple Select': ['Large', 'Small'],  
//       'Multi-Select': ['Large', 'Small'],             // Multi-Select
//       'Date': new Date('2025-07-04'),       // Date element
//       'File': './tests/fixtures/example.txt',     // File element (path)
//       'Image': './tests/fixtures/happy.png',
//       'Media': MEDIA_ID,
//       'Cascading List': ['Soccer', 'Liverpool'],           // Cascading List
//       'Section/Content Link': {                            // Section/Content Link
//         sectionId: CHILD_SECTION_ID,
//         linkText: 'Click here',
//       },
//       'Whole Number': 42,                                 // Whole Number
//       'Decimal': 3.14,                               // Decimal
//       'Content Owner': 38,
//       'Keyword Selector': {                                 // Keyword Selector
//         or: ['Large', { and: ['Small', 'Other'] }],
//       },
//       'Repeater': [
//           { name: 'Slide 1', fields: { 'Heading': 'First Slide', 'Display items': ['yes'], 'Find items': { sectionId: CHILD_SECTION_ID }}},
//           { name: 'Slide 2', fields: { 'Heading': 'Second Slide', 'Display items': ['yes'], 'Find items': { sectionId: CHILD_SECTION_ID }}},
//       ]
//     },
//   });
// });


// ── 3k. Create content with inline media upload ──
// await run('content.create (inline media upload)', async () => {
//   return t4.section(SECTION_ID).content.create({
//     type: CONTENT_TYPE_ID,
//     name: 'Inline Media Content',
//     fields: {
//       'Title': 'Inline Media Test',
//       'Photo': {                                   // Media element (inline upload)
//         file: 'https://files.davelarkan.com/happy.png',
//         name: 'Uploaded Photo',
//         category: MEDIA_CATEGORY_ID,
//       },
//     },
//   });
// });



// ── 3p. Create content with group select ──
// await run('content.create (group select)', async () => {
//   return t4.section(SECTION_ID).content.create({
//     type: CONTENT_TYPE_ID,
//     name: 'Group Select Content',
//     fields: {
//       'Title': 'Group Test',
//       'Departments': [GROUP_ID, 501, 502],         // Group Select
//     },
//   });
// });


// ── 3s. Update content ──
// await run('content.update', async () => {
//   return t4.section(SECTION_ID).content.update(CONTENT_ID, {
//     name: 'Updated Content Name',
//     fields: {
//       'Plain Text': 'Updated Title',
//     },
//     status: 'approved',
//   });
// });

// ── 3t. Update content with dates ──
// await run('content.update (with dates)', async () => {
//   return t4.section(SECTION_ID).content.update(CONTENT_ID, {
//     publishDate: new Date('2025-07-01'),
//     expiryDate: null,                              // Clear expiry date
//     archiveSection: null,                          // Clear archive section
//   });
// });

// ── 3u. Content item save (mutable pattern) ──
// await run('contentItem.save', async () => {
//   const item = await t4.section(SECTION_ID).content.get(CONTENT_ID);
//   item.name = 'Saved via item.save()';
//   item.fields['Plain Text'] = 'Modified Title';
//   item.publishDate = new Date('2025-08-01');
//   await item.save();
//   return { saved: true, name: item.name, status: item.status };
// });

// ── 3v. Content item approve ──
// await run('contentItem.approve', async () => {
//   const item = await t4.section(SECTION_ID).content.get(CONTENT_ID);
//   await item.approve();
//   return { approved: true, status: item.status };
// });

// ── 3w. Delete content (soft) ──
// await run('content.delete', async () => {
//   await t4.section(SECTION_ID).content.delete(CONTENT_ID);
//   return { deleted: true };
// });

// ── 3x. Purge content (permanent) ──
// await run('content.purge', async () => {
//   await t4.section(SECTION_ID).content.purge(CONTENT_ID);
//   return { purged: true };
// });

// ── 3y. Move content to another section ──
// await run('contentItem.move', async () => {
//   const item = await t4.section(SECTION_ID).content.get(CONTENT_ID);
//   await item.move(CHILD_SECTION_ID);
//   return { moved: true };
// });

// ── 3z. Approve all pending content in section ──
// await run('content.approveAll', async () => {
//   const count = await t4.section(SECTION_ID).content.approveAll();
//   return { approved: count };
// });

// ── 3z2. Duplicate content in same section ──
// await run('contentItem.duplicate (same section)', async () => {
//   const item = await t4.section(SECTION_ID).content.get(CONTENT_ID);
//   await item.duplicate();
//   return { duplicated: true };
// });

// ── 3z3. Duplicate content to different section ──
// await run('contentItem.duplicate (different section)', async () => {
//   const item = await t4.section(SECTION_ID).content.get(CONTENT_ID);
//   await item.duplicate(CHILD_SECTION_ID);
//   return { duplicated: true };
// });


// ═══════════════════════════════════════════════════════════
// 4. CONTENT TYPES
// ═══════════════════════════════════════════════════════════

// ── 4a. List content types ──
// await run('contentTypes.list', async () => {
//   const types = await t4.contentTypes.list();
//   for (const ct of types) {
//     console.log(`  [${ct.id}] ${ct.name} — ${Object.keys(ct.fields).length} fields`);
//   }
//   return types;
// });

// ── 4b. Get single content type ──
// await run('contentTypes.get', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   console.log('  name:', ct.name);
//   console.log('  alias:', ct.alias);
//   console.log('  description:', ct.description);
//   console.log('  minUserLevel:', ct.minUserLevel);
//   console.log('  workflow:', ct.workflow);
//   console.log('  directEdit:', ct.directEdit);
//   console.log('  primaryGroup:', ct.primaryGroup);
//   console.log('  sharedGroups:', ct.sharedGroups);
//   console.log('  fields:');
//   for (const [name, field] of Object.entries(ct.fields)) {
//     console.log(`    ${name}: ${field.type} (required: ${field.required}, listId: ${field.listId}, listName: ${field.listName})`);
//     if (field.config) {
//       console.log(`      repeater → ${field.config.contentTypeName} (min: ${field.config.minRepeats}, max: ${field.config.maxRepeats})`);
//     }
//   }
//   return ct;
// });

// ── 4c. Create content type ──
// await run('contentTypes.create', async () => {
//   return t4.contentTypes.create({
//     name: 'SDK Test Type',
//     description: 'Created by test script',
//     elements: [
//       { name: 'Title', type: 'Plain Text', required: true, maxSize: 200 },
//       { name: 'Body', type: 'HTML', required: false },
//       { name: 'Summary', type: 'Plain Text', maxSize: 500 },
//     ],
//     minUserLevel: 'contributor',
//     directEdit: true,
//   });
// });

// ── 4d. Update content type (immutable) ──
// await run('contentTypes.update', async () => {
//   return t4.contentTypes.update(CONTENT_TYPE_ID, {
//     name: 'Renamed Content Type',
//     description: 'Updated description',
//     minUserLevel: 'moderator',
//     directEdit: false,
//   });
// });

// ── 4e. Content type save (mutable pattern) ──
// await run('contentType.save', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   ct.name = 'Saved Content Type';
//   ct.description = 'Modified via save()';
//   await ct.save();
//   return { saved: true };
// });

// ── 4f. Add field to content type ──
// await run('contentType.addField', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   await ct.addField({
//     name: 'New Field',
//     type: 'Plain Text',
//     description: 'Added by test script',
//     maxSize: 100,
//     required: false,
//     shown: true,
//   });
//   await ct.save();
//   return { added: true, fields: Object.keys(ct.fields) };
// });

// ── 4f2. Add repeater field to content type ──
// await run('contentType.addField (repeater)', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   await ct.addField({
//     name: 'Slides',
//     type: 'Repeater',
//     repeater: {
//       contentTypeId: CHILD_CONTENT_TYPE_ID,        // ID of the sub-content-type that defines repeater fields
//       layout: CHILD_CONTENT_TYPE_LAYOUT,      // content layout to use
//       minRepeats: 1,
//       maxRepeats: 10,
//     },
//   });
//   await ct.save();
//   console.log('  config:', ct.fields['Slides'].config);
//   return { added: true, fields: Object.keys(ct.fields) };
// });

// ── 4f3. Create content type with repeater element (atomic) ──
// await run('contentTypes.create (with repeater)', async () => {
//   return t4.contentTypes.create({
//     name: 'SDK Repeater Test',
//     description: 'Tests atomic creation with a repeater element',
//     elements: [
//       { name: 'Title', type: 'Plain Text', required: true, maxSize: 200 },
//       {
//         name: 'Slides',
//         type: 'Repeater',
//         repeater: {
//           contentTypeId: CHILD_CONTENT_TYPE_ID,
//           layout: CHILD_CONTENT_TYPE_LAYOUT,
//           minRepeats: 1,
//           maxRepeats: 10,
//         },
//       },
//     ],
//   });
// });

// // ── 4f4. Add repeater field via update() (immutable pattern) ──
// await run('contentTypes.update (addFields with repeater)', async () => {
//   return t4.contentTypes.update(CONTENT_TYPE_ID, {
//     addFields: [{
//       name: 'Slides',
//       type: 'Repeater',
//       repeater: {
//         contentTypeId: CHILD_CONTENT_TYPE_ID,
//         layout: CHILD_CONTENT_TYPE_LAYOUT,
//         minRepeats: 1,
//         maxRepeats: 10,
//       },
//     }],
//   });
// });

// ── 4g. Remove field from content type ──
// await run('contentType.removeField', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   ct.removeField('New Field');
//   await ct.save();
//   return { removed: true, fields: Object.keys(ct.fields) };
// });

// ── 4h. Delete content type ──
// await run('contentTypes.delete', async () => {
//   await t4.contentTypes.delete(CONTENT_TYPE_ID);
//   return { deleted: true };
// });


// ═══════════════════════════════════════════════════════════
// 5. CONTENT LAYOUTS (on a content type)
// ═══════════════════════════════════════════════════════════

// ── 5a. List layouts ──
// await run('contentType.layouts.list', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   return ct.layouts.list();
// });

// ── 5b. Get layout ──
// await run('contentType.layouts.get', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   const layout = await ct.layouts.get('text/html');
//   console.log('  name:', layout.name);
//   console.log('  code:', layout.code.substring(0, 100) + '...');
//   console.log('  lastModified:', layout.lastModified);
//   return layout;
// });

// ── 5c. Create layout ──
// await run('contentType.layouts.create', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   return ct.layouts.create({
//     name: 'text/json',
//     code: '{ "title": "<t4 type=\'content\' name=\'Title\' />" }',
//     syntax: 'JavaScript',
//     extension: 'json',
//   });
// });

// ── 5d. Update layout (immutable) ──
// await run('contentType.layouts.update', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   return ct.layouts.update('text/json', {
//     name: 'text/json-v2',
//     code: '{ "title": "{{publish element="Title"}}" }',
//     processor: 'handlebars',
//   });
// });

// ── 5e. Layout save (mutable pattern) ──
// await run('layout.save', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   const layout = await ct.layouts.get('text/html');
//   layout.name = 'text/html-updated';
//   layout.code = '<div>{{Title}}</div>';
//   await layout.save();
//   return { saved: true };
// });

// ── 5f. Delete layout ──
// await run('contentType.layouts.delete', async () => {
//   const ct = await t4.contentTypes.get(CONTENT_TYPE_ID);
//   await ct.layouts.delete('text/json-v2');
//   return { deleted: true };
// });

// ═══════════════════════════════════════════════════════════
// 6. CHANNELS
// ═══════════════════════════════════════════════════════════

// ── 6a. List channels ──
// await run('channels.list', async () => {
//   const channels = await t4.channels.list();
//   for (const ch of channels) {
//     console.log(`  [${ch.id}] ${ch.name} — root: ${ch.rootSectionId}, microsites: ${ch.microSites.length}`);
//   }
//   return channels;
// });

// ── 6b. Get channel ──
// await run('channels.get', async () => {
//   const channel = await t4.channels.get(CHANNEL_ID);
//   console.log('  name:', channel.name);
//   console.log('  description:', channel.description);
//   console.log('  defaultLanguage:', channel.defaultLanguage);
//   console.log('  rootSectionId:', channel.rootSectionId);
//   console.log('  fileOutputPath:', channel.fileOutputPath);
//   console.log('  indexFileName:', channel.indexFileName);
//   console.log('  baseHref:', channel.baseHref);
//   console.log('  siteRoot:', channel.siteRoot);
//   console.log('  publishUrl:', channel.publishUrl);
//   console.log('  defaultFullTextLayout:', channel.defaultFullTextLayout);
//   console.log('  fullTextExtension:', channel.fullTextExtension);
//   console.log('  languages:', channel.languages);
//   console.log('  microSites:', channel.microSites);
//   console.log('  fileExtensions:', channel.fileExtensions);
//   return channel;
// });

// ── 6c. Publish channel ──
// await run('channel.publish', async () => {
//   const channel = await t4.channels.get(CHANNEL_ID);
//   await channel.publish();
//   return { published: true };
// });

// ── 6d. Publish channel (with options) ──
// await run('channel.publish (with options)', async () => {
//   const channel = await t4.channels.get(CHANNEL_ID);
//   await channel.publish({
//     includeArchives: true,
//     overridePublishPeriodRestriction: false,
//   });
//   return { published: true };
// });

// ═══════════════════════════════════════════════════════════
// 7. LISTS
// ═══════════════════════════════════════════════════════════

// ── 7a. List all lists ──
// await run('lists.list', async () => {
//   const lists = await t4.lists.list();
//   for (const l of lists) {
//     console.log(`  [${l.id}] ${l.name}`);
//   }
//   return lists;
// });

// ── 7b. Get list (with items) ──
// await run('lists.get', async () => {
//   const list = await t4.lists.get(LIST_ID);
//   console.log('  name:', list.name);
//   console.log('  description:', list.description);
//   console.log('  isForcedLanguage:', list.isForcedLanguage);
//   console.log('  isDefaultLanguage:', list.isDefaultLanguage);
//   console.log('  primaryGroup:', list.primaryGroup);
//   console.log('  sharedGroups:', list.sharedGroups);
//   console.log('  items:');
//   for (const [name, item] of Object.entries(list.items)) {
//     console.log(`    ${name}: value="${item.value}", selected=${item.selected}`);
//   }
//   return list;
// });

// ── 7c. Create list ──
// await run('lists.create', async () => {
//   return t4.lists.create({
//     name: 'SDK Test List',
//     description: 'Created by test script',
//     items: [
//       { name: 'Option A', value: 'a', selected: true },
//       { name: 'Option B', value: 'b' },
//       { name: 'Option C', value: 'c' },
//     ],
//   });
// });

// ── 7d. Update list (immutable) ──
// await run('lists.update', async () => {
//   return t4.lists.update(LIST_ID, {
//     name: 'Renamed List',
//     description: 'Updated description',
//   });
// });

// ── 7e. List save (mutable pattern) ──
// await run('list.save', async () => {
//   const list = await t4.lists.get(LIST_ID);
//   list.name = 'Saved List Name';
//   list.description = 'Modified via save()';
//   await list.save();
//   return { saved: true };
// });

// ── 7f. Add item to list ──
// await run('list.addItem + save', async () => {
//   const list = await t4.lists.get(LIST_ID);
//   list.addItem({ name: 'New Item', value: 'new', selected: false });
//   await list.save();
//   return { added: true, items: Object.keys(list.items) };
// });

// ── 7g. Remove item from list ──
// await run('list.removeItem + save', async () => {
//   const list = await t4.lists.get(LIST_ID);
//   list.removeItem('New Item');
//   await list.save();
//   return { removed: true, items: Object.keys(list.items) };
// });

// ── 7h. Delete list ──
// await run('lists.delete', async () => {
//   await t4.lists.delete(LIST_ID);
//   return { deleted: true };
// });


// ═══════════════════════════════════════════════════════════
// 8. GROUPS
// ═══════════════════════════════════════════════════════════

// ── 8a. List groups ──
// await run('groups.list', async () => {
//   const groups = await t4.groups.list();
//   for (const g of groups) {
//     console.log(`  [${g.id}] ${g.name} — ${g.membersCount} members, enabled: ${g.enabled}`);
//   }
//   return groups;
// });

// ── 8b. Get group (with members) ──
// await run('groups.get', async () => {
//   const group = await t4.groups.get(GROUP_ID);
//   console.log('  name:', group.name);
//   console.log('  description:', group.description);
//   console.log('  enabled:', group.enabled);
//   console.log('  emailAddress:', group.emailAddress);
//   console.log('  children:', group.children);
//   console.log('  members:');
//   for (const m of group.members) {
//     console.log(`    [${m.id}] ${m.username} — ${m.firstName} ${m.lastName} (${m.userLevel})`);
//   }
//   return group;
// });

// ── 8c. Create group ──
// await run('groups.create', async () => {
//   return t4.groups.create({
//     name: 'SDK Test Group - New',
//     description: 'Created by test script',
//     members: [USER_ID],
//     enabled: true,
//   });
// });

// ── 8d. Update group (immutable) ──
// await run('groups.update', async () => {
//   return t4.groups.update(GROUP_ID, {
//     name: 'Renamed Group - SDK',
//     description: 'Updated description',
//     enabled: true,
//   });
// });

// ── 8e. Group save (mutable pattern) ──
// await run('groups.save', async () => {
//   const group = await t4.groups.get(GROUP_ID);
//   group.name = 'Saved Group Name';
//   group.description = 'Modified via save() - Via SDK';
//   await group.save();
//   return { saved: true };
// });

// ── 8f. Add members to group ──
// await run('group.addMembers + save', async () => {
//   const group = await t4.groups.get(GROUP_ID);
//   group.addMembers([SECOND_USER_ID]);
//   await group.save();
//   return { added: true, members: group.members.map(m => m.username) };
// });

// ── 8g. Remove members from group ──
// await run('group.removeMembers + save', async () => {
//   const group = await t4.groups.get(GROUP_ID);
//   group.removeMembers([SECOND_USER_ID]);
//   await group.save();
//   return { removed: true, members: group.members.map(m => m.username) };
// });

// ── 8h. Delete group ──
// await run('groups.delete', async () => {
//   await t4.groups.delete(45);
//   return { deleted: true };
// });

// ═══════════════════════════════════════════════════════════
// 9. USERS
// ═══════════════════════════════════════════════════════════

// ── 9a. List users ──
// await run('users.list', async () => {
//   const users = await t4.users.list();
//   for (const u of users) {
//     console.log(`  [${u.id}] ${u.username} — ${u.firstName} ${u.lastName} (${u.userLevel})`);
//   }
//   return users;
// });

// ── 9b. List users (filtered by level) ──
// await run('users.list (filtered)', async () => {
//   return t4.users.list({ userLevel: 'admin' });
// });

// ── 9c. Get user ──
// await run('users.get', async () => {
//   const user = await t4.users.get(USER_ID);
//   console.log('  username:', user.username);
//   console.log('  firstName:', user.firstName);
//   console.log('  lastName:', user.lastName);
//   console.log('  emailAddress:', user.emailAddress);
//   console.log('  userLevel:', user.userLevel);
//   console.log('  defaultLanguage:', user.defaultLanguage);
//   console.log('  enabled:', user.enabled);
//   console.log('  groups:', user.groups);
//   console.log('  authMethods:', user.authMethods);
//   console.log('  customFields:', user.customFields);
//   return user;
// });

// ── 9d. Create user ──
// await run('users.create', async () => {
//   return t4.users.create({
//     username: 'sdk-test-user',
//     firstName: 'SDK',
//     lastName: 'Test',
//     emailAddress: 'sdk-test@example.com',
//     password: 'SecureP@ss123!',
//     userLevel: 'contributor',
//     defaultLanguage: 'en',
//     enabled: true,
//     authMethods: { local: true },
//   });
// });

// ── 9e. Update user (immutable) ──
// await run('users.update', async () => {
//   return t4.users.update(USER_ID, {
//     firstName: 'Updated',
//     lastName: 'Name',
//     emailAddress: 'updated@example.com',
//     userLevel: 'moderator',
//   });
// });

// ── 9f. User save (mutable pattern) ──
// await run('user.save', async () => {
//   const user = await t4.users.get(USER_ID);
//   user.firstName = 'Saved';
//   user.lastName = 'User';
//   user.defaultLanguage = 'en';
//   user.customFields['Department'] = 'Updated';
//   await user.save();
//   return { saved: true };
// });

// ── 9g. Update user password ──
// await run('user.save (password)', async () => {
//   const user = await t4.users.get(USER_ID);
//   user.password = 'NewP@ssword456!';
//   await user.save();
//   return { passwordChanged: true };
// });

// ── 9h. Update user auth methods ──
// await run('user.save (authMethods)', async () => {
//   const user = await t4.users.get(USER_ID);
//   user.authMethods = {
//     local: true,
//     ldap: { enabled: true, identifier: 'uid=testuser,ou=people,dc=example,dc=com' },
//     saml: false,
//   };
//   await user.save();
//   return { authMethodsUpdated: true };
// });

// ── 9i. Update user custom fields ──
// await run('user.save (customFields)', async () => {
//   const user = await t4.users.get(USER_ID);
//   if (user.customFields) {
//     user.customFields['Department'] = 'Engineering';
//     await user.save();
//     return { customFieldsUpdated: true };
//   }
//   return { customFieldsUpdated: false, reason: 'No custom fields configured' };
// });

// ── 9j. Delete user ──
// await run('users.delete', async () => {
//   await t4.users.delete(USER_ID);
//   return { deleted: true };
// });


// ═══════════════════════════════════════════════════════════
// 10. PAGE LAYOUTS
// ═══════════════════════════════════════════════════════════

// ── 10a. List page layouts ──
// await run('pageLayouts.list', async () => {
//   const layouts = await t4.pageLayouts.list();
//   for (const l of layouts) {
//     console.log(`  [${l.id}] ${l.name}`);
//   }
//   return layouts;
// });

// ── 10b. Get page layout ──
// await run('pageLayouts.get', async () => {
//   const layout = await t4.pageLayouts.get(PAGE_LAYOUT_ID);
//   console.log('  name:', layout.name);
//   console.log('  description:', layout.description);
//   console.log('  syntax:', layout.syntax);
//   console.log('  processor:', layout.processor);
//   console.log('  fileExtension:', layout.fileExtension);
//   console.log('  headerCode:', layout.headerCode.substring(0, 100) + '...');
//   console.log('  footerCode:', layout.footerCode.substring(0, 100) + '...');
//   return layout;
// });

// ── 10c. Create page layout ──
// await run('pageLayouts.create', async () => {
//   return t4.pageLayouts.create({
//     name: 'SDK Test Page Layout',
//     description: 'Created by test script',
//     headerCode: '<!DOCTYPE html><html><head></head><body>',
//     footerCode: '</body></html>',
//     syntax: 'HTML/XML',
//     processor: 'handlebars',
//     fileExtension: 'html',
//   });
// });

// ── 10d. Update page layout (immutable) ──
// await run('pageLayouts.update', async () => {
//   return t4.pageLayouts.update(PAGE_LAYOUT_ID, {
//     name: 'Renamed Page Layout - SDK',
//     description: 'Updated description',
//     headerCode: '<!DOCTYPE html><html><body>',
//     footerCode: '</body></html>',
//   });
// });

// ── 10e. Page layout save (mutable pattern) ──
// await run('pageLayout.save', async () => {
//   const layout = await t4.pageLayouts.get(PAGE_LAYOUT_ID);
//   layout.name = 'Saved Page Layout';
//   layout.headerCode = '<!-- updated header -->';
//   await layout.save();
//   return { saved: true };
// });

// ── 10f. Delete page layout ──
// await run('pageLayouts.delete', async () => {
//   await t4.pageLayouts.delete(11816);
//   return { deleted: true };
// });

// ═══════════════════════════════════════════════════════════
// 11. MEDIA
// ═══════════════════════════════════════════════════════════

// ── 11a. Get media item ──
// await run('media.get', async () => {
//   const item = await t4.media.get(MEDIA_ID);
//   console.log('  name:', item.name);
//   console.log('  description:', item.description);
//   console.log('  fileName:', item.fileName);
//   console.log('  fileSize:', item.fileSize);
//   console.log('  mediaType:', item.mediaType);
//   console.log('  mediaTypeId:', item.mediaTypeId);
//   console.log('  language:', item.language);
//   console.log('  version:', item.version);
//   console.log('  status:', item.status);
//   console.log('  downloadUrl:', item.downloadUrl);
//   console.log('  thumbnailUrl:', item.thumbnailUrl);
//   console.log('  path:', item.path);
//   console.log('  categories:', item.categories);
//   console.log('  fields:', item.fields);
//   console.log('  content:', item.content);
//   console.log('  syntaxType:', item.syntaxType);
//   return item;
// });

// ── 11b. Create media (binary — image/document) ──
// await run('media.create (binary)', async () => {
//   return t4.media.create({
//     file: 'https://files.davelarkan.com/happy.png',
//     name: 'SDK Test File',
//     category: MEDIA_CATEGORY_ID,
//     description: 'Uploaded by test script',
//   });
// });

// ── 11c. Create media (with Blob) ──
// await run('media.create (blob)', async () => {
//   const blob = new Blob(['body { color: red; }'], { type: 'text/css' });
//   return t4.media.create({
//     file: { file: blob, filename: 'test.css' },
//     name: 'SDK Test CSS',
//     category: MEDIA_CATEGORY_ID,
//     description: 'CSS file from blob',
//   });
// });

// ── 11d. Update media (immutable) ──
// await run('media.update', async () => {
//   return t4.media.update(MEDIA_ID, {
//     name: 'Renamed Media',
//     description: 'Updated description',
//   });
// });

// ── 11e. Update media with file replacement ──
// await run('media.update (file replacement)', async () => {
//   return t4.media.update(MEDIA_ID, {
//     file: './tests/fixtures/example.txt',
//   });
// });

// ── 11f. Update non-binary media content ──
// await run('media.update (text content)', async () => {
//   return t4.media.update(MEDIA_ID, {
//     content: 'body { color: blue; }',
//     syntaxType: 'css',
//   });
// });

// ── 11g. Media item save (mutable pattern) ──
// await run('mediaItem.save', async () => {
//   const item = await t4.media.get(MEDIA_ID);
//   item.name = 'Saved Media Name';
//   item.description = 'Modified via save()';
//   await item.save();
//   return { saved: true };
// });

// ── 11h. Media item save with file replacement ──
// await run('mediaItem.save (file replacement)', async () => {
//   const item = await t4.media.update(MEDIA_ID, {
//     file: './tests/fixtures/example.txt',
//     name: 'One shot update',
//   });

//   return { saved: true, version: item.version };
// });

// ── 11i. Media item save with custom fields ──
// await run('mediaItem.save (fields)', async () => {
//   const item = await t4.media.get(MEDIA_ID);
//   item.fields['Photo Credit'] = 'Test Photographer';
//   await item.save();
//   return { saved: true };
// });

// ── 11j. Delete media ──
// await run('media.delete', async () => {
//   await t4.media.delete(MEDIA_ID);
//   return { deleted: true };
// });

// ── 11k. Delete media (explicit category) ──
// await run('media.delete (with category)', async () => {
//   await t4.media.delete(MEDIA_ID, { categoryId: MEDIA_CATEGORY_ID });
//   return { deleted: true };
// });

// ── 11l. Purge media (permanent) ──
// await run('media.purge', async () => {
//   await t4.media.purge(11818);
//   return { purged: true };
// });

// ═══════════════════════════════════════════════════════════
// 12. MEDIA CATEGORIES (via MediaCategoryRef)
// ═══════════════════════════════════════════════════════════

// ── 12a. Get media category ──
// await run('mediaCategory.get', async () => {
//   const cat = await t4.mediaCategory(MEDIA_CATEGORY_ID).get();
//   console.log('  name:', cat.name);
//   console.log('  parentId:', cat.parentId);
//   console.log('  path:', cat.path);
//   console.log('  lastModified:', cat.lastModified);
//   return cat;
// });

// ── 12b. Media category save (mutable pattern) ──
// await run('mediaCategory.save', async () => {
//   const cat = await t4.mediaCategory(MEDIA_CATEGORY_ID).get();
//   cat.name = 'Content Assets';
//   await cat.save();
//   return { saved: true };
// });

// ── 12c. List subcategories ──
// await run('mediaCategory.subcategories', async () => {
//   return t4.mediaCategory(MEDIA_CATEGORY_ID).subcategories();
// });

// ── 12d. Update media category ──
// await run('mediaCategory.update', async () => {
//   return t4.mediaCategory(MEDIA_CATEGORY_ID).update({ name: 'Content Assets' });
// });

// ── 12e. Add child category ──
// await run('mediaCategory.addCategory', async () => {
//   return t4.mediaCategory(MEDIA_CATEGORY_ID).addCategory({ name: 'New Subcategory' });
// });

// ── 12f. List media in category ──
// await run('mediaCategory.list', async () => {
//   const items = await t4.mediaCategory(MEDIA_CATEGORY_ID).list();
//   for (const item of items) {
//     console.log(`  [${item.id}] ${item.name} — ${item.mediaType}, ${item.fileSize}, ${item.status}`);
//   }
//   return items;
// });

// ── 12g. Delete media category ──
// await run('mediaCategory.delete', async () => {
//   await t4.mediaCategory(MEDIA_CATEGORY_ID).delete();
//   return { deleted: true };
// });

// ── 12h. Purge media category (permanent) ──
// await run('mediaCategory.purge', async () => {
//   await t4.mediaCategory(MEDIA_CATEGORY_ID).purge();
//   return { purged: true };
// });

// ── 12i. Move media category under a new parent ──
// await run('mediaCategory.move', async () => {
//   await t4.mediaCategory(MEDIA_CATEGORY_ID).move(900);  // new parent category ID
//   return { moved: true };
// });

// ═══════════════════════════════════════════════════════════
// 13. MEDIA LIBRARY
// ═══════════════════════════════════════════════════════════

// await run('mediaLibrary.tree', async () => {
//   return t4.mediaLibrary.tree();
// });

// ═══════════════════════════════════════════════════════════
// 14. HANDLEBARS (HELPERS & PARTIALS)
// ═══════════════════════════════════════════════════════════

// ── 14a. List helpers ──
// await run('handlebars.helpers.list', async () => {
//   const helpers = await t4.handlebars.helpers.list();
//   for (const h of helpers) {
//     console.log(`  [${h.id}] ${h.name} — lastModified: ${h.lastModified}`);
//   }
//   return helpers;
// });

// ── 14b. Get helper (with code) ──
// await run('handlebars.helpers.get', async () => {
//   const helper = await t4.handlebars.helpers.get('formatDate');
//   console.log('  name:', helper.name);
//   console.log('  code:', helper.code.substring(0, 100) + '...');
//   console.log('  lastModified:', helper.lastModified);
//   return helper;
// });

// ── 14c. Create helper ──
// await run('handlebars.helpers.create', async () => {
//   return t4.handlebars.helpers.create({
//     name: 'truncate',
//     code: `module.exports = function(str, len) {
//   if (!str) return '';
//   return str.length > len ? str.substring(0, len) + '...' : str;
// }`,
//   });
// });

// ── 14d. Update helper (immutable) ──
// await run('handlebars.helpers.update', async () => {
//   return t4.handlebars.helpers.update('truncate', {
//     name: 'truncateText',
//     code: `module.exports = function(str, len, suffix) {
//   if (!str) return '';
//   suffix = suffix || '...';
//   return str.length > len ? str.substring(0, len) + suffix : str;
// }`,
//   });
// });

// ── 14e. Helper save (mutable pattern) ──
// await run('handlebars.helpers.save', async () => {
//   const helper = await t4.handlebars.helpers.get('truncateText');
//   helper.name = 'formatDate';
//   helper.code = `module.exports = function(date, format) {
//   const d = new Date(date);
//   if (format === 'iso') return d.toISOString().split('T')[0];
//   return d.toLocaleDateString();
// }`;
//   await helper.save();
//   return { saved: true, name: helper.name };
// });

// ── 14f. Delete helper (soft) ──
// await run('handlebars.helpers.delete', async () => {
//   await t4.handlebars.helpers.delete('formatDate');
//   return { deleted: true };
// });

// ── 14g. Purge helper (permanent) ──
// await run('handlebars.helpers.purge', async () => {
//   await t4.handlebars.helpers.purge('formatDate');
//   return { purged: true };
// });

// ── 14h. List partials ──
// await run('handlebars.partials.list', async () => {
//   const partials = await t4.handlebars.partials.list();
//   for (const p of partials) {
//     console.log(`  [${p.id}] ${p.name} — lastModified: ${p.lastModified}`);
//   }
//   return partials;
// });

// ── 14i. Get partial (with code) ──
// await run('handlebars.partials.get', async () => {
//   const partial = await t4.handlebars.partials.get('site-footer');
//   console.log('  name:', partial.name);
//   console.log('  code:', partial.code.substring(0, 100) + '...');
//   console.log('  lastModified:', partial.lastModified);
//   return partial;
// });

// ── 14j. Create partial ──
// await run('handlebars.partials.create', async () => {
//   return t4.handlebars.partials.create({
//     name: 'site-footer',
//     code: `<footer>
//   <p>&copy; {{year}} {{siteName}}</p>
//   <nav>{{> footerNav}}</nav>
// </footer>`,
//   });
// });

// ── 14k. Update partial (immutable) ──
// await run('handlebars.partials.update', async () => {
//   return t4.handlebars.partials.update('site-footer', {
//     name: 'site-header',
//     code: `<header class="main">
//   <h1>{{title}}</h1>
//   <nav>{{> mainNav}}</nav>
// </header>`,
//   });
// });

// ── 14l. Partial save (mutable pattern) ──
// await run('handlebars.partials.save', async () => {
//   const partial = await t4.handlebars.partials.get('site-header');
//   partial.name = 'header-v2';
//   partial.code = '<header><h1>{{title}}</h1><p>{{subtitle}}</p></header>';
//   await partial.save();
//   return { saved: true, name: partial.name };
// });

// ── 14m. Delete partial (soft) ──
// await run('handlebars.partials.delete', async () => {
//   await t4.handlebars.partials.delete('header-v2');
//   return { deleted: true };
// });

// ── 14n. Purge partial (permanent) ──
// await run('handlebars.partials.purge', async () => {
//   await t4.handlebars.partials.purge('header-v2');
//   return { purged: true };
// });

// ═══════════════════════════════════════════════════════════
// 15. CACHE
// ═══════════════════════════════════════════════════════════

// await run('clearCache', async () => {
//   t4.clearCache();
//   return { cleared: true };
// });

// ═══════════════════════════════════════════════════════════
// 15b. PLATFORM INFO
// ═══════════════════════════════════════════════════════════

// await run('about', async () => {
//   return t4.about();
// });

// await run('database', async () => {
//   return t4.database();
// });

// await run('environment', async () => {
//   return t4.environment();
// });

// await run('licence', async () => {
//   return t4.licence();
// });

// ═══════════════════════════════════════════════════════════
// 16. ERROR HANDLING
// ═══════════════════════════════════════════════════════════

// await run('error handling (T4ApiError)', async () => {
//   try {
//     await t4.section(999999).get();
//   } catch (error) {
//     if (error instanceof T4ApiError) {
//       console.log('  Caught T4ApiError:');
//       console.log('    statusCode:', error.statusCode);
//       console.log('    statusText:', error.statusText);
//       console.log('    requestMethod:', error.requestMethod);
//       console.log('    requestUrl:', error.requestUrl);
//       console.log('    responseBody:', error.responseBody);
//       return { caught: true };
//     }
//     throw error;
//   }
// });

// ═══════════════════════════════════════════════════════════
// 17. LANGUAGE OVERRIDES
// ═══════════════════════════════════════════════════════════

// ── Per-call language override (works on most section/content operations) ──
// await run('section.get (Spanish)', async () => {
//   return t4.section(SECTION_ID).get({ language: 'es' });
// });

// await run('content.list (Spanish)', async () => {
//   return t4.section(SECTION_ID).content.list({ language: 'es' });
// });

// await run('content.create (Spanish)', async () => {
//   return t4.section(SECTION_ID).content.create({
//     type: CONTENT_TYPE_ID,
//     name: 'Spanish Content',
//     fields: { 'Example Element': 'Hola mundo' },
//   }, { language: 'es' });
// });

// ── Client-level default language ──
// const t4Fr = new T4Client({
//   baseUrl: process.env.T4_BASE_URL,
//   apiToken: process.env.T4_API_TOKEN,
//   language: 'es',
// });
// await run('client with default language', async () => {
//   return t4Fr.section(SECTION_ID).get();
// });

// ═══════════════════════════════════════════════════════════
// 18. NAVIGATION OBJECTS
// ═══════════════════════════════════════════════════════════
// IDs to replace with real ones for validation tests:
const NAV_SECTION_ID = 233;
const NAV_CONTENT_TYPE_ID = 67;
const NAV_CONTENT_TYPE_ID_2 = 68;
const NAV_MEDIA_ID = 4767;
const NAV_CHANNEL_ID = 1;
const NAV_MICROSITE_ID = 6;
const NAV_PAGE_LAYOUT_ID = 344;

// ── 18a. List navigation objects ──
// await run('navigation.list', async () => {
//   return t4.navigation.list();
// });

// ── 18b. List filtered by type ──
// await run('navigation.list (breadcrumbs)', async () => {
//   return t4.navigation.list({ type: 'breadcrumbs' });
// });

// ── 18c. Get navigation object ──
// await run('navigation.get', async () => {
//   const nav = await t4.navigation.get(322);
//   console.log('  type:', nav.type);
//   console.log('  properties:', nav.properties);
//   return nav;
// });

// ── 18d. Delete navigation object ──
// await run('navigation.delete', async () => {
//   await t4.navigation.delete(256);
//   return { deleted: true };
// });

// ── 18e. A to Z — minimal ──
// await run('nav.create a-to-z (minimal)', async () => {
//   return t4.navigation.create({ type: 'a-to-z', name: 'SDK A-Z Minimal' });
// });

// ── 18f. A to Z — full options ──
// await run('nav.create a-to-z (full)', async () => {
//   return t4.navigation.create({
//     type: 'a-to-z', name: 'SDK A-Z Full',
//     properties: {
//       startLevel: 1, endLevel: 3,
//       useSectionMetaData: true, sectionMetaContentTypeElement: 'Title',
//       microSite: NAV_MICROSITE_ID,
//       beforeMenu: '<ul>', afterMenu: '</ul>', beforeItem: '<li>', afterItem: '</li>',
//     },
//   });
// });

// ── 18g. Breadcrumbs — minimal ──
// await run('nav.create breadcrumbs (minimal)', async () => {
//   return t4.navigation.create({ type: 'breadcrumbs', name: 'SDK Breadcrumbs Minimal' });
// });

// ── 18h. Breadcrumbs — with links and separator ──
// await run('nav.create breadcrumbs (links)', async () => {
//   return t4.navigation.create({
//     type: 'breadcrumbs', name: 'SDK Breadcrumbs Links',
//     properties: { useLinks: true, linkCurrent: false, separator: ' > ', hideHome: true, noSpace: true },
//   });
// });

// ── 18i. Breadcrumbs — with maxLength ──
// await run('nav.create breadcrumbs (maxLength)', async () => {
//   return t4.navigation.create({
//     type: 'breadcrumbs', name: 'SDK Breadcrumbs MaxLen',
//     properties: { maxLength: 50, elementToAppend: 'Title' },
//   });
// });

// ── 18j. CSS Selector — default stylesheet only ──
// await run('nav.create css-selector (minimal)', async () => {
//   return t4.navigation.create({
//     type: 'css-selector', name: 'SDK CSS Minimal',
//     properties: { defaultStylesheet: NAV_MEDIA_ID },
//   });
// });

// ── 18k. CSS Selector — with branches ──
// await run('nav.create css-selector (branches)', async () => {
//   return t4.navigation.create({
//     type: 'css-selector', name: 'SDK CSS Branches',
//     properties: {
//       defaultStylesheet: NAV_MEDIA_ID,
//       branches: [{ stylesheet: NAV_MEDIA_ID, rootSection: NAV_SECTION_ID }],
//     },
//   });
// });

// ── 18l. Generate File — minimal ──
// await run('nav.create generate-file (minimal)', async () => {
//   return t4.navigation.create({ type: 'generate-file', name: 'SDK Gen File Minimal' });
// });

// ── 18m. Generate File — full ──
// await run('nav.create generate-file (full)', async () => {
//   return t4.navigation.create({
//     type: 'generate-file', name: 'SDK Gen File Full',
//     properties: {
//       fileName: 'output', fileExtension: 'html', layout: 'text/html',
//       appendContentId: true, appendDirectory: true, baseDirectory: '/files',
//       mediaFile: NAV_MEDIA_ID,
//     },
//   });
// });

// ── 18n. Language Switcher — minimal ──
// await run('nav.create language-switcher (minimal)', async () => {
//   return t4.navigation.create({ type: 'language-switcher', name: 'SDK Lang Switch Minimal' });
// });

// ── 18o. Language Switcher — with images ──
// await run('nav.create language-switcher (images)', async () => {
//   return t4.navigation.create({
//     type: 'language-switcher', name: 'SDK Lang Switch Images',
//     properties: {
//       langCode: 'en', alwaysOutput: true,
//       imageUrl: 'https://example.com/flags', imageExtension: '.png', imageProperties: 'width="24"',
//       beforeHtml: '<div class="langs">', afterHtml: '</div>',
//     },
//   });
// });

// ── 18p. Pagination — current section ──
// await run('nav.create pagination (current)', async () => {
//   return t4.navigation.create({
//     type: 'pagination', name: 'SDK Pagination Current',
//     properties: { contentTypeId: NAV_CONTENT_TYPE_ID, fetchMethod: 'current', contentItemsPerPage: 10 },
//   });
// });

// ── 18q. Pagination — branch with section ──
// await run('nav.create pagination (branch)', async () => {
//   return t4.navigation.create({
//     type: 'pagination', name: 'SDK Pagination Branch',
//     properties: { contentTypeId: NAV_CONTENT_TYPE_ID, fetchMethod: 'branch', section: NAV_SECTION_ID, numToRecurse: 3 },
//   });
// });

// ── 18r. Previous/Next — previous only ──
// await run('nav.create previous-next (previous)', async () => {
//   return t4.navigation.create({
//     type: 'previous-next-fulltext', name: 'SDK Prev Only',
//     properties: { type: 'previous', previousHtml: '← Previous' },
//   });
// });

// ── 18s. Previous/Next — both with layout ──
// await run('nav.create previous-next (both)', async () => {
//   return t4.navigation.create({
//     type: 'previous-next-fulltext', name: 'SDK Prev/Next Both',
//     properties: {
//       type: 'both', altLayoutName: 'text/nav',
//       skipNonFulltextContent: true, sameContentTypeRestriction: true,
//       previousHtml: '←', betweenHtml: ' | ', nextHtml: '→',
//     },
//   });
// });

// ── 18t. Section Iterator ──
// await run('nav.create section-iterator', async () => {
//   return t4.navigation.create({
//     type: 'section-iterator', name: 'SDK Section Iterator',
//     properties: { beforeHtml: '<ul>', betweenHtml: '', afterHtml: '</ul>' },
//   });
// });

// ── 18u. Related Section Branch ──
// await run('nav.create related-section-branch', async () => {
//   return t4.navigation.create({
//     type: 'related-section-branch', name: 'SDK RSB',
//     properties: { childSectionName: 'news', linkText: 'View News' },
//   });
// });

// ── 18v. Return to Index ──
// await run('nav.create return-to-index', async () => {
//   return t4.navigation.create({
//     type: 'return-to-index', name: 'SDK Return to Index',
//     properties: { linkText: 'Back to', appendSectionName: true, scrollToContent: true },
//   });
// });

// ── 18w. Section Meta Info ──
// await run('nav.create section-meta-info', async () => {
//   return t4.navigation.create({
//     type: 'section-meta-info', name: 'SDK Meta Info',
//     properties: { metaType: 'description', dateFormat: 'dd.MM.yyyy', beforeHtml: '<meta content="', afterHtml: '">' },
//   });
// });

// ── 18x. Top Stories ──
// await run('nav.create top-stories', async () => {
//   return t4.navigation.create({
//     type: 'top-stories', name: 'SDK Top Stories',
//     properties: {
//       section: NAV_SECTION_ID, numToShow: 5, linkToFulltext: true,
//       title: 'Latest', beforeMenuHtml: '<ul>', afterMenuHtml: '</ul>', beforeHtml: '<li>', afterHtml: '</li>',
//     },
//   });
// });

// ── 18y. Site Map — minimal ──
// await run('nav.create site-map (minimal)', async () => {
//   return t4.navigation.create({ type: 'site-map', name: 'SDK Site Map Minimal' });
// });

// ── 18z. Site Map — with content count ──
// await run('nav.create site-map (content count)', async () => {
//   return t4.navigation.create({
//     type: 'site-map', name: 'SDK Site Map Count',
//     properties: {
//       startSection: NAV_SECTION_ID, levels: 5, childSectionLinks: true,
//       enableContentCount: true, contentTypeIds: [NAV_CONTENT_TYPE_ID], countRecursively: true, maxLevelsToCount: 10,
//       htmlBeforeContentCount: '(', htmlAfterContentCount: ')',
//     },
//   });
// });

// ── 18aa. Section Details — current ──
// await run('nav.create section-details (current)', async () => {
//   return t4.navigation.create({
//     type: 'section-details', name: 'SDK Section Details Current',
//     properties: { detailMethod: 'current', displayType: 'name' },
//   });
// });

// ── 18ab. Section Details — section ──
// await run('nav.create section-details (section)', async () => {
//   return t4.navigation.create({
//     type: 'section-details', name: 'SDK Section Details Section',
//     properties: { detailMethod: 'section', section: NAV_SECTION_ID, displayType: 'path' },
//   });
// });

// ── 18ac. Related Content — current ──
// await run('nav.create related-content (current)', async () => {
//   return t4.navigation.create({
//     type: 'related-content', name: 'SDK Related Current',
//     properties: { fetchMethod: 'current', title: 'Related' },
//   });
// });

// ── 18ad. Related Content — section ──
// await run('nav.create related-content (section)', async () => {
//   return t4.navigation.create({
//     type: 'related-content', name: 'SDK Related Section',
//     properties: { fetchMethod: 'section', section: NAV_SECTION_ID, altLayoutName: 'text/foo' },
//   });
// });

// ── 18ae. Related Content — child ──
// await run('nav.create related-content (child)', async () => {
//   return t4.navigation.create({
//     type: 'related-content', name: 'SDK Related Child',
//     properties: {
//       fetchMethod: 'child', childSectionName: 'Related',
//       contentTypeIds: [NAV_CONTENT_TYPE_ID], display: 5, recurseChildSection: true,
//     },
//   });
// });

// ── 18af. Link Menu — branch-at-level ──
// await run('nav.create link-menu (branch-at-level)', async () => {
//   return t4.navigation.create({
//     type: 'link-menu', name: 'SDK Link Menu Branch',
//     properties: {
//       menuType: 'branch-at-level', level: 1, numToRecurse: 3, subNavigationType: 'ul',
//       showNonCurrentChildren: true, useCurrentBranchClass: true,
//       beforeMenuHtml: '<nav>', afterMenuHtml: '</nav>', beforeLinkHtml: '<li>', afterLinkHtml: '</li>',
//     },
//   });
// });

// ── 18ag. Link Menu — children with specific branch ──
// await run('nav.create link-menu (children)', async () => {
//   return t4.navigation.create({
//     type: 'link-menu', name: 'SDK Link Menu Children',
//     properties: {
//       menuType: 'children', displaySpecificBranch: true, specificBranchId: NAV_SECTION_ID,
//       showSiblingsIfNoChildren: true,
//     },
//   });
// });

// ── 18ah. Link Menu — siblings-and-children ──
// await run('nav.create link-menu (siblings-and-children)', async () => {
//   return t4.navigation.create({
//     type: 'link-menu', name: 'SDK Link Menu Siblings',
//     properties: { menuType: 'siblings-and-children', subNavigationType: 'div', menuDisplayType: 'dropdown' },
//   });
// });

// ── 18ai. Publish to One File — current section ──
// await run('nav.create publish-to-one-file (current)', async () => {
//   return t4.navigation.create({
//     type: 'publish-to-one-file', name: 'SDK POF Current',
//     properties: { startSection: 'current', levelsToRecurse: 5, beforeHtml: '<div>', afterHtml: '</div>' },
//   });
// });

// ── 18aj. Publish to One File — specific section with pagination ──
// await run('nav.create publish-to-one-file (specific + pagination)', async () => {
//   return t4.navigation.create({
//     type: 'publish-to-one-file', name: 'SDK POF Specific',
//     properties: {
//       contentTypeId: NAV_CONTENT_TYPE_ID, startSection: 'specific', section: NAV_SECTION_ID,
//       showHiddenSections: true, levelsToRecurse: 10,
//       showSectionName: true, showNameForHidden: true, beforeSectionName: '<h3>', afterSectionName: '</h3>',
//       surroundingPageLayout: NAV_PAGE_LAYOUT_ID, altLayoutName: 'text/html',
//       pagination: true, contentPerPage: 10,
//       beforePaginationHtml: '<nav>', betweenPaginationHtml: '|', afterPaginationHtml: '</nav>',
//     },
//   });
// });

// ── 18ak. Publish to One File — element mode ──
// await run('nav.create publish-to-one-file (element)', async () => {
//   return t4.navigation.create({
//     type: 'publish-to-one-file', name: 'SDK POF Element',
//     properties: { contentTypeId: 343, startSection: 'element', startSectionElement: 'Section/Content Link' },
//   });
// });

// ── 18al. Top Content — current ──
// await run('nav.create top-content (current)', async () => {
//   return t4.navigation.create({
//     type: 'top-content', name: 'SDK Top Content Current',
//     properties: { fetchMethod: 'current', numToDisplay: 5, dateElement: 'Published Date' },
//   });
// });

// ── 18am. Top Content — section with all options ──
// await run('nav.create top-content (section full)', async () => {
//   return t4.navigation.create({
//     type: 'top-content', name: 'SDK Top Content Section',
//     properties: {
//       fetchMethod: 'section', section: NAV_SECTION_ID,
//       contentTypeIds: [NAV_CONTENT_TYPE_ID], channelId: NAV_CHANNEL_ID,
//       upcomingContent: true, dateElement: 'Date released', ignoreDateOrdering: false,
//       numToDisplay: 10, startAt: 5, altLayoutName: 'text/html',
//       title: 'Top Content', beforeHtml: '<ul>', afterHtml: '</ul>',
//     },
//   });
// });

// ── 18an. Keyword Search — minimal ──
// await run('nav.create keyword-search (minimal)', async () => {
//   return t4.navigation.create({
//     type: 'keyword-search', name: 'SDK Keyword Minimal',
//     properties: { contentFetchMethod: 'section', searchSection: NAV_SECTION_ID },
//   });
// });

// ── 18ao. Keyword Search — section keyword fetch + section content fetch ──
// await run('nav.create keyword-search (section/section)', async () => {
//   return t4.navigation.create({
//     type: 'keyword-search', name: 'SDK Keyword Section/Section',
//     properties: {
//       keywordFetchMethod: 'section', keywordSection: NAV_SECTION_ID,
//       narrowToSingleContentItem: true, keywordContentTypeId: NAV_CONTENT_TYPE_ID,
//       keywordElements: ['Display items'],
//       contentFetchMethod: 'section', searchSection: NAV_SECTION_ID,
//       searchContentTypeId: NAV_CONTENT_TYPE_ID_2, searchElements: ['Display item'],
//       numToDisplay: 10, showHiddenSections: true,
//       altLayoutName: 'text/html', pagination: true, contentPerPage: 20,
//       beforePaginationHtml: '<nav>', betweenPaginationHtml: '|', afterPaginationHtml: '</nav>',
//     },
//   });
// });

// ── 18ap. Keyword Search — branch-at-level content fetch ──
// await run('nav.create keyword-search (branch-at-level)', async () => {
//   return t4.navigation.create({
//     type: 'keyword-search', name: 'SDK Keyword Branch-at-Level',
//     properties: {
//       contentFetchMethod: 'branch-at-level', startLevel: 1, endLevel: 10,
//       searchContentTypeId: NAV_CONTENT_TYPE_ID, searchElements: ['Display items'],
//       sortType: 'last-modified', numToDisplay: 50,
//     },
//   });
// });

// ── 18aq. Keyword Search — with cross-language and date sorting ──
// await run('nav.create keyword-search (cross-lang + date sort)', async () => {
//   return t4.navigation.create({
//     type: 'keyword-search', name: 'SDK Keyword Cross-Lang',
//     properties: {
//       contentFetchMethod: 'branch', searchSection: NAV_SECTION_ID,
//       crossLanguageSearch: true, crossLanguageLanguages: ['en', 'es'],
//       matchCompositeKeywords: true, matchSubItems: true,
//       sortByDateElement: true, dateElementName: 'Release Date',
//       showUpcomingContent: true,
//       beforeHtml: '<div>', afterHtml: '</div>',
//     },
//   });
// });

// ── 18ar. Keyword Search — searchSectionElement mode ──
// await run('nav.create keyword-search (searchSectionElement)', async () => {
//   return t4.navigation.create({
//     type: 'keyword-search', name: 'SDK Keyword Element Mode',
//     properties: {
//       contentFetchMethod: 'section', searchSectionElement: 'Find items',  // must be a Section/Content Link element
//       keywordContentTypeId: NAV_CONTENT_TYPE_ID,
//       keywordElements: ['Display items'],
//     },
//   });
// });


// ═══════════════════════════════════════════════════════════
// 18z. NAVIGATION — CLONE (get + create with same settings)
// ═══════════════════════════════════════════════════════════
// const NAV_ID_TO_CLONE = 49; // Replace with a real nav object ID

// await run('nav.clone', async () => {
//   const original = await t4.navigation.get(NAV_ID_TO_CLONE);
//   const clone = await t4.navigation.create({
//     type: original.type,
//     name: `${original.name} (Clone)`,
//     description: original.description,
//     enabled: original.enabled,
//     previewEnabled: original.previewEnabled,
//     properties: original.properties,
//   });
//   console.log('  Original:', original.id, original.name, original.type);
//   console.log('  Clone:', clone.id, clone.name, clone.type);
//   console.log('  Properties match:', JSON.stringify(original.properties) === JSON.stringify(clone.properties));
//   return { originalId: original.id, cloneId: clone.id };
// });
