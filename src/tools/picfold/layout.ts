import type { Rotation } from '../../file-queue/reorder';

export type PageSize = 'fit' | 'a4' | 'letter';
export type Margin = 'none' | 'small' | 'large';

export interface PageLayout {
  size: PageSize;
  margin: Margin;
}

/** Paper sizes in PDF points (1/72 inch), portrait. */
const PAPER: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

const MARGIN_POINTS: Record<Margin, number> = { none: 0, small: 18, large: 36 };

/** "Fit" pages show the image at 96 pixels per inch, the usual screen resolution. */
const POINTS_PER_PIXEL = 72 / 96;

export interface Placement {
  pageWidth: number;
  pageHeight: number;
  /** Where the image is drawn on the unrotated page. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Size a page for an image and center the image on it.
 *
 * Rotation is applied afterwards as the page's /Rotate, so everything here is in the page's
 * unrotated space: for a quarter turn the page is laid out sideways, and the viewer turns it
 * upright. Paper pages pick portrait or landscape to match the image as the reader will see it.
 */
export function placeImage(
  imageWidth: number,
  imageHeight: number,
  rotation: Rotation,
  { size, margin }: PageLayout,
): Placement {
  const sideways = rotation === 90 || rotation === 270;
  const pad = MARGIN_POINTS[margin];

  let pageWidth: number;
  let pageHeight: number;
  if (size === 'fit') {
    pageWidth = imageWidth * POINTS_PER_PIXEL + 2 * pad;
    pageHeight = imageHeight * POINTS_PER_PIXEL + 2 * pad;
  } else {
    const [short, long] = PAPER[size];
    const landscapeAsSeen = sideways ? imageHeight > imageWidth : imageWidth > imageHeight;
    // Landscape-as-seen on a sideways page is portrait in unrotated space, and vice versa.
    [pageWidth, pageHeight] = landscapeAsSeen !== sideways ? [long, short] : [short, long];
  }

  const scale = Math.min((pageWidth - 2 * pad) / imageWidth, (pageHeight - 2 * pad) / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    pageWidth,
    pageHeight,
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}
