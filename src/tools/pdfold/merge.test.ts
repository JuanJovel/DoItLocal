import { describe, expect, it } from 'vitest';
import { JobError, type JobProgress } from '../../file-queue/job';
import { mergePdfs } from './merge';
import {
  asInput,
  makeEncryptedLookingPdf,
  makeSamplePdf,
  readPages,
  readPageTexts,
} from './test-helpers';

describe('mergePdfs', () => {
  it('merges several PDFs with the right page count and order', async () => {
    const a = await makeSamplePdf('A', 2, { baseWidth: 100 });
    const b = await makeSamplePdf('B', 3, { baseWidth: 200 });
    const c = await makeSamplePdf('C', 1, { baseWidth: 300 });

    const result = await mergePdfs([asInput('a.pdf', a), asInput('b.pdf', b), asInput('c.pdf', c)]);

    expect(result.pageCount).toBe(6);
    expect(result.pagesPerFile).toEqual([2, 3, 1]);

    // Order check 1: unique page widths (read back with pdf-lib).
    const pages = await readPages(result.bytes);
    expect(pages.map((p) => p.width)).toEqual([101, 102, 201, 202, 203, 301]);

    // Order check 2: page text, read back by a different PDF engine (pdf.js).
    expect(await readPageTexts(result.bytes)).toEqual([
      'A-p1',
      'A-p2',
      'B-p1',
      'B-p2',
      'B-p3',
      'C-p1',
    ]);
  });

  it('follows the input order, not the creation order', async () => {
    const a = await makeSamplePdf('A', 1, { baseWidth: 100 });
    const b = await makeSamplePdf('B', 1, { baseWidth: 200 });

    const result = await mergePdfs([asInput('b.pdf', b), asInput('a.pdf', a)]);

    expect(await readPageTexts(result.bytes)).toEqual(['B-p1', 'A-p1']);
  });

  it('applies per-file rotation on top of existing page rotation', async () => {
    const plain = await makeSamplePdf('P', 1);
    const alreadyRotated = await makeSamplePdf('R', 1, { pageRotation: 90 });

    const result = await mergePdfs([
      asInput('plain.pdf', plain, 90),
      asInput('rotated.pdf', alreadyRotated, 90),
      asInput('untouched.pdf', plain, 0),
      asInput('wrap.pdf', alreadyRotated, 270),
    ]);

    expect((await readPages(result.bytes)).map((p) => p.rotation)).toEqual([90, 180, 0, 0]);
  });

  it('merges a single file (useful for rotate-only)', async () => {
    const a = await makeSamplePdf('A', 4);
    const result = await mergePdfs([asInput('a.pdf', a, 180)]);
    expect(result.pageCount).toBe(4);
    expect((await readPages(result.bytes)).every((p) => p.rotation === 180)).toBe(true);
  });

  it('handles many files and keeps every page', async () => {
    const files = await Promise.all(
      Array.from({ length: 25 }, (_, i) => makeSamplePdf(`F${i}`, (i % 3) + 1)),
    );
    const result = await mergePdfs(files.map((bytes, i) => asInput(`f${i}.pdf`, bytes)));
    const expected = files.reduce((sum, _file, i) => sum + ((i % 3) + 1), 0);
    expect(result.pageCount).toBe(expected);
    expect(result.pagesPerFile).toHaveLength(25);
  });

  it('reads files lazily, one at a time', async () => {
    const bytes = await makeSamplePdf('A', 1);
    let active = 0;
    let maxActive = 0;
    const inputs = Array.from({ length: 4 }, (_, i) => ({
      name: `${i}.pdf`,
      rotation: 0 as const,
      read: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await Promise.resolve();
        active--;
        return bytes;
      },
    }));
    await mergePdfs(inputs);
    expect(maxActive).toBe(1);
  });

  it('reports monotonic progress ending at 1', async () => {
    const bytes = await makeSamplePdf('A', 1);
    const events: JobProgress[] = [];
    await mergePdfs([asInput('1.pdf', bytes), asInput('2.pdf', bytes), asInput('3.pdf', bytes)], {
      onProgress: (p) => events.push(p),
    });
    const fractions = events.map((e) => e.fraction);
    expect(fractions).toEqual([...fractions].sort((x, y) => x - y));
    expect(fractions[0]).toBe(0);
    expect(fractions.at(-1)).toBe(1);
    expect(events.filter((e) => e.stage === 'reading').map((e) => e.name)).toEqual([
      '1.pdf',
      '2.pdf',
      '3.pdf',
    ]);
  });

  it('rejects an empty list', async () => {
    await expect(mergePdfs([])).rejects.toMatchObject({ code: 'no-input' });
  });

  it('names the broken file that stopped the merge', async () => {
    const good = await makeSamplePdf('G', 1);
    const junk = new TextEncoder().encode('this is definitely not a pdf');

    const error = await mergePdfs([asInput('good.pdf', good), asInput('bad.pdf', junk)]).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(JobError);
    expect(error).toMatchObject({ code: 'corrupt', failedFile: { index: 1, name: 'bad.pdf' } });
  });

  it('reports password-protected PDFs distinctly', async () => {
    const locked = await makeEncryptedLookingPdf();
    const error = await mergePdfs([asInput('locked.pdf', locked)]).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'password', failedFile: { index: 0, name: 'locked.pdf' } });
  });

  it('reports unreadable files (for example deleted after being added)', async () => {
    const error = await mergePdfs([
      {
        name: 'gone.pdf',
        rotation: 0,
        read: () => Promise.reject(new DOMException('gone', 'NotFoundError')),
      },
    ]).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'unreadable', failedFile: { index: 0, name: 'gone.pdf' } });
  });

  it('stops when aborted', async () => {
    const bytes = await makeSamplePdf('A', 1);
    const controller = new AbortController();
    const error = await mergePdfs([asInput('1.pdf', bytes), asInput('2.pdf', bytes)], {
      signal: controller.signal,
      onProgress: (p) => {
        if (p.index === 0) controller.abort();
      },
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'cancelled' });
  });
});
