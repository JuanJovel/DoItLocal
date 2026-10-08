/**
 * File validation and friendly error messages.
 *
 * Messages deliberately omit the file name: the UI shows it next to the message
 * (and prefixes it for screen-reader announcements).
 */

export type ProblemCode = 'empty' | 'not-pdf' | 'corrupt' | 'password' | 'unreadable';

export interface FileProblem {
  code: ProblemCode;
  message: string;
}

/** The PDF spec allows up to 1024 bytes of junk before the "%PDF-" header. */
const HEADER_WINDOW = 1024;

const MESSAGES = {
  empty: 'This file is empty (0 bytes), so there is nothing to merge.',
  corrupt: 'This file looks damaged or is not a valid PDF, so it can’t be read.',
  password:
    'This PDF is password-protected. Remove the password in the app that created it, then add it again.',
  unreadable:
    'This file couldn’t be read. It may have been moved, renamed or still be saving. Try adding it again.',
} as const;

/** Best-effort description of what a non-PDF file is, for a more specific message. */
function describeNonPdf(name: string, type: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'svg', 'tif', 'tiff'].includes(ext)
  )
    return 'This is an image, not a PDF. PDFold only merges PDF files.';
  if (['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods'].includes(ext))
    return 'This is an office document, not a PDF. Export or “Save as PDF” first, then add it.';
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext))
    return 'This is an archive, not a PDF. Extract it first, then add the PDFs inside.';
  if (type.startsWith('text/') || ['txt', 'md', 'csv', 'html', 'htm'].includes(ext))
    return 'This is a text file, not a PDF. PDFold only merges PDF files.';
  return 'This doesn’t look like a PDF. PDFold only merges PDF files.';
}

function claimsToBePdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

/**
 * Cheap first check that only reads the first KB of the file, so it stays instant
 * even for multi-hundred-megabyte PDFs. Returns null when the file looks like a PDF.
 */
export async function checkPdfFile(file: File): Promise<FileProblem | null> {
  if (file.size === 0) return { code: 'empty', message: MESSAGES.empty };

  let head: string;
  try {
    const bytes = new Uint8Array(await file.slice(0, HEADER_WINDOW).arrayBuffer());
    head = String.fromCharCode(...bytes);
  } catch {
    return { code: 'unreadable', message: MESSAGES.unreadable };
  }

  if (head.includes('%PDF-')) return null;
  if (claimsToBePdf(file)) return { code: 'corrupt', message: MESSAGES.corrupt };
  return { code: 'not-pdf', message: describeNonPdf(file.name, file.type) };
}

/**
 * Map an error thrown while opening a PDF with pdf.js to a friendly problem.
 * pdf.js sets explicit `name` strings on its exceptions, which survive minification.
 */
export function describeLoadError(error: unknown): FileProblem {
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return { code: 'password', message: MESSAGES.password };
  if (name === 'FileReadError') return { code: 'unreadable', message: MESSAGES.unreadable };
  return { code: 'corrupt', message: MESSAGES.corrupt };
}

export function problemFor(code: Exclude<ProblemCode, 'not-pdf'>): FileProblem {
  return { code, message: MESSAGES[code] };
}
