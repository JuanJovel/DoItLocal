import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import type { Rotation } from '../file-queue/reorder';

/** Test utilities: generate real PDFs whose pages can be identified after a merge. */

export interface SamplePdfOptions {
  /** Starting width; page n is `baseWidth + n` points wide, so each page has a unique size. */
  baseWidth?: number;
  /** Rotation to bake into every page of the source file. */
  pageRotation?: Rotation;
}

/**
 * Create a PDF where page `n` (1-based) is `baseWidth + n` wide, 300 tall, and
 * contains the text "<label>-p<n>". Size and text both identify the page.
 */
export async function makeSamplePdf(
  label: string,
  pageCount: number,
  { baseWidth = 200, pageRotation = 0 }: SamplePdfOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= pageCount; n++) {
    const page = doc.addPage([baseWidth + n, 300]);
    page.drawText(`${label}-p${n}`, { x: 10, y: 150, size: 18, font });
    if (pageRotation) page.setRotation(degrees(pageRotation));
  }
  return doc.save();
}

/** A PDF that pdf-lib refuses to load because its trailer declares encryption. */
export async function makeEncryptedLookingPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const encrypt = doc.context.register(doc.context.obj({ Filter: 'Standard', V: 1, R: 2 }));
  doc.context.trailerInfo.Encrypt = encrypt;
  return doc.save();
}

export interface PageInfo {
  width: number;
  height: number;
  rotation: number;
}

/** Page sizes and rotations of a PDF, in order. */
export async function readPages(bytes: Uint8Array): Promise<PageInfo[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => ({
    width: page.getWidth(),
    height: page.getHeight(),
    rotation: page.getRotation().angle,
  }));
}

/** Extract each page's text with pdf.js: an independent check that does not use pdf-lib. */
export async function readPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes), // pdf.js takes ownership of the buffer, so pass a copy
    useWorkerFetch: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const texts: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    texts.push(
      content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join('')
        .trim(),
    );
  }
  await task.destroy();
  return texts;
}
