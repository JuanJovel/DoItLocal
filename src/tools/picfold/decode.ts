import type { ImageKind } from './image-file';

/**
 * Browser-only image work: decoding with `createImageBitmap`, which applies EXIF orientation
 * and opens every format the browser supports (including HEIC in Safari).
 */

/** True when this browser can open the image. */
export async function canDecode(file: Blob): Promise<boolean> {
  try {
    (await createImageBitmap(file)).close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encode an image pdf-lib can't embed as is: photo formats become JPEG, everything else PNG
 * (which keeps transparency and sharp edges). The pixels come out upright. Works in a worker.
 */
export async function reencode(
  file: Blob,
  kind: ImageKind,
): Promise<{ format: 'jpeg' | 'png'; bytes: Uint8Array }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available.');
    ctx.drawImage(bitmap, 0, 0);

    const format = kind === 'jpeg' || kind === 'heic' || kind === 'avif' ? 'jpeg' : 'png';
    const blob = await canvas.convertToBlob({ type: `image/${format}`, quality: 0.92 });
    return { format, bytes: new Uint8Array(await blob.arrayBuffer()) };
  } finally {
    bitmap.close();
  }
}

/** Longest side of the generated thumbnail in pixels (shown at ~half size on 2x screens). */
const THUMB_MAX_SIDE = 360;

/** A small upright JPEG preview, or null if the image can't be decoded. */
export async function renderThumbnail(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, THUMB_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // JPEG has no transparency: show transparent areas on white, as the PDF page will.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.82),
    );
    canvas.width = canvas.height = 0; // release the bitmap memory right away
    return blob;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
