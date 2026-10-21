import { describe, expect, it } from 'vitest';
import { fitCanvas, MAX_CANVAS_PIXELS } from './reader';

describe('fitCanvas', () => {
  it('keeps the requested scale when the image fits', () => {
    // A4 at 300 DPI: 2480 x 3508 pixels.
    expect(fitCanvas(595, 842, 300 / 72)).toBe(300 / 72);
  });

  it('scales a poster down to the largest canvas every browser can draw', () => {
    // A0 at 300 DPI would be about 9933 x 14043 pixels.
    const scale = fitCanvas(2384, 3370, 300 / 72);
    expect(scale).toBeLessThan(300 / 72);
    expect(2384 * scale * 3370 * scale).toBeCloseTo(MAX_CANVAS_PIXELS, -2);
  });
});
