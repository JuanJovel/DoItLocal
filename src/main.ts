import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

import { siteConfig } from './config';
import { siteFooter } from './components/footer';
import { siteHeader } from './components/header';
import { announce, initAnnouncer } from './lib/announce';
import { createElement } from './lib/dom';
import { prefetchLiveToolsWhenIdle } from './lib/prefetch';
import { startRouter, type Route } from './lib/router';
import { renderHome } from './pages/home';
import { renderLoading } from './pages/loading';
import { renderLoadError, renderNotFound } from './pages/not-found';
import { homeMeta, notFoundMeta, toolMeta, type PageMeta } from './seo';
import type { ToolDefinition, Unmount } from './tools/types';

const base = import.meta.env.BASE_URL;

/** How long a tool may take to load before a placeholder replaces the previous page. */
const LOADING_DELAY_MS = 120;

function metaFor(route: Route): PageMeta {
  if (route.kind === 'home') return homeMeta();
  if (route.kind === 'tool') return toolMeta(route.tool);
  return notFoundMeta();
}

/** Keep <title> and the description in sync during client-side navigation. */
function applyMeta(meta: PageMeta): void {
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
}

async function renderTool(main: HTMLElement, tool: ToolDefinition): Promise<Unmount | undefined> {
  // Fast loads (prefetched, cached) never show the placeholder; slow ones don't look frozen.
  const loadingTimer = window.setTimeout(() => {
    renderLoading(main, tool.name);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, LOADING_DELAY_MS);

  try {
    const page = await tool.load?.();
    if (page) return page.mount({ container: main });
    renderNotFound(main);
  } catch (error) {
    console.error(`Failed to load ${tool.name}`, error);
    renderLoadError(main, () => location.reload());
  } finally {
    window.clearTimeout(loadingTimer);
  }
  return undefined;
}

/** After a route change, move focus to the page heading so keyboard/screen-reader users land on it. */
function focusHeading(main: HTMLElement): void {
  const heading = main.querySelector<HTMLElement>('h1');
  const target = heading ?? main;
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  announce(`${heading?.textContent?.trim() || siteConfig.shortName}: page loaded.`);
}

function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
      // Offline support is an enhancement; the site works without it.
      console.warn('Service worker registration failed', error);
    });
  });
}

function boot(): void {
  const app = document.getElementById('app');
  if (!app) throw new Error('Missing #app mount point');

  // The footer stays hidden until the first page has rendered, so it never jumps (layout shift).
  app.dataset['ready'] = 'false';
  const main = createElement('main', { id: 'main', class: 'main', tabindex: '-1' });
  app.replaceChildren(
    createElement('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
    siteHeader(),
    main,
    siteFooter(),
  );
  initAnnouncer();

  let firstRender = true;
  startRouter({
    base,
    async render(route) {
      applyMeta(metaFor(route));
      let unmount: Unmount | undefined;
      if (route.kind === 'home') renderHome(main);
      else if (route.kind === 'tool') unmount = await renderTool(main, route.tool);
      else renderNotFound(main);

      if (location.hash) {
        document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView();
      } else if (!firstRender) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      }
      if (!firstRender) focusHeading(main);
      firstRender = false;
      app.dataset['ready'] = 'true';
      return unmount;
    },
  });

  prefetchLiveToolsWhenIdle();
  registerServiceWorker();
}

boot();
