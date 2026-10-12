import { describe, expect, it } from 'vitest';
import { siteConfig } from './config';
import { faqItems } from './content';
import {
  absoluteUrl,
  escapeHtml,
  homeMeta,
  renderSeoTags,
  SEO_END,
  SEO_START,
  toolMeta,
} from './seo';
import { liveTools, tools } from './tools/registry';

describe('seo', () => {
  it('builds absolute URLs without doubled slashes', () => {
    expect(absoluteUrl('https://x.test/', 'pdfold/')).toBe('https://x.test/pdfold/');
    expect(absoluteUrl('https://x.test/repo/', '')).toBe('https://x.test/repo/');
    expect(absoluteUrl('https://x.test/repo', '/og.png')).toBe('https://x.test/repo/og.png');
  });

  it('escapes HTML in attribute values', () => {
    expect(escapeHtml('a "b" <c> & d')).toBe('a &quot;b&quot; &lt;c&gt; &amp; d');
  });

  it('renders social and canonical tags for the home page', () => {
    const html = renderSeoTags(homeMeta(), 'https://x.test/repo/');
    expect(html.startsWith(SEO_START)).toBe(true);
    expect(html.endsWith(SEO_END)).toBe(true);
    expect(html).toContain('<link rel="canonical" href="https://x.test/repo/" />');
    expect(html).toContain('property="og:image" content="https://x.test/repo/og-image.png"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain(
      `<title>Free PDF, Image and QR Tools, No Upload | ${siteConfig.shortName}`,
    );
    expect(html).not.toContain('name="keywords"');
  });

  it('renders tool pages with their own title, URL and JSON-LD', () => {
    const pdfold = liveTools()[0]!;
    const html = renderSeoTags(toolMeta(pdfold), 'https://x.test/');
    expect(html).toContain('<title>Merge PDF Files Free, No Upload | PDFold</title>');
    expect(html).toContain('<link rel="canonical" href="https://x.test/pdfold/" />');
    expect(html).toContain('"@type":"WebApplication"');
    expect(html).toContain('"price":"0"');
  });

  it('describes tool pages with a breadcrumb and the FAQ the page shows', () => {
    const pdfold = liveTools()[0]!;
    const html = renderSeoTags(toolMeta(pdfold), 'https://x.test/');
    const data = JSON.parse(html.slice(html.indexOf('{'), html.lastIndexOf('}') + 1)) as {
      '@graph': { '@type': string; itemListElement?: { item: string }[]; mainEntity?: unknown[] }[];
    };
    const byType = Object.fromEntries(data['@graph'].map((node) => [node['@type'], node]));
    expect(byType['BreadcrumbList']?.itemListElement?.map((i) => i.item)).toEqual([
      'https://x.test/',
      'https://x.test/pdfold/',
    ]);
    expect(byType['FAQPage']?.mainEntity).toHaveLength(pdfold.faq!.length + faqItems.length);
  });

  it('never lets content break out of the JSON-LD script', () => {
    const meta = { ...homeMeta(), description: '</script><script>alert(1)</script>' };
    const html = renderSeoTags(meta, 'https://x.test/');
    const jsonLd = html.slice(html.indexOf('application/ld+json'));
    expect(jsonLd.split('</script>').length).toBe(2); // exactly one closing tag
  });

  it('has a title and description for every live tool', () => {
    for (const tool of tools.filter((t) => t.status === 'live')) {
      const meta = toolMeta(tool);
      expect(meta.title.length).toBeGreaterThan(10);
      expect(meta.description.length).toBeGreaterThan(20);
      expect(meta.path).toBe(`${tool.slug}/`);
    }
  });
});
