import type { ToolDefinition } from '../types';

/** EzQR: make a QR code for a link or text and download it as PNG or SVG. */
export const ezqr: ToolDefinition = {
  id: 'ezqr',
  slug: 'ezqr',
  name: 'EzQR',
  seoTitle: 'Free QR Code Generator, No Watermark | EzQR',
  tagline: 'Create QR codes. Free, no watermarks.',
  description:
    'Free QR code generator for links and text. Download a sharp PNG or SVG with no watermark and no sign-up. Nothing you type leaves your device.',
  guide: {
    title: 'How to make a QR code',
    steps: [
      'Type or paste a link or any text. The QR code updates as you type.',
      'Optionally pick colors and how much error correction the code should have.',
      'Download it as a PNG for documents and messages, or as an SVG for print at any size.',
    ],
  },
  faq: [
    {
      question: 'Do these QR codes expire?',
      answer:
        "No. The link or text is stored in the code itself, not on a server, so it works forever and there's nothing to renew.",
    },
    {
      question: 'Can I use the QR codes commercially?',
      answer: 'Yes. The codes you make are yours, with no watermark and no attribution required.',
    },
    {
      question: 'PNG or SVG: which should I download?',
      answer:
        'PNG works everywhere. SVG stays sharp at any size, so it is the better choice for print, signage and design software.',
    },
  ],
  icon: 'qr',
  status: 'live',
  load: () => import('./page'),
};
