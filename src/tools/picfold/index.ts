import type { ToolDefinition } from '../types';

/**
 * PicFold: turn photos and images into one PDF, entirely in the browser.
 * The page module is imported lazily so pdf-lib only loads on this page.
 */
export const picfold: ToolDefinition = {
  id: 'picfold',
  slug: 'picfold',
  name: 'PicFold',
  seoTitle: 'PicFold: Free Image to PDF Converter, No Upload | DoItLocal',
  tagline: 'Turn photos into a PDF. Free. Private.',
  description:
    'Turn photos, scans and screenshots into a single PDF. Reorder and rotate them, pick a page size, and download. Free, no sign-up, and your images are never uploaded.',
  keywords: [
    'image to PDF converter',
    'JPG to PDF free',
    'photos to PDF no upload',
    'PNG to PDF',
    'private image to PDF',
  ],
  icon: 'image',
  status: 'live',
  load: () => import('./page'),
};
