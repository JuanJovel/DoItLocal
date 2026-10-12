import { faqItems, privacyPoints, type FaqItem } from '../content';
import { createElement } from '../lib/dom';
import { icon } from '../lib/icons';

function disclosure(summary: string, body: Node[], className = ''): HTMLDetailsElement {
  return createElement(
    'details',
    { class: `disclosure ${className}`.trim() },
    createElement(
      'summary',
      null,
      createElement('span', null, summary),
      icon('chevron', 'icon disclosure__chevron'),
    ),
    createElement('div', { class: 'disclosure__body' }, ...body),
  );
}

export function privacyDetails(): HTMLElement {
  return disclosure(
    'How is this private?',
    [
      createElement(
        'ol',
        { class: 'steps' },
        ...privacyPoints.map((point) =>
          createElement(
            'li',
            null,
            createElement('strong', null, point.title),
            createElement('p', null, point.body),
          ),
        ),
      ),
    ],
    'disclosure--featured',
  );
}

export function faqSection(items: readonly FaqItem[] = faqItems): HTMLElement {
  return createElement(
    'section',
    { class: 'section', id: 'faq', 'aria-labelledby': 'faq-title' },
    createElement(
      'div',
      { class: 'container container--narrow' },
      createElement(
        'h2',
        { id: 'faq-title', class: 'section__title' },
        'Frequently asked questions',
      ),
      createElement(
        'div',
        { class: 'faq' },
        ...items.map((item) =>
          disclosure(
            item.question,
            item.answer.split('\n\n').map((paragraph) => createElement('p', null, paragraph)),
          ),
        ),
      ),
    ),
  );
}
