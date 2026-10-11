/**
 * Collect files from a drop event, including files inside dropped folders.
 *
 * Entries must be grabbed synchronously while the drop event is still being
 * dispatched (the DataTransfer is cleared afterwards), so call this directly
 * from the event handler and await the result.
 */

/** True when a drag carries files (as opposed to text or an in-page card drag). */
export function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function readDirectory(entry: FileSystemDirectoryEntry): Promise<File[]> {
  const reader = entry.createReader();
  const files: File[] = [];
  // readEntries returns results in batches; keep going until it returns an empty batch.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    );
    if (batch.length === 0) break;
    for (const child of batch) files.push(...(await walk(child)));
  }
  return files;
}

async function walk(entry: FileSystemEntry): Promise<File[]> {
  try {
    if (entry.isFile) return [await readFile(entry as FileSystemFileEntry)];
    if (entry.isDirectory) return await readDirectory(entry as FileSystemDirectoryEntry);
  } catch {
    /* Unreadable entry: skip it rather than failing the whole drop. */
  }
  return [];
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.() ?? null);

  // Browsers without the entries API: fall back to the flat file list.
  if (entries.length === 0 || entries.includes(null)) return Array.from(dataTransfer.files);

  const nested = await Promise.all((entries as FileSystemEntry[]).map(walk));
  return nested.flat();
}
