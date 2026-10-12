import { picfoldLogo } from '../../components/logo';
import { selectField } from '../../components/select-field';
import { startJob } from '../../file-queue/job';
import { mountFileQueue } from '../../file-queue/view';
import { createElement } from '../../lib/dom';
import { formatBytes } from '../../lib/format';
import type { ToolContext, Unmount } from '../types';
import { picfold } from './index';
import type { ConvertRequest } from './convert';
import { renderThumbnail } from './decode';
import { KIND_LABELS } from './image-file';
import { inspectImage, type ImageInfo } from './inspect';
import type { Margin, PageSize } from './layout';

export function mount({ container }: ToolContext): Unmount {
  const pageSize = selectField<PageSize>(
    'page-size',
    'Page size',
    { fit: 'Same as image', a4: 'A4', letter: 'US Letter' },
    'fit',
  );
  const margin = selectField<Margin>(
    'page-margin',
    'Margin',
    { none: 'None', small: 'Small', large: 'Large' },
    'none',
  );

  return mountFileQueue<ImageInfo>(container, {
    page: {
      tool: picfold,
      logo: picfoldLogo(18),
      title: [
        'JPG to PDF. ',
        createElement('span', { class: 'hero__accent' }, 'Free. Private.'),
        ' Nothing leaves your device.',
      ],
      lede: 'Turn photos, scans, screenshots and other images into one PDF, without uploading a thing.',
      workspaceLabel: 'Image to PDF converter',
    },
    accept: 'image/*,.heic,.heif,.avif',
    noun: 'image',
    verb: { base: 'convert', ing: 'Converting', past: 'Converted' },
    action: { label: 'Make PDF', icon: 'file' },
    listLabel: 'Images, in the order they will appear in the PDF',
    queueHint:
      'Each image becomes one page, in this order. Drag cards to reorder, or use the arrow buttons.',
    minFiles: 1,
    defaultFileName: 'images.pdf',
    inspect: (file) => inspectImage(file),
    renderThumbnail,
    pageCount: () => 1,
    describe: (info, item) => `${KIND_LABELS[info.kind]} · ${formatBytes(item.size)}`,
    options: createElement('div', { class: 'actionbar__options' }, pageSize.field, margin.field),
    start(items, onProgress) {
      const request: ConvertRequest = {
        files: items.flatMap(({ file, name, rotation, info }) =>
          info ? [{ file, name, rotation, kind: info.kind }] : [],
        ),
        layout: { size: pageSize.value(), margin: margin.value() },
      };
      return startJob({
        worker: () =>
          new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' }),
        request,
        onProgress,
        fallback: (signal) =>
          import('./convert').then(({ convertFiles }) =>
            convertFiles(request, { onProgress, signal }),
          ),
      });
    },
  });
}
