import { commonProblems, readHead, type Inspection } from '../../file-queue/intake';
import type { FileProblem } from '../../file-queue/store';
import { inspectPdf } from './pdf-reader';

/**
 * PDF validation and friendly error messages.
 *
 * Messages deliberately omit the file name: the UI shows it next to the message
 * (and prefixes it for screen-reader announcements).
 */

export type ProblemCode = 'empty' | 'not-pdf' | 'corrupt' | 'password' | 'unreadable';

export interface PdfInfo {
  pageCount: number;
}

/** The PDF spec allows up to 1024 bytes of junk before the "%PDF-" header. */
const HEADER_WINDOW = 1024;

const problems = {
  ...commonProblems,
  corrupt: {
    code: 'corrupt',
    message: "This file looks damaged or is not a valid PDF, so it can't be read.",
  },
  password: {
    code: 'password',
    message:
      'This PDF is password-protected. Remove the password in the app that created it, then add it again.',
  },
} satisfies Record<Exclude<ProblemCode, 'not-pdf'>, FileProblem>;

export function problemFor(code: Exclude<ProblemCode, 'not-pdf'>): FileProblem {
  return problems[code];
}

/** Best-effort description of what a non-PDF file is, for a more specific message. */
function describeNonPdf(name: string, type: string): string {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  if (
    type.startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'bmp', 'svg', 'tif', 'tiff'].includes(ext)
  )
    return 'This is an image, not a PDF. To turn images into a PDF, use PicFold.';
  if (['doc', 'docx', 'odt', 'rtf', 'ppt', 'pptx', 'odp', 'xls', 'xlsx', 'ods'].includes(ext))
    return 'This is an office document, not a PDF. Export or "Save as PDF" first, then add it.';
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext))
    return 'This is an archive, not a PDF. Extract it first, then add the PDFs inside.';
  if (type.startsWith('text/') || ['txt', 'md', 'csv', 'html', 'htm'].includes(ext))
    return 'This is a text file, not a PDF. PDFold only merges PDF files.';
  return "This doesn't look like a PDF. PDFold only merges PDF files.";
}

/**
 * Cheap first check that only reads the first KB of the file, so it stays instant
 * even for multi-hundred-megabyte PDFs. Returns null when the file looks like a PDF.
 */
export async function checkPdfFile(file: File): Promise<FileProblem | null> {
  if (file.size === 0) return problems.empty;

  const head = await readHead(file, HEADER_WINDOW);
  if (!head) return problems.unreadable;
  if (String.fromCharCode(...head).includes('%PDF-')) return null;

  const claimsToBePdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (claimsToBePdf) return problems.corrupt;
  return { code: 'not-pdf', message: describeNonPdf(file.name, file.type) };
}

/**
 * Map an error thrown while opening a PDF with pdf.js to a friendly problem.
 * pdf.js sets explicit `name` strings on its exceptions, which survive minification.
 */
export function describeLoadError(error: unknown): FileProblem {
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return problems.password;
  if (name === 'FileReadError') return problems.unreadable;
  return problems.corrupt;
}

/** The full check run on every added file: a quick header check, then opening it with pdf.js. */
export async function inspectPdfFile(
  file: File,
  open: (file: File) => Promise<PdfInfo> = inspectPdf,
): Promise<Inspection<PdfInfo>> {
  const problem = await checkPdfFile(file);
  if (problem) return { problem };
  try {
    return { info: await open(file) };
  } catch (error) {
    return { problem: describeLoadError(error) };
  }
}
