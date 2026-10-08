import { describe, expect, it } from 'vitest';
import { normalizePath, resolveRoute } from './router';

describe('normalizePath', () => {
  it('handles the root deployment', () => {
    expect(normalizePath('/', '/')).toBe('/');
    expect(normalizePath('/pdfold', '/')).toBe('/pdfold');
    expect(normalizePath('/pdfold/', '/')).toBe('/pdfold');
    expect(normalizePath('/pdfold/index.html', '/')).toBe('/pdfold');
    expect(normalizePath('/index.html', '/')).toBe('/');
  });

  it('strips a sub-path base (GitHub Pages project sites)', () => {
    expect(normalizePath('/repo/', '/repo/')).toBe('/');
    expect(normalizePath('/repo', '/repo/')).toBe('/');
    expect(normalizePath('/repo/pdfold/', '/repo/')).toBe('/pdfold');
  });

  it('does not strip a base that merely shares a prefix', () => {
    expect(normalizePath('/repository/pdfold', '/repo/')).toBe('/repository/pdfold');
  });
});

describe('resolveRoute', () => {
  it('resolves home and live tools', () => {
    expect(resolveRoute('/').kind).toBe('home');
    const route = resolveRoute('/pdfold/');
    expect(route.kind).toBe('tool');
    if (route.kind === 'tool') expect(route.tool.id).toBe('pdfold');
  });

  it('works under a base path', () => {
    expect(resolveRoute('/repo/pdfold/', '/repo/').kind).toBe('tool');
    expect(resolveRoute('/repo/', '/repo/').kind).toBe('home');
  });

  it('returns not-found for unknown and coming-soon pages', () => {
    expect(resolveRoute('/nope').kind).toBe('not-found');
    expect(resolveRoute('/split-pdf').kind).toBe('not-found');
    expect(resolveRoute('/pdfold/extra').kind).toBe('not-found');
  });
});
