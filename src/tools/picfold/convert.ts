import { degrees } from 'pdf-lib';
import { buildPdf, type BuildOptions, type BuildResult } from '../../file-queue/pdf-build';
import { rotateBy, type Rotation } from '../../file-queue/reorder';
import { reencode } from './decode';
import { jpegOrientation, orientationRotation, type ImageKind } from './image-file';
import { placeImage, type PageLayout } from './layout';

/** An image from the queue, as sent to the convert worker. */
export interface ImageFile {
  file: File;
  name: string;
  rotation: Rotation;
  kind: ImageKind;
}

export interface ConvertRequest {
  files: ImageFile[];
  layout: PageLayout;
}

/** Image bytes pdf-lib can embed, and the clockwise turn that shows them upright. */
export interface EmbeddableImage {
  format: 'jpeg' | 'png';
  bytes: Uint8Array;
  upright: Rotation;
}

export interface ImageInput {
  name: string;
  /** Extra clockwise rotation the user chose. */
  rotation: Rotation;
  /** Called lazily, one image at a time, to limit memory use. */
  load: () => Promise<EmbeddableImage>;
}

/** One page per image, in order. */
export function imagesToPdf(
  inputs: readonly ImageInput[],
  layout: PageLayout,
  options?: BuildOptions,
): Promise<BuildResult> {
  return buildPdf(
    inputs,
    {
      producer: 'PicFold (DoItLocal)',
      describeError: () => ({
        code: 'corrupt',
        message: "This image looks damaged or couldn't be decoded, so it can't be added.",
      }),
      async add(doc, input) {
        const { format, bytes, upright } = await input.load();
        const image = format === 'jpeg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
        const rotation = rotateBy(upright, input.rotation);
        const { pageWidth, pageHeight, ...box } = placeImage(
          image.width,
          image.height,
          rotation,
          layout,
        );
        const page = doc.addPage([pageWidth, pageHeight]);
        page.drawImage(image, box);
        if (rotation !== 0) page.setRotation(degrees(rotation));
        return 1;
      },
    },
    options,
  );
}

/**
 * Prepare one image for embedding. JPEG and PNG go in untouched (no quality loss), with the
 * JPEG's EXIF orientation turned into a page rotation. Everything else, and the rare mirrored
 * JPEG, is decoded and re-encoded upright by the browser.
 */
export async function loadImage(
  { file, kind }: Pick<ImageFile, 'file' | 'kind'>,
  reencodeImage = reencode,
): Promise<EmbeddableImage> {
  if (kind === 'png' || kind === 'jpeg') {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upright = kind === 'png' ? 0 : orientationRotation(jpegOrientation(bytes));
    if (upright !== null) return { format: kind, bytes, upright };
  }
  return { ...(await reencodeImage(file, kind)), upright: 0 };
}

export function convertFiles(
  { files, layout }: ConvertRequest,
  options?: BuildOptions,
): Promise<BuildResult> {
  return imagesToPdf(
    files.map((file) => ({
      name: file.name,
      rotation: file.rotation,
      load: () => loadImage(file),
    })),
    layout,
    options,
  );
}
