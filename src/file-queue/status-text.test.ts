import { describe, expect, it } from 'vitest';
import { actionHint, LARGE_TOTAL_BYTES, queueSummary } from './status-text';

const base = { files: 3, pages: 6, bytes: 2048, problems: 0, checking: false };
const merge = { minFiles: 2, noun: 'PDF', verb: 'merge' };
const convert = { minFiles: 1, noun: 'image', verb: 'convert' };

describe('queueSummary', () => {
  it('summarizes files, pages and size', () => {
    expect(queueSummary(base)).toBe('3 files · 6 pages · 2 KB');
  });

  it('mentions problem files and ongoing reads', () => {
    expect(queueSummary({ ...base, files: 1, pages: 1, problems: 2, checking: true })).toBe(
      "1 file · 1 page · 2 KB · 2 files can't be used · reading…",
    );
  });
});

describe('actionHint', () => {
  it('asks for more files until there are enough', () => {
    expect(actionHint({ ...base, files: 0 }, merge)).toBe('Add at least two PDFs to merge.');
    expect(actionHint({ ...base, files: 1 }, merge)).toBe('Add at least one more PDF to merge.');
    expect(actionHint({ ...base, files: 0 }, convert)).toBe('Add at least one image to convert.');
    expect(actionHint({ ...base, files: 1, pages: 1 }, convert)).toMatch(/^Ready/);
  });

  it('says when files are still being read', () => {
    expect(actionHint({ ...base, checking: true }, merge)).toMatch(/reading/i);
  });

  it('warns about very large totals', () => {
    expect(actionHint({ ...base, bytes: LARGE_TOTAL_BYTES + 1 }, merge)).toMatch(
      /smaller batches/i,
    );
  });

  it('confirms when ready', () => {
    expect(actionHint(base, merge)).toBe('Ready: 3 PDFs into one PDF of 6 pages.');
  });
});
