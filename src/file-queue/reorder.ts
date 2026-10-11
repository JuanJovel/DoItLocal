import { clamp } from '../lib/clamp';

/** Pure helpers for ordering and rotating the file queue. Nothing here touches the DOM. */

export type Rotation = 0 | 90 | 180 | 270;

/** Move the item at `from` so it ends up at index `to`. Returns a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const target = clamp(to, 0, next.length - 1);
  if (target === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item as T);
  return next;
}

/** Combine two clockwise turns. */
export function rotateBy(rotation: Rotation, turn: Rotation): Rotation {
  return ((rotation + turn) % 360) as Rotation;
}

/** Rotate a quarter turn clockwise: 0 -> 90 -> 180 -> 270 -> 0. */
export function rotateClockwise(rotation: Rotation): Rotation {
  return rotateBy(rotation, 90);
}

/**
 * Re-order `list` to follow `orderedIds`. Items missing from `orderedIds` keep their
 * relative order at the end; unknown ids are ignored. Used to sync after drag-and-drop.
 */
export function orderByIds<T extends { id: string }>(
  list: readonly T[],
  orderedIds: readonly string[],
): T[] {
  const byId = new Map(list.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const id of orderedIds) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  return [...ordered, ...byId.values()];
}
