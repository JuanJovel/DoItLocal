import type { ProblemCode } from './validate';

export type MergeErrorCode = ProblemCode | 'cancelled' | 'no-input' | 'failed';

/** The input file a merge failed on: its position in the list that was merged, and its name. */
export interface FailedFile {
  index: number;
  name: string;
}

/**
 * Thrown for any merge failure. `failedFile` is set when one specific file caused it, so the UI
 * can flag that card. Kept in its own module (no pdf-lib import) so the main thread can use it
 * without pulling the PDF library into the page bundle.
 */
export class MergeError extends Error {
  constructor(
    readonly code: MergeErrorCode,
    message: string,
    readonly failedFile?: FailedFile,
  ) {
    super(message);
    this.name = 'MergeError';
  }
}
