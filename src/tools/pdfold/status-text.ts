import { formatBytes, plural } from '../../lib/format';
import type { IntakeSummary } from './intake';

/** Builders for the user-facing status strings, kept out of the view so they can be tested. */

/** How many failed files are read out individually; the rest are summarized as a count. */
const MAX_FAILURES_LISTED = 3;

/** Above this total size we warn that the browser may run low on memory. */
export const LARGE_TOTAL_BYTES = 1.5 * 1024 ** 3;

export interface QueueState {
  /** Files that will be merged. */
  files: number;
  pages: number;
  bytes: number;
  /** Files that can't be merged (errors). */
  problems: number;
  /** Files still being read. */
  checking: boolean;
}

/** "3 files · 6 pages · 3.8 KB · 1 file can't be merged · reading…" */
export function queueSummary({ files, pages, bytes, problems, checking }: QueueState): string {
  const parts = [plural(files, 'file'), plural(pages, 'page'), formatBytes(bytes)];
  if (problems) parts.push(`${plural(problems, 'file')} can’t be merged`);
  if (checking) parts.push('reading…');
  return parts.join(' · ');
}

/** The helper line under the merge button. Empty while a merge is running. */
export function mergeHint(state: QueueState & { merging: boolean }): string {
  if (state.merging) return '';
  if (state.checking) return 'Reading your files…';
  if (state.files === 0) return 'Add at least two PDFs to merge.';
  if (state.files === 1) return 'Add at least one more PDF to merge.';
  if (state.bytes > LARGE_TOTAL_BYTES) {
    return `That’s ${formatBytes(state.bytes)} in total. If your browser runs out of memory, merge in smaller batches.`;
  }
  return `Ready: ${plural(state.files, 'PDF')} into one file of ${plural(state.pages, 'page')}.`;
}

/** Screen-reader sentence after files were added: what worked, and why the rest didn't. */
export function describeIntake({ ok, failed }: IntakeSummary): string {
  const parts: string[] = [];
  if (ok > 0) parts.push(`Added ${plural(ok, 'PDF')}.`);
  for (const { name, problem } of failed.slice(0, MAX_FAILURES_LISTED))
    parts.push(`${name}: ${problem.message}`);
  const unlisted = failed.length - MAX_FAILURES_LISTED;
  if (unlisted > 0) parts.push(`${unlisted} more files had problems.`);
  return parts.join(' ');
}
