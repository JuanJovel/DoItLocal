import { siteConfig } from '../config';
import { createElement, externalLink } from '../lib/dom';
import { icon } from '../lib/icons';
import { doItLocalLogo } from './logo';

export function siteFooter(): HTMLElement {
  return createElement(
    'footer',
    { class: 'site-footer' },
    createElement(
      'div',
      { class: 'container site-footer__inner' },
      createElement(
        'div',
        { class: 'site-footer__about' },
        createElement(
          'div',
          { class: 'brand' },
          doItLocalLogo(26),
          createElement('span', { class: 'brand__name' }, siteConfig.name),
        ),
        createElement('p', { class: 'muted' }, siteConfig.tagline),
        createElement(
          'p',
          { class: 'muted small' },
          'No ads. No cookies. No analytics. No accounts.',
        ),
      ),
      createElement(
        'nav',
        { class: 'site-footer__links', 'aria-label': 'Footer' },
        createElement(
          'a',
          { href: siteConfig.githubUrl, ...externalLink },
          icon('github'),
          'GitHub',
          createElement('span', { class: 'visually-hidden' }, ' (opens in a new tab)'),
        ),
        createElement(
          'a',
          { href: `${siteConfig.githubUrl}/blob/main/LICENSE`, ...externalLink },
          `${siteConfig.license} license`,
        ),
        createElement(
          'a',
          {
            href: `${siteConfig.githubUrl}/blob/main/THIRD_PARTY_NOTICES.md`,
            ...externalLink,
          },
          'Third-party notices',
        ),
      ),
    ),
    createElement(
      'div',
      { class: 'container site-footer__legal muted small' },
      'Made with ',
      createElement('span', { role: 'img', 'aria-label': 'love' }, '❤️'),
      ` by JJ. Released under the ${siteConfig.license} License`,
    ),
  );
}
