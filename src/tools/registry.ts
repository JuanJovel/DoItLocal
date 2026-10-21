import { ezqr } from './ezqr';
import { pdfold } from './pdfold';
import { picfold } from './picfold';
import { snapPages } from './snappages';
import type { ToolDefinition } from './types';

/**
 * Every tool on the site. To add one: create `src/tools/<name>/`, export a
 * `ToolDefinition` from its `index.ts`, and add it to this list.
 */
export const tools: readonly ToolDefinition[] = [pdfold, picfold, snapPages, ezqr];

/** Tools that have a working page. */
export function liveTools(list: readonly ToolDefinition[] = tools): ToolDefinition[] {
  return list.filter((t) => t.status === 'live');
}

export function findToolBySlug(
  slug: string,
  list: readonly ToolDefinition[] = tools,
): ToolDefinition | undefined {
  return liveTools(list).find((t) => t.slug === slug);
}
