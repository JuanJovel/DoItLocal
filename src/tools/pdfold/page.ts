import { pdfoldLogo } from '../../components/logo';
import { startJob } from '../../file-queue/job';
import { mountFileQueue } from '../../file-queue/view';
import { createElement } from '../../lib/dom';
import { formatBytes, plural } from '../../lib/format';
import type { ToolContext, Unmount } from '../types';
import { pdfold } from './index';
import type { MergeFile } from './merge';
import { preloadPdfjs, renderThumbnail } from './pdf-reader';
import { inspectPdfFile, type PdfInfo } from './validate';

export function mount({ container }: ToolContext): Unmount {
  return mountFileQueue<PdfInfo>(container, {
    page: {
      tool: pdfold,
      logo: pdfoldLogo(18),
      title: [
        'Merge PDFs. ',
        createElement('span', { class: 'hero__accent' }, 'Free. Private.'),
        ' Nothing leaves your device.',
      ],
      lede: 'Combine PDFs in any order, in seconds, without uploading a thing.',
      workspaceLabel: 'PDF merger',
    },
    accept: 'application/pdf,.pdf',
    noun: 'PDF',
    verb: { base: 'merge', ing: 'Merging', past: 'Merged' },
    action: { label: 'Merge PDFs', icon: 'merge' },
    listLabel: 'PDF files, in the order they will be merged',
    queueHint: 'Files merge in this order. Drag cards to reorder, or use the arrow buttons.',
    minFiles: 2,
    defaultFileName: 'merged.pdf',
    inspect: (file) => inspectPdfFile(file),
    renderThumbnail,
    pageCount: (info) => info.pageCount,
    describe: (info, item) => `${plural(info.pageCount, 'page')} · ${formatBytes(item.size)}`,
    start(items, onProgress) {
      const files: MergeFile[] = items.map(({ file, name, rotation }) => ({
        file,
        name,
        rotation,
      }));
      return startJob({
        worker: () => new Worker(new URL('./merge.worker.ts', import.meta.url), { type: 'module' }),
        request: files,
        onProgress,
        fallback: (signal) =>
          import('./merge').then(({ mergeFiles }) => mergeFiles(files, { onProgress, signal })),
      });
    },
    preload: preloadPdfjs,
  });
}
