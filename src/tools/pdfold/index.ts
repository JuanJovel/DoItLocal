import type { ToolDefinition } from '../types';

/**
 * PDFold: merge PDFs entirely in the browser.
 * The page module is imported lazily so pdf.js and pdf-lib only load on this page.
 */
export const pdfold: ToolDefinition = {
  id: 'pdfold',
  slug: 'pdfold',
  name: 'PDFold',
  seoTitle: 'Merge PDF Files Free, No Upload | PDFold',
  tagline: 'Merge PDFs. Free. Private. Nothing leaves your device.',
  description:
    'Merge PDF files into one, free. Drag to reorder, rotate pages and download in seconds. Runs in your browser, so your PDFs are never uploaded.',
  guide: {
    title: 'How to merge PDF files',
    steps: [
      'Drop your PDFs on the page, or click "Choose PDFs". They are read on your device; nothing is uploaded.',
      'Drag the cards into the order you want. Use the rotate button to turn all pages of a file.',
      'Click "Merge PDFs". The combined PDF downloads straight away.',
    ],
  },
  faq: [
    {
      question: 'Will merging reduce the quality of my PDFs?',
      answer:
        'No. Pages are copied as they are, so text stays selectable and images keep their original quality.',
    },
    {
      question: 'How many PDFs can I merge at once?',
      answer:
        "There's no set limit. It depends on your device's memory: dozens of files and hundreds of pages are fine on a typical computer.",
    },
    {
      question: 'Can I merge password-protected PDFs?',
      answer:
        'Not yet. Open the PDF in the app that created it and save a copy without the password, then add that copy. PDFold tells you which file is locked.',
    },
  ],
  icon: 'merge',
  status: 'live',
  load: () => import('./page'),
};
