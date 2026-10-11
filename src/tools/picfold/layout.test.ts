import { describe, expect, it } from 'vitest';
import { placeImage } from './layout';

const A4 = [595.28, 841.89];

describe('placeImage', () => {
  it('sizes "fit" pages to the image at 96 pixels per inch', () => {
    expect(placeImage(960, 480, 0, { size: 'fit', margin: 'none' })).toEqual({
      pageWidth: 720,
      pageHeight: 360,
      x: 0,
      y: 0,
      width: 720,
      height: 360,
    });
  });

  it('adds the margin around "fit" pages', () => {
    const place = placeImage(960, 480, 0, { size: 'fit', margin: 'small' });
    expect([place.pageWidth, place.pageHeight, place.x, place.y]).toEqual([756, 396, 18, 18]);
  });

  it('matches paper orientation to the image and centers it', () => {
    const portrait = placeImage(1000, 2000, 0, { size: 'a4', margin: 'none' });
    expect([portrait.pageWidth, portrait.pageHeight]).toEqual(A4);
    expect(portrait.height).toBeCloseTo(841.89);
    expect(portrait.x).toBeCloseTo((595.28 - portrait.width) / 2);

    const landscape = placeImage(2000, 1000, 0, { size: 'a4', margin: 'none' });
    expect([landscape.pageWidth, landscape.pageHeight]).toEqual([841.89, 595.28]);
  });

  it('lays a quarter-turned image out sideways, so it reads upright once the page turns', () => {
    // A landscape photo turned 90° is seen as portrait: portrait paper, landscape when unrotated.
    const place = placeImage(2000, 1000, 90, { size: 'a4', margin: 'none' });
    expect([place.pageWidth, place.pageHeight]).toEqual([841.89, 595.28]);
    expect(place.width).toBeCloseTo(841.89);
  });

  it('keeps the image inside the margins', () => {
    const place = placeImage(3000, 3000, 0, { size: 'letter', margin: 'large' });
    expect(place.width).toBeCloseTo(612 - 72);
    expect(place.y).toBeCloseTo((792 - place.height) / 2);
  });
});
