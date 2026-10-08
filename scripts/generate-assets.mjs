/**
 * Generates the raster brand assets from code (no design tools needed):
 *   public/og-image.png                 1200x630 social preview
 *   public/icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
 *
 * Run `npm run assets` after changing colors or the logo, and commit the results.
 * Uses @napi-rs/canvas (a dev dependency with prebuilt binaries; no system libraries).
 * The logo geometry mirrors public/favicon.svg and src/components/logo.ts.
 */
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
mkdirSync(join(publicDir, 'icons'), { recursive: true });

// Brand palette (keep in sync with src/styles/tokens.css).
const CELADON = '#a1cca5';
const MUTED_TEAL = '#8fb996';
const HUNTER_GREEN = '#415d43';
const CARBON = '#111d13';
const BG = '#070c08'; // page background: carbon black, darkened
const TEXT = '#e9f3ea';
const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Draw the DoItLocal mark (house + check) in a 32x32 design space scaled to `size`. */
function drawLogo(ctx, x, y, size, { rounded = true, radius = 8, glyphScale = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.fillStyle = CELADON;
  if (rounded) {
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, radius);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, 32, 32);
  }
  // Scale the glyph around the centre (used to keep maskable icons inside the safe zone).
  ctx.translate(16, 16);
  ctx.scale(glyphScale, glyphScale);
  ctx.translate(-16, -16);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Solid house...
  ctx.fillStyle = CARBON;
  ctx.strokeStyle = CARBON;
  ctx.lineWidth = 1.6;
  const house = new Path2D('M16 5.2 4.4 15.4h3.3v10.6h16.6V15.4h3.3L16 5.2z');
  ctx.fill(house);
  ctx.stroke(house);
  // ...with the check cut out of it.
  ctx.strokeStyle = CELADON;
  ctx.lineWidth = 2.6;
  ctx.stroke(new Path2D('m11.4 17.4 3.4 3.4 6-6.6'));
  ctx.restore();
}

function save(canvas, relativePath) {
  const target = join(publicDir, relativePath);
  writeFileSync(target, canvas.toBuffer('image/png'));
  console.log('wrote', relativePath);
}

function icon(size, options) {
  const canvas = createCanvas(size, size);
  drawLogo(canvas.getContext('2d'), 0, 0, size, options);
  return canvas;
}

save(icon(192), 'icons/icon-192.png');
save(icon(512), 'icons/icon-512.png');
// Maskable: full-bleed background, glyph shrunk into the central 80% safe zone.
save(icon(512, { rounded: false, glyphScale: 0.72 }), 'icons/icon-maskable-512.png');
save(icon(180, { rounded: false, glyphScale: 0.82 }), 'icons/apple-touch-icon.png');

// ---------------------------------------------------------------- OG image
{
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, BG);
  bg.addColorStop(1, '#0f1b11');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft accent glow, top right.
  const glow = ctx.createRadialGradient(1020, 60, 0, 1020, 60, 480);
  glow.addColorStop(0, 'rgba(161, 204, 165, 0.22)');
  glow.addColorStop(1, 'rgba(161, 204, 165, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  drawLogo(ctx, 80, 72, 96, { radius: 8 });
  ctx.fillStyle = TEXT;
  ctx.font = `700 40px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('DoItLocal Toolkit', 200, 120);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TEXT;
  ctx.font = `800 66px ${FONT}`;
  ctx.fillText('Free tools.', 80, 282);
  ctx.fillText('Private by design.', 80, 362);
  ctx.fillStyle = CELADON;
  ctx.fillText('Nothing leaves your device.', 80, 442);

  // Trust chips.
  const chips = ['100% free, no sign-up', 'Runs in your browser', 'Open source'];
  ctx.font = `600 26px ${FONT}`;
  let x = 80;
  for (const label of chips) {
    const w = ctx.measureText(label).width + 48;
    ctx.fillStyle = '#182a1b';
    ctx.strokeStyle = HUNTER_GREEN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, 500, w, 52, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = MUTED_TEAL;
    ctx.fillText(label, x + 24, 535);
    x += w + 16;
  }

  save(canvas, 'og-image.png');
}
