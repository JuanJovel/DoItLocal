import type { MergeFile, MergeProgress, MergeResult } from './merge';
import { MergeError } from './merge-error';
import type { WorkerRequest, WorkerResponse } from './merge.worker';

export interface MergeJob {
  result: Promise<MergeResult>;
  /** Stops the merge. `result` rejects with a "cancelled" MergeError. */
  cancel: () => void;
}

/**
 * Start a merge in a Web Worker. Falls back to the main thread where module workers are
 * unavailable, which still works but may briefly block the UI.
 */
export function startMerge(
  files: readonly MergeFile[],
  onProgress: (progress: MergeProgress) => void,
): MergeJob {
  let worker: Worker;
  try {
    worker = new Worker(new URL('./merge.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return startOnMainThread(files, onProgress);
  }

  let fail: (error: MergeError) => void = () => undefined;
  const result = new Promise<MergeResult>((resolve, reject) => {
    fail = (error) => {
      worker.terminate();
      reject(error);
    };
    worker.addEventListener('message', ({ data }: MessageEvent<WorkerResponse>) => {
      if (data.type === 'progress') {
        onProgress(data.progress);
        return;
      }
      worker.terminate();
      if (data.type === 'done') resolve(data.result);
      else reject(new MergeError(data.code, data.message, data.failedFile));
    });
    worker.addEventListener('error', (event) =>
      fail(new MergeError('failed', event.message || 'The merge worker crashed.')),
    );
    worker.addEventListener('messageerror', () =>
      fail(new MergeError('failed', 'The merge worker sent back an unreadable result.')),
    );
  });

  worker.postMessage({ type: 'merge', files: [...files] } satisfies WorkerRequest);
  return { result, cancel: () => fail(new MergeError('cancelled', 'Merge cancelled.')) };
}

function startOnMainThread(
  files: readonly MergeFile[],
  onProgress: (progress: MergeProgress) => void,
): MergeJob {
  const controller = new AbortController();
  // pdf-lib is only pulled into the page when this rare fallback is actually used.
  const result = import('./merge').then(({ mergeFiles }) =>
    mergeFiles(files, { onProgress, signal: controller.signal }),
  );
  return { result, cancel: () => controller.abort() };
}
