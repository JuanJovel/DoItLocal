/**
 * Running a build (merge, convert): `startJob` runs one in a Web Worker, which calls
 * `serveJobs`; `startTask` runs one on the main thread. This module never imports pdf-lib,
 * so the page can use it without pulling the PDF library into its bundle.
 */

export interface JobProgress {
  /** Overall progress from 0 to 1. */
  fraction: number;
  /** What is happening, e.g. "Merging file 2 of 5: report.pdf". */
  label: string;
}

export interface JobResult {
  bytes: Uint8Array;
  /** MIME type of `bytes`, which also decides the download's file extension. */
  type: string;
  pageCount: number;
}

/** The input file a job failed on: its position in the list it was given, and its name. */
export interface FailedFile {
  index: number;
  name: string;
}

/**
 * Thrown for any job failure. `code` is "cancelled", "failed" or a tool's problem code;
 * `failedFile` is set when one specific file caused it, so the UI can flag that card.
 */
export class JobError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly failedFile?: FailedFile,
  ) {
    super(message);
    this.name = 'JobError';
  }
}

export interface Job {
  result: Promise<JobResult>;
  /** Stops the job. `result` rejects with a "cancelled" JobError. */
  cancel: () => void;
}

type WorkerResponse =
  | { type: 'progress'; progress: JobProgress }
  | { type: 'done'; result: JobResult }
  | { type: 'error'; code: string; message: string; failedFile?: FailedFile };

export interface JobOptions<Request> {
  /** Creates the worker. Must be `new Worker(new URL(...), ...)` in the tool's module for Vite. */
  worker: () => Worker;
  request: Request;
  onProgress: (progress: JobProgress) => void;
  /** Runs the same job on the main thread where module workers are unavailable. */
  fallback: (signal: AbortSignal) => Promise<JobResult>;
}

export function startJob<Request>({
  worker: createWorker,
  request,
  onProgress,
  fallback,
}: JobOptions<Request>): Job {
  let worker: Worker;
  try {
    worker = createWorker();
  } catch {
    // Slower, and may briefly block the UI, but still works.
    return startTask(fallback);
  }

  let fail: (error: JobError) => void = () => undefined;
  const result = new Promise<JobResult>((resolve, reject) => {
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
      else reject(new JobError(data.code, data.message, data.failedFile));
    });
    worker.addEventListener('error', (event) =>
      fail(new JobError('failed', event.message || 'The background worker crashed.')),
    );
    worker.addEventListener('messageerror', () =>
      fail(new JobError('failed', 'The background worker sent back an unreadable result.')),
    );
  });

  worker.postMessage(request);
  return { result, cancel: () => fail(new JobError('cancelled', 'Cancelled.')) };
}

/** Run a job on the main thread, for work that needs the page (pdf.js rendering to a canvas). */
export function startTask(run: (signal: AbortSignal) => Promise<JobResult>): Job {
  const controller = new AbortController();
  return { result: run(controller.signal), cancel: () => controller.abort() };
}

/** Throw the "cancelled" JobError once `signal` is aborted; call it between units of work. */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new JobError('cancelled', 'Cancelled.');
}

/** Worker side: run `job` for each request and report progress, the result or the error. */
export function serveJobs<Request>(
  job: (request: Request, onProgress: (progress: JobProgress) => void) => Promise<JobResult>,
): void {
  // The project is typed against the DOM lib, so describe the slice of the worker scope we use.
  const scope = self as unknown as {
    postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
    addEventListener(type: 'message', listener: (event: MessageEvent<Request>) => void): void;
  };

  scope.addEventListener('message', ({ data }) => {
    job(data, (progress) => scope.postMessage({ type: 'progress', progress })).then(
      (result) => scope.postMessage({ type: 'done', result }, [result.bytes.buffer]),
      (error: unknown) => {
        const { code, message, failedFile } =
          error instanceof JobError
            ? error
            : new JobError('failed', error instanceof Error ? error.message : 'Something failed.');
        scope.postMessage({ type: 'error', code, message, failedFile });
      },
    );
  });
}
