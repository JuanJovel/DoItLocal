import { describe, expect, it } from 'vitest';
import { extensionFor, sanitizeOutputName } from './filename';

const name = (input: string): string => sanitizeOutputName(input, 'merged.pdf');

describe('sanitizeOutputName', () => {
  it('keeps a normal name and ensures a single extension', () => {
    expect(name('report')).toBe('report.pdf');
    expect(name('report.pdf')).toBe('report.pdf');
    expect(name('report.PDF')).toBe('report.pdf');
    expect(name('report.pdf.pdf')).toBe('report.pdf');
  });

  it('replaces a typed output extension with the one the download needs', () => {
    expect(sanitizeOutputName('pages.zip', 'pages.zip', 'jpg')).toBe('pages.jpg');
    expect(sanitizeOutputName('scan.jpeg', 'pages.zip')).toBe('scan.zip');
    expect(name('v1.2 notes')).toBe('v1.2 notes.pdf');
  });

  it('falls back to the default for empty or unusable input', () => {
    for (const input of ['', '   ', '.pdf', '...', '///']) expect(name(input)).toBe('merged.pdf');
    expect(sanitizeOutputName('', 'pages.zip', 'png')).toBe('pages.png');
  });

  it('removes characters that are illegal in file names', () => {
    expect(name('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij.pdf');
    expect(name('line\nbreak\u0000')).toBe('linebreak.pdf');
  });

  it('trims spaces and trailing dots', () => {
    expect(name('  my file.  ')).toBe('my file.pdf');
    expect(name('.hidden')).toBe('hidden.pdf');
  });

  it('avoids reserved Windows device names', () => {
    expect(name('con')).toBe('con_.pdf');
    expect(name('NUL.pdf')).toBe('NUL_.pdf');
    expect(name('console')).toBe('console.pdf');
  });

  it('limits very long names', () => {
    const result = name('x'.repeat(500));
    expect(result.endsWith('.pdf')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(124);
  });

  it('keeps unicode names', () => {
    expect(name('Résumé 履歴書')).toBe('Résumé 履歴書.pdf');
  });
});

describe('extensionFor', () => {
  it('maps the MIME types the tools produce', () => {
    expect(extensionFor('application/pdf')).toBe('pdf');
    expect(extensionFor('application/zip')).toBe('zip');
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
  });
});
