import { describe, expect, it } from 'vitest';
import { describeIntake, LARGE_TOTAL_BYTES, mergeHint, queueSummary } from './status-text';

const base = { files: 3, pages: 6, bytes: 2048, problems: 0, checking: false };

describe('queueSummary', () => {
  it('summarizes files, pages and size', () => {
    expect(queueSummary(base)).toBe('3 files · 6 pages · 2 KB');
  });

  it('mentions problem files and ongoing reads', () => {
    expect(queueSummary({ ...base, files: 1, pages: 1, problems: 2, checking: true })).toBe(
      '1 file · 1 page · 2 KB · 2 files can’t be merged · reading…',
    );
  });
});

describe('mergeHint', () => {
  const idle = { ...base, merging: false };

  it('is empty while merging', () => {
    expect(mergeHint({ ...idle, merging: true })).toBe('');
  });

  it('asks for more files until there are two', () => {
    expect(mergeHint({ ...idle, files: 0 })).toMatch(/at least two/i);
    expect(mergeHint({ ...idle, files: 1 })).toMatch(/one more/i);
  });

  it('says when files are still being read', () => {
    expect(mergeHint({ ...idle, checking: true })).toMatch(/reading/i);
  });

  it('warns about very large totals', () => {
    expect(mergeHint({ ...idle, bytes: LARGE_TOTAL_BYTES + 1 })).toMatch(/smaller batches/i);
  });

  it('confirms when ready', () => {
    expect(mergeHint(idle)).toBe('Ready: 3 PDFs into one file of 6 pages.');
  });
});

describe('describeIntake', () => {
  const problem = (message: string) => ({ code: 'corrupt' as const, message });

  it('reports successes and the first few failures', () => {
    const text = describeIntake({
      added: 6,
      ok: 2,
      failed: ['a', 'b', 'c', 'd'].map((name) => ({ name, problem: problem(`${name} bad.`) })),
    });
    expect(text).toBe('Added 2 PDFs. a: a bad. b: b bad. c: c bad. 1 more files had problems.');
  });

  it('is just the success line when everything worked', () => {
    expect(describeIntake({ added: 1, ok: 1, failed: [] })).toBe('Added 1 PDF.');
  });
});
