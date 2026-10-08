import { collectDroppedFiles, dragHasFiles } from './dropped-files';

export interface DropAnywhereOptions {
  /** Called with the dropped files (folders already expanded). */
  onFiles: (files: File[]) => void;
  /** Called when the "drop files now" highlight should show or hide. */
  onActiveChange: (active: boolean) => void;
  /** While true, drags are refused (for example during a merge). */
  isDisabled: () => boolean;
}

/**
 * Accept files dropped anywhere on the window. Returns a function that removes the listeners.
 *
 * Only drags that carry files are handled, so dragging a card inside the page (SortableJS)
 * is left alone. `dragenter`/`dragleave` fire for every child element the pointer crosses,
 * hence the depth counter: the highlight hides only once the pointer has truly left.
 */
export function enableDropAnywhere({
  onFiles,
  onActiveChange,
  isDisabled,
}: DropAnywhereOptions): () => void {
  let depth = 0;

  const onDragEnter = (event: DragEvent): void => {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    depth++;
    if (!isDisabled()) onActiveChange(true);
  };

  const onDragOver = (event: DragEvent): void => {
    if (!dragHasFiles(event)) return;
    event.preventDefault(); // required, otherwise the browser refuses the drop
    if (event.dataTransfer) event.dataTransfer.dropEffect = isDisabled() ? 'none' : 'copy';
  };

  const onDragLeave = (event: DragEvent): void => {
    if (!dragHasFiles(event)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) onActiveChange(false);
  };

  const onDrop = (event: DragEvent): void => {
    if (!dragHasFiles(event)) return;
    event.preventDefault(); // stop the browser from navigating to the dropped PDF
    depth = 0;
    onActiveChange(false);
    // Entries must be read synchronously inside the event; the promise resolves later.
    if (event.dataTransfer && !isDisabled())
      void collectDroppedFiles(event.dataTransfer).then(onFiles);
  };

  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);
  return () => {
    window.removeEventListener('dragenter', onDragEnter);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
  };
}
