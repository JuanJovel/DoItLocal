import { describe, expect, it, vi } from 'vitest';
import { PdfStore } from './store';

const pdf = (name: string, size = 10): File => new File([new Uint8Array(size)], name);

function storeWith(...names: string[]): PdfStore {
  const store = new PdfStore();
  const items = store.add(names.map((n) => pdf(n)));
  items.forEach((item) => store.update(item.id, { status: 'ready', pageCount: 2 }));
  return store;
}

const names = (store: PdfStore): string[] => store.items.map((i) => i.name);

describe('PdfStore', () => {
  it('adds files in order with the checking state', () => {
    const store = new PdfStore();
    const added = store.add([pdf('a.pdf'), pdf('b.pdf')]);
    expect(added.map((i) => i.status)).toEqual(['checking', 'checking']);
    expect(new Set(added.map((i) => i.id)).size).toBe(2);
    expect(names(store)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('notifies subscribers and supports unsubscribe', () => {
    const store = new PdfStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.add([pdf('a.pdf')]);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.add([pdf('b.pdf')]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify for an empty add or an update of a removed item', () => {
    const store = new PdfStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.add([]);
    store.update('nope', { status: 'ready' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('removes items and clears everything', () => {
    const store = storeWith('a.pdf', 'b.pdf', 'c.pdf');
    const b = store.items[1]!;
    expect(store.remove(b.id)?.name).toBe('b.pdf');
    expect(names(store)).toEqual(['a.pdf', 'c.pdf']);
    expect(store.remove('missing')).toBeUndefined();
    store.clear();
    expect(store.items).toHaveLength(0);
  });

  it('revokes thumbnail object URLs on remove and clear', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { revokeObjectURL: revoke });
    const store = storeWith('a.pdf', 'b.pdf');
    store.update(store.items[0]!.id, { thumbUrl: 'blob:one' });
    store.update(store.items[1]!.id, { thumbUrl: 'blob:two' });
    store.remove(store.items[0]!.id);
    expect(revoke).toHaveBeenCalledWith('blob:one');
    store.clear();
    expect(revoke).toHaveBeenCalledWith('blob:two');
    vi.unstubAllGlobals();
  });

  it('moves a file earlier or later', () => {
    const store = storeWith('a.pdf', 'b.pdf', 'c.pdf');
    const [a, b, c] = store.items.map((i) => i.id) as [string, string, string];
    expect(store.moveBy(c, -1)).toBe(2);
    expect(names(store)).toEqual(['a.pdf', 'c.pdf', 'b.pdf']);
    expect(store.moveBy(a, 1)).toBe(2);
    expect(names(store)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
    expect(store.moveBy(b, 1)).toBe(3); // already last: stays put
    expect(store.moveBy(c, -1)).toBe(1); // already first
    expect(names(store)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
  });

  it('steps over files that cannot be merged when moving', () => {
    const store = storeWith('a.pdf', 'b.pdf', 'c.pdf');
    const [a, b, c] = store.items.map((i) => i.id) as [string, string, string];
    store.update(b, { status: 'error' });
    // Moving "c" earlier should swap it with "a" in merge order, hopping over the broken "b".
    expect(store.moveBy(c, -1)).toBe(1);
    expect(store.ready.map((i) => i.name)).toEqual(['c.pdf', 'a.pdf']);
    expect(store.moveBy(b, 1)).toBeUndefined(); // broken files can't be moved
    expect(store.indexOf(a)).toBeGreaterThanOrEqual(0);
  });

  it('re-syncs order from DOM ids and only notifies on real changes', () => {
    const store = storeWith('a.pdf', 'b.pdf', 'c.pdf');
    const [a, b, c] = store.items.map((i) => i.id) as [string, string, string];
    const listener = vi.fn();
    store.subscribe(listener);
    store.setOrder([a, b, c]);
    expect(listener).not.toHaveBeenCalled();
    store.setOrder([c, a, b]);
    expect(names(store)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rotates in quarter turns', () => {
    const store = storeWith('a.pdf');
    const id = store.items[0]!.id;
    expect([store.rotate(id), store.rotate(id), store.rotate(id), store.rotate(id)]).toEqual([
      90, 180, 270, 0,
    ]);
    expect(store.rotate('missing')).toBeUndefined();
  });

  it('computes totals over mergeable files only', () => {
    const store = new PdfStore();
    const [a, b, c] = store.add([pdf('a.pdf', 100), pdf('b.pdf', 200), pdf('c.pdf', 400)]);
    store.update(a!.id, { status: 'ready', pageCount: 3 });
    store.update(b!.id, { status: 'ready', pageCount: 5 });
    store.update(c!.id, { status: 'error' });
    expect(store.totals).toEqual({ files: 2, pages: 8, bytes: 300 });
  });
});
