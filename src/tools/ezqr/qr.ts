import qrcode from 'qrcode-generator';

// The encoder defaults to Latin-1, which garbles accents, emoji and non-Latin scripts.
const textEncoder = new TextEncoder();
qrcode.stringToBytes = (text: string): number[] => Array.from(textEncoder.encode(text));

export type ErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export const ERROR_CORRECTION_LABELS: Record<ErrorCorrection, string> = {
  L: 'Low (7%): smallest code',
  M: 'Medium (15%): good default',
  Q: 'Quartile (25%)',
  H: 'High (30%): survives wear and logos',
};

/** Modules of empty "quiet zone" around the code. The QR spec asks for at least 4. */
export const QUIET_ZONE = 4;

export interface QrMatrix {
  /** Modules per side (not counting the quiet zone). */
  size: number;
  /** `modules[row][col]` is true for a dark module. */
  modules: boolean[][];
}

/** Thrown when the text doesn't fit in the largest QR code at the chosen error correction. */
export class QrTooLongError extends Error {
  constructor() {
    super('That is too much for a single QR code. Shorten the text or lower the error correction.');
    this.name = 'QrTooLongError';
  }
}

export function createQr(text: string, level: ErrorCorrection): QrMatrix {
  const qr = qrcode(0, level); // 0 = pick the smallest version that fits
  try {
    qr.addData(text, 'Byte');
    qr.make();
  } catch {
    throw new QrTooLongError();
  }
  const size = qr.getModuleCount();
  const modules = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => qr.isDark(row, col)),
  );
  return { size, modules };
}

export interface QrColors {
  /** Foreground (dark module) color as #rrggbb. */
  fg: string;
  /** Background color as #rrggbb. */
  bg: string;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

function assertColors({ fg, bg }: QrColors): void {
  if (!isHexColor(fg) || !isHexColor(bg)) throw new Error('Colors must look like #rrggbb.');
}

/** Pixels per module for a requested image width, never less than 1. */
export function pixelsPerModule(totalModules: number, targetPx: number): number {
  return Math.max(1, Math.floor(targetPx / totalModules));
}

/** Crisp, scalable vector output: one path per row-run of dark modules. */
export function toSvg(matrix: QrMatrix, colors: QrColors): string {
  assertColors(colors);
  const total = matrix.size + QUIET_ZONE * 2;
  let path = '';
  matrix.modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      path += `M${start + QUIET_ZONE} ${y + QUIET_ZONE}h${x - start}v1h-${x - start}z`;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="${total * 10}" height="${total * 10}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${colors.bg}"/>` +
    `<path d="${path}" fill="${colors.fg}"/></svg>`
  );
}

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA bytes, row-major. */
  data: Uint8ClampedArray<ArrayBuffer>;
}

function parseHex(color: string): [number, number, number] {
  const n = Number.parseInt(color.replace(/^#/, ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Render to raw RGBA pixels at a whole number of pixels per module (so edges stay sharp).
 * The result is at most `targetPx` wide and as close to it as whole modules allow.
 */
export function toRaster(matrix: QrMatrix, colors: QrColors, targetPx: number): RasterImage {
  assertColors(colors);
  const total = matrix.size + QUIET_ZONE * 2;
  const scale = pixelsPerModule(total, targetPx);
  const side = total * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  const [fr, fg, fb] = parseHex(colors.fg);
  const [br, bg, bb] = parseHex(colors.bg);

  for (let y = 0; y < side; y++) {
    const row = matrix.modules[Math.floor(y / scale) - QUIET_ZONE];
    for (let x = 0; x < side; x++) {
      const dark = row?.[Math.floor(x / scale) - QUIET_ZONE] === true;
      const i = (y * side + x) * 4;
      data[i] = dark ? fr : br;
      data[i + 1] = dark ? fg : bg;
      data[i + 2] = dark ? fb : bb;
      data[i + 3] = 255;
    }
  }
  return { width: side, height: side, data };
}

/** WCAG relative luminance of a #rrggbb color. */
function luminance(color: string): number {
  const [r, g, b] = parseHex(color).map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** A readable warning when the colors are likely to produce a code that won't scan, else null. */
export function colorWarning({ fg, bg }: QrColors): string | null {
  if (contrastRatio(fg, bg) < 3) {
    return 'These colors are too similar: the code may not scan. Pick a darker foreground or a lighter background.';
  }
  if (luminance(fg) > luminance(bg)) {
    return 'Light-on-dark codes work with many phones but not all scanners. Dark-on-light is the safest.';
  }
  return null;
}
