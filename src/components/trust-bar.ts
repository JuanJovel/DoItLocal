import { trustItems } from '../content';
import { createElement, externalLink } from '../lib/dom';
import { icon } from '../lib/icons';

export function trustBar(): HTMLElement {
  return createElement(
    'ul',
    { class: 'trust-bar', role: 'list', 'aria-label': 'Our promises' },
    ...trustItems.map((item) =>
      createElement(
        'li',
        { class: 'trust-bar__item' },
        createElement('span', { class: 'trust-bar__icon' }, icon(item.icon)),
        createElement(
          'span',
          { class: 'trust-bar__text' },
          createElement('strong', null, item.lead),
          item.href
            ? createElement('a', { href: item.href, ...externalLink }, item.rest)
            : item.rest,
        ),
      ),
    ),
  );
}
