/**
 * Tiny element builder:
 *
 *   createElement('button', { class: 'btn', onclick: save }, 'Save')
 *
 * Attributes: `null`, `undefined` and `false` are skipped so conditions can be written inline,
 * `true` sets a boolean attribute, and a function is an event listener (its name must start with
 * "on"). Children can be nodes, strings or numbers; empty values are skipped.
 */

export type ElementChild = Node | string | number | null | undefined | false;
export type ElementAttributeValue = string | number | boolean | EventListener | null | undefined;
export type ElementAttributes = Record<string, ElementAttributeValue>;

export function createElement<TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  attributes?: ElementAttributes | null,
  ...children: ElementChild[]
): HTMLElementTagNameMap[TagName] {
  const element = document.createElement(tagName);

  for (const [name, value] of Object.entries(attributes ?? {})) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === 'function') {
      if (!name.startsWith('on')) throw new TypeError(`Listener "${name}" must start with "on".`);
      element.addEventListener(name.slice(2).toLowerCase(), value);
    } else {
      element.setAttribute(name, value === true ? '' : String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(typeof child === 'number' ? String(child) : child);
  }
  return element;
}

/** Parse trusted SVG markup (never user input) into an element. */
export function parseSvg(markup: string): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content.firstElementChild as SVGSVGElement;
}

/** Attributes for a link that opens another site in a new tab. */
export const externalLink = { target: '_blank', rel: 'noopener noreferrer' } as const;
