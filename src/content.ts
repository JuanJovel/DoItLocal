import { siteConfig } from './config';
import type { IconName } from './lib/icons';

/** User-facing copy shared across pages. */

export interface TrustItem {
  icon: IconName;
  lead: string;
  rest: string;
  href?: string;
}

export const trustItems: readonly TrustItem[] = [
  { icon: 'gift', lead: '100% free,', rest: ' no limits, no sign-up' },
  {
    icon: 'shield',
    lead: 'Files never leave your device.',
    rest: ' Everything runs in your browser.',
  },
  {
    icon: 'code',
    lead: 'Open source.',
    rest: ' Inspect the code yourself.',
    href: siteConfig.githubUrl,
  },
];

export interface FaqItem {
  question: string;
  /** Plain-text answer; blank lines separate paragraphs. */
  answer: string;
}

export const faqItems: readonly FaqItem[] = [
  {
    question: 'Is it really free?',
    answer:
      'Yes, completely. There is no trial, no watermark, no daily limit, no sign-up and no ads. Every tool is open source under the MIT license, so it will stay that way.',
  },
  {
    question: 'Are my files uploaded?',
    answer:
      "No. Your files are read and processed by JavaScript running on your own device, and they are never sent anywhere. This site has no server that accepts files, and its security policy tells your browser to block requests to any other server. You can check this yourself in your browser's DevTools (Network tab).",
  },
  {
    question: 'Is there a file size limit?',
    answer:
      "This site does not impose one. The practical limit is your device's memory: files of 100 MB or more work fine on a typical computer. On phones, or when combining very large files, merge in smaller batches if your browser runs out of memory.",
  },
  {
    question: 'Does it work offline?',
    answer:
      "Yes. After your first visit the site is saved in your browser, so you can load it and use it with no connection at all. You can also install it as an app from your browser's menu.",
  },
  {
    question: 'How is this funded/maintained?',
    answer: siteConfig.fundingNote,
  },
];

export interface PrivacyPoint {
  title: string;
  body: string;
}

export const privacyPoints: readonly PrivacyPoint[] = [
  {
    title: 'Processing is local JavaScript',
    body: 'Your browser reads each file from your disk and the code running in a Web Worker on your device does the work. The result is created in memory and handed straight back to you as a download.',
  },
  {
    title: 'No server ever receives your files',
    body: 'This website is just static files. There is no upload endpoint, no database and no account system. A strict Content-Security-Policy also tells your browser to block every request to any other server, so the page could not send your files elsewhere even if it tried.',
  },
  {
    title: 'Verify it yourself',
    body: "Open your browser's DevTools (F12), switch to the Network tab, then add and merge some files: you will see no requests carrying your data. Or load the page, switch off Wi-Fi, and everything still works. The full source code is public on GitHub.",
  },
];
