// Characters that are illegal in file names on Windows, macOS or Linux, plus control characters.
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
const MAX_BASE_LENGTH = 120;

/**
 * Turn whatever the user typed into a safe download file name that always ends in ".pdf".
 * Empty or unusable input gives `fallback`.
 */
export function sanitizeOutputName(input: string, fallback: string): string {
  let base = input.replace(ILLEGAL, '').trim();
  base = base
    .replace(/(\.pdf)+$/i, '')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim();
  if (base.length > MAX_BASE_LENGTH) base = base.slice(0, MAX_BASE_LENGTH).trim();
  if (!base) return fallback;
  if (WINDOWS_RESERVED.test(base)) base = `${base}_`;
  return `${base}.pdf`;
}
