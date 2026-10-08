/**
 * Helpers for reading the Content-Security-Policy out of `public/_headers`,
 * which is the single source of truth for the site's CSP.
 */

export interface HeaderRule {
  path: string;
  headers: Record<string, string>;
}

/** Parse the `_headers` file format into a list of path rules. */
export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  let current: HeaderRule | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      current = { path: raw.trim(), headers: {} };
      rules.push(current);
    } else if (current) {
      const colon = raw.indexOf(':');
      if (colon > 0) current.headers[raw.slice(0, colon).trim()] = raw.slice(colon + 1).trim();
    }
  }
  return rules;
}

/** Directives that browsers ignore (and warn about) when the policy comes from a <meta> tag. */
const HEADER_ONLY = new Set(['frame-ancestors', 'report-uri', 'sandbox']);

/** The policy for the home page, with header-only directives removed, ready for a <meta> tag. */
export function metaCsp(headersFile: string): string {
  const rule = parseHeadersFile(headersFile).find((r) => r.path === '/');
  const policy = rule?.headers['Content-Security-Policy'];
  if (!policy) throw new Error("public/_headers has no Content-Security-Policy for '/'");
  return policy
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d && !HEADER_ONLY.has(d.split(/\s+/)[0] ?? ''))
    .join('; ');
}
