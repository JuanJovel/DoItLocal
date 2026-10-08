import { createElement } from '../lib/dom';
import { icon } from '../lib/icons';
import { prefetchTool } from '../lib/prefetch';
import { toolHref } from '../lib/router';
import type { ToolDefinition } from '../tools/types';

export function toolCard(tool: ToolDefinition): HTMLElement {
  const soon = tool.status === 'soon';
  const content = [
    createElement('span', { class: 'tool-card__icon' }, icon(tool.icon)),
    createElement(
      'span',
      { class: 'tool-card__body' },
      createElement('span', { class: 'tool-card__name' }, tool.name),
      createElement('span', { class: 'tool-card__desc' }, soon ? tool.tagline : tool.description),
    ),
  ];

  if (soon) {
    return createElement(
      'li',
      { class: 'tool-card is-soon' },
      ...content,
      createElement('span', { class: 'badge' }, 'Coming soon'),
    );
  }
  return createElement(
    'li',
    { class: 'tool-card is-live' },
    createElement(
      'a',
      {
        class: 'tool-card__link',
        href: toolHref(tool),
        // Start fetching the tool's code on intent, so the click feels instant.
        onpointerenter: () => prefetchTool(tool),
        onfocus: () => prefetchTool(tool),
        ontouchstart: () => prefetchTool(tool),
      },
      ...content,
      createElement('span', { class: 'badge badge--live' }, 'Free · Private'),
      createElement('span', { class: 'tool-card__cta' }, 'Open', icon('arrow-right')),
    ),
  );
}
