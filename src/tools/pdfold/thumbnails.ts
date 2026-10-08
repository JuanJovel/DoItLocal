import { serialRunner } from '../../lib/serial';
import type { PdfStore } from './store';

/**
 * Renders first-page thumbnails lazily: only for cards that are on (or near) the screen,
 * one at a time, so adding a hundred files does not stall the page.
 */
export function createThumbnailLoader(
  store: PdfStore,
  render: (file: File) => Promise<Blob | null>,
) {
  const runInOrder = serialRunner();
  const visible = new Set<string>();

  const observer =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const id = (entry.target as HTMLElement).dataset['id'];
              if (!id) continue;
              if (entry.isIntersecting) visible.add(id);
              else visible.delete(id);
            }
            kick();
          },
          { rootMargin: '300px' },
        );

  /** Start rendering for every visible card that is ready but has no thumbnail yet. */
  function kick(): void {
    for (const item of store.items) {
      // Without IntersectionObserver support, treat everything as visible.
      const isVisible = observer ? visible.has(item.id) : true;
      if (!isVisible || item.status !== 'ready' || item.thumbState !== 'idle') continue;

      store.update(item.id, { thumbState: 'loading' });
      void runInOrder(() => render(item.file)).then((blob) => {
        // The file may have been removed while rendering: don't leak the object URL.
        if (!store.get(item.id)) return;
        if (blob) {
          store.update(item.id, { thumbState: 'done', thumbUrl: URL.createObjectURL(blob) });
        } else store.update(item.id, { thumbState: 'failed' });
      });
    }
  }

  return {
    observe(el: HTMLElement): void {
      observer?.observe(el);
    },
    unobserve(el: HTMLElement): void {
      observer?.unobserve(el);
      const id = el.dataset['id'];
      if (id) visible.delete(id);
    },
    kick,
    dispose(): void {
      observer?.disconnect();
      visible.clear();
    },
  };
}
