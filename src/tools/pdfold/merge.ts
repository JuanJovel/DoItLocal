import { PDFDocument, degrees } from 'pdf-lib';
import { MergeError, type FailedFile } from './merge-error';
import { problemFor } from './validate';
import type { Rotation } from './reorder';

/**
 * Core merge logic. Pure and environment-agnostic: it runs unchanged inside the
 * Web Worker (production), on the main thread (fallback) and in Node (tests).
 */

export interface MergeInput {
  /** Display name, used in progress and error messages. */
  name: string;
  /** Extra clockwise rotation applied to every page of this file. */
  rotation: Rotation;
  /** Returns the file's bytes. Called lazily, one file at a time, to limit memory use. */
  read: () => Promise<Uint8Array>;
}

/** A file from the queue, as sent to the merge worker. */
export interface MergeFile {
  file: File;
  name: string;
  rotation: Rotation;
}

export interface MergeProgress {
  stage: 'reading' | 'saving';
  /** 0-based index of the file being processed (the last index while saving). */
  index: number;
  total: number;
  name: string;
  /** Overall progress from 0 to 1. */
  fraction: number;
}

export interface MergeResult {
  bytes: Uint8Array;
  pageCount: number;
  /** Page count contributed by each input, in input order. */
  pagesPerFile: number[];
}

export interface MergeOptions {
  onProgress?: (progress: MergeProgress) => void;
  signal?: AbortSignal;
}

/** The loading phase takes most of the time; saving gets the last slice of the bar. */
const SAVE_SHARE = 0.1;

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new MergeError('cancelled', 'Merge cancelled.');
}

export async function mergePdfs(
  inputs: readonly MergeInput[],
  { onProgress, signal }: MergeOptions = {},
): Promise<MergeResult> {
  if (inputs.length === 0) throw new MergeError('no-input', 'Add at least one PDF to merge.');

  const total = inputs.length;
  const output = await PDFDocument.create();
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
      const source = await PDFDocument.load(await input.read(), { updateMetadata: false });
      const pages = await output.copyPages(source, source.getPageIndices());
      for (const page of pages) {
        if (input.rotation !== 0) {
          page.setRotation(degrees((page.getRotation().angle + input.rotation) % 360));
        }
        output.addPage(page);
      }
      pagesPerFile.push(pages.length);
    } catch (error) {
      throw toMergeError(error, { index, name: input.name });
    }
  }

  throwIfAborted(signal);
  onProgress?.({ stage: 'saving', index: total - 1, total, name: '', fraction: 1 - SAVE_SHARE });

  output.setProducer('PDFold (DoItLocal)');
  output.setCreator('PDFold (DoItLocal)');
  const bytes = await output.save();
  onProgress?.({ stage: 'saving', index: total - 1, total, name: '', fraction: 1 });

  return { bytes, pageCount: output.getPageCount(), pagesPerFile };
}

/** Merge files from the queue, reading each one from disk only when its turn comes. */
export function mergeFiles(
  files: readonly MergeFile[],
  options?: MergeOptions,
): Promise<MergeResult> {
  return mergePdfs(
    files.map(({ file, name, rotation }) => ({
      name,
      rotation,
      read: async () => new Uint8Array(await file.arrayBuffer()),
    })),
    options,
  );
}

/** Translate library errors into a MergeError with a message a person can act on. */
function toMergeError(error: unknown, failedFile: FailedFile): MergeError {
  if (error instanceof MergeError) return error;
  if (isEncryptedError(error)) {
    return new MergeError('password', problemFor('password').message, failedFile);
  }
  if (
    error instanceof DOMException &&
    (error.name === 'NotReadableError' || error.name === 'NotFoundError')
  ) {
    return new MergeError('unreadable', problemFor('unreadable').message, failedFile);
  }
  if (error instanceof RangeError && /allocation|memory|array buffer/i.test(error.message)) {
    return new MergeError(
      'failed',
      'Your browser ran out of memory while merging. Try merging fewer or smaller files at a time.',
      failedFile,
    );
  }
  return new MergeError('corrupt', problemFor('corrupt').message, failedFile);
}

/**
 * pdf-lib's EncryptedPDFError is compiled to ES5, so `instanceof` is unreliable
 * (and class names don't survive minification). Its message is stable, so match on that.
 */
function isEncryptedError(error: unknown): boolean {
  return error instanceof Error && /is encrypted/i.test(error.message);
}
