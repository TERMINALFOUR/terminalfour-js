/** Standard element type definitions matching the T4 API GET /type/ response */
export const ELEMENT_TYPES = [
  { id: 1, name: 'Plain Text', listType: false },
  { id: 2, name: 'Image', listType: false },
  { id: 3, name: 'HTML', listType: false },
  { id: 4, name: 'File', listType: false },
  { id: 5, name: 'Date', listType: false },
  { id: 6, name: 'Check Box', listType: true },
  { id: 7, name: 'Select Box', listType: true },
  { id: 8, name: 'Multiple Select', listType: true },
  { id: 9, name: 'Radio Button', listType: true },
  { id: 10, name: 'Cascading List', listType: true },
  { id: 11, name: 'Media', listType: false },
  { id: 12, name: 'Decimal Number', listType: false },
  { id: 13, name: 'Whole Number', listType: false },
  { id: 14, name: 'Section/Content Link', listType: false },
  { id: 15, name: 'Multi-select List', listType: true },
  { id: 16, name: 'Content Owner', listType: false },
  { id: 17, name: 'Group Select', listType: false },
  { id: 18, name: 'Keyword Selector', listType: true },
  { id: 19, name: 'Repeater', listType: false },
];

/** Standard HTML editor definitions matching the T4 API GET /htmlEditor response */
export const HTML_EDITORS = [
  { id: 2, name: 'Standard Textarea', minimumAccessLevel: 2 },
  { id: 5, name: 'TinyMCE', minimumAccessLevel: 2 },
];
