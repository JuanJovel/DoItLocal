import Sortable from 'sortablejs';
import './file-queue.css';

import { toolPage, type ToolPageOptions } from '../components/tool-page';
import { announce } from '../lib/announce';
import { triggerDownload } from '../lib/download';
import { createElement } from '../lib/dom';
import { formatBytes, plural } from '../lib/format';
import { icon, type IconName } from '../lib/icons';
import { runWhenIdle } from '../lib/prefetch';
import type { Unmount } from '../tools/types';
import { enableDropAnywhere } from './drop-anywhere';
import { createCard, type Card, type CardAction } from './file-card';
import { sanitizeOutputName } from './filename';
import { createIntake, describeIntake, type Inspection } from './intake';
import { JobError, type Job, type JobProgress } from './job';
import { actionHint, queueSummary } from './status-text';
import { FileQueue, type QueueItem } from './store';
import { createThumbnailLoader } from './thumbnails';

/**
 * The page shared by tools that turn a queue of files into one PDF: pick or drop files, check
 * them one by one, reorder and rotate them, then build the PDF in a worker and download it.
 */
export interface FileQueueConfig<Info> {
  page: Omit<ToolPageOptions, 'workspace'>;
  /** `accept` attribute of the file picker. */
  accept: string;
  /** What the files are, singular: "PDF", "image". */
  noun: string;
  /** What the action does, in the forms the copy needs. */
  verb: { base: string; ing: string; past: string };
  action: { label: string; icon: IconName };
  /** Accessible name of the card list, e.g. "PDF files, in the order they will be merged". */
  listLabel: string;
  queueHint: string;
  /** Fewest ready files the action needs. */
  minFiles: number;
  defaultFileName: string;
  /** Checks one added file. Called for one file at a time. */
  inspect: (file: File) => Promise<Inspection<Info>>;
  renderThumbnail: (file: File) => Promise<Blob | null>;
  /** Pages a ready file adds to the output. */
  pageCount: (info: Info) => number;
  /** Detail line on a ready file's card, e.g. "3 pages · 1.2 MB". */
  describe: (info: Info, item: QueueItem<Info>) => string;
  /** Starts building the PDF from the ready files, in order. */
  start: (items: QueueItem<Info>[], onProgress: (progress: JobProgress) => void) => Job;
  /** Extra settings shown next to the file name. Changing one discards a finished result. */
  options?: HTMLElement;
  /** Warm-up work to do once the page is idle, such as loading a library. */
  preload?: () => void;
}

interface Outcome {
  url: string;
  /** Snapshot of the queue the result was built from; any change makes it stale. */
  signature: string;
}

const prefersReducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mountFileQueue<Info>(
  container: HTMLElement,
  config: FileQueueConfig<Info>,
): Unmount {
  const { noun, verb } = config;
  const queue = new FileQueue<Info>();
  const intake = createIntake(queue, config.inspect);
  const thumbs = createThumbnailLoader(queue, config.renderThumbnail);
  const cards = new Map<string, Card>();
  const cleanups: (() => void)[] = [];

  let job: Job | null = null;
  let outcome: Outcome | null = null;
  let pendingFocus: { id: string; action: CardAction } | null = null;

  // ---------------------------------------------------------------- markup
  const fileInput = createElement('input', {
    type: 'file',
    class: 'visually-hidden',
    accept: config.accept,
    multiple: true,
    tabindex: '-1',
    'aria-hidden': 'true',
  });
  const chooseBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg' },
    icon('upload'),
    `Choose ${noun}s`,
  );
  const dropzone = createElement(
    'div',
    { class: 'dropzone', role: 'group', 'aria-labelledby': 'dz-title' },
    createElement('span', { class: 'dropzone__icon' }, icon('upload')),
    createElement(
      'div',
      { class: 'dropzone__text' },
      createElement('p', { id: 'dz-title', class: 'dropzone__title' }, `Drop ${noun}s here`),
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
  const list = createElement('ol', { class: 'cards', 'aria-label': config.listLabel });
  const queueSection = createElement(
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
    createElement('p', { class: 'queue__hint' }, config.queueHint),
    list,
  );

  const nameInput = createElement('input', {
    id: 'out-name',
    class: 'input',
    type: 'text',
    value: config.defaultFileName,
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': 'action-hint',
  });
  const actionBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg actionbar__button' },
    icon(config.action.icon),
    config.action.label,
  );
  const hint = createElement('p', { id: 'action-hint', class: 'actionbar__hint' });
  const progressLabel = createElement('span', { class: 'progress__label' });
  const progressBar = createElement('progress', {
    class: 'progress__bar',
    max: '1',
    value: '0',
    'aria-label': 'Progress',
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
  const settings = createElement(
    'div',
    { class: 'actionbar__fields' },
    createElement(
      'div',
      { class: 'field' },
      createElement('label', { for: 'out-name', class: 'field__label' }, 'Output file name'),
      nameInput,
    ),
    config.options,
  );
  const actionbar = createElement(
    'section',
    { class: 'actionbar', 'aria-label': config.action.label, hidden: true },
    createElement('div', { class: 'actionbar__row' }, settings, actionBtn),
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
      createElement('p', null, `Drop ${noun}s to add them`),
    ),
  );

  const page = toolPage({
    ...config.page,
    workspace: createElement('div', { class: 'container' }, dropzone, queueSection, actionbar),
  });
  page.append(overlay);
  container.replaceChildren(page);

  // ------------------------------------------------------------- rendering
  const signature = (): string =>
    queue.ready.map((item) => `${item.id}:${item.rotation}`).join('|');

  function isBusy(): boolean {
    return job !== null;
  }

  function detailFor(item: QueueItem<Info>): string {
    if (item.status === 'checking') return `Reading… · ${formatBytes(item.size)}`;
    return item.info ? config.describe(item.info, item) : '';
  }

  function render(): void {
    const items = queue.items;
    const ready = queue.ready;
    const empty = items.length === 0;
    page.dataset['state'] = empty ? 'empty' : 'filled';
    queueSection.hidden = empty;
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

    // Create/update cards and make the DOM order match the queue order.
    const readyPositions = new Map(ready.map((item, index) => [item.id, index + 1]));
    items.forEach((item, i) => {
      let card = cards.get(item.id);
      if (!card) {
        card = createCard(item.id);
        cards.set(item.id, card);
        thumbs.observe(card.el);
      }
      card.update(item, readyPositions.get(item.id) ?? null, ready.length, detailFor(item));
      if (list.children[i] !== card.el) list.insertBefore(card.el, list.children[i] ?? null);
    });

    // Summary line and action button.
    const state = {
      files: ready.length,
      pages: ready.reduce((sum, item) => sum + (item.info ? config.pageCount(item.info) : 0), 0),
      bytes: ready.reduce((sum, item) => sum + item.size, 0),
      problems: items.filter((item) => item.status === 'error').length,
      checking: items.some((item) => item.status === 'checking'),
    };
    summary.textContent = queueSummary(state);
    actionBtn.disabled = ready.length < config.minFiles || state.checking || isBusy();
    hint.textContent = isBusy() ? '' : actionHint(state, { ...config, verb: verb.base });

    // A finished result goes stale when the queue changes.
    if (outcome && outcome.signature !== signature()) discardOutcome();

    // Restore focus lost when a focused button's card was moved in the DOM.
    if (pendingFocus) {
      const { id, action } = pendingFocus;
      pendingFocus = null;
      cards.get(id)?.el.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus();
    }

    sortable.option('disabled', isBusy());
    thumbs.kick();
  }

  // ----------------------------------------------------------- user actions
  async function addFiles(files: File[]): Promise<void> {
    if (files.length === 0 || isBusy()) return;
    announce(`Adding ${plural(files.length, 'file')}…`);
    const result = await intake.addFiles(files);
    announce(describeIntake(result, noun));
  }

  list.addEventListener('click', (event) => {
    if (isBusy()) return;
    const button = (event.target as Element).closest<HTMLElement>('[data-action]');
    const id = button?.closest<HTMLElement>('.card')?.dataset['id'];
    const action = button?.dataset['action'] as CardAction | undefined;
    const item = id ? queue.get(id) : undefined;
    if (!button || !id || !action || !item) return;

    if (action === 'remove') {
      // Move focus somewhere sensible before the focused button disappears.
      const index = queue.indexOf(id);
      const neighbor = queue.items[index + 1] ?? queue.items[index - 1];
      queue.remove(id);
      const next = neighbor
        ? cards.get(neighbor.id)?.el.querySelector<HTMLElement>('[data-action="remove"]')
        : null;
      (next ?? chooseBtn).focus();
      announce(`Removed ${item.name}. ${plural(queue.items.length, 'file')} left.`);
    } else if (action === 'rotate') {
      const rotation = queue.rotate(id);
      announce(`${item.name} rotated to ${rotation} degrees.`);
    } else {
      if (button.getAttribute('aria-disabled') === 'true') return;
      pendingFocus = { id, action };
      const newPosition = queue.moveBy(id, action === 'earlier' ? -1 : 1);
      if (newPosition !== undefined) {
        announce(`${item.name} moved to position ${newPosition} of ${queue.ready.length}.`);
      }
    }
  });

  clearBtn.addEventListener('click', () => {
    if (isBusy()) return;
    queue.clear();
    nameInput.value = config.defaultFileName;
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
      queue.setOrder(ids);
      const id = (event.item as HTMLElement).dataset['id'] ?? '';
      const item = queue.get(id);
      const position = queue.readyPosition(id);
      if (item && position !== undefined && event.oldIndex !== event.newIndex) {
        announce(`${item.name} moved to position ${position} of ${queue.ready.length}.`);
      }
    },
  });
  cleanups.push(() => sortable.destroy());

  // --- drop files anywhere on the page
  cleanups.push(
    enableDropAnywhere({
      isDisabled: isBusy,
      onActiveChange: (active) => {
        overlay.hidden = !active;
        dropzone.classList.toggle('is-over', active);
      },
      onFiles: (files) => void addFiles(files),
    }),
  );

  // ------------------------------------------------------------------ build
  function setBusy(on: boolean): void {
    queueSection.toggleAttribute('inert', on);
    dropzone.toggleAttribute('inert', on);
    settings.toggleAttribute('inert', on);
    progress.hidden = !on;
    if (on) {
      errorPanel.hidden = true;
      discardOutcome();
    }
  }

  function showProgress(p: JobProgress): void {
    progressBar.value = p.fraction;
    progressLabel.textContent =
      p.stage === 'saving'
        ? 'Saving the PDF…'
        : `${verb.ing} file ${p.index + 1} of ${p.total}: ${p.name}`;
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
    announce(message);
  }

  async function run(): Promise<void> {
    if (isBusy() || actionBtn.disabled) return;
    const fileName = sanitizeOutputName(nameInput.value, config.defaultFileName);
    nameInput.value = fileName;

    const inputs = queue.ready;
    const snapshot = signature();
    progressBar.value = 0;
    progressLabel.textContent = 'Starting…';
    job = config.start(inputs, showProgress);
    setBusy(true);
    render();
    announce(`${verb.ing} ${plural(inputs.length, noun)}. Please wait.`);

    try {
      const result = await job.result;
      const blob = new Blob([result.bytes as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const details = `${plural(result.pageCount, 'page')} · ${formatBytes(blob.size)}`;
      outcome = { url, signature: snapshot };
      triggerDownload(url, fileName);
      resultPanel.replaceChildren(
        createElement('span', { class: 'result__icon' }, icon('check')),
        createElement(
          'div',
          { class: 'result__text' },
          createElement('strong', null, `${fileName} is ready`),
          createElement('span', null, `${details}. Your download should have started.`),
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
        `${verb.past} ${plural(inputs.length, noun)} into ${fileName}: ${details}. Download started.`,
      );
    } catch (error) {
      handleJobError(
        error,
        inputs.map((item) => item.id),
      );
    } finally {
      job = null;
      setBusy(false);
      render();
      // The button was disabled while busy, which drops keyboard focus: put it back.
      if (document.activeElement === document.body) actionBtn.focus();
    }
  }

  function handleJobError(error: unknown, ids: string[]): void {
    if (!(error instanceof JobError)) {
      showError(`Something went wrong while ${verb.ing.toLowerCase()}.`);
      return;
    }
    if (error.code === 'cancelled') {
      announce('Cancelled.');
      return;
    }

    const { code, failedFile, message } = error;
    const badId = failedFile && ids[failedFile.index];
    if (!badId) {
      showError(message);
      return;
    }
    // Flag just the offending file; the rest of the queue stays intact.
    queue.update(badId, { status: 'error', problem: { code, message } });
    showError(
      `Couldn’t ${verb.base} “${failedFile.name}”: ${message} It has been marked in your list; remove it and try again.`,
    );
  }

  actionBtn.addEventListener('click', () => void run());
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void run();
  });
  nameInput.addEventListener('blur', () => {
    nameInput.value = sanitizeOutputName(nameInput.value, config.defaultFileName);
  });
  config.options?.addEventListener('change', discardOutcome);
  cancelBtn.addEventListener('click', () => job?.cancel());

  // ------------------------------------------------------------------ boot
  const unsubscribe = queue.subscribe(render);
  render();
  if (config.preload) runWhenIdle(config.preload);

  return () => {
    unsubscribe();
    job?.cancel();
    discardOutcome();
    thumbs.dispose();
    queue.clear(); // revokes thumbnail object URLs
    for (const cleanup of cleanups) cleanup();
  };
}
