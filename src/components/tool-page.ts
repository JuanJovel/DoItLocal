import { siteConfig } from '../config';
import { createElement, type ElementChild } from '../lib/dom';
import { doItLocalLogo } from './logo';
import { faqSection, privacyDetails } from './faq';
import { trustBar } from './trust-bar';

export interface ToolPageOptions {
  name: string;
  logo: SVGSVGElement;
  /** Contents of the page's <h1>. */
  title: ElementChild[];
  lede: string;
  /** The tool itself, placed in a labelled section under the hero. */
  workspace: HTMLElement;
  workspaceLabel: string;
}

/** The layout every tool page shares: breadcrumb hero, the tool, then the privacy promise and FAQ. */
export function toolPage({
  name,
  logo,
  title,
  lede,
  workspace,
  workspaceLabel,
}: ToolPageOptions): HTMLElement {
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
          createElement('span', { class: 'crumb__here' }, logo, name),
        ),
        createElement('h1', { class: 'tool-hero__title' }, ...title),
        createElement(
          'p',
          { class: 'tool-hero__lede' },
          `${name}, a ${siteConfig.shortName} tool.`,
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
    createElement(
      'section',
      { class: 'section section--tight' },
      createElement('div', { class: 'container container--narrow' }, privacyDetails()),
    ),
    faqSection(),
  );
}
