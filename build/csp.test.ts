import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { metaCsp, parseHeadersFile } from './csp';

const headersFile = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

describe('public/_headers', () => {
  const rules = parseHeadersFile(headersFile);
  const csp = (path: string): string =>
    rules.find((r) => r.path === path)?.headers['Content-Security-Policy'] ?? '';

  it('only allows same-origin requests from pages (the privacy guarantee)', () => {
    for (const path of ['/', '/index.html', '/404.html', '/*/', '/assets/*']) {
      expect(csp(path), path).toContain("connect-src 'self'");
    }
  });

  it('keeps the policy tight', () => {
    const policy = csp('/');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval';");
    expect(policy).toContain("worker-src 'self' blob:");
    expect(policy).toContain("img-src 'self' blob: data:");
    expect(policy).toContain("media-src 'self' blob:");
    // 'wasm-unsafe-eval' (for ffmpeg.wasm) compiles WebAssembly only; JavaScript eval stays off.
    expect(policy).not.toMatch(/unsafe-inline|(?<!wasm-)unsafe-eval|\*\s|https?:/);
  });

  it('uses the same policy on every page route', () => {
    const normalize = (p: string): string => p.replace(/;\s*frame-ancestors[^;]*/, '');
    const pages = ['/', '/index.html', '/404.html', '/*/'].map((p) => normalize(csp(p)));
    expect(new Set(pages).size).toBe(1);
  });

  it('lets only the service worker script fetch from its own origin', () => {
    const swRule = rules.find((r) => r.path === '/sw.js');
    expect(swRule?.headers['Content-Security-Policy']).toContain("connect-src 'self'");
    expect(swRule?.headers['Cache-Control']).toBe('no-cache');
  });

  it('sets baseline security headers for all paths', () => {
    const all = rules.find((r) => r.path === '/*')?.headers ?? {};
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['Referrer-Policy']).toBe('no-referrer');
  });
});

describe('metaCsp', () => {
  it('drops directives that only work as HTTP headers', () => {
    const meta = metaCsp(headersFile);
    expect(meta).not.toContain('frame-ancestors');
    expect(meta).toContain("connect-src 'self'");
  });

  it('throws if the policy is missing', () => {
    expect(() => metaCsp('/*\n  X-Test: 1\n')).toThrow(/Content-Security-Policy/);
  });
});

describe('parseHeadersFile', () => {
  it('ignores comments and blank lines', () => {
    const rules = parseHeadersFile('# hi\n\n/a\n  X-One: 1\n  X-Two: a: b\n/b\n  X-Three: 3\n');
    expect(rules).toEqual([
      { path: '/a', headers: { 'X-One': '1', 'X-Two': 'a: b' } },
      { path: '/b', headers: { 'X-Three': '3' } },
    ]);
  });
});
