import { zipSync } from 'fflate';
import { extensionFor } from '../../file-queue/filename';
import { JobError, throwIfAborted, type JobProgress, type JobResult } from '../../file-queue/job';
import type { Rotation } from '../../file-queue/reorder';
import type { ImageType, RenderablePdf } from '../../pdf/reader';
import { describeLoadError } from '../../pdf/validate';

/** A PDF from the queue. */
export interface PdfFile {
  file: File;
  name: string;
  /** Extra clockwise rotation for every page. */
  rotation: Rotation;
  pageCount: number;
}

export interface ConvertOptions {
  type: ImageType;
  /** Opens a PDF for rendering at the chosen format and resolution (pdf.js in the browser). */
  open: (file: File, rotation: Rotation) => Promise<RenderablePdf>;
  onProgress?: (progress: JobProgress) => void;
  signal?: AbortSignal;
}

/**
 * Turn every page of every PDF into an image, in order. One image downloads as is; more are
 * bundled into a ZIP named page by page ("report-01.jpg"). Pages are rendered one at a time,
 * so only one canvas exists at once.
 */
export async function pdfsToImages(
  pdfs: readonly PdfFile[],
  { type, open, onProgress, signal }: ConvertOptions,
): Promise<JobResult> {
  const total = pdfs.reduce((sum, pdf) => sum + pdf.pageCount, 0);
  const extension = extensionFor(type);
  const names = uniqueBaseNames(pdfs.map((pdf) => pdf.name));
  const images: { name: string; data: Uint8Array }[] = [];

  for (const [index, pdf] of pdfs.entries()) {
    try {
      const doc = await open(pdf.file, pdf.rotation);
      try {
        for (let page = 1; page <= doc.pageCount; page++) {
          throwIfAborted(signal);
          onProgress?.({
            fraction: Math.min(images.length / total, 1),
            label: `Converting page ${images.length + 1} of ${total}: ${pdf.name}`,
          });
          const image = await doc.render(page);
          images.push({
            name: pageFileName(names[index] ?? 'page', page, doc.pageCount, extension),
            data: new Uint8Array(await image.arrayBuffer()),
          });
        }
      } finally {
        await doc.close();
      }
    } catch (error) {
      throw toJobError(error, index, pdf.name);
    }
  }

  const [only] = images;
  if (images.length === 1 && only) return { bytes: only.data, type, pageCount: 1 };

  onProgress?.({ fraction: 1, label: 'Packing the ZIP file…' });
  // Stored, not deflated: JPEG and PNG are already compressed, so this is just as small and faster.
  const zip = zipSync(Object.fromEntries(images.map(({ name, data }) => [name, data])), {
    level: 0,
  });
  return { bytes: zip, type: 'application/zip', pageCount: images.length };
}

/** "report", page 3 of 12 -> "report-03.jpg". Zero-padded so the files sort in page order. */
export function pageFileName(
  base: string,
  page: number,
  pageCount: number,
  extension: string,
): string {
  return `${base}-${String(page).padStart(String(pageCount).length, '0')}.${extension}`;
}

/**
 * The PDFs' names without ".pdf", made unique so two files called "scan.pdf" don't overwrite
 * each other's pages. Compared case-insensitively, as Windows and macOS do when unzipping.
 */
export function uniqueBaseNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    const base = name.replace(/\.pdf$/i, '').trim() || 'document';
    let unique = base;
    for (let n = 2; used.has(unique.toLowerCase()); n++) unique = `${base} (${n})`;
    used.add(unique.toLowerCase());
    return unique;
  });
}

function toJobError(error: unknown, index: number, name: string): JobError {
  if (error instanceof JobError) return error;
  if (error instanceof RangeError) {
    return new JobError(
      'failed',
      'Your browser ran out of memory. Try a lower resolution or fewer pages at a time.',
      { index, name },
    );
  }
  const { code, message } = describeLoadError(error);
  return new JobError(code, message, { index, name });
}
