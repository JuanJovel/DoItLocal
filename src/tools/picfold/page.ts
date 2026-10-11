import { picfoldLogo } from '../../components/logo';
import { startJob } from '../../file-queue/job';
import { mountFileQueue } from '../../file-queue/view';
import { createElement } from '../../lib/dom';
import { formatBytes } from '../../lib/format';
import type { ToolContext, Unmount } from '../types';
import type { ConvertRequest } from './convert';
import { renderThumbnail } from './decode';
import { KIND_LABELS } from './image-file';
import { inspectImage, type ImageInfo } from './inspect';
import type { Margin, PageSize } from './layout';

function select<Value extends string>(
  id: string,
  label: string,
  choices: Record<Value, string>,
  initial: Value,
): { field: HTMLElement; value: () => Value } {
  const control = createElement(
    'select',
    { id, class: 'input' },
    ...Object.entries<string>(choices).map(([value, text]) =>
      createElement('option', { value, selected: value === initial }, text),
    ),
  );
  return {
    field: createElement(
      'div',
      { class: 'field' },
      createElement('label', { for: id, class: 'field__label' }, label),
      control,
    ),
    value: () => control.value as Value,
  };
}

export function mount({ container }: ToolContext): Unmount {
  const pageSize = select<PageSize>(
    'page-size',
    'Page size',
    { fit: 'Same as image', a4: 'A4', letter: 'US Letter' },
    'fit',
  );
  const margin = select<Margin>(
    'page-margin',
    'Margin',
    { none: 'None', small: 'Small', large: 'Large' },
    'none',
  );

  return mountFileQueue<ImageInfo>(container, {
    page: {
      name: 'PicFold',
      logo: picfoldLogo(18),
      title: [
        'Photos to PDF. ',
        createElement('span', { class: 'hero__accent' }, 'Free. Private.'),
        ' Nothing leaves your device.',
      ],
      lede: 'Turn photos, scans and screenshots into one PDF, without uploading a thing.',
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
