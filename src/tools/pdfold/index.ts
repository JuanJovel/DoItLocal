import type { ToolDefinition } from '../types';

/**
 * PDFold: merge PDFs entirely in the browser.
 * The page module is imported lazily so pdf.js and pdf-lib only load on this page.
 */
export const pdfold: ToolDefinition = {
  id: 'pdfold',
  slug: 'pdfold',
  name: 'PDFold',
  seoTitle: 'PDFold: Free Private PDF Merger, No Upload | DoItLocal',
  tagline: 'Merge PDFs. Free. Private. Nothing leaves your device.',
  description:
    'Combine multiple PDF files into one. Drag to reorder, rotate pages, and download. Free, no sign-up, and your files are never uploaded.',
  keywords: [
    'free private PDF merger',
    'merge PDF no upload',
    'combine PDF files',
    'offline PDF merge',
    'PDF merger no sign up',
  ],
  icon: 'merge',
  status: 'live',
  load: () => import('./page'),
};
