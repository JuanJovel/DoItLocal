import type { ToolDefinition } from '../types';

/**
 * SnapPages: turn PDF pages into JPG or PNG images, entirely in the browser.
 * The page module is imported lazily so pdf.js only loads on this page.
 */
export const snapPages: ToolDefinition = {
  id: 'snappages',
  slug: 'snappages',
  name: 'SnapPages',
  seoTitle: 'PDF to JPG Converter, Free and No Upload | SnapPages',
  tagline: 'Turn PDF pages into images. Free. Private.',
  description:
    'Convert PDF pages to JPG or PNG images, free. Pick the resolution and download one image or a ZIP of every page. Runs in your browser, so nothing is uploaded.',
  guide: {
    title: 'How to convert PDF to JPG',
    steps: [
      'Drop your PDFs on the page, or click "Choose PDFs". They are read on your device; nothing is uploaded.',
      'Pick JPG or PNG and a resolution. Rotate any file whose pages are sideways.',
      'Click "Convert to images". A one-page PDF downloads as a single image; longer ones as a ZIP with one image per page.',
    ],
  },
  faq: [
    {
      question: 'Which resolution should I choose?',
      answer:
        'Standard (150 DPI) is sharp on screens and in documents. Choose High (300 DPI) for printing or reading small text, and Screen (72 DPI) for the smallest files.',
    },
    {
      question: 'Should I pick JPG or PNG?',
      answer:
        'JPG files are much smaller and look right for most pages. PNG is lossless, so text and line drawings stay perfectly crisp, at a larger file size.',
    },
    {
      question: 'How do I get every page at once?',
      answer:
        'SnapPages puts all the pages in one ZIP file, one image per page, numbered in order so they sort correctly. A PDF with a single page downloads as just that image.',
    },
  ],
  icon: 'file-image',
  status: 'live',
  load: () => import('./page'),
};
