import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { JobProgress } from '../../file-queue/job';
import type { Rotation } from '../../file-queue/reorder';
import { imagesToPdf, loadImage, type ImageInput } from './convert';
import { fileOf, makeImage, withOrientation } from './test-helpers';

const fit = { size: 'fit', margin: 'none' } as const;

const noReencode = (): never => {
  throw new Error('should not re-encode');
};

function input(name: string, bytes: Uint8Array, rotation: Rotation = 0): ImageInput {
  const file = fileOf(bytes, name);
  const kind = name.endsWith('.png') ? 'png' : 'jpeg';
  return { name, rotation, load: () => loadImage({ file, kind }, noReencode) };
}

async function pages(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => ({
    width: Math.round(page.getWidth()),
    height: Math.round(page.getHeight()),
    rotation: page.getRotation().angle,
  }));
}

describe('imagesToPdf', () => {
  it('makes one page per image, in order, sized to each image', async () => {
    const result = await imagesToPdf(
      [
        input('wide.jpg', makeImage('jpeg', 400, 200)),
        input('tall.png', makeImage('png', 200, 400)),
      ],
      fit,
    );
    expect(result.pageCount).toBe(2);
    expect(await pages(result.bytes)).toEqual([
      { width: 300, height: 150, rotation: 0 },
      { width: 150, height: 300, rotation: 0 },
    ]);
  });

  it("turns EXIF-rotated photos upright and adds the user's rotation on top", async () => {
    const sideways = withOrientation(makeImage('jpeg', 400, 200), 6);
    const result = await imagesToPdf(
      [
        input('a.jpg', sideways),
        input('b.jpg', sideways, 90),
        input('c.png', makeImage('png', 8, 8), 270),
      ],
      fit,
    );
    expect((await pages(result.bytes)).map((p) => p.rotation)).toEqual([90, 180, 270]);
  });

  it('uses paper sizes when asked', async () => {
    const result = await imagesToPdf([input('a.jpg', makeImage('jpeg', 400, 200))], {
      size: 'letter',
      margin: 'small',
    });
    expect(await pages(result.bytes)).toEqual([{ width: 792, height: 612, rotation: 0 }]);
  });

  it('names the image that stopped the conversion', async () => {
    const error = await imagesToPdf(
      [
        input('good.jpg', makeImage('jpeg', 4, 4)),
        input('bad.jpg', new Uint8Array([0xff, 0xd8, 0xff, 0])),
      ],
      fit,
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'corrupt', failedFile: { index: 1, name: 'bad.jpg' } });
  });

  it('reports progress per image, ending at 1', async () => {
    const events: JobProgress[] = [];
    await imagesToPdf(
      [input('1.png', makeImage('png', 4, 4)), input('2.png', makeImage('png', 4, 4))],
      fit,
      { onProgress: (p) => events.push(p) },
    );
    const reading = events.filter((e) => e.stage === 'reading').map((e) => e.name);
    expect(reading).toEqual(['1.png', '2.png']);
    expect(events.at(-1)?.fraction).toBe(1);
  });
});

describe('loadImage', () => {
  it('re-encodes mirrored JPEGs and formats pdf-lib cannot embed', async () => {
    const png = makeImage('png', 4, 4);
    const reencode = async () => ({ format: 'png' as const, bytes: png });
    const mirrored = fileOf(withOrientation(makeImage('jpeg', 4, 4), 5), 'm.jpg');

    expect(await loadImage({ file: mirrored, kind: 'jpeg' }, reencode)).toEqual({
      format: 'png',
      bytes: png,
      upright: 0,
    });
    const webp = await loadImage({ file: fileOf('x', 'a.webp'), kind: 'webp' }, reencode);
    expect(webp.format).toBe('png');
  });
});
