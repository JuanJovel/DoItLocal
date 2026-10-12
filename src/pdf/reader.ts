/**
 * pdf.js wrapper used for page counts and thumbnails.
 *
 * pdf.js is imported dynamically, so none of it is downloaded until the PDFold
 * page actually needs it. Files are read through a range transport that pulls
 * slices of the `File` on demand, so even a 500 MB PDF is never loaded into memory
 * whole just to show a thumbnail.
 */
import type * as PdfJsModule from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy, PDFDataRangeTransport } from 'pdfjs-dist/legacy/build/pdf.mjs';

type PdfJs = typeof PdfJsModule;

let pdfjsPromise: Promise<PdfJs> | undefined;

/** Load pdf.js and point it at the locally bundled worker (no CDN, no network). */
function loadPdfjs(): Promise<PdfJs> {
  pdfjsPromise ??= (async () => {
    const [lib, worker] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  })();
  // Allow a retry if the chunk failed to load (e.g. flaky connection on first visit).
  pdfjsPromise.catch(() => {
    pdfjsPromise = undefined;
  });
  return pdfjsPromise;
}

/** Download and parse pdf.js ahead of time (called when the browser is idle). */
export function preloadPdfjs(): void {
  loadPdfjs().catch(() => undefined);
}

/** Raised when slices of the file can no longer be read from disk (see `describeLoadError`). */
class FileReadError extends Error {
  override name = 'FileReadError';
}

const INITIAL_CHUNK = 64 * 1024;

/** Serves pdf.js byte-range requests straight from a `File`. */
function createTransport(
  pdfjs: PdfJs,
  file: File,
  initial: Uint8Array,
  onReadError: (error: Error) => void,
): PDFDataRangeTransport {
  class FileRangeTransport extends pdfjs.PDFDataRangeTransport {
    override requestDataRange(begin: number, end: number): void {
      file
        .slice(begin, end)
        .arrayBuffer()
        .then(
          (buffer) => this.onDataRange(begin, new Uint8Array(buffer)),
          () => onReadError(new FileReadError('Could not read the file.')),
        );
    }
  }
  return new FileRangeTransport(file.size, initial);
}

interface OpenDocument {
  doc: PDFDocumentProxy;
  destroy: () => Promise<void>;
}

async function openDocument(file: File): Promise<OpenDocument> {
  const pdfjs = await loadPdfjs();
  const initial = new Uint8Array(await file.slice(0, INITIAL_CHUNK).arrayBuffer());

  let failRead: (error: Error) => void = () => undefined;
  const readFailure = new Promise<never>((_, reject) => {
    failRead = reject;
  });
  const task = pdfjs.getDocument({
    range: createTransport(pdfjs, file, initial, (e) => failRead(e)),
    // Nothing is ever fetched over the network; missing optional resources just degrade.
    useWorkerFetch: false,
    useSystemFonts: true,
    enableXfa: false,
    disableAutoFetch: true,
  });
  try {
    const doc = await Promise.race([task.promise, readFailure]);
    return { doc, destroy: () => task.destroy() };
  } catch (error) {
    void task.destroy();
    throw error;
  }
}

/**
 * Opens a PDF just far enough to learn its page count. Rejects with the pdf.js (or read) error,
 * which `describeLoadError` turns into a message.
 */
export async function inspectPdf(file: File): Promise<{ pageCount: number }> {
  const opened = await openDocument(file);
  try {
    return { pageCount: opened.doc.numPages };
  } finally {
    await opened.destroy();
  }
}

/** Longest side of the generated thumbnail in pixels (shown at ~half size on 2x screens). */
const THUMB_MAX_SIDE = 360;

/**
 * Render page 1 to a small JPEG. Returns null if rendering fails: a missing thumbnail
 * must never make an otherwise mergeable file look broken.
 */
export async function renderThumbnail(file: File): Promise<Blob | null> {
  let opened: OpenDocument | undefined;
  try {
    opened = await openDocument(file);
    const page = await opened.doc.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const scale = THUMB_MAX_SIDE / Math.max(natural.width, natural.height);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;
    page.cleanup();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    canvas.width = canvas.height = 0; // release the bitmap memory right away
    return blob;
  } catch {
    return null;
  } finally {
    await opened?.destroy();
  }
}
