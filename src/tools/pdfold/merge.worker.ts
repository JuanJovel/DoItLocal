/**
 * Web Worker entry: runs the merge off the main thread so the UI stays responsive
 * (and the progress bar keeps animating) even with very large files.
 */
import { mergeFiles, type MergeFile, type MergeProgress, type MergeResult } from './merge';
import { MergeError, type FailedFile, type MergeErrorCode } from './merge-error';

export interface WorkerRequest {
  type: 'merge';
  files: MergeFile[];
}

export type WorkerResponse =
  | { type: 'progress'; progress: MergeProgress }
  | { type: 'done'; result: MergeResult }
  | { type: 'error'; code: MergeErrorCode; message: string; failedFile?: FailedFile };

/** The slice of the worker global scope we use (the project is typed against the DOM lib). */
interface WorkerScope {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void;
}
const scope = self as unknown as WorkerScope;

scope.addEventListener('message', ({ data }) => {
  if (data.type !== 'merge') return;

  mergeFiles(data.files, {
    onProgress: (progress) => scope.postMessage({ type: 'progress', progress }),
  }).then(
    (result) => scope.postMessage({ type: 'done', result }, [result.bytes.buffer]),
    (error: unknown) => {
      const { code, message, failedFile } =
        error instanceof MergeError
          ? error
          : new MergeError('failed', error instanceof Error ? error.message : 'Merge failed.');
      scope.postMessage({ type: 'error', code, message, failedFile });
    },
  );
});
