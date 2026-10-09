/**
 * Content-Security-Policy for the website (served by Vercel from dist/, see vercel.json) and for
 * the JSON API (Express). tests/security.test.ts keeps vercel.json in sync with SITE_CSP.
 */

/** Origins allowed to be framed (Google Maps embed on the Pickup section). */
export const MAP_FRAME_SOURCES = ['https://www.google.com', 'https://maps.google.com'];

export const SITE_CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  // Inline styles: React/framer-motion style attributes and the toast library's <style> tag.
  'style-src': ["'self'", "'unsafe-inline'"],
  // https: covers menu photos the owner links from elsewhere; data:/blob: for inline SVG/previews.
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'frame-src': [...MAP_FRAME_SOURCES],
  'manifest-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
};

export const SITE_CSP = Object.entries(SITE_CSP_DIRECTIVES)
  .map(([k, v]) => [k, ...v].join(' '))
  .join('; ');

/** The API only returns JSON / CSV / ICS: nothing in a response may load or be framed. */
export const API_CSP_DIRECTIVES = {
  'default-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

export const HSTS = 'max-age=63072000; includeSubDomains';
