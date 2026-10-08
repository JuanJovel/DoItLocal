import { createElement } from '../../lib/dom';
import { formatBytes, plural } from '../../lib/format';
import { icon, type IconName } from '../../lib/icons';
import type { PdfItem } from './store';

export type CardAction = 'earlier' | 'later' | 'rotate' | 'remove';

export interface Card {
  el: HTMLLIElement;
  /** Sync the card with an item. `position` is 1-based among mergeable files, or null for files that will not be merged. */
  update(item: PdfItem, position: number | null, readyCount: number): void;
}

function actionButton(
  action: CardAction,
  iconName: IconName,
  title: string,
  className = '',
): HTMLButtonElement {
  return createElement(
    'button',
    {
      type: 'button',
      class: `icon-btn card__btn ${className}`.trim(),
      'data-action': action,
      title,
    },
    icon(iconName),
  );
}

/**
 * One file in the queue. The element is created once per file and updated in place,
 * which keeps drag-and-drop smooth and keyboard focus stable.
 */
export function createCard(id: string): Card {
  const index = createElement('span', { class: 'card__index', 'aria-hidden': 'true' });
  const thumb = createElement('div', { class: 'card__thumb' });
  const rotBadge = createElement('span', { class: 'card__rot', 'aria-hidden': 'true' });
  const name = createElement('p', { class: 'card__name' });
  const meta = createElement('p', { class: 'card__meta' });
  const earlier = actionButton('earlier', 'arrow-left', 'Move earlier');
  const later = actionButton('later', 'arrow-right', 'Move later');
  const rotate = actionButton('rotate', 'rotate', 'Rotate 90°');
  const remove = actionButton('remove', 'x', 'Remove', 'card__remove');
  const actions = createElement(
    'div',
    { class: 'card__actions', role: 'group' },
    earlier,
    later,
    rotate,
    remove,
  );

  const el = createElement(
    'li',
    { class: 'card', 'data-id': id },
    index,
    createElement('div', { class: 'card__preview' }, thumb, rotBadge),
    createElement('div', { class: 'card__body' }, name, meta),
    actions,
  );

  // Cache what the thumbnail box currently shows so updates only touch the DOM on a change.
  let img: HTMLImageElement | null = null;
  let placeholder: 'file' | 'alert' | null = null;

  function update(item: PdfItem, position: number | null, readyCount: number): void {
    const isError = item.status === 'error';
    el.classList.toggle('is-error', isError);
    el.classList.toggle('is-checking', item.status === 'checking');
    el.dataset['status'] = item.status;

    // Position badge: only mergeable files are numbered.
    index.textContent = position === null ? '' : String(position);
    index.hidden = position === null;

    // Preview: real thumbnail, loading skeleton, or a generic file icon.
    if (item.thumbUrl) {
      if (!img) {
        img = createElement('img', {
          class: 'card__img',
          alt: '',
          draggable: 'false',
          decoding: 'async',
        });
        thumb.replaceChildren(img);
        placeholder = null;
      }
      if (img.getAttribute('src') !== item.thumbUrl) img.src = item.thumbUrl;
      thumb.classList.remove('is-loading');
    } else {
      img = null;
      const showSkeleton = item.status === 'checking' || item.thumbState === 'loading';
      thumb.classList.toggle('is-loading', showSkeleton);
      const wanted = isError ? 'alert' : 'file';
      if (placeholder !== wanted) {
        thumb.replaceChildren(icon(wanted, 'icon card__placeholder'));
        placeholder = wanted;
      }
    }
    thumb.style.setProperty('--rot', `${item.rotation}deg`);
    rotBadge.textContent = item.rotation ? `${item.rotation}°` : '';
    rotBadge.hidden = item.rotation === 0;

    name.textContent = item.name;
    name.title = item.name;

    if (isError && item.problem) {
      meta.replaceChildren(
        createElement(
          'span',
          { class: 'card__error' },
          icon('alert', 'icon icon--sm'),
          item.problem.message,
        ),
      );
    } else if (item.status === 'checking') {
      meta.textContent = `Reading… · ${formatBytes(item.size)}`;
    } else {
      meta.textContent = `${plural(item.pageCount ?? 0, 'page')} · ${formatBytes(item.size)}`;
    }

    // Controls. Disabled-looking edges use aria-disabled so keyboard focus is never lost.
    actions.setAttribute('aria-label', `Actions for ${item.name}`);
    earlier.hidden = later.hidden = rotate.hidden = isError || item.status === 'checking';
    const positionSuffix = position === null ? '' : ` (position ${position} of ${readyCount})`;
    earlier.setAttribute('aria-disabled', String(position === 1));
    later.setAttribute('aria-disabled', String(position === readyCount));
    earlier.setAttribute('aria-label', `Move ${item.name} earlier${positionSuffix}`);
    later.setAttribute('aria-label', `Move ${item.name} later${positionSuffix}`);
    rotate.setAttribute('aria-label', `Rotate ${item.name} 90° clockwise (now ${item.rotation}°)`);
    remove.setAttribute('aria-label', `Remove ${item.name}`);
  }

  return { el, update };
}
