import { PDFDocument, degrees } from 'pdf-lib';
import { buildPdf, type BuildOptions, type BuildResult } from '../../file-queue/pdf-build';
import type { Rotation } from '../../file-queue/reorder';
import type { FileProblem } from '../../file-queue/store';
import { problemFor } from './validate';

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

export function mergePdfs(
  inputs: readonly MergeInput[],
  options?: BuildOptions,
): Promise<BuildResult> {
  return buildPdf(
    inputs,
    {
      producer: 'PDFold (DoItLocal)',
      describeError,
      async add(output, input) {
        const source = await PDFDocument.load(await input.read(), { updateMetadata: false });
        const pages = await output.copyPages(source, source.getPageIndices());
        for (const page of pages) {
          if (input.rotation !== 0) {
            page.setRotation(degrees((page.getRotation().angle + input.rotation) % 360));
          }
          output.addPage(page);
        }
        return pages.length;
      },
    },
    options,
  );
}

/** Merge files from the queue, reading each one from disk only when its turn comes. */
export function mergeFiles(
  files: readonly MergeFile[],
  options?: BuildOptions,
): Promise<BuildResult> {
  return mergePdfs(
    files.map(({ file, name, rotation }) => ({
      name,
      rotation,
      read: async () => new Uint8Array(await file.arrayBuffer()),
    })),
    options,
  );
}

/**
 * pdf-lib's EncryptedPDFError is compiled to ES5, so `instanceof` is unreliable
 * (and class names don't survive minification). Its message is stable, so match on that.
 */
function describeError(error: unknown): FileProblem {
  const encrypted = error instanceof Error && /is encrypted/i.test(error.message);
  return problemFor(encrypted ? 'password' : 'corrupt');
}
