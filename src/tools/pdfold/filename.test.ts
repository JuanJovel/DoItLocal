import { describe, expect, it } from 'vitest';
import { DEFAULT_OUTPUT_NAME, sanitizeOutputName } from './filename';

describe('sanitizeOutputName', () => {
  it('keeps a normal name and ensures a single .pdf extension', () => {
    expect(sanitizeOutputName('report')).toBe('report.pdf');
    expect(sanitizeOutputName('report.pdf')).toBe('report.pdf');
    expect(sanitizeOutputName('report.PDF')).toBe('report.pdf');
    expect(sanitizeOutputName('report.pdf.pdf')).toBe('report.pdf');
  });

  it('falls back to the default for empty or unusable input', () => {
    expect(sanitizeOutputName('')).toBe(DEFAULT_OUTPUT_NAME);
    expect(sanitizeOutputName('   ')).toBe(DEFAULT_OUTPUT_NAME);
    expect(sanitizeOutputName('.pdf')).toBe(DEFAULT_OUTPUT_NAME);
    expect(sanitizeOutputName('...')).toBe(DEFAULT_OUTPUT_NAME);
    expect(sanitizeOutputName('///')).toBe(DEFAULT_OUTPUT_NAME);
  });

  it('removes characters that are illegal in file names', () => {
    expect(sanitizeOutputName('a/b\\c:d*e?f"g<h>i|j')).toBe('abcdefghij.pdf');
    expect(sanitizeOutputName('line\nbreak\u0000')).toBe('linebreak.pdf');
  });

  it('trims spaces and trailing dots', () => {
    expect(sanitizeOutputName('  my file.  ')).toBe('my file.pdf');
    expect(sanitizeOutputName('.hidden')).toBe('hidden.pdf');
  });

  it('avoids reserved Windows device names', () => {
    expect(sanitizeOutputName('con')).toBe('con_.pdf');
    expect(sanitizeOutputName('NUL.pdf')).toBe('NUL_.pdf');
    expect(sanitizeOutputName('console')).toBe('console.pdf');
  });

  it('limits very long names', () => {
    const result = sanitizeOutputName('x'.repeat(500));
    expect(result.endsWith('.pdf')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(124);
  });

  it('keeps unicode names', () => {
    expect(sanitizeOutputName('Résumé 履歴書')).toBe('Résumé 履歴書.pdf');
  });

  it('honors a custom fallback', () => {
    expect(sanitizeOutputName('', 'out.pdf')).toBe('out.pdf');
  });
});
