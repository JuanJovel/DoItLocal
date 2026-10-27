import { defineConfig } from 'vitest/config';
import { doItLocalPlugin } from './build/doitlocal-plugin.ts';
import { siteConfig } from './src/config.ts';

export default defineConfig(({ command, isPreview }) => ({
  // The built site lives under the path of `siteConfig.siteUrl` (/DoItLocal/ on GitHub Pages);
  // the dev server is served from the root. `vite preview` serves the built output, so it matches the build.
  base: command === 'build' || isPreview ? new URL(siteConfig.siteUrl).pathname : '/',
  plugins: [doItLocalPlugin({ siteUrl: siteConfig.siteUrl })],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Never inline assets as data: URIs; keeps the CSP simple and caching effective.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 700,
  },
  worker: {
    format: 'es',
  },
  // ffmpeg.wasm starts its own worker from a URL next to its code, which pre-bundling would break.
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg'],
  },
  test: {
    include: ['src/**/*.test.ts', 'build/**/*.test.ts'],
    environment: 'node',
    // The integration tests build and parse real PDFs; give them room on slower machines.
    testTimeout: 30_000,
  },
}));
