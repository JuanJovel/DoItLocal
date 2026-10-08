import { clamp } from '../../lib/clamp';
import { moveItem, orderByIds, rotateClockwise, type Rotation } from './reorder';
import type { FileProblem } from './validate';

/**
 * State for the file queue: a plain observable list, independent of the DOM so it
 * can be unit tested. The view subscribes and re-renders on every change.
 */

export type ItemStatus = 'checking' | 'ready' | 'error';
export type ThumbState = 'idle' | 'loading' | 'done' | 'failed';

export interface PdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  rotation: Rotation;
  status: ItemStatus;
  pageCount: number | null;
  problem: FileProblem | null;
  thumbUrl: string | null;
  thumbState: ThumbState;
}

export type ItemPatch = Partial<Omit<PdfItem, 'id' | 'file'>>;

type Listener = () => void;

export class PdfStore {
  private list: PdfItem[] = [];
  private listeners = new Set<Listener>();
  private nextId = 1;

  get items(): readonly PdfItem[] {
    return this.list;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  get(id: string): PdfItem | undefined {
    return this.list.find((item) => item.id === id);
  }

  indexOf(id: string): number {
    return this.list.findIndex((item) => item.id === id);
  }

  /** Append files in the order given. New items start in the "checking" state. */
  add(files: readonly File[]): PdfItem[] {
    const added = files.map<PdfItem>((file) => ({
      id: `pdf-${this.nextId++}`,
      file,
      name: file.name,
      size: file.size,
      rotation: 0,
      status: 'checking',
      pageCount: null,
      problem: null,
      thumbUrl: null,
      thumbState: 'idle',
    }));
    if (added.length > 0) {
      this.list = [...this.list, ...added];
      this.emit();
    }
    return added;
  }

  update(id: string, patch: ItemPatch): void {
    const index = this.indexOf(id);
    if (index < 0) return; // removed while a background task was still running
    this.list = this.list.map((item, i) => (i === index ? { ...item, ...patch } : item));
    this.emit();
  }

  remove(id: string): PdfItem | undefined {
    const item = this.get(id);
    if (!item) return undefined;
    revoke(item);
    this.list = this.list.filter((i) => i.id !== id);
    this.emit();
    return item;
  }

  clear(): void {
    this.list.forEach(revoke);
    this.list = [];
    this.emit();
  }

  /**
   * 1-based position of a file among the files that will be merged, or undefined if it won't be
   * merged (for example a file that failed to load).
   */
  readyPosition(id: string): number | undefined {
    const index = this.ready.findIndex((item) => item.id === id);
    return index === -1 ? undefined : index + 1;
  }

  /**
   * Move a file earlier (negative `delta`) or later (positive) among the files that will be merged.
   * Error cards are stepped over, so one press always changes the merge order.
   * Returns the file's new 1-based position, or undefined if it isn't a file that will be merged.
   */
  moveBy(id: string, delta: number): number | undefined {
    const currentPosition = this.readyPosition(id);
    if (currentPosition === undefined) return undefined;

    const ready = this.ready;
    const currentIndex = currentPosition - 1;
    const targetIndex = clamp(currentIndex + delta, 0, ready.length - 1);
    const target = ready[targetIndex];
    if (target && target.id !== id) {
      this.list = moveItem(this.list, this.indexOf(id), this.indexOf(target.id));
      this.emit();
    }
    return this.readyPosition(id);
  }

  /** Re-sync the order from a list of ids (as laid out in the DOM after a drag). */
  setOrder(ids: readonly string[]): void {
    const next = orderByIds(this.list, ids);
    if (next.some((item, i) => item !== this.list[i])) {
      this.list = next;
      this.emit();
    }
  }

  rotate(id: string): Rotation | undefined {
    const item = this.get(id);
    if (!item) return undefined;
    const rotation = rotateClockwise(item.rotation);
    this.update(id, { rotation });
    return rotation;
  }

  /** Items that will be included in the merge, in order. */
  get ready(): PdfItem[] {
    return this.list.filter((item) => item.status === 'ready');
  }

  get totals(): { files: number; pages: number; bytes: number } {
    const ready = this.ready;
    return {
      files: ready.length,
      pages: ready.reduce((sum, item) => sum + (item.pageCount ?? 0), 0),
      bytes: ready.reduce((sum, item) => sum + item.size, 0),
    };
  }
}

function revoke(item: PdfItem): void {
  if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
}
