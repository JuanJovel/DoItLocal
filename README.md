# DoItLocal Toolkit

[![Deploy](https://github.com/JuanJovel/DoItLocal/actions/workflows/deploy.yml/badge.svg)](https://github.com/JuanJovel/DoItLocal/actions/workflows/deploy.yml)
[![Open the site](https://img.shields.io/badge/Open_the_site-juanjovel.github.io%2FDoItLocal-a1cca5?style=for-the-badge)](https://juanjovel.github.io/DoItLocal/)

Small, free web tools that run entirely in your browser. No uploads, no accounts, no tracking.

## Tools

- **PDFold** merges PDFs. Drop in files, drag them into order, rotate them if needed, and download one PDF.
- **PicFold** turns photos, scans and screenshots into one PDF. Reorder and rotate them, pick a page size, and download.
- **SnapPages** turns PDF pages into JPG or PNG images: one image for a one-page PDF, or a ZIP with every page.
- **EzQR** makes QR codes from a link or text and exports them as PNG or SVG, with no watermark.
- **ReelBack** reverses a video, sound included, and saves it as an MP4. It runs ffmpeg in the browser with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm).

Everything is processed on your own device. There is no backend: the site is only static files.

## Privacy

The Content-Security-Policy only allows requests to the site's own origin and no third-party scripts, fonts or analytics. ffmpeg.wasm is served from the site itself, not a CDN; the policy's `'wasm-unsafe-eval'` lets it compile WebAssembly while JavaScript `eval()` stays blocked. You can check this yourself: open the Network tab in your browser's dev tools and use a tool, or load the page and go offline.

## Adding a tool

1. Create `src/tools/my-tool/` with an `index.ts` that exports a `ToolDefinition` (see `src/tools/pdfold/index.ts`) and a `page.ts` that exports `mount({ container })` and returns an optional cleanup function.
2. Add the tool to the `tools` array in `src/tools/registry.ts`.

A tool that turns a list of files into one PDF can reuse `src/file-queue/`: the drop zone, reorderable cards, background worker and download flow. PDFold, PicFold and SnapPages are all built on it; each page is mostly configuration.

The home page card, the route, the SEO tags, the sitemap entry and the offline cache are all generated from the registry. A tool that is planned but not built can be listed with `status: 'soon'` and no `load`.

## License

MIT, see [LICENSE](LICENSE). Third-party licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
