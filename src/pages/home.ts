import { siteConfig } from '../config';
import { faqSection, privacyDetails } from '../components/faq';
import { toolCard } from '../components/tool-card';
import { trustBar } from '../components/trust-bar';
import { createElement } from '../lib/dom';
import { icon } from '../lib/icons';
import { toolHref } from '../lib/router';
import { liveTools, tools } from '../tools/registry';

export function renderHome(container: HTMLElement): void {
  const live = liveTools();
  const featured = live[Math.floor(Math.random() * live.length)];

  const hero = createElement(
    'section',
    { class: 'hero', 'aria-labelledby': 'hero-title' },
    createElement(
      'div',
      { class: 'container hero__inner' },
      createElement(
        'h1',
        { id: 'hero-title', class: 'hero__title' },
        'Free tools.',
        createElement('br'),
        'Private by design.',
        createElement('br'),
        createElement('span', { class: 'hero__accent' }, 'Nothing leaves your device.'),
      ),
      createElement(
        'p',
        { class: 'hero__lede' },
        'Handy tools that normally cost money or ask you to sign up, rebuilt to run entirely in your browser. Your files never touch a server.',
      ),
      featured
        ? createElement(
            'p',
            { class: 'hero__cta' },
            createElement(
              'a',
              { class: 'btn btn--primary btn--lg', href: toolHref(featured) },
              `Try ${featured.name}`,
              icon('arrow-right'),
            ),
            createElement(
              'a',
              { class: 'btn btn--ghost btn--lg', href: '#tools' },
              'See all tools',
            ),
          )
        : null,
      trustBar(),
    ),
  );

  const toolsSection = createElement(
    'section',
    { class: 'section', id: 'tools', 'aria-labelledby': 'tools-title' },
    createElement(
      'div',
      { class: 'container' },
      createElement('h2', { id: 'tools-title', class: 'section__title' }, 'Tools'),
      createElement(
        'p',
        { class: 'section__lede' },
        `More are on the way. Every ${siteConfig.shortName} tool follows the same promise.`,
      ),
      createElement('ul', { class: 'tool-grid', role: 'list' }, ...tools.map(toolCard)),
    ),
  );

  const privacy = createElement(
    'section',
    { class: 'section section--tight', 'aria-label': 'Privacy' },
    createElement('div', { class: 'container container--narrow' }, privacyDetails()),
  );

  container.replaceChildren(hero, toolsSection, privacy, faqSection());
}
