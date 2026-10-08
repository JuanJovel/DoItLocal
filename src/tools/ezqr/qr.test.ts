import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import {
  colorWarning,
  contrastRatio,
  createQr,
  isHexColor,
  pixelsPerModule,
  QrTooLongError,
  QUIET_ZONE,
  toRaster,
  toSvg,
  type ErrorCorrection,
} from './qr';

const BLACK_ON_WHITE = { fg: '#000000', bg: '#ffffff' };

/** Render to pixels and decode with an independent QR reader: a true "does it scan" check. */
function scan(text: string, level: ErrorCorrection = 'M', colors = BLACK_ON_WHITE): string | null {
  const image = toRaster(createQr(text, level), colors, 600);
  return jsQR(image.data, image.width, image.height)?.data ?? null;
}

describe('createQr', () => {
  it('uses the smallest version that fits (21 modules for short text)', () => {
    expect(createQr('hello', 'M').size).toBe(21);
  });

  it('grows with the amount of text and the error correction level', () => {
    const short = createQr('x'.repeat(10), 'M').size;
    const long = createQr('x'.repeat(300), 'M').size;
    expect(long).toBeGreaterThan(short);
    expect(createQr('x'.repeat(100), 'H').size).toBeGreaterThan(
      createQr('x'.repeat(100), 'L').size,
    );
  });

  it('is square and has the three finder patterns in the corners', () => {
    const { size, modules } = createQr('finder', 'L');
    expect(modules).toHaveLength(size);
    for (const [r, c] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as const) {
      expect(modules[r]?.[c]).toBe(true); // outer ring corner
      expect(modules[r! + 3]?.[c! + 3]).toBe(true); // 3x3 centre
      expect(modules[r! + 1]?.[c! + 1]).toBe(false); // gap between ring and centre
    }
  });

  it('rejects text that cannot fit in any QR code', () => {
    expect(() => createQr('x'.repeat(5000), 'M')).toThrow(QrTooLongError);
    expect(() => createQr('x'.repeat(2500), 'H')).toThrow(QrTooLongError);
  });

  it('accepts a long but legal payload', () => {
    expect(() => createQr('x'.repeat(2900), 'L')).not.toThrow();
  });
});

describe('rendered codes really scan', () => {
  it.each([
    ['https://example.com'],
    ['https://example.com/a/very/long/path?with=query&and=more#fragment'],
    ['plain text with spaces'],
    ['multi\nline\ntext'],
    ['Crème brûlée ✓ 你好 🎉'], // UTF-8: accents, CJK and emoji must survive
  ])('decodes %j back to the original text', (text) => {
    expect(scan(text)).toBe(text);
  });

  it.each(['L', 'M', 'Q', 'H'] as const)('works at error correction %s', (level) => {
    expect(scan('error correction test', level)).toBe('error correction test');
  });

  it('works with custom dark colors', () => {
    expect(scan('colorful', 'M', { fg: '#1b3a1d', bg: '#f4fff5' })).toBe('colorful');
  });

  it('works for a big code (version 20+)', () => {
    const text = 'a longer payload '.repeat(40);
    expect(scan(text, 'M')).toBe(text);
  });
});

describe('toRaster', () => {
  it('uses whole pixels per module and includes the quiet zone', () => {
    const matrix = createQr('hello', 'M');
    const total = matrix.size + QUIET_ZONE * 2; // 29
    const image = toRaster(matrix, BLACK_ON_WHITE, 512);
    const scale = Math.floor(512 / total);
    expect(image.width).toBe(total * scale);
    expect(image.height).toBe(image.width);
    expect(image.data).toHaveLength(image.width * image.height * 4);
  });

  it('paints the quiet zone with the background color and the finder corner with the foreground', () => {
    const image = toRaster(createQr('hello', 'M'), { fg: '#102030', bg: '#fafbfc' }, 290);
    const px = (x: number, y: number): number[] => {
      const i = (y * image.width + x) * 4;
      return [...image.data.slice(i, i + 4)];
    };
    const scale = image.width / 29;
    expect(px(0, 0)).toEqual([0xfa, 0xfb, 0xfc, 255]);
    expect(px(QUIET_ZONE * scale, QUIET_ZONE * scale)).toEqual([0x10, 0x20, 0x30, 255]);
  });

  it('never goes below one pixel per module', () => {
    expect(pixelsPerModule(100, 10)).toBe(1);
    expect(pixelsPerModule(29, 512)).toBe(17);
  });

  it('rejects colors that are not #rrggbb', () => {
    const matrix = createQr('x', 'L');
    expect(() => toRaster(matrix, { fg: 'red', bg: '#ffffff' }, 100)).toThrow(/colors/i);
    expect(() => toRaster(matrix, { fg: '#000', bg: '#ffffff' }, 100)).toThrow();
  });
});

describe('toSvg', () => {
  const matrix = createQr('https://example.com', 'M');
  const svg = toSvg(matrix, { fg: '#102030', bg: '#fafbfc' });

  it('is a well-formed standalone SVG sized to the code plus the quiet zone', () => {
    const total = matrix.size + QUIET_ZONE * 2;
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('uses the chosen colors and contains no scripts or external references', () => {
    expect(svg).toContain('fill="#fafbfc"');
    expect(svg).toContain('fill="#102030"');
    expect(svg).not.toMatch(/<script|href=|url\(/i);
  });

  it('draws exactly the dark modules (path area equals the dark module count)', () => {
    const dark = matrix.modules.flat().filter(Boolean).length;
    const area = [...svg.matchAll(/h(\d+)v1h-\1z/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    expect(area).toBe(dark);
  });

  it('refuses unsafe color strings, so markup can never be injected', () => {
    expect(() => toSvg(matrix, { fg: '"/><script>', bg: '#ffffff' })).toThrow();
  });
});

describe('colors', () => {
  it('validates hex colors', () => {
    expect(isHexColor('#a1cca5')).toBe(true);
    expect(isHexColor('#A1CCA5')).toBe(true);
    expect(isHexColor('a1cca5')).toBe(false);
    expect(isHexColor('#fff')).toBe(false);
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#336699', '#336699')).toBe(1);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
  });

  it('warns about low contrast and about inverted codes, but not about black on white', () => {
    expect(colorWarning(BLACK_ON_WHITE)).toBeNull();
    expect(colorWarning({ fg: '#777777', bg: '#888888' })).toMatch(/too similar/i);
    expect(colorWarning({ fg: '#ffffff', bg: '#000000' })).toMatch(/light-on-dark/i);
  });
});
