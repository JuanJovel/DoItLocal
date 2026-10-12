import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { JobProgress } from '../../file-queue/job';
import type { Rotation } from '../../file-queue/reorder';
import type { RenderablePdf } from '../../pdf/reader';
import { pageFileName, pdfsToImages, uniqueBaseNames, type PdfFile } from './convert';

const pdf = (name: string, pageCount: number, rotation: Rotation = 0): PdfFile => ({
  file: new File(['%PDF-'], name),
  name,
  rotation,
  pageCount,
});

/** Stands in for pdf.js: each page renders to the text "<file>#<page>@<rotation>". */
function fakeOpen(opened: string[] = []) {
  return async (file: File, rotation: Rotation): Promise<RenderablePdf> => {
    const pageCount = Number(file.name.match(/(\d+)p/)?.[1] ?? 1);
    opened.push(file.name);
    return {
      pageCount,
      render: async (page) => new Blob([`${file.name}#${page}@${rotation}`]),
      close: async () => {
        opened.splice(opened.indexOf(file.name), 1);
      },
    };
  };
}

/** The files in a ZIP, by name, as text. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const files = unzipSync(bytes);
  return Object.fromEntries(
    Object.entries(files).map(([name, data]) => [name, new TextDecoder().decode(data)]),
  );
}

describe('pdfsToImages', () => {
  it('downloads a single page as the image itself', async () => {
    const result = await pdfsToImages([pdf('receipt-1p.pdf', 1)], {
      type: 'image/png',
      open: fakeOpen(),
    });
    expect(result.type).toBe('image/png');
    expect(result.pageCount).toBe(1);
    expect(new TextDecoder().decode(result.bytes)).toBe('receipt-1p.pdf#1@0');
  });

  it('zips every page of every PDF, in order, with sortable names', async () => {
    const result = await pdfsToImages([pdf('report-12p.pdf', 12, 90), pdf('cover-1p.pdf', 1)], {
      type: 'image/jpeg',
      open: fakeOpen(),
    });
    expect(result.type).toBe('application/zip');
    expect(result.pageCount).toBe(13);

    const files = unzip(result.bytes);
    expect(Object.keys(files)).toEqual([
      ...Array.from({ length: 12 }, (_, i) => `report-12p-${String(i + 1).padStart(2, '0')}.jpg`),
      'cover-1p-1.jpg',
    ]);
    expect(files['report-12p-03.jpg']).toBe('report-12p.pdf#3@90');
  });

  it('reports progress page by page and closes every document', async () => {
    const opened: string[] = [];
    const events: JobProgress[] = [];
    await pdfsToImages([pdf('a-2p.pdf', 2), pdf('b-1p.pdf', 1)], {
      type: 'image/jpeg',
      open: fakeOpen(opened),
      onProgress: (p) => events.push(p),
    });
    expect(events.map((e) => e.label)).toEqual([
      'Converting page 1 of 3: a-2p.pdf',
      'Converting page 2 of 3: a-2p.pdf',
      'Converting page 3 of 3: b-1p.pdf',
      'Packing the ZIP file…',
    ]);
    expect(opened).toEqual([]);
  });

  it('names the PDF that failed, with a message a person can act on', async () => {
    const open = fakeOpen();
    const error = await pdfsToImages([pdf('good-1p.pdf', 1), pdf('locked-1p.pdf', 1)], {
      type: 'image/jpeg',
      open: async (file, rotation) => {
        if (file.name.startsWith('locked')) {
          throw Object.assign(new Error('needs password'), { name: 'PasswordException' });
        }
        return open(file, rotation);
      },
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: 'password',
      failedFile: { index: 1, name: 'locked-1p.pdf' },
    });
  });

  it('turns running out of memory into advice', async () => {
    const error = await pdfsToImages([pdf('huge-1p.pdf', 1)], {
      type: 'image/png',
      open: async () => ({
        pageCount: 1,
        render: () => Promise.reject(new RangeError('Out of memory')),
        close: async () => undefined,
      }),
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'failed', message: expect.stringMatching(/resolution/) });
  });

  it('stops when cancelled', async () => {
    const controller = new AbortController();
    const error = await pdfsToImages([pdf('a-3p.pdf', 3)], {
      type: 'image/jpeg',
      open: fakeOpen(),
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'cancelled' });
  });
});

describe('pageFileName', () => {
  it('pads page numbers to the width of the page count', () => {
    expect(pageFileName('doc', 3, 9, 'jpg')).toBe('doc-3.jpg');
    expect(pageFileName('doc', 3, 12, 'png')).toBe('doc-03.png');
    expect(pageFileName('doc', 42, 100, 'jpg')).toBe('doc-042.jpg');
  });
});

describe('uniqueBaseNames', () => {
  it('drops ".pdf" and keeps same-named files apart, ignoring case', () => {
    expect(uniqueBaseNames(['scan.pdf', 'Scan.PDF', 'scan (2).pdf', 'notes.pdf', '.pdf'])).toEqual([
      'scan',
      'Scan (2)',
      'scan (2) (2)',
      'notes',
      'document',
    ]);
  });
});
