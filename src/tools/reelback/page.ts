import '../../file-queue/file-queue.css';
import './reelback.css';

import { reelBackLogo } from '../../components/logo';
import { selectField } from '../../components/select-field';
import { toolPage } from '../../components/tool-page';
import { enableDropAnywhere } from '../../file-queue/drop-anywhere';
import { JobError, type JobProgress } from '../../file-queue/job';
import { announce } from '../../lib/announce';
import { createElement } from '../../lib/dom';
import { formatBytes } from '../../lib/format';
import { icon } from '../../lib/icons';
import type { ToolContext, Unmount } from '../types';
import { reelBack } from './index';
import { previewVideo } from './preview';
import {
  AUDIO_LABELS,
  formatDuration,
  isVideoFile,
  MAX_HEIGHT_LABELS,
  reversedName,
  type AudioMode,
  type MaxHeight,
} from './reverse';
import { preloadFfmpeg, reverseVideo, type ReverseJob } from './run';

const ACCEPT = 'video/*,.mp4,.m4v,.mov,.webm,.mkv,.avi,.3gp';

export function mount({ container }: ToolContext): Unmount {
  const size = selectField<MaxHeight>('rb-size', 'Size', MAX_HEIGHT_LABELS, '1080');
  const audio = selectField<AudioMode>('rb-audio', 'Sound', AUDIO_LABELS, 'reverse');

  // ---------------------------------------------------------------- markup
  const fileInput = createElement('input', {
    type: 'file',
    class: 'visually-hidden',
    accept: ACCEPT,
    tabindex: '-1',
    'aria-hidden': 'true',
  });
  const chooseBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg' },
    icon('upload'),
    'Choose a video',
  );
  const dropzone = createElement(
    'div',
    { class: 'dropzone', role: 'group', 'aria-labelledby': 'dz-title' },
    createElement('span', { class: 'dropzone__icon' }, icon('upload')),
    createElement(
      'div',
      { class: 'dropzone__text' },
      createElement('p', { id: 'dz-title', class: 'dropzone__title' }, 'Drop a video here'),
      createElement(
        'p',
        { class: 'dropzone__hint' },
        'or choose one from your device. It stays on your device and is never uploaded.',
      ),
    ),
    chooseBtn,
    fileInput,
  );

  // The picked video is not played here: a small frame and its details are enough, and a heavy
  // file would make an inline player stutter or freeze.
  const sourceThumb = createElement('div', { class: 'rb-thumb' });
  const sourceName = createElement('p', { class: 'rb-clip__name' });
  const sourceMeta = createElement('p', { class: 'rb-clip__meta' });
  const reversedVideo = createElement('video', {
    class: 'rb-video',
    controls: true,
    playsinline: true,
    preload: 'metadata',
    'aria-label': 'Reversed video',
  });
  const reversedMeta = createElement('p', { class: 'rb-clip__meta' });
  const reversedClip = createElement(
    'figure',
    { class: 'rb-clip', hidden: true },
    reversedVideo,
    createElement(
      'figcaption',
      null,
      createElement('p', { class: 'rb-clip__name' }, 'Reversed'),
      reversedMeta,
    ),
  );
  const clips = createElement(
    'section',
    { class: 'rb-clips', 'aria-label': 'Videos', hidden: true },
    createElement(
      'div',
      { class: 'rb-clip rb-source' },
      sourceThumb,
      createElement('div', { class: 'rb-source__text' }, sourceName, sourceMeta),
    ),
    reversedClip,
  );

  const actionBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg actionbar__button' },
    icon('rewind'),
    'Reverse video',
  );
  const hint = createElement(
    'p',
    { id: 'action-hint', class: 'actionbar__hint' },
    'Your device does the work. Long or 4K videos take a while; a smaller size is much faster.',
  );
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
    createElement('div', { class: 'actionbar__options' }, size.field, audio.field),
  );
  const actionbar = createElement(
    'section',
    { class: 'actionbar', 'aria-label': 'Reverse video', hidden: true },
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
      createElement('p', null, 'Drop a video to reverse it'),
    ),
  );

  const page = toolPage({
    tool: reelBack,
    logo: reelBackLogo(18),
    title: [
      'Reverse a video. ',
      createElement('span', { class: 'hero__accent' }, 'Free. Private.'),
      ' Nothing leaves your device.',
    ],
    lede: 'Play any clip backwards, sound and all, and save it as an MP4. Nothing is uploaded.',
    workspace: createElement('div', { class: 'container' }, dropzone, clips, actionbar),
    workspaceLabel: 'Video reverser',
  });
  page.dataset['state'] = 'empty';
  page.append(overlay);
  container.replaceChildren(page);

  // ------------------------------------------------------------------ state
  let file: File | null = null;
  let previewing: AbortController | null = null;
  let outputUrl: string | null = null;
  let job: ReverseJob | null = null;

  const isBusy = (): boolean => job !== null;

  function showError(message: string): void {
    errorPanel.replaceChildren(icon('alert'), createElement('p', null, message));
    errorPanel.hidden = false;
    announce(message);
  }

  function discardOutput(): void {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    outputUrl = null;
    reversedVideo.removeAttribute('src');
    reversedVideo.load();
    reversedClip.hidden = true;
    resultPanel.hidden = true;
    resultPanel.replaceChildren();
  }

  function setFile(next: File): void {
    if (isBusy()) return;
    errorPanel.hidden = true;
    if (!isVideoFile(next)) {
      showError(`"${next.name}" is not a video. Choose an MP4, MOV, WebM or MKV file.`);
      return;
    }
    discardOutput();
    file = next;
    sourceName.textContent = next.name;
    sourceMeta.textContent = formatBytes(next.size);
    sourceThumb.replaceChildren(icon('rewind'));
    clips.hidden = false;
    actionbar.hidden = false;
    page.dataset['state'] = 'filled';
    preloadFfmpeg();
    announce(`${next.name} added. Choose your settings, then reverse it.`);
    void showDetails(next);
  }

  /** Fill in the length, size and a frame once the browser has read them. */
  async function showDetails(picked: File): Promise<void> {
    previewing?.abort();
    const controller = new AbortController();
    previewing = controller;
    const preview = await previewVideo(picked, controller.signal);
    if (controller.signal.aborted) return;

    // Formats the browser can't read (AVI, some MKV) still work; ffmpeg reads them.
    const details: string[] = [];
    if (preview.duration !== null) details.push(formatDuration(preview.duration));
    if (preview.size) details.push(`${preview.size.width}×${preview.size.height}`);
    details.push(formatBytes(picked.size));
    if (!preview.size) details.push('no preview in this browser');
    sourceMeta.textContent = details.join(' · ');
    if (preview.thumbnail) {
      preview.thumbnail.setAttribute('aria-hidden', 'true');
      sourceThumb.replaceChildren(preview.thumbnail);
    }
  }

  function setBusy(on: boolean): void {
    dropzone.toggleAttribute('inert', on);
    settings.toggleAttribute('inert', on);
    actionBtn.disabled = on;
    progress.hidden = !on;
    hint.hidden = on;
    if (on) {
      errorPanel.hidden = true;
      discardOutput();
    }
  }

  function showProgress({ fraction, label }: JobProgress): void {
    progressBar.value = fraction;
    progressLabel.textContent = `${label} ${Math.round(fraction * 100)}%`;
  }

  async function run(): Promise<void> {
    if (!file || isBusy()) return;
    const input = file;
    const fileName = reversedName(input.name);
    progressBar.value = 0;
    progressLabel.textContent = 'Starting…';
    job = reverseVideo(input, { maxHeight: size.value(), audio: audio.value() }, showProgress);
    setBusy(true);
    announce(`Reversing ${input.name}. Please wait.`);

    try {
      const { bytes } = await job.result;
      const blob = new Blob([bytes as BlobPart], { type: 'video/mp4' });
      outputUrl = URL.createObjectURL(blob);
      reversedVideo.src = outputUrl;
      reversedMeta.textContent = `${fileName} · ${formatBytes(blob.size)}`;
      reversedClip.hidden = false;
      resultPanel.replaceChildren(
        createElement('span', { class: 'result__icon' }, icon('check')),
        createElement(
          'div',
          { class: 'result__text' },
          createElement('strong', null, `${fileName} is ready`),
          createElement('span', null, `${formatBytes(blob.size)}. Watch it above, or download it.`),
        ),
        createElement(
          'a',
          { class: 'btn btn--primary btn--sm', href: outputUrl, download: fileName },
          icon('download'),
          'Download MP4',
        ),
      );
      resultPanel.hidden = false;
      announce(`${fileName} is ready to watch and download.`);
    } catch (error) {
      if (error instanceof JobError && error.code === 'cancelled') announce('Cancelled.');
      else
        showError(
          error instanceof JobError ? error.message : 'Something went wrong while reversing.',
        );
    } finally {
      job = null;
      setBusy(false);
      if (document.activeElement === document.body) actionBtn.focus();
    }
  }

  // ----------------------------------------------------------------- events
  chooseBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const [picked] = Array.from(fileInput.files ?? []);
    fileInput.value = ''; // allow re-selecting the same file later
    if (picked) setFile(picked);
  });
  actionBtn.addEventListener('click', () => void run());
  cancelBtn.addEventListener('click', () => job?.cancel());
  settings.addEventListener('change', discardOutput);

  const stopDrops = enableDropAnywhere({
    isDisabled: isBusy,
    onActiveChange: (active) => {
      overlay.hidden = !active;
      dropzone.classList.toggle('is-over', active);
    },
    onFiles: ([dropped]) => {
      if (dropped) setFile(dropped);
    },
  });

  return () => {
    stopDrops();
    job?.cancel();
    discardOutput();
    previewing?.abort();
  };
}
