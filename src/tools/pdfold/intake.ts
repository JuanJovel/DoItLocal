import { serialRunner } from '../../lib/serial';
import type { PdfStore, PdfItem } from './store';
import { checkPdfFile, describeLoadError, type FileProblem } from './validate';

/**
 * Takes freshly added files through validation and inspection. Each file is handled
 * independently, so a bad file becomes an error card and never blocks the rest.
 */

export interface IntakeDeps {
  store: PdfStore;
  /** Opens the PDF and reports its page count; rejects if it can't be read. */
  inspect: (file: File) => Promise<{ pageCount: number }>;
  /** Quick header check; defaults to the real one. Injectable for tests. */
  check?: (file: File) => Promise<FileProblem | null>;
}

export interface IntakeSummary {
  added: number;
  ok: number;
  failed: { name: string; problem: FileProblem }[];
}

export function createIntake({ store, inspect, check = checkPdfFile }: IntakeDeps) {
  // One file at a time keeps memory use flat when someone drops a hundred big PDFs.
  const runInOrder = serialRunner();

  async function process(item: PdfItem): Promise<FileProblem | null> {
    const quick = await check(item.file);
    if (quick) {
      store.update(item.id, { status: 'error', problem: quick });
      return quick;
    }
    try {
      const { pageCount } = await inspect(item.file);
      store.update(item.id, { status: 'ready', pageCount });
      return null;
    } catch (error) {
      const problem = describeLoadError(error);
      store.update(item.id, { status: 'error', problem });
      return problem;
    }
  }

  /** Add files to the store and resolve once every one has been checked. */
  async function addFiles(files: readonly File[]): Promise<IntakeSummary> {
    const items = store.add(files);
    const results = await Promise.all(
      items.map(async (item) => ({ item, problem: await runInOrder(() => process(item)) })),
    );
    const failed = results.flatMap(({ item, problem }) =>
      problem ? [{ name: item.name, problem }] : [],
    );
    return { added: items.length, ok: items.length - failed.length, failed };
  }

  return { addFiles };
}
