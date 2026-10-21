import { snapPagesLogo } from '../../components/logo';
import { selectField } from '../../components/select-field';
import { startTask } from '../../file-queue/job';
import { mountFileQueue } from '../../file-queue/view';
import { createElement } from '../../lib/dom';
import { formatBytes, plural } from '../../lib/format';
import { openForRendering, preloadPdfjs, renderThumbnail, type ImageType } from '../../pdf/reader';
import { inspectPdfFile, type PdfInfo } from '../../pdf/validate';
import type { ToolContext, Unmount } from '../types';
import { pdfsToImages } from './convert';
import { snapPages } from './index';

const FORMAT_LABELS: Record<ImageType, string> = { 'image/jpeg': 'JPG', 'image/png': 'PNG' };

export function mount({ container }: ToolContext): Unmount {
  const format = selectField<ImageType>('image-format', 'Format', FORMAT_LABELS, 'image/jpeg');
  const resolution = selectField(
    'image-dpi',
    'Resolution',
    { '72': 'Screen (72 DPI)', '150': 'Standard (150 DPI)', '300': 'High (300 DPI)' },
    '150',
  );

  return mountFileQueue<PdfInfo>(container, {
    page: {
      tool: snapPages,
      logo: snapPagesLogo(18),
      title: [
        'PDF to JPG. ',
        createElement('span', { class: 'hero__accent' }, 'Free. Private.'),
        ' Nothing leaves your device.',
      ],
      lede: 'Turn every page of a PDF into a JPG or PNG image, without uploading a thing.',
      workspaceLabel: 'PDF to image converter',
    },
    accept: 'application/pdf,.pdf',
    noun: 'PDF',
    verb: { base: 'convert', ing: 'Converting', past: 'Converted' },
    action: { label: 'Convert to images', icon: 'file-image' },
    listLabel: 'PDF files, in the order their pages will be saved',
    queueHint: 'Every page becomes one image. Rotate a file to turn all of its pages.',
    minFiles: 1,
    defaultFileName: 'pages.zip',
    inspect: (file) => inspectPdfFile(file),
    renderThumbnail,
    pageCount: (info) => info.pageCount,
    describe: (info, item) => `${plural(info.pageCount, 'page')} · ${formatBytes(item.size)}`,
    describeOutput: (pages) => plural(pages, `${FORMAT_LABELS[format.value()]} image`),
    options: createElement('div', { class: 'actionbar__options' }, format.field, resolution.field),
    start(items, onProgress) {
      const type = format.value();
      const dpi = Number(resolution.value());
      const pdfs = items.map(({ file, name, rotation, info }) => ({
        file,
        name,
        rotation,
        pageCount: info?.pageCount ?? 0,
      }));
      return startTask((signal) =>
        pdfsToImages(pdfs, {
          type,
          open: (file, rotation) => openForRendering(file, { type, dpi, rotation }),
          onProgress,
          signal,
        }),
      );
    },
    preload: preloadPdfjs,
  });
}
