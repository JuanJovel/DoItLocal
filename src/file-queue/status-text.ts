import { formatBytes, plural } from '../lib/format';

/** Builders for the queue's status strings, kept out of the view so they can be tested. */

/** Above this total size we warn that the browser may run low on memory. */
export const LARGE_TOTAL_BYTES = 1.5 * 1024 ** 3;

export interface QueueState {
  /** Files that will be used. */
  files: number;
  pages: number;
  bytes: number;
  /** Files that can't be used (errors). */
  problems: number;
  /** Files still being read. */
  checking: boolean;
}

/** "3 files · 6 pages · 3.8 KB · 1 file can't be used · reading…" */
export function queueSummary({ files, pages, bytes, problems, checking }: QueueState): string {
  const parts = [plural(files, 'file'), plural(pages, 'page'), formatBytes(bytes)];
  if (problems) parts.push(`${plural(problems, 'file')} can't be used`);
  if (checking) parts.push('reading…');
  return parts.join(' · ');
}

export interface HintOptions {
  /** Fewest files the action needs: 2 to merge, 1 to convert. */
  minFiles: number;
  /** What the files are, singular: "PDF" or "image". */
  noun: string;
  /** What the action does to them: "merge" or "convert". */
  verb: string;
}

/** The helper line under the action button. */
export function actionHint(state: QueueState, { minFiles, noun, verb }: HintOptions): string {
  if (state.checking) return 'Reading your files…';
  if (state.files < minFiles) {
    const missing = minFiles - state.files;
    const count = missing === 1 ? 'one' : missing === 2 ? 'two' : String(missing);
    const what = state.files === 0 ? (missing === 1 ? noun : `${noun}s`) : `more ${noun}`;
    return `Add at least ${count} ${what} to ${verb}.`;
  }
  if (state.bytes > LARGE_TOTAL_BYTES) {
    return `That's ${formatBytes(state.bytes)} in total. If your browser runs out of memory, work in smaller batches.`;
  }
  return `Ready: ${plural(state.files, noun)} into one PDF of ${plural(state.pages, 'page')}.`;
}
