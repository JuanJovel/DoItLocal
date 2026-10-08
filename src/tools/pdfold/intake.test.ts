import { describe, expect, it } from 'vitest';
import { createIntake } from './intake';
import { PdfStore } from './store';
import { makeSamplePdf } from './test-helpers';
import { describeLoadError } from './validate';

const file = (content: string | Uint8Array, name: string, type = ''): File =>
  new File([content as BlobPart], name, { type });

describe('createIntake', () => {
  it('marks good PDFs ready with their page count', async () => {
    const store = new PdfStore();
    const intake = createIntake({ store, inspect: async () => ({ pageCount: 7 }) });
    const bytes = await makeSamplePdf('A', 1);

    const summary = await intake.addFiles([file(bytes, 'a.pdf', 'application/pdf')]);

    expect(summary).toMatchObject({ added: 1, ok: 1, failed: [] });
    expect(store.items[0]).toMatchObject({ status: 'ready', pageCount: 7 });
  });

  it('keeps going when some files are bad: errors are per file', async () => {
    const store = new PdfStore();
    const good = await makeSamplePdf('G', 1);
    const intake = createIntake({
      store,
      inspect: async (f) => {
        if (f.name === 'locked.pdf') {
          throw Object.assign(new Error('needs password'), { name: 'PasswordException' });
        }
        if (f.name === 'broken.pdf') {
          throw Object.assign(new Error('bad xref'), { name: 'InvalidPDFException' });
        }
        return { pageCount: 1 };
      },
    });

    const summary = await intake.addFiles([
      file(good, 'one.pdf'),
      file('hello', 'picture.png', 'image/png'),
      file(good, 'locked.pdf'),
      file(good, 'broken.pdf'),
      file(good, 'two.pdf'),
      file('', 'empty.pdf'),
    ]);

    expect(summary.added).toBe(6);
    expect(summary.ok).toBe(2);
    const byName = Object.fromEntries(summary.failed.map((f) => [f.name, f.problem.code]));
    expect(byName).toEqual({
      'picture.png': 'not-pdf',
      'locked.pdf': 'password',
      'broken.pdf': 'corrupt',
      'empty.pdf': 'empty',
    });
    // The queue keeps its order and the good files are still mergeable.
    expect(store.items.map((i) => i.name)).toEqual([
      'one.pdf',
      'picture.png',
      'locked.pdf',
      'broken.pdf',
      'two.pdf',
      'empty.pdf',
    ]);
    expect(store.ready.map((i) => i.name)).toEqual(['one.pdf', 'two.pdf']);
    expect(store.items.find((i) => i.name === 'locked.pdf')?.problem?.message).toMatch(/password/i);
  });

  it('inspects files one at a time', async () => {
    const store = new PdfStore();
    let active = 0;
    let maxActive = 0;
    const intake = createIntake({
      store,
      check: async () => null,
      inspect: async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;
        return { pageCount: 1 };
      },
    });

    await intake.addFiles(Array.from({ length: 8 }, (_, i) => file('x', `${i}.pdf`)));

    expect(maxActive).toBe(1);
    expect(store.ready).toHaveLength(8);
  });

  it('does not resurrect a file removed while it was being inspected', async () => {
    const store = new PdfStore();
    const intake = createIntake({
      store,
      check: async () => null,
      inspect: async () => {
        store.remove(store.items[0]!.id);
        return { pageCount: 1 };
      },
    });
    await intake.addFiles([file('x', 'a.pdf')]);
    expect(store.items).toHaveLength(0);
  });

  it('uses the same error mapping as describeLoadError for unknown failures', async () => {
    const store = new PdfStore();
    const intake = createIntake({
      store,
      check: async () => null,
      inspect: async () => Promise.reject(new Error('weird')),
    });
    await intake.addFiles([file('x', 'a.pdf')]);
    expect(store.items[0]?.problem).toEqual(describeLoadError(new Error('weird')));
  });
});
