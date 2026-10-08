# DoItLocal Toolkit

Small, free web tools that run entirely in your browser. No uploads, no accounts, no tracking.

## Tools

- **PDFold** merges PDFs. Drop in files, drag them into order, rotate them if needed, and download one PDF.
- **EzQR** makes QR codes from a link or text and exports them as PNG or SVG, with no watermark.

Everything is processed on your own device. There is no backend: the site is only static files.

## Privacy

The Content-Security-Policy only allows requests to the site's own origin and no third-party scripts, fonts or analytics. You can check this yourself: open the Network tab in your browser's dev tools and use a tool, or load the page and go offline.

## Adding a tool

1. Create `src/tools/my-tool/` with an `index.ts` that exports a `ToolDefinition` (see `src/tools/pdfold/index.ts`) and a `page.ts` that exports `mount({ container })` and returns an optional cleanup function.
2. Add the tool to the `tools` array in `src/tools/registry.ts`.

The home page card, the route, the SEO tags, the sitemap entry and the offline cache are all generated from the registry. A tool that is planned but not built can be listed with `status: 'soon'` and no `load`.

## License

MIT, see [LICENSE](LICENSE). Third-party licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
