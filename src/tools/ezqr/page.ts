import './ezqr.css';

import { ezqrLogo } from '../../components/logo';
import { toolPage } from '../../components/tool-page';
import { announce } from '../../lib/announce';
import { downloadBlob } from '../../lib/download';
import { createElement, parseSvg } from '../../lib/dom';
import { icon } from '../../lib/icons';
import type { ToolContext } from '../types';
import {
  colorWarning,
  createQr,
  ERROR_CORRECTION_LABELS,
  QrTooLongError,
  toRaster,
  toSvg,
  type ErrorCorrection,
  type QrColors,
  type QrMatrix,
} from './qr';

const SIZES = [
  { px: 256, label: 'Small (about 256 px)' },
  { px: 512, label: 'Medium (about 512 px)' },
  { px: 1024, label: 'Large (about 1024 px)' },
  { px: 2048, label: 'Extra large (about 2048 px)' },
] as const;

const FILE_BASE = 'qr-code';
const SAMPLE_TEXT = 'https://example.com';

function field(label: string, id: string, control: HTMLElement, hint?: HTMLElement): HTMLElement {
  return createElement(
    'div',
    { class: 'field' },
    createElement('label', { for: id, class: 'field__label' }, label),
    control,
    hint,
  );
}

export function mount({ container }: ToolContext): undefined {
  const textInput = createElement('textarea', {
    id: 'qr-text',
    class: 'input qr-text',
    rows: '4',
    maxlength: '2000',
    placeholder: SAMPLE_TEXT,
    spellcheck: 'false',
    autocomplete: 'off',
    'aria-describedby': 'qr-text-hint',
  });
  const levelSelect = createElement(
    'select',
    { id: 'qr-level', class: 'input' },
    ...(Object.keys(ERROR_CORRECTION_LABELS) as ErrorCorrection[]).map((level) =>
      createElement(
        'option',
        { value: level, selected: level === 'M' },
        ERROR_CORRECTION_LABELS[level],
      ),
    ),
  );
  const sizeSelect = createElement(
    'select',
    { id: 'qr-size', class: 'input' },
    ...SIZES.map(({ px, label }) =>
      createElement('option', { value: String(px), selected: px === 512 }, label),
    ),
  );
  const fgInput = createElement('input', {
    id: 'qr-fg',
    class: 'color-input',
    type: 'color',
    value: '#000000',
  });
  const bgInput = createElement('input', {
    id: 'qr-bg',
    class: 'color-input',
    type: 'color',
    value: '#ffffff',
  });

  const message = createElement('div', { class: 'notice qr-notice', hidden: true });
  const pngBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--primary btn--lg' },
    icon('download'),
    'Download PNG',
  );
  const svgBtn = createElement(
    'button',
    { type: 'button', class: 'btn btn--ghost btn--lg' },
    icon('download'),
    'Download SVG',
  );

  const preview = createElement('div', { class: 'qr-preview' });

  const controls = createElement(
    'div',
    { class: 'panel qr-controls' },
    field(
      'Link or text',
      'qr-text',
      textInput,
      createElement(
        'p',
        { id: 'qr-text-hint', class: 'field__hint' },
        'Anything you type stays on this device. The code updates as you type.',
      ),
    ),
    createElement(
      'div',
      { class: 'qr-row' },
      field('Error correction', 'qr-level', levelSelect),
      field('Image size', 'qr-size', sizeSelect),
    ),
    createElement(
      'div',
      { class: 'qr-row qr-row--colors' },
      field('Code color', 'qr-fg', fgInput),
      field('Background', 'qr-bg', bgInput),
    ),
    message,
  );

  const output = createElement(
    'div',
    { class: 'panel qr-output' },
    preview,
    createElement('div', { class: 'qr-actions' }, pngBtn, svgBtn),
  );

  container.replaceChildren(
    toolPage({
      name: 'EzQR',
      logo: ezqrLogo(18),
      title: [
        'Make QR codes. ',
        createElement('span', { class: 'hero__accent' }, 'Free. No watermarks.'),
      ],
      lede: 'Type a link or some text and download a sharp PNG or SVG. Nothing is uploaded.',
      workspace: createElement('div', { class: 'container qr-layout' }, controls, output),
      workspaceLabel: 'QR code generator',
    }),
  );

  let matrix: QrMatrix | null = null;

  const colors = (): QrColors => ({ fg: fgInput.value, bg: bgInput.value });

  function showMessage(text: string | null, kind: 'error' | 'warn' = 'warn'): void {
    message.hidden = text === null;
    if (text === null) return;
    message.className = `notice qr-notice ${kind === 'error' ? 'notice--error' : 'notice--warn'}`;
    message.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    message.replaceChildren(icon('alert'), createElement('p', null, text));
  }

  function showPlaceholder(): void {
    preview.className = 'qr-preview is-empty';
    preview.replaceChildren(
      icon('qr', 'icon qr-preview__icon'),
      createElement('p', null, 'Your QR code will appear here.'),
    );
  }

  /**
   * Draw a code in the preview. Until something is typed a dimmed sample is shown instead, so
   * the color pickers have something to change.
   */
  function showCode(code: QrMatrix, isSample: boolean): void {
    // The SVG is built from numbers and validated #rrggbb colors only, and the user's text
    // never appears in it, so it is safe to parse as markup.
    const svg = parseSvg(toSvg(code, colors()));
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', isSample ? 'Sample QR code' : 'Generated QR code');
    svg.classList.add('qr-preview__svg');

    preview.className = isSample ? 'qr-preview is-sample' : 'qr-preview';
    preview.replaceChildren(svg);
    if (isSample) {
      preview.append(
        createElement(
          'p',
          { class: 'qr-preview__caption' },
          'Sample. Type something to make your own.',
        ),
      );
    }
  }

  /** Rebuild the code from the current inputs. */
  function update(): void {
    const text = textInput.value;
    const level = levelSelect.value as ErrorCorrection;
    matrix = null;

    try {
      if (text.trim() === '') {
        showCode(createQr(SAMPLE_TEXT, level), true);
      } else {
        matrix = createQr(text, level);
        showCode(matrix, false);
      }
      showMessage(colorWarning(colors()));
    } catch (error) {
      showPlaceholder();
      showMessage(
        error instanceof QrTooLongError ? error.message : 'Could not create a QR code.',
        'error',
      );
    }
    pngBtn.disabled = svgBtn.disabled = matrix === null;
  }

  function downloadSvg(): void {
    if (!matrix) return;
    downloadBlob(
      new Blob([toSvg(matrix, colors())], { type: 'image/svg+xml' }),
      `${FILE_BASE}.svg`,
    );
    announce(`Downloaded ${FILE_BASE}.svg.`);
  }

  function downloadPng(): void {
    if (!matrix) return;
    const image = toRaster(matrix, colors(), Number(sizeSelect.value));
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas
      .getContext('2d')
      ?.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        showMessage(
          'Your browser could not create the PNG. Try the SVG download instead.',
          'error',
        );
        return;
      }
      downloadBlob(blob, `${FILE_BASE}.png`);
      announce(`Downloaded ${FILE_BASE}.png, ${image.width} by ${image.height} pixels.`);
    }, 'image/png');
  }

  textInput.addEventListener('input', update);
  levelSelect.addEventListener('change', update);
  fgInput.addEventListener('input', update);
  bgInput.addEventListener('input', update);
  pngBtn.addEventListener('click', downloadPng);
  svgBtn.addEventListener('click', downloadSvg);

  update();
}
