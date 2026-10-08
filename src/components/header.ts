import { siteConfig } from '../config';
import { createElement, externalLink } from '../lib/dom';
import { icon } from '../lib/icons';
import { doItLocalLogo } from './logo';

const base = import.meta.env.BASE_URL;

export function siteHeader(): HTMLElement {
  return createElement(
    'header',
    { class: 'site-header' },
    createElement(
      'div',
      { class: 'container site-header__inner' },
      createElement(
        'a',
        { class: 'brand', href: base, 'aria-label': `${siteConfig.shortName} home` },
        doItLocalLogo(30),
        createElement('span', { class: 'brand__name' }, siteConfig.shortName),
      ),
      createElement(
        'nav',
        { class: 'site-nav', 'aria-label': 'Main' },
        createElement('a', { class: 'site-nav__link', href: `${base}#tools` }, 'Tools'),
        createElement('a', { class: 'site-nav__link', href: `${base}#faq` }, 'FAQ'),
        createElement(
          'a',
          {
            class: 'icon-btn',
            href: siteConfig.githubUrl,
            ...externalLink,
            'aria-label': 'View source on GitHub (opens in a new tab)',
            title: 'View source on GitHub',
          },
          icon('github'),
        ),
      ),
    ),
  );
}
