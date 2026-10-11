import { PDFDocument } from 'pdf-lib';
import { commonProblems } from './intake';
import { JobError, type FailedFile, type JobProgress, type JobResult } from './job';
import type { FileProblem } from './store';

/**
 * The loop every PDF-producing tool shares: add each input to one document, report
 * progress, stop on cancel, and blame the right file when something fails. Environment
 * agnostic: it runs in a Web Worker, on the main thread and in Node (tests).
 */

export interface BuildOptions {
  onProgress?: (progress: JobProgress) => void;
  signal?: AbortSignal;
}

export interface BuildResult extends JobResult {
  /** Pages contributed by each input, in input order. */
  pagesPerFile: number[];
}

export interface BuildSteps<Input> {
  /** Adds one input's pages to the document and returns how many it added. */
  add: (doc: PDFDocument, input: Input) => Promise<number>;
  /** Explains a library error about one input in words a person can act on. */
  describeError: (error: unknown) => FileProblem;
  /** Written into the PDF's Producer and Creator fields. */
  producer: string;
}

/** Reading takes most of the time; saving gets the last slice of the progress bar. */
const SAVE_SHARE = 0.1;

export async function buildPdf<Input extends { name: string }>(
  inputs: readonly Input[],
  { add, describeError, producer }: BuildSteps<Input>,
  { onProgress, signal }: BuildOptions = {},
): Promise<BuildResult> {
  if (inputs.length === 0) throw new JobError('no-input', 'Add at least one file.');

  const total = inputs.length;
  const doc = await PDFDocument.create();
  const pagesPerFile: number[] = [];

  for (const [index, input] of inputs.entries()) {
    throwIfAborted(signal);
    onProgress?.({
      stage: 'reading',
      index,
      total,
      name: input.name,
      fraction: (index / total) * (1 - SAVE_SHARE),
    });
    try {
      pagesPerFile.push(await add(doc, input));
    } catch (error) {
      throw toJobError(error, { index, name: input.name }, describeError);
    }
  }

  throwIfAborted(signal);
  onProgress?.({ stage: 'saving', index: total - 1, total, name: '', fraction: 1 - SAVE_SHARE });
  doc.setProducer(producer);
  doc.setCreator(producer);
  const bytes = await doc.save();
  onProgress?.({ stage: 'saving', index: total - 1, total, name: '', fraction: 1 });

  return { bytes, pageCount: doc.getPageCount(), pagesPerFile };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new JobError('cancelled', 'Cancelled.');
}

function toJobError(
  error: unknown,
  failedFile: FailedFile,
  describeError: (error: unknown) => FileProblem,
): JobError {
  if (error instanceof JobError) return error;
  if (
    error instanceof DOMException &&
    (error.name === 'NotReadableError' || error.name === 'NotFoundError')
  ) {
    const { code, message } = commonProblems.unreadable;
    return new JobError(code, message, failedFile);
  }
  if (error instanceof RangeError && /allocation|memory|array buffer/i.test(error.message)) {
    return new JobError(
      'failed',
      'Your browser ran out of memory. Try fewer or smaller files at a time.',
      failedFile,
    );
  }
  const { code, message } = describeError(error);
  return new JobError(code, message, failedFile);
}
