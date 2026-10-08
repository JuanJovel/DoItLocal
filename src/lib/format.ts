const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/** Human-readable file size using 1024-based units: 1536 -> "1.5 KB", 123.4 MB -> "123 MB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';

  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  // One decimal for small values ("1.5 MB"), none once it stops adding information ("123 MB").
  const text = unit === 0 || size >= 100 ? size.toFixed(0) : size.toFixed(1).replace(/\.0$/, '');
  return `${text} ${UNITS[unit]}`;
}

/** "1 page" / "2 pages". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
