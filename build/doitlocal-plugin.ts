import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createServer, type Plugin, type ResolvedConfig } from 'vite';
import { metaCsp } from './csp.ts';

/**
 * Build-time glue for DoItLocal. It turns the single source of truth (src/config.ts and the
 * tools registry) into everything that has to exist as a real file:
 *
 *  - strict CSP <meta> tag in every page (copied from public/_headers)
 *  - per-page SEO/social tags: /index.html and /<tool>/index.html (+ 404.html)
 *  - manifest.webmanifest, sitemap.xml, robots.txt
 *  - the offline precache list inside sw.js
 *
 * Adding a tool to the registry is enough; nothing here needs editing.
 */

interface Options {
  /** Public URL of the site including sub-path and trailing slash. */
  siteUrl: string;
}

/** Shape of the modules loaded through Vite's SSR loader (kept loose on purpose). */
interface SeoModule {
  homeMeta(): unknown;
  toolMeta(tool: unknown): unknown;
  notFoundMeta(): unknown;
  renderSeoTags(meta: unknown, siteUrl: string): string;
  SEO_START: string;
  SEO_END: string;
}
interface RegistryModule {
  liveTools(): { slug: string }[];
}
interface ConfigModule {
  siteConfig: {
    name: string;
    shortName: string;
    description: string;
    themeColor: string;
  };
}

export function doItLocalPlugin({ siteUrl }: Options): Plugin {
  let config: ResolvedConfig;

  return {
    name: 'doitlocal',

    configResolved(resolved) {
      config = resolved;
    },

    /** Dev server: serve the manifest the build would generate. */
    configureServer(server) {
      server.middlewares.use(`${config.base}manifest.webmanifest`, (_req, res) => {
        void server.ssrLoadModule('/src/config.ts').then((mod) => {
          res.setHeader('Content-Type', 'application/manifest+json');
          res.end(JSON.stringify(buildManifest((mod as unknown as ConfigModule).siteConfig)));
        });
      });
    },

    transformIndexHtml: {
      order: 'pre',
      async handler(html, ctx) {
        const { root } = config;
        const { seo } = await loadSources(root);
        const csp = ctx.server
          ? '' // Vite's dev server needs inline styles and a websocket, so no CSP while developing.
          : `<meta http-equiv="Content-Security-Policy" content="${metaCsp(
              readFileSync(join(root, 'public/_headers'), 'utf8'),
            )}" />`;
        return html
          .replace('<!-- @csp -->', csp)
          .replace('<!-- @seo -->', seo.renderSeoTags(seo.homeMeta(), siteUrl));
      },
    },

    /** After the bundle is written: derive the extra files from it. */
    async closeBundle() {
      if (config.command !== 'build') return;
      const root = config.root;
      const out = resolve(root, config.build.outDir);
      const indexPath = join(out, 'index.html');
      if (!existsSync(indexPath)) return;

      const { seo, registry, config: configModule } = await loadSources(root);
      const { siteConfig } = configModule;
      const indexHtml = readFileSync(indexPath, 'utf8');

      const swap = (meta: unknown, extra = ''): string => {
        const block = seo.renderSeoTags(meta, siteUrl) + extra;
        const start = indexHtml.indexOf(seo.SEO_START);
        const end = indexHtml.indexOf(seo.SEO_END) + seo.SEO_END.length;
        return indexHtml.slice(0, start) + block + indexHtml.slice(end);
      };

      // One static HTML file per tool so crawlers and link previews get the right tags.
      const tools = registry.liveTools();
      for (const tool of tools) {
        writeFile(join(out, tool.slug, 'index.html'), swap(seo.toolMeta(tool)));
      }
      // 404.html: used by GitHub Pages for unknown URLs; the client router shows "not found".
      writeFile(
        join(out, '404.html'),
        swap(seo.notFoundMeta(), '\n    <meta name="robots" content="noindex" />'),
      );

      writeFile(
        join(out, 'manifest.webmanifest'),
        JSON.stringify(buildManifest(siteConfig), null, 2),
      );

      const siteRoot = siteUrl.replace(/\/+$/, '');
      const urls = ['', ...tools.map((t) => `${t.slug}/`)];
      writeFile(
        join(out, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url><loc>${siteRoot}/${u}</loc></url>`).join('\n') +
          `\n</urlset>\n`,
      );
      writeFile(
        join(out, 'robots.txt'),
        `User-agent: *\nAllow: /\n\nSitemap: ${siteRoot}/sitemap.xml\n`,
      );

      writeServiceWorker(out);
    },
  };
}

interface SourceModules {
  seo: SeoModule;
  registry: RegistryModule;
  config: ConfigModule;
}

/** Load source modules in Node through Vite's SSR pipeline (handles TypeScript). Cached per root. */
const loaded = new Map<string, Promise<SourceModules>>();
function loadSources(root: string): Promise<SourceModules> {
  let promise = loaded.get(root);
  if (!promise) {
    promise = (async () => {
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'silent',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      try {
        return {
          seo: (await server.ssrLoadModule('/src/seo.ts')) as unknown as SeoModule,
          registry: (await server.ssrLoadModule(
            '/src/tools/registry.ts',
          )) as unknown as RegistryModule,
          config: (await server.ssrLoadModule('/src/config.ts')) as unknown as ConfigModule,
        };
      } finally {
        await server.close();
      }
    })();
    loaded.set(root, promise);
  }
  return promise;
}

function buildManifest(site: ConfigModule['siteConfig']): Record<string, unknown> {
  return {
    name: site.name,
    short_name: site.shortName,
    description: site.description,
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: site.themeColor,
    theme_color: site.themeColor,
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: 'icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

/** Largest file the service worker downloads on install. */
const PRECACHE_MAX_BYTES = 5 * 1024 * 1024;

/** Fill the placeholders in sw.js with the real file list and a content-based cache version. */
function writeServiceWorker(out: string): void {
  const swPath = join(out, 'sw.js');
  if (!existsSync(swPath)) return;

  const skip = new Set(['sw.js', '_headers', '404.html', 'robots.txt', 'sitemap.xml']);
  const files = listFiles(out)
    .map((f) => relative(out, f).split('\\').join('/'))
    .filter((f) => !skip.has(f) && !f.endsWith('.map'))
    // Very large files (ffmpeg.wasm) are not downloaded by every visitor up front; sw.js caches
    // them the first time a tool asks for one.
    .filter((f) => statSync(join(out, f)).size <= PRECACHE_MAX_BYTES)
    .sort();

  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update(readFileSync(join(out, file)));

  // './' is the directory URL (served from index.html); keep both spellings cached.
  const precache = ['./', ...files];
  const source = readFileSync(swPath, 'utf8')
    .replace(
      "const VERSION = '__VERSION__';",
      `const VERSION = '${hash.digest('hex').slice(0, 12)}';`,
    )
    .replace(
      'const PRECACHE = __PRECACHE__;',
      `const PRECACHE = ${JSON.stringify(precache, null, 2)};`,
    );
  if (source.includes('__PRECACHE__;') || source.includes('__VERSION__')) {
    throw new Error('sw.js placeholders were not replaced');
  }
  writeFileSync(swPath, source);
}
