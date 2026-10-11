import { plural } from '../lib/format';
import { serialRunner } from '../lib/serial';
import type { FileProblem, FileQueue } from './store';

/** What a tool's check of one file found: either what it learned, or why the file can't be used. */
export type Inspection<Info> = { info: Info } | { problem: FileProblem };

export interface IntakeSummary {
  added: number;
  ok: number;
  failed: { name: string; problem: FileProblem }[];
}

/**
 * Takes freshly added files through the tool's check. Each file is handled independently,
 * so a bad file becomes an error card and never blocks the rest.
 */
export function createIntake<Info>(
  queue: FileQueue<Info>,
  inspect: (file: File) => Promise<Inspection<Info>>,
) {
  // One file at a time keeps memory use flat when someone drops a hundred big files.
  const runInOrder = serialRunner();

  /** Add files to the queue and resolve once every one has been checked. */
  async function addFiles(files: readonly File[]): Promise<IntakeSummary> {
    const items = queue.add(files);
    const results = await Promise.all(
      items.map((item) =>
        runInOrder(async () => {
          const result = await inspect(item.file);
          if ('info' in result) queue.update(item.id, { status: 'ready', info: result.info });
          else queue.update(item.id, { status: 'error', problem: result.problem });
          return { name: item.name, result };
        }),
      ),
    );
    const failed = results.flatMap(({ name, result }) =>
      'problem' in result ? [{ name, problem: result.problem }] : [],
    );
    return { added: items.length, ok: items.length - failed.length, failed };
  }

  return { addFiles };
}

/** How many failed files are read out individually; the rest are summarized as a count. */
const MAX_FAILURES_LISTED = 3;

/** Screen-reader sentence after files were added: what worked, and why the rest didn't. */
export function describeIntake({ ok, failed }: IntakeSummary, noun: string): string {
  const parts: string[] = [];
  if (ok > 0) parts.push(`Added ${plural(ok, noun)}.`);
  for (const { name, problem } of failed.slice(0, MAX_FAILURES_LISTED)) {
    parts.push(`${name}: ${problem.message}`);
  }
  const unlisted = failed.length - MAX_FAILURES_LISTED;
  if (unlisted > 0) parts.push(`${unlisted} more files had problems.`);
  return parts.join(' ');
}

/** Problems that apply to any kind of file. */
export const commonProblems = {
  empty: { code: 'empty', message: 'This file is empty (0 bytes), so there is nothing to use.' },
  unreadable: {
    code: 'unreadable',
    message:
      "This file couldn't be read. It may have been moved, renamed or still be saving. Try adding it again.",
  },
} satisfies Record<string, FileProblem>;

/** Read the first `length` bytes of a file, or null if the file can no longer be read. */
export async function readHead(file: File, length: number): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await file.slice(0, length).arrayBuffer());
  } catch {
    return null;
  }
}
