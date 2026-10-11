import type { Rotation } from '../../file-queue/reorder';

/** Image formats PicFold recognizes. pdf-lib embeds JPEG and PNG as is; the rest are re-encoded. */
export type ImageKind = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'heic' | 'avif';

export const KIND_LABELS: Record<ImageKind, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  gif: 'GIF',
  webp: 'WebP',
  bmp: 'BMP',
  heic: 'HEIC',
  avif: 'AVIF',
};

/** Enough of the file to recognize every format above. */
export const SNIFF_BYTES = 32;

const ascii = (bytes: Uint8Array, start: number, end: number): string =>
  String.fromCharCode(...bytes.subarray(start, end));

/** Recognize an image by its first bytes rather than trusting the file name or type. */
export function sniffImage(head: Uint8Array): ImageKind | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  if (ascii(head, 0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (ascii(head, 0, 4) === 'GIF8') return 'gif';
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'webp';
  if (ascii(head, 0, 2) === 'BM') return 'bmp';
  // ISO-BMFF ("ftyp" box): the major brand says which image format it is.
  if (ascii(head, 4, 8) === 'ftyp') {
    const brand = ascii(head, 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
      return 'heic';
    }
  }
  return null;
}

/**
 * The EXIF orientation (1-8) of a JPEG, or 1 when it has none. Phone cameras store photos
 * sideways and set this tag instead of rotating the pixels; browsers honor it, PDFs don't.
 */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2; // skip the SOI marker
  while (offset + 4 <= view.byteLength && view.getUint8(offset) === 0xff) {
    const marker = view.getUint8(offset + 1);
    if (marker === 0xda) break; // start of scan: image data follows, no more metadata
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1 && ascii(bytes, offset + 4, offset + 10) === 'Exif\0\0') {
      return exifOrientation(view, offset + 10) ?? 1;
    }
    offset += 2 + length;
  }
  return 1;
}

/** Find tag 0x0112 (Orientation) in the first IFD of the TIFF block that starts at `tiff`. */
function exifOrientation(view: DataView, tiff: number): number | undefined {
  try {
    const little = view.getUint16(tiff) === 0x4949; // "II" = Intel byte order
    const ifd = tiff + view.getUint32(tiff + 4, little);
    const count = view.getUint16(ifd, little);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
    }
  } catch {
    // Truncated or malformed EXIF: treat the photo as upright.
  }
  return undefined;
}

/**
 * The clockwise turn that shows an EXIF-oriented photo upright, or null for the mirrored
 * orientations (2, 4, 5, 7), which a page rotation can't express.
 */
export function orientationRotation(orientation: number): Rotation | null {
  switch (orientation) {
    case 1:
      return 0;
    case 3:
      return 180;
    case 6:
      return 90;
    case 8:
      return 270;
    default:
      return orientation >= 2 && orientation <= 8 ? null : 0;
  }
}
