import { siteConfig } from './config';
import type { ToolDefinition } from './tools/types';

/**
 * SEO and social metadata. Pure functions, no DOM: the build uses them to write
 * static tags into each page's HTML (so crawlers and link previews see them without
 * running JavaScript) and the router uses them to keep the title in sync on navigation.
 */

export interface PageMeta {
  title: string;
  description: string;
  keywords: string[];
  /** Path relative to the site root, e.g. "" for home or "pdfold/". */
  path: string;
  /** Tool this page belongs to, if any. */
  tool?: ToolDefinition;
}

export function homeMeta(): PageMeta {
  return {
    title: `${siteConfig.name}: Free, private tools that run in your browser`,
    description: siteConfig.description,
    keywords: [...siteConfig.keywords],
    path: '',
  };
}

export function toolMeta(tool: ToolDefinition): PageMeta {
  return {
    title: tool.seoTitle ?? `${tool.name} | ${siteConfig.shortName}`,
    description: tool.description,
    keywords: [...tool.keywords, ...siteConfig.keywords],
    path: `${tool.slug}/`,
    tool,
  };
}

export function notFoundMeta(): PageMeta {
  return {
    title: `Page not found | ${siteConfig.shortName}`,
    description: siteConfig.description,
    keywords: [],
    path: '',
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Join a site URL (with trailing slash) and a relative path without doubling slashes. */
export function absoluteUrl(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export const SEO_START = '<!-- seo:start -->';
export const SEO_END = '<!-- seo:end -->';

/** Build the block of <title>/<meta>/<link>/JSON-LD tags for one page. */
export function renderSeoTags(meta: PageMeta, siteUrl: string): string {
  const url = absoluteUrl(siteUrl, meta.path);
  const image = absoluteUrl(siteUrl, 'og-image.png');
  const e = escapeHtml;

  const jsonLd = meta.tool
    ? {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: meta.tool.name,
        description: meta.description,
        url,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any (web browser)',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isAccessibleForFree: true,
      }
    : {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteConfig.name,
        description: siteConfig.description,
        url,
      };

  return [
    SEO_START,
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<meta name="keywords" content="${e(meta.keywords.join(', '))}" />`,
    `<link rel="canonical" href="${e(url)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${e(siteConfig.name)}" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(url)}" />`,
    `<meta property="og:image" content="${e(image)}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${e(`${siteConfig.name}: ${siteConfig.tagline}`)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
    `<meta name="twitter:image" content="${e(image)}" />`,
    // JSON-LD is data, not executable script, so it is allowed by the strict CSP.
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
    SEO_END,
  ].join('\n    ');
}
