import { describe, expect, it } from 'vitest';
import { jpegOrientation, orientationRotation, sniffImage } from './image-file';
import { makeImage, withOrientation } from './test-helpers';

const bytes = (...parts: (string | number[])[]): Uint8Array =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((c) => c.charCodeAt(0)) : part,
    ),
  );

describe('sniffImage', () => {
  it('recognizes images by their bytes', () => {
    expect(sniffImage(makeImage('jpeg', 4, 4))).toBe('jpeg');
    expect(sniffImage(makeImage('png', 4, 4))).toBe('png');
    expect(sniffImage(bytes('GIF89a'))).toBe('gif');
    expect(sniffImage(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 '))).toBe('webp');
    expect(sniffImage(bytes('BM', [0, 0, 0, 0]))).toBe('bmp');
    expect(sniffImage(bytes([0, 0, 0, 24], 'ftypheic'))).toBe('heic');
    expect(sniffImage(bytes([0, 0, 0, 24], 'ftypmif1'))).toBe('heic');
    expect(sniffImage(bytes([0, 0, 0, 24], 'ftypavif'))).toBe('avif');
  });

  it('rejects everything else', () => {
    expect(sniffImage(bytes('%PDF-1.7'))).toBeNull();
    expect(sniffImage(bytes([0, 0, 0, 24], 'ftypisom'))).toBeNull(); // an MP4 video
    expect(sniffImage(bytes('<svg xmlns='))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});

describe('jpegOrientation', () => {
  const jpeg = makeImage('jpeg', 8, 4);

  it('is 1 when the photo has no EXIF data', () => {
    expect(jpegOrientation(jpeg)).toBe(1);
  });

  it('reads the tag in both byte orders', () => {
    expect(jpegOrientation(withOrientation(jpeg, 6))).toBe(6);
    expect(jpegOrientation(withOrientation(jpeg, 8, true))).toBe(8);
  });

  it('survives truncated data', () => {
    expect(jpegOrientation(withOrientation(jpeg, 6).subarray(0, 20))).toBe(1);
  });
});

describe('orientationRotation', () => {
  it('turns rotations into a clockwise page turn and refuses mirrored ones', () => {
    expect([1, 3, 6, 8].map(orientationRotation)).toEqual([0, 180, 90, 270]);
    expect([2, 4, 5, 7].map(orientationRotation)).toEqual([null, null, null, null]);
    expect(orientationRotation(0)).toBe(0);
  });
});
