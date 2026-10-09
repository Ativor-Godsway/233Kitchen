const LOCAL = /^(\/images\/(?:[a-z0-9-]+\/)*[a-z0-9-]+)-(480|720|960|1600)\.webp$/;

/** Widths built by `npm run images` (keep in sync with scripts/optimize-images.ts). */
const PLATED_WIDTHS = [480, 720, 960, 1600] as const;
const BOX_WIDTHS = [480, 960, 1600] as const;
type Width = (typeof PLATED_WIDTHS)[number];

/**
 * Local images follow `/images/<name>-<w>.webp` (480/720/960/1600) or
 * `/images/box/<name>-<w>.webp` (480/960/1600). Remote images (e.g. pasted in admin) are used as-is.
 */
export function srcSetFor(src: string | null | undefined): string | undefined {
  const m = src?.match(LOCAL);
  if (!m) return undefined;
  const widths = m[1].startsWith('/images/box/') ? BOX_WIDTHS : PLATED_WIDTHS;
  return widths.map((w) => `${m[1]}-${w}.webp ${w}w`).join(', ');
}

/** The same local image at another width ("/images/box/x-480.webp", 1600 → "…-1600.webp"). */
export function imageAt(src: string, width: Width): string {
  const m = src.match(LOCAL);
  return m ? `${m[1]}-${width}.webp` : src;
}
