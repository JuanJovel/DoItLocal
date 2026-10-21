// Characters that are illegal in file names on Windows, macOS or Linux, plus control characters.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
const OUTPUT_EXTENSION = /(\.(pdf|zip|jpe?g|png))+$/i;
const MAX_BASE_LENGTH = 120;

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** The file extension for a download of this MIME type, e.g. "application/zip" -> "zip". */
export function extensionFor(type: string): string {
  return EXTENSIONS[type] ?? 'bin';
}

/** The usable part of a typed name: no illegal characters, output extension or stray dots. */
function baseName(input: string): string {
  let base = input
    .replace(ILLEGAL, '')
    .trim()
    .replace(OUTPUT_EXTENSION, '')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim();
  if (base.length > MAX_BASE_LENGTH) base = base.slice(0, MAX_BASE_LENGTH).trim();
  return WINDOWS_RESERVED.test(base) ? `${base}_` : base;
}

/**
 * Turn whatever the user typed into a safe download file name. Any output extension they typed
 * is replaced by `extension` (by default the fallback's), and empty or unusable input gives the
 * fallback's name.
 */
export function sanitizeOutputName(
  input: string,
  fallback: string,
  extension = fallback.slice(fallback.lastIndexOf('.') + 1),
): string {
  return `${baseName(input) || baseName(fallback)}.${extension}`;
}
