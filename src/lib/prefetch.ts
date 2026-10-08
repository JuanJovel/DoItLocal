import { liveTools } from '../tools/registry';
import type { ToolDefinition } from '../tools/types';

/** Start downloading a tool's code early. Failures are ignored; navigation will retry. */
export function prefetchTool(tool: ToolDefinition): void {
  tool.load?.().catch(() => undefined);
}

/** Run `task` when the browser is idle (or soon after, where `requestIdleCallback` is missing). */
export function runWhenIdle(task: () => void): void {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: 2000 });
  } else window.setTimeout(task, 300);
}

/** After the first page is up, quietly fetch every live tool. They are small and cached. */
export function prefetchLiveToolsWhenIdle(): void {
  runWhenIdle(() => liveTools().forEach(prefetchTool));
}
