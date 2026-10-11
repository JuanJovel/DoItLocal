import { commonProblems, readHead, type Inspection } from '../../file-queue/intake';
import type { FileProblem } from '../../file-queue/store';
import { canDecode } from './decode';
import { KIND_LABELS, SNIFF_BYTES, sniffImage, type ImageKind } from './image-file';

export interface ImageInfo {
  kind: ImageKind;
}

/**
 * Check one added file: it must be a recognizable image, and any format pdf-lib can't embed
 * directly must be one this browser can decode (HEIC, for example, only opens in Safari).
 */
export async function inspectImage(
  file: File,
  decodes: (file: File) => Promise<boolean> = canDecode,
): Promise<Inspection<ImageInfo>> {
  if (file.size === 0) return { problem: commonProblems.empty };

  const head = await readHead(file, SNIFF_BYTES);
  if (!head) return { problem: commonProblems.unreadable };

  const kind = sniffImage(head);
  if (!kind) return { problem: notAnImage(head) };
  if (kind !== 'jpeg' && kind !== 'png' && !(await decodes(file))) {
    return { problem: unsupported(kind) };
  }
  return { info: { kind } };
}

function notAnImage(head: Uint8Array): FileProblem {
  const isPdf = String.fromCharCode(...head.subarray(0, 5)) === '%PDF-';
  return {
    code: 'not-image',
    message: isPdf
      ? 'This is a PDF, not an image. To combine PDFs, use PDFold.'
      : 'This doesn’t look like an image. PicFold accepts JPEG, PNG, GIF, WebP, BMP, HEIC and AVIF.',
  };
}

function unsupported(kind: ImageKind): FileProblem {
  return {
    code: 'unsupported',
    message:
      kind === 'heic'
        ? 'This browser can’t open HEIC photos. Try Safari, or set your iPhone camera to “Most Compatible” so it saves JPEGs.'
        : `This browser can’t open ${KIND_LABELS[kind]} images. Convert it to JPEG or PNG first.`,
  };
}
