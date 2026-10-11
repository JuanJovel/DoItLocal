import { describe, expect, it } from 'vitest';
import { moveItem, orderByIds, rotateClockwise, type Rotation } from './reorder';

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('moves an item forward and backward', () => {
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns an equal copy when nothing moves', () => {
    const result = moveItem(list, 2, 2);
    expect(result).toEqual(list);
    expect(result).not.toBe(list);
  });

  it('clamps the target index into range', () => {
    expect(moveItem(list, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveItem(list, 2, -5)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores an invalid source index', () => {
    expect(moveItem(list, -1, 0)).toEqual(list);
    expect(moveItem(list, 4, 0)).toEqual(list);
  });

  it('does not mutate the input', () => {
    const copy = [...list];
    moveItem(list, 0, 3);
    expect(list).toEqual(copy);
  });
});

describe('rotateClockwise', () => {
  it('cycles through quarter turns', () => {
    const steps: Rotation[] = [];
    let r: Rotation = 0;
    for (let i = 0; i < 5; i++) {
      r = rotateClockwise(r);
      steps.push(r);
    }
    expect(steps).toEqual([90, 180, 270, 0, 90]);
  });
});

describe('orderByIds', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('orders by the given ids', () => {
    expect(orderByIds(items, ['c', 'a', 'b']).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps items missing from the id list at the end, in their original order', () => {
    expect(orderByIds(items, ['c']).map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });

  it('ignores unknown and duplicate ids', () => {
    expect(orderByIds(items, ['x', 'b', 'b', 'a']).map((i) => i.id)).toEqual(['b', 'a', 'c']);
  });
});
