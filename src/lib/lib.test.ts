import { describe, expect, it } from 'vitest';
import { clamp } from './clamp';
import { formatBytes, plural } from './format';
import { serialRunner } from './serial';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [10 * 1024 * 1024, '10 MB'],
    [123.4 * 1024 * 1024, '123 MB'],
    [2.5 * 1024 ** 3, '2.5 GB'],
  ])('formats %d bytes as %s', (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });

  it('is safe on bad input', () => {
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});

describe('clamp', () => {
  it('keeps values inside the range and limits the ones outside it', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('plural', () => {
  it('pluralizes', () => {
    expect(plural(1, 'page')).toBe('1 page');
    expect(plural(0, 'page')).toBe('0 pages');
    expect(plural(3, 'file')).toBe('3 files');
    expect(plural(2, 'box', 'boxes')).toBe('2 boxes');
  });
});

describe('serialRunner', () => {
  it('runs tasks one at a time, in call order, and returns their results', async () => {
    const run = serialRunner();
    const started: number[] = [];
    let active = 0;
    let maxActive = 0;
    const task = (n: number) => async () => {
      started.push(n);
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n * 2;
    };
    const results = await Promise.all([1, 2, 3, 4].map((n) => run(task(n))));
    expect(results).toEqual([2, 4, 6, 8]);
    expect(started).toEqual([1, 2, 3, 4]);
    expect(maxActive).toBe(1);
  });

  it('keeps running after a task fails', async () => {
    const run = serialRunner();
    const failing = run(() => Promise.reject(new Error('nope')));
    const after = run(() => Promise.resolve('ok'));
    await expect(failing).rejects.toThrow('nope');
    await expect(after).resolves.toBe('ok');
  });
});
