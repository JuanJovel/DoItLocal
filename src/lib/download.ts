import { createElement } from './dom';

/** Start a browser download for an object URL (or any URL) with the given file name. */
export function triggerDownload(url: string, fileName: string): void {
  const link = createElement('a', { href: url, download: fileName, class: 'visually-hidden' });
  document.body.append(link);
  link.click();
  link.remove();
}

/** Download an in-memory blob, then release its object URL once the browser has started. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
