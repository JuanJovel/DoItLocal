/** Polite screen-reader announcements through a single shared live region. */
let region: HTMLElement | null = null;
let timer: number | undefined;

export function initAnnouncer(): void {
  region = document.createElement('div');
  region.className = 'visually-hidden';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
}

export function announce(message: string): void {
  if (!region) return;
  // Clear first so repeating the same message is announced again.
  region.textContent = '';
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (region) region.textContent = message;
  }, 50);
}
