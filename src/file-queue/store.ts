import { clamp } from '../lib/clamp';
import { moveItem, orderByIds, rotateClockwise, type Rotation } from './reorder';

/**
 * State for a queue of files: a plain observable list, independent of the DOM so it
 * can be unit tested. The view subscribes and re-renders on every change.
 *
 * `Info` is what a tool learns about a file while checking it (a PDF's page count,
 * an image's format), available once the file is ready.
 */

export type ItemStatus = 'checking' | 'ready' | 'error';
export type ThumbState = 'idle' | 'loading' | 'done' | 'failed';

/** Why a file can't be used. `code` is tool-specific; `message` is shown to the user. */
export interface FileProblem {
  code: string;
  message: string;
}

export interface QueueItem<Info> {
  id: string;
  file: File;
  name: string;
  size: number;
  rotation: Rotation;
  status: ItemStatus;
  info: Info | null;
  problem: FileProblem | null;
  thumbUrl: string | null;
  thumbState: ThumbState;
}

export type ItemPatch<Info> = Partial<Omit<QueueItem<Info>, 'id' | 'file'>>;

export class FileQueue<Info> {
  private list: QueueItem<Info>[] = [];
  private listeners = new Set<() => void>();
  private nextId = 1;

  get items(): readonly QueueItem<Info>[] {
    return this.list;
  }

  /** Items that will be included in the output, in order. */
  get ready(): QueueItem<Info>[] {
    return this.list.filter((item) => item.status === 'ready');
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  get(id: string): QueueItem<Info> | undefined {
    return this.list.find((item) => item.id === id);
  }

  indexOf(id: string): number {
    return this.list.findIndex((item) => item.id === id);
  }

  /** Append files in the order given. New items start in the "checking" state. */
  add(files: readonly File[]): QueueItem<Info>[] {
    const added = files.map<QueueItem<Info>>((file) => ({
      id: `file-${this.nextId++}`,
      file,
      name: file.name,
      size: file.size,
      rotation: 0,
      status: 'checking',
      info: null,
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

  update(id: string, patch: ItemPatch<Info>): void {
    const index = this.indexOf(id);
    if (index < 0) return; // removed while a background task was still running
    this.list = this.list.map((item, i) => (i === index ? { ...item, ...patch } : item));
    this.emit();
  }

  remove(id: string): QueueItem<Info> | undefined {
    const item = this.get(id);
    if (!item) return undefined;
    revokeThumb(item);
    this.list = this.list.filter((i) => i.id !== id);
    this.emit();
    return item;
  }

  clear(): void {
    this.list.forEach(revokeThumb);
    this.list = [];
    this.emit();
  }

  /** 1-based position among the ready files, or undefined for a file that won't be used. */
  readyPosition(id: string): number | undefined {
    const index = this.ready.findIndex((item) => item.id === id);
    return index === -1 ? undefined : index + 1;
  }

  /**
   * Move a file earlier (negative `delta`) or later (positive) among the ready files.
   * Error cards are stepped over, so one press always changes the output order.
   * Returns the file's new 1-based position, or undefined if it isn't ready.
   */
  moveBy(id: string, delta: number): number | undefined {
    const currentPosition = this.readyPosition(id);
    if (currentPosition === undefined) return undefined;

    const ready = this.ready;
    const target = ready[clamp(currentPosition - 1 + delta, 0, ready.length - 1)];
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
}

function revokeThumb(item: QueueItem<unknown>): void {
  if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
}
