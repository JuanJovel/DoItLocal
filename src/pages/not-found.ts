import { createElement } from '../lib/dom';

function messagePage(title: string, lede: string, action: HTMLElement): HTMLElement {
  return createElement(
    'section',
    { class: 'section' },
    createElement(
      'div',
      { class: 'container container--narrow center' },
      createElement('h1', { class: 'section__title' }, title),
      createElement('p', { class: 'section__lede' }, lede),
      action,
    ),
  );
}

export function renderNotFound(container: HTMLElement): void {
  container.replaceChildren(
    messagePage(
      'Page not found',
      'That page doesn’t exist. Maybe the link is old.',
      createElement(
        'a',
        { class: 'btn btn--primary', href: import.meta.env.BASE_URL },
        'Back to all tools',
      ),
    ),
  );
}

export function renderLoadError(container: HTMLElement, retry: () => void): void {
  container.replaceChildren(
    messagePage(
      "Couldn't load this tool",
      "The tool's code didn't finish loading. Check your connection and try again. Once it has loaded once, it works offline.",
      createElement(
        'button',
        { class: 'btn btn--primary', type: 'button', onclick: retry },
        'Try again',
      ),
    ),
  );
}
