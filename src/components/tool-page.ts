import { siteConfig } from '../config';
import { faqItems } from '../content';
import { createElement, type ElementChild } from '../lib/dom';
import { liveTools } from '../tools/registry';
import type { ToolDefinition } from '../tools/types';
import { faqSection, privacyDetails } from './faq';
import { doItLocalLogo } from './logo';
import { toolCard } from './tool-card';
import { trustBar } from './trust-bar';

export interface ToolPageOptions {
  tool: ToolDefinition;
  logo: SVGSVGElement;
  /** Contents of the page's <h1>. */
  title: ElementChild[];
  lede: string;
  /** The tool itself, placed in a labelled section under the hero. */
  workspace: HTMLElement;
  workspaceLabel: string;
}

/**
 * The layout every tool page shares: breadcrumb hero, the tool, then how to use it, the privacy
 * promise, the FAQ and links to the other tools. The text below the tool is what search engines
 * match against, so it is kept specific to the tool.
 */
export function toolPage({
  tool,
  logo,
  title,
  lede,
  workspace,
  workspaceLabel,
}: ToolPageOptions): HTMLElement {
  const otherTools = liveTools().filter((other) => other.id !== tool.id);

  return createElement(
    'div',
    { class: 'tool-page' },
    createElement(
      'section',
      { class: 'tool-hero' },
      createElement(
        'div',
        { class: 'container' },
        createElement(
          'a',
          { class: 'crumb', href: import.meta.env.BASE_URL },
          doItLocalLogo(18),
          siteConfig.shortName,
          createElement('span', { class: 'crumb__sep', 'aria-hidden': 'true' }, '/'),
          createElement('span', { class: 'crumb__here' }, logo, tool.name),
        ),
        createElement('h1', { class: 'tool-hero__title' }, ...title),
        createElement(
          'p',
          { class: 'tool-hero__lede' },
          `${tool.name}, a ${siteConfig.shortName} tool.`,
          createElement('br'),
          lede,
        ),
      ),
    ),
    createElement('section', { class: 'workspace', 'aria-label': workspaceLabel }, workspace),
    createElement(
      'section',
      { class: 'section section--tight' },
      createElement('div', { class: 'container' }, trustBar()),
    ),
    tool.guide &&
      createElement(
        'section',
        { class: 'section section--tight', 'aria-labelledby': 'guide-title' },
        createElement(
          'div',
          { class: 'container container--narrow' },
          createElement('h2', { id: 'guide-title', class: 'section__title' }, tool.guide.title),
          createElement(
            'ol',
            { class: 'steps' },
            ...tool.guide.steps.map((step) => createElement('li', null, step)),
          ),
        ),
      ),
    createElement(
      'section',
      { class: 'section section--tight' },
      createElement('div', { class: 'container container--narrow' }, privacyDetails()),
    ),
    faqSection([...(tool.faq ?? []), ...faqItems]),
    otherTools.length > 0 &&
      createElement(
        'section',
        { class: 'section section--tight', 'aria-labelledby': 'more-tools-title' },
        createElement(
          'div',
          { class: 'container' },
          createElement(
            'h2',
            { id: 'more-tools-title', class: 'section__title' },
            'More free tools',
          ),
          createElement('ul', { class: 'tool-grid', role: 'list' }, ...otherTools.map(toolCard)),
        ),
      ),
  );
}
