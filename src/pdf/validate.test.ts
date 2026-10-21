import { describe, expect, it } from 'vitest';
import { checkPdfFile, describeLoadError, inspectPdfFile } from './validate';
import { makeSamplePdf } from './test-helpers';

function fileOf(content: string | Uint8Array, name: string, type = ''): File {
  return new File([content as BlobPart], name, { type });
}

describe('checkPdfFile', () => {
  it('accepts a real PDF', async () => {
    const bytes = await makeSamplePdf('A', 1);
    expect(await checkPdfFile(fileOf(bytes, 'a.pdf', 'application/pdf'))).toBeNull();
  });

  it('accepts a PDF with no extension or type, judging by content', async () => {
    const bytes = await makeSamplePdf('A', 1);
    expect(await checkPdfFile(fileOf(bytes, 'download'))).toBeNull();
  });

  it('accepts junk before the header, as the PDF spec allows', async () => {
    const bytes = new TextEncoder().encode('\n\n   garbage\n%PDF-1.7\n1 0 obj');
    expect(await checkPdfFile(fileOf(bytes, 'odd.pdf'))).toBeNull();
  });

  it('rejects an empty file', async () => {
    const problem = await checkPdfFile(fileOf('', 'empty.pdf', 'application/pdf'));
    expect(problem?.code).toBe('empty');
  });

  it('flags a .pdf that has no PDF header as damaged', async () => {
    const problem = await checkPdfFile(fileOf('hello world', 'fake.pdf', 'application/pdf'));
    expect(problem?.code).toBe('corrupt');
    expect(problem?.message).toMatch(/damaged|valid PDF/i);
  });

  it.each([
    ['photo.png', 'image/png', /image/i],
    ['photo.JPG', '', /image/i],
    ['letter.docx', '', /office document/i],
    ['sheet.xlsx', '', /office document/i],
    ['bundle.zip', 'application/zip', /archive/i],
    ['notes.txt', 'text/plain', /text file/i],
    ['mystery.bin', '', /doesn.t look like a PDF/i],
  ])('explains what a non-PDF %s is', async (name, type, pattern) => {
    const problem = await checkPdfFile(fileOf('not a pdf at all', name, type));
    expect(problem?.code).toBe('not-pdf');
    expect(problem?.message).toMatch(pattern);
  });

  it('only reads the start of the file', async () => {
    // A file whose header is fine passes even if the rest is junk: the deep check is pdf.js.
    const bytes = new TextEncoder().encode('%PDF-1.4\n' + 'x'.repeat(50_000));
    expect(await checkPdfFile(fileOf(bytes, 'big.pdf'))).toBeNull();
  });

  it('reports unreadable files instead of throwing', async () => {
    const file = fileOf('%PDF-1.4', 'a.pdf');
    Object.defineProperty(file, 'slice', {
      value: () => ({
        arrayBuffer: () => Promise.reject(new DOMException('x', 'NotReadableError')),
      }),
    });
    expect((await checkPdfFile(file))?.code).toBe('unreadable');
  });
});

describe('describeLoadError', () => {
  it('maps pdf.js password errors', () => {
    const error = Object.assign(new Error('No password given'), { name: 'PasswordException' });
    const problem = describeLoadError(error);
    expect(problem.code).toBe('password');
    expect(problem.message).toMatch(/password-protected/i);
  });

  it('maps invalid-structure and missing-file errors to corrupt', () => {
    expect(
      describeLoadError(Object.assign(new Error('x'), { name: 'InvalidPDFException' })).code,
    ).toBe('corrupt');
    expect(
      describeLoadError(Object.assign(new Error('x'), { name: 'MissingPDFException' })).code,
    ).toBe('corrupt');
  });

  it('maps read failures to unreadable', () => {
    expect(describeLoadError(Object.assign(new Error('x'), { name: 'FileReadError' })).code).toBe(
      'unreadable',
    );
  });

  it('treats anything unknown as a damaged file', () => {
    expect(describeLoadError('boom').code).toBe('corrupt');
    expect(describeLoadError(undefined).code).toBe('corrupt');
  });
});

describe('inspectPdfFile', () => {
  const named = (name: string): Error => Object.assign(new Error(name), { name });

  it('returns the page count of a good PDF', async () => {
    const bytes = await makeSamplePdf('A', 1);
    const result = await inspectPdfFile(fileOf(bytes, 'a.pdf'), async () => ({ pageCount: 7 }));
    expect(result).toEqual({ info: { pageCount: 7 } });
  });

  it('explains each kind of bad file', async () => {
    const good = await makeSamplePdf('G', 1);
    const open = async (file: File) => {
      if (file.name === 'locked.pdf') throw named('PasswordException');
      if (file.name === 'broken.pdf') throw named('InvalidPDFException');
      return { pageCount: 1 };
    };
    const codes = await Promise.all(
      [
        fileOf('hello', 'picture.png', 'image/png'),
        fileOf(good, 'locked.pdf'),
        fileOf(good, 'broken.pdf'),
        fileOf('', 'empty.pdf'),
      ].map(async (file) => {
        const result = await inspectPdfFile(file, open);
        return 'problem' in result ? result.problem.code : 'ok';
      }),
    );
    expect(codes).toEqual(['not-pdf', 'password', 'corrupt', 'empty']);
  });
});
