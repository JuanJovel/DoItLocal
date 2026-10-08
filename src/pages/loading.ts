import { createElement } from '../lib/dom';

/**
 * Placeholder shown while a tool's code is still downloading
 */
export function renderLoading(container: HTMLElement, name: string): void {
  container.replaceChildren(
    createElement(
      'section',
      { class: 'page-loading', 'aria-busy': 'true' },
      createElement(
        'div',
        { class: 'container' },
        createElement('h1', { class: 'page-loading__title' }, name),
        createElement('p', { class: 'page-loading__text', role: 'status' }, 'Loading…'),
        createElement('div', { class: 'page-loading__block', 'aria-hidden': 'true' }),
      ),
    ),
  );
}
