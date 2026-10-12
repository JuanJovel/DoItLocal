import { siteConfig } from './config';
import { faqItems, type FaqItem } from './content';
import type { ToolDefinition } from './tools/types';

/**
 * SEO and social metadata. Pure functions, no DOM: the build uses them to write
 * static tags into each page's HTML (so crawlers and link previews see them without
 * running JavaScript) and the router uses them to keep the title in sync on navigation.
 */

export interface PageMeta {
  title: string;
  description: string;
  /** Path relative to the site root, e.g. "" for home or "pdfold/". */
  path: string;
  /** Tool this page belongs to, if any. */
  tool?: ToolDefinition;
  /** The questions the page shows, mirrored in its structured data. */
  faq?: readonly FaqItem[];
}

export function homeMeta(): PageMeta {
  return {
    title: `Free PDF, Image and QR Tools, No Upload | ${siteConfig.shortName}`,
    description: siteConfig.description,
    path: '',
    faq: faqItems,
  };
}

export function toolMeta(tool: ToolDefinition): PageMeta {
  return {
    title: tool.seoTitle ?? `${tool.name} | ${siteConfig.shortName}`,
    description: tool.description,
    path: `${tool.slug}/`,
    tool,
    faq: [...(tool.faq ?? []), ...faqItems],
  };
}

export function notFoundMeta(): PageMeta {
  return {
    title: `Page not found | ${siteConfig.shortName}`,
    description: siteConfig.description,
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

  const jsonLd = structuredData(meta, url, absoluteUrl(siteUrl, ''));

  return [
    SEO_START,
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
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

/**
 * schema.org data for a page: the web app with its price and breadcrumb for tool pages, the site
 * for the home page, and the page's visible FAQ. It must match what the page shows.
 */
function structuredData(meta: PageMeta, url: string, homeUrl: string): object {
  const graph: object[] = [];
  if (meta.tool) {
    graph.push(
      {
        '@type': 'WebApplication',
        name: meta.tool.name,
        description: meta.description,
        url,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteConfig.shortName, item: homeUrl },
          { '@type': 'ListItem', position: 2, name: meta.tool.name, item: url },
        ],
      },
    );
  } else {
    graph.push({
      '@type': 'WebSite',
      name: siteConfig.name,
      description: siteConfig.description,
      url,
    });
  }
  if (meta.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: meta.faq.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
