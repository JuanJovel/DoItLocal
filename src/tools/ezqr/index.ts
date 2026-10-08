import type { ToolDefinition } from '../types';

/** EzQR: make a QR code for a link or text and download it as PNG or SVG. */
export const ezqr: ToolDefinition = {
  id: 'ezqr',
  slug: 'ezqr',
  name: 'EzQR',
  seoTitle: 'EzQR: Free QR Code Generator, No Watermark, No Sign-up | DoItLocal',
  tagline: 'Create QR codes. Free, no watermarks.',
  description:
    'Make a QR code for a link or any text and download it as a sharp PNG or SVG. Free, no watermark, no sign-up, and nothing you type is uploaded.',
  keywords: [
    'free QR code generator',
    'QR code no watermark',
    'private QR code maker',
    'QR code generator no sign up',
    'offline QR code generator',
  ],
  icon: 'qr',
  status: 'live',
  load: () => import('./page'),
};
