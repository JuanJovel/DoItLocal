import type { ToolDefinition } from '../types';

/**
 * PicFold: turn photos and images into one PDF, entirely in the browser.
 * The page module is imported lazily so pdf-lib only loads on this page.
 */
export const picfold: ToolDefinition = {
  id: 'picfold',
  slug: 'picfold',
  name: 'PicFold',
  seoTitle: 'JPG to PDF Converter, Free and No Upload | PicFold',
  tagline: 'Turn photos into a PDF. Free. Private.',
  description:
    'Convert JPG, PNG and other images to PDF, free. Reorder and rotate them, pick A4 or Letter, and download. Runs in your browser, so nothing is uploaded.',
  guide: {
    title: 'How to convert JPG to PDF',
    steps: [
      'Drop your photos or images on the page, or click "Choose images". JPG, PNG, WebP, GIF, BMP and more are supported.',
      'Drag them into order and rotate any that are sideways. Each image becomes one page.',
      'Pick a page size (same as the image, A4 or US Letter), then click "Make PDF" to download it.',
    ],
  },
  faq: [
    {
      question: 'Will my photos lose quality?',
      answer:
        'No. JPG and PNG images go into the PDF exactly as they are, with no re-compression. Other formats are converted at high quality first.',
    },
    {
      question: 'Do sideways phone photos come out the right way up?',
      answer:
        'Yes. Phones often store photos sideways along with a note saying how to turn them. PicFold reads that note, so each page looks the way the photo does on your phone.',
    },
    {
      question: 'Can I convert iPhone (HEIC) photos to PDF?',
      answer:
        'Yes, in Safari, which can open HEIC photos. Other browsers cannot read HEIC yet. On an iPhone you can also set Settings > Camera > Formats to "Most Compatible" so it saves JPGs.',
    },
  ],
  icon: 'image',
  status: 'live',
  load: () => import('./page'),
};
