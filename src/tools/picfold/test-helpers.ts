import { createCanvas } from '@napi-rs/canvas';

/** Test utilities: real JPEG and PNG files, optionally tagged with an EXIF orientation. */

export function makeImage(format: 'jpeg' | 'png', width: number, height: number): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3366cc';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(0, 0, width / 2, height / 2);
  return new Uint8Array(
    format === 'jpeg' ? canvas.toBuffer('image/jpeg') : canvas.toBuffer('image/png'),
  );
}

/** Insert an EXIF block holding only the Orientation tag right after the JPEG's SOI marker. */
export function withOrientation(
  jpeg: Uint8Array,
  orientation: number,
  littleEndian = false,
): Uint8Array {
  const tiff = new DataView(new ArrayBuffer(26));
  tiff.setUint16(0, littleEndian ? 0x4949 : 0x4d4d);
  tiff.setUint16(2, 42, littleEndian);
  tiff.setUint32(4, 8, littleEndian); // first IFD right after the header
  tiff.setUint16(8, 1, littleEndian); // one entry
  tiff.setUint16(10, 0x0112, littleEndian); // Orientation
  tiff.setUint16(12, 3, littleEndian); // type SHORT
  tiff.setUint32(14, 1, littleEndian); // count
  tiff.setUint16(18, orientation, littleEndian);
  tiff.setUint32(22, 0, littleEndian); // no next IFD

  const app1 = [0xff, 0xe1, 0, 2 + 6 + 26, ...'Exif\0\0'].map((c) =>
    typeof c === 'string' ? c.charCodeAt(0) : c,
  );
  return new Uint8Array([
    ...jpeg.subarray(0, 2),
    ...app1,
    ...new Uint8Array(tiff.buffer),
    ...jpeg.subarray(2),
  ]);
}

export const fileOf = (bytes: Uint8Array | string, name: string): File =>
  new File([bytes as BlobPart], name);
