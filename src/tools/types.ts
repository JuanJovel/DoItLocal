import type { FaqItem } from '../content';
import type { IconName } from '../lib/icons';

/**
 * Contract every tool implements.
 *
 * A tool is a folder under `src/tools/<tool-name>/` that exports a
 * `ToolDefinition` (see `pdfold/index.ts`) and is listed once in `registry.ts`.
 * Nothing else needs to change: the home page grid, routing, SEO tags,
 * sitemap and offline cache are all derived from the registry.
 */

/** What the router hands to a tool when it mounts. */
export interface ToolContext {
  /** Element the tool renders into. */
  container: HTMLElement;
}

/** Returned by a tool's `mount()`; called when the user navigates away. */
export type Unmount = () => void;

/** A tool's lazily loaded page module. */
export interface ToolPageModule {
  mount(ctx: ToolContext): Unmount | undefined;
}

export interface ToolDefinition {
  /** Unique, stable identifier. Matches the folder name. */
  id: string;
  /** URL path segment: the tool is served at `/<slug>/`. Lowercase letters, digits, hyphens. */
  slug: string;
  /** Display name, e.g. "PDFold". */
  name: string;
  /** Short marketing line shown under the name. */
  tagline: string;
  /**
   * <title> for the tool's page; defaults to "<name> | <site short name>". Lead with what people
   * search for ("Merge PDF Files"), not the brand: search results weight the start of the title.
   */
  seoTitle?: string;
  /** One-paragraph description used on the home page card and in SEO meta tags. */
  description: string;
  /** Step-by-step instructions shown on the tool's page, e.g. "How to merge PDF files". */
  guide?: { title: string; steps: string[] };
  /** Questions specific to this tool, shown above the site-wide FAQ. */
  faq?: FaqItem[];
  icon: IconName;
  /** `soon` tools render a disabled "Coming soon" card and have no page. */
  status: 'live' | 'soon';
  /** Lazily imports the tool's page module. Required when `status === 'live'`. */
  load?: () => Promise<ToolPageModule>;
}
