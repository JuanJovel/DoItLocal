import Sortable from 'sortablejs';
import './pdfold.css';

import { pdfoldLogo } from '../../components/logo';
import { toolPage } from '../../components/tool-page';
import { announce } from '../../lib/announce';
import { triggerDownload } from '../../lib/download';
import { createElement } from '../../lib/dom';
import { formatBytes, plural } from '../../lib/format';
import { icon } from '../../lib/icons';
import { runWhenIdle } from '../../lib/prefetch';
import { enableDropAnywhere } from './drop-anywhere';
import { DEFAULT_OUTPUT_NAME, sanitizeOutputName } from './filename';
import { createCard, type Card, type CardAction } from './file-card';
import { createIntake } from './intake';
import type { MergeProgress } from './merge';
import { startMerge, type MergeJob } from './merge-client';
import { MergeError } from './merge-error';
import { inspectPdf, preloadPdfjs, renderThumbnail } from './pdf-reader';
import { describeIntake, mergeHint, queueSummary } from './status-text';
import { PdfStore } from './store';
import { createThumbnailLoader } from './thumbnails';
import type { ProblemCode } from './validate';
import type { ToolContext, Unmount } from '../types';

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface MergeOutcome {
  url: string;
  fileName: string;
  /** Snapshot of the queue the result was built from; any change makes it stale. */
  signature: string;
}

export function mount({ container }: ToolContext): Unmount {
  const store = new PdfStore();
  const intake = createIntake({ store, inspect: inspectPdf });
  const thumbs = createThumbnailLoader(store, renderThumbnail);
  const cards = new Map<string, Card>();
  const cleanups: (() => void)[] = [];

  let job: MergeJob | null = null;
  let outcome: MergeOutcome | null = null;
  let pendingFocus: { id: string; action: CardAction } | null = null;

  // ---------------------------------------------------------------- markup
  const fileInput = createElement('input', {
    type: 'file',
    class: 'visually-hidden',
    accept: 'application/pdf,.pdf',
    multiple: true,
    tabindex: '-1',
    'aria-hidden': 'true',
  });
  const chooseBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg' },
    icon('upload'),
    'Choose PDFs',
  );
  const dropzone = createElement(
    'div',
    { class: 'dropzone', role: 'group', 'aria-labelledby': 'dz-title' },
    createElement('span', { class: 'dropzone__icon' }, icon('upload')),
    createElement(
      'div',
      { class: 'dropzone__text' },
      createElement('p', { id: 'dz-title', class: 'dropzone__title' }, 'Drop PDFs here'),
      createElement(
        'p',
        { class: 'dropzone__hint' },
        'or choose files from your device. They stay on your device and are never uploaded.',
      ),
    ),
    chooseBtn,
    fileInput,
  );

  const summary = createElement('p', { class: 'queue__summary' });
  const clearBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--ghost btn--sm' },
    icon('x'),
    'Clear all',
  );
  const list = createElement('ol', {
    class: 'cards',
    'aria-label': 'PDF files, in the order they will be merged',
  });
  const queue = createElement(
    'section',
    { class: 'queue', 'aria-labelledby': 'queue-title', hidden: true },
    createElement(
      'div',
      { class: 'queue__head' },
      createElement(
        'div',
        null,
        createElement('h2', { id: 'queue-title', class: 'queue__title' }, 'Your files'),
        summary,
      ),
      clearBtn,
    ),
    createElement(
      'p',
      { class: 'queue__hint' },
      'Files merge in this order. Drag cards to reorder, or use the arrow buttons.',
    ),
    list,
  );

  const nameInput = createElement('input', {
    id: 'out-name',
    class: 'input',
    type: 'text',
    value: DEFAULT_OUTPUT_NAME,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'merge-hint',
  });
  const mergeBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg btn--merge' },
    icon('merge'),
    'Merge PDFs',
  );
  const hint = createElement('p', { id: 'merge-hint', class: 'actionbar__hint' });
  const progressLabel = createElement('span', { class: 'progress__label' });
  const progressBar = createElement('progress', {
    class: 'progress__bar',
    max: '1',
    value: '0',
    'aria-label': 'Merge progress',
  });
  const cancelBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--ghost btn--sm' },
    'Cancel',
  );
  const progress = createElement(
    'div',
    { class: 'progress', hidden: true },
    createElement('div', { class: 'progress__row' }, progressLabel, cancelBtn),
    progressBar,
  );
  const resultPanel = createElement('div', { class: 'result', hidden: true });
  const errorPanel = createElement('div', {
    class: 'notice notice--error',
    role: 'alert',
    hidden: true,
  });
  const actionbar = createElement(
    'section',
    { class: 'actionbar', 'aria-label': 'Merge', hidden: true },
    createElement(
      'div',
      { class: 'actionbar__row' },
      createElement(
        'div',
        { class: 'field' },
        createElement('label', { for: 'out-name', class: 'field__label' }, 'Output file name'),
        nameInput,
      ),
      mergeBtn,
    ),
    hint,
    progress,
    errorPanel,
    resultPanel,
  );

  const overlay = createElement(
    'div',
    { class: 'drop-overlay', 'aria-hidden': 'true', hidden: true },
    createElement(
      'div',
      { class: 'drop-overlay__box' },
      icon('upload'),
      createElement('p', null, 'Drop PDFs to add them'),
    ),
  );

  const page = toolPage({
    name: 'PDFold',
    logo: pdfoldLogo(18),
    title: [
      'Merge PDFs. ',
      createElement('span', { class: 'hero__accent' }, 'Free. Private.'),
      ' Nothing leaves your device.',
    ],
    lede: 'Combine PDFs in any order, in seconds, without uploading a thing.',
    workspace: createElement('div', { class: 'container' }, dropzone, queue, actionbar),
    workspaceLabel: 'PDF merger',
  });
  page.append(overlay);
  container.replaceChildren(page);

  // ------------------------------------------------------------- rendering
  const signature = (): string =>
    store.ready.map((item) => `${item.id}:${item.rotation}`).join('|');

  function isMerging(): boolean {
    return job !== null;
  }

  function render(): void {
    const items = store.items;
    const ready = store.ready;
    const checking = items.some((item) => item.status === 'checking');
    const empty = items.length === 0;
    page.dataset['state'] = empty ? 'empty' : 'filled';
    queue.hidden = empty;
    actionbar.hidden = empty;

    // Remove cards for items that are gone.
    const live = new Set(items.map((item) => item.id));
    for (const [id, card] of cards) {
      if (!live.has(id)) {
        thumbs.unobserve(card.el);
        card.el.remove();
        cards.delete(id);
      }
    }

    // Create/update cards and make the DOM order match the store order.
    const readyPositions = new Map(ready.map((item, index) => [item.id, index + 1]));
    items.forEach((item, i) => {
      let card = cards.get(item.id);
      if (!card) {
        card = createCard(item.id);
        cards.set(item.id, card);
        thumbs.observe(card.el);
      }
      card.update(item, readyPositions.get(item.id) ?? null, ready.length);
      if (list.children[i] !== card.el) list.insertBefore(card.el, list.children[i] ?? null);
    });

    // Summary line and merge button.
    const totals = store.totals;
    const state = {
      ...totals,
      problems: items.filter((item) => item.status === 'error').length,
      checking,
    };
    summary.textContent = queueSummary(state);
    mergeBtn.disabled = !(ready.length >= 2 && !checking && !isMerging());
    hint.textContent = mergeHint({ ...state, merging: isMerging() });

    // A finished result goes stale when the queue changes.
    if (outcome && outcome.signature !== signature()) discardOutcome();

    // Restore focus lost when a focused button's card was moved in the DOM.
    if (pendingFocus) {
      const { id, action } = pendingFocus;
      pendingFocus = null;
      cards.get(id)?.el.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus();
    }

    sortable.option('disabled', isMerging());
    thumbs.kick();
  }

  // ----------------------------------------------------------- user actions
  async function addFiles(files: File[]): Promise<void> {
    if (files.length === 0 || isMerging()) return;
    announce(`Adding ${plural(files.length, 'file')}…`);
    const result = await intake.addFiles(files);
    announce(describeIntake(result));
  }

  list.addEventListener('click', (event) => {
    if (isMerging()) return;
    const button = (event.target as Element).closest<HTMLElement>('[data-action]');
    const id = button?.closest<HTMLElement>('.card')?.dataset['id'];
    const action = button?.dataset['action'] as CardAction | undefined;
    const item = id ? store.get(id) : undefined;
    if (!button || !id || !action || !item) return;

    if (action === 'remove') {
      // Move focus somewhere sensible before the focused button disappears.
      const index = store.indexOf(id);
      const neighbor = store.items[index + 1] ?? store.items[index - 1];
      store.remove(id);
      const next = neighbor
        ? cards.get(neighbor.id)?.el.querySelector<HTMLElement>('[data-action="remove"]')
        : null;
      (next ?? chooseBtn).focus();
      announce(`Removed ${item.name}. ${plural(store.items.length, 'file')} left.`);
    } else if (action === 'rotate') {
      const rotation = store.rotate(id);
      announce(`${item.name} rotated to ${rotation} degrees.`);
    } else {
      if (button.getAttribute('aria-disabled') === 'true') return;
      pendingFocus = { id, action };
      const newPosition = store.moveBy(id, action === 'earlier' ? -1 : 1);
      if (newPosition !== undefined) {
        announce(`${item.name} moved to position ${newPosition} of ${store.ready.length}.`);
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    if (isMerging()) return;
    store.clear();
    nameInput.value = DEFAULT_OUTPUT_NAME;
    announce('All files cleared.');
    chooseBtn.focus();
  });

  chooseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = ''; // allow re-selecting the same file later
    void addFiles(files);
  });

  // --- drag to reorder (SortableJS: pointer + touch + native DnD, with animation)
  const sortable = Sortable.create(list, {
    animation: prefersReducedMotion() ? 0 : 180,
    easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    ghostClass: 'card--ghost',
    chosenClass: 'card--chosen',
    dragClass: 'card--drag',
    filter: '.card__actions',
    preventOnFilter: false,
    // Touch: a short press starts a drag so normal swipes still scroll the page.
    delay: 160,
    delayOnTouchOnly: true,
    touchStartThreshold: 6,
    onEnd: (event) => {
      const ids = Array.from(list.children).map((el) => (el as HTMLElement).dataset['id'] ?? '');
      store.setOrder(ids);
      const id = (event.item as HTMLElement).dataset['id'] ?? '';
      const item = store.get(id);
      const position = store.readyPosition(id);
      const didMove = event.oldIndex !== event.newIndex;
      if (item && position !== undefined && didMove) {
        announce(`${item.name} moved to position ${position} of ${store.ready.length}.`);
      }
    },
  });
  cleanups.push(() => sortable.destroy());

  // --- drop files anywhere on the page
  cleanups.push(
    enableDropAnywhere({
      isDisabled: isMerging,
      onActiveChange: (active) => {
        overlay.hidden = !active;
        dropzone.classList.toggle('is-over', active);
      },
      onFiles: (files) => void addFiles(files),
    }),
  );

  // ------------------------------------------------------------------ merge
  function setMerging(on: boolean): void {
    queue.toggleAttribute('inert', on);
    dropzone.toggleAttribute('inert', on);
    nameInput.disabled = on;
    progress.hidden = !on;
    if (on) {
      errorPanel.hidden = true;
      discardOutcome();
    }
  }

  function showProgress(p: MergeProgress): void {
    progressBar.value = p.fraction;
    progressLabel.textContent =
      p.stage === 'saving'
        ? 'Saving the merged PDF…'
        : `Merging file ${p.index + 1} of ${p.total}: ${p.name}`;
  }

  function discardOutcome(): void {
    if (outcome) URL.revokeObjectURL(outcome.url);
    outcome = null;
    resultPanel.hidden = true;
    resultPanel.replaceChildren();
  }

  function showError(message: string): void {
    errorPanel.replaceChildren(icon('alert'), createElement('p', null, message));
    errorPanel.hidden = false;
  }

  async function runMerge(): Promise<void> {
    if (isMerging() || mergeBtn.disabled) return;
    const fileName = sanitizeOutputName(nameInput.value);
    nameInput.value = fileName;

    const inputs = store.ready;
    const snapshot = signature();
    progressBar.value = 0;
    progressLabel.textContent = 'Starting…';
    job = startMerge(
      inputs.map((item) => ({ file: item.file, name: item.name, rotation: item.rotation })),
      showProgress,
    );
    setMerging(true);
    render();
    announce(`Merging ${plural(inputs.length, 'PDF')}. Please wait.`);

    try {
      const result = await job.result;
      const blob = new Blob([result.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      outcome = { url, fileName, signature: snapshot };
      triggerDownload(url, fileName);
      resultPanel.replaceChildren(
        createElement('span', { class: 'result__icon' }, icon('check')),
        createElement(
          'div',
          { class: 'result__text' },
          createElement('strong', null, `${fileName} is ready`),
          createElement(
            'span',
            null,
            `${plural(result.pageCount, 'page')} · ${formatBytes(blob.size)}. Your download should have started.`,
          ),
        ),
        createElement(
          'a',
          { class: 'btn btn--ghost btn--sm', href: url, download: fileName },
          icon('download'),
          'Download again',
        ),
      );
      resultPanel.hidden = false;
      announce(
        `Merged ${plural(inputs.length, 'PDF')} into ${fileName}: ${plural(result.pageCount, 'page')}, ${formatBytes(blob.size)}. Download started.`,
      );
    } catch (error) {
      handleMergeError(
        error,
        inputs.map((item) => item.id),
      );
    } finally {
      job = null;
      setMerging(false);
      render();
      // The button was disabled while merging, which drops keyboard focus: put it back.
      if (document.activeElement === document.body) mergeBtn.focus();
    }
  }

  function handleMergeError(error: unknown, ids: string[]): void {
    if (!(error instanceof MergeError)) {
      showError('Something went wrong while merging.');
      announce('Something went wrong while merging.');
      return;
    }
    if (error.code === 'cancelled') {
      announce('Merge cancelled.');
      return;
    }

    const { failedFile, message } = error;
    const badId = failedFile && ids[failedFile.index];
    if (!badId) {
      showError(message);
      announce(message);
      return;
    }
    // Flag just the offending file; the rest of the queue stays intact.
    store.update(badId, { status: 'error', problem: { code: toProblemCode(error.code), message } });
    showError(
      `Couldn’t merge “${failedFile.name}”: ${message} It has been marked in your list; remove it and try again.`,
    );
    announce(`Merge stopped. ${failedFile.name}: ${message}`);
  }

  /** Merge errors that describe a file problem keep their code; anything else reads as damaged. */
  function toProblemCode(code: MergeError['code']): ProblemCode {
    return code === 'password' || code === 'unreadable' || code === 'empty' ? code : 'corrupt';
  }

  mergeBtn.addEventListener('click', () => void runMerge());
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void runMerge();
  });
  nameInput.addEventListener('blur', () => {
    nameInput.value = sanitizeOutputName(nameInput.value);
  });
  cancelBtn.addEventListener('click', () => job?.cancel());

  // ------------------------------------------------------------------ boot
  const unsubscribe = store.subscribe(render);
  render();
  runWhenIdle(preloadPdfjs);

  return () => {
    unsubscribe();
    job?.cancel();
    discardOutcome();
    thumbs.dispose();
    store.clear(); // revokes thumbnail object URLs
    for (const cleanup of cleanups) cleanup();
  };
}
