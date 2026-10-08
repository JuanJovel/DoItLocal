import { findToolBySlug } from '../tools/registry';
import type { ToolDefinition, Unmount } from '../tools/types';

export type Route =
  { kind: 'home' } | { kind: 'tool'; tool: ToolDefinition } | { kind: 'not-found' };

/**
 * The path segments that identify a page, with the site's base path and any "index.html" removed:
 * "/DoItLocal/pdfold/" and "/DoItLocal/pdfold/index.html" both give ["pdfold"].
 */
function routeSegments(pathname: string, base: string): string[] {
  const split = (path: string): string[] => path.split('/').filter(Boolean);
  const baseSegments = split(base);
  const segments = split(pathname);

  const underBase = baseSegments.every((segment, i) => segments[i] === segment);
  return (underBase ? segments.slice(baseSegments.length) : segments).filter(
    (segment) => segment !== 'index.html',
  );
}

/** "/DoItLocal/pdfold/" -> "/pdfold" and "/DoItLocal/" -> "/". */
export function normalizePath(pathname: string, base = '/'): string {
  return `/${routeSegments(pathname, base).join('/')}`;
}

export function resolveRoute(pathname: string, base = '/'): Route {
  const [slug, ...rest] = routeSegments(pathname, base);
  if (slug === undefined) return { kind: 'home' };

  const tool = rest.length === 0 ? findToolBySlug(slug) : undefined;
  return tool ? { kind: 'tool', tool } : { kind: 'not-found' };
}

export function toolHref(tool: ToolDefinition, base = import.meta.env.BASE_URL): string {
  return `${base}${tool.slug}/`;
}

export interface RouterOptions {
  base: string;
  /** Renders a route and returns the page's cleanup, if it has one. */
  render: (route: Route) => Promise<Unmount | undefined>;
}

/** Minimal History-API router: handles clicks on internal links and the back/forward buttons. */
export function startRouter({ base, render }: RouterOptions): void {
  let unmountCurrent: Unmount | undefined;
  let navigationId = 0;

  async function renderCurrentRoute(): Promise<void> {
    const id = ++navigationId;
    unmountCurrent?.();
    unmountCurrent = undefined;

    const unmount = await render(resolveRoute(location.pathname, base));

    // Another navigation started while this page was loading: it is already stale.
    if (id !== navigationId) unmount?.();
    else unmountCurrent = unmount;
  }

  document.addEventListener('click', (event) => {
    const link = internalLinkFor(event, base);
    if (!link) return;
    event.preventDefault();
    const url = new URL(link.href);
    history.pushState({}, '', url.pathname + url.search + url.hash);
    void renderCurrentRoute();
  });
  window.addEventListener('popstate', () => void renderCurrentRoute());

  void renderCurrentRoute();
}

/**
 * The link the router should handle for this click, or null when the browser should do its normal
 * thing: modified or non-primary clicks, links that open elsewhere or download, other sites,
 * files such as /sitemap.xml, and anchors within the current page.
 */
function internalLinkFor(event: MouseEvent, base: string): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
  if (!link || link.target !== '' || link.hasAttribute('download')) return null;

  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(base)) return null;
  if (/\.\w+$/.test(url.pathname) && !url.pathname.endsWith('.html')) return null;
  if (url.pathname === location.pathname && url.hash !== '') return null;
  return link;
}
