import { parseSvg } from '../lib/dom';

/**
 * Brand marks as inline SVG, so they follow the theme's accent color.
 * Static copies with fixed colors live in /public for the favicon and OG image.
 */
function logo(size: number, cornerRadius: number, body: string): SVGSVGElement {
  return parseSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true" focusable="false" class="logo">` +
      `<rect width="32" height="32" rx="${cornerRadius}" fill="var(--accent)"/>${body}</svg>`,
  );
}

export function doItLocalLogo(size = 32): SVGSVGElement {
  return logo(
    size,
    8,
    `<path d="M16 5.2 4.4 15.4h3.3v10.6h16.6V15.4h3.3L16 5.2z" fill="var(--accent-contrast)" stroke="var(--accent-contrast)" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="m11.4 17.4 3.4 3.4 6-6.6" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
}

export function pdfoldLogo(size = 32): SVGSVGElement {
  return logo(
    size,
    9,
    `<rect x="8.5" y="6.5" width="12" height="15" rx="2" fill="var(--accent-contrast)" opacity=".5"/>` +
      `<path d="M12.5 10.5h7.2l4.3 4.3V24a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 11 24V12a1.5 1.5 0 0 1 1.5-1.5Z" fill="var(--accent-contrast)"/>` +
      `<path d="M19.7 10.5v3.3a1 1 0 0 0 1 1H24" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M14 19.2h6M14 22h4" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/>`,
  );
}

export function ezqrLogo(size = 32): SVGSVGElement {
  return logo(
    size,
    9,
    `<g fill="none" stroke="var(--accent-contrast)" stroke-width="2" stroke-linejoin="round">` +
      `<rect x="7" y="7" width="7" height="7" rx="1.5"/><rect x="18" y="7" width="7" height="7" rx="1.5"/><rect x="7" y="18" width="7" height="7" rx="1.5"/></g>` +
      `<g fill="var(--accent-contrast)"><rect x="9.5" y="9.5" width="2" height="2"/><rect x="20.5" y="9.5" width="2" height="2"/><rect x="9.5" y="20.5" width="2" height="2"/>` +
      `<rect x="18" y="18" width="3.5" height="3.5" rx=".6"/><rect x="22.5" y="22.5" width="2.5" height="2.5" rx=".6"/><rect x="22.5" y="18" width="2.5" height="2.5" rx=".6"/><rect x="18" y="22.5" width="2.5" height="2.5" rx=".6"/></g>`,
  );
}
