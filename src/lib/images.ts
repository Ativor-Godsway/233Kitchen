const LOCAL = /^(\/images\/(?:[a-z0-9-]+\/)*[a-z0-9-]+)-(480|960|1600)\.webp$/;

/**
 * Local images follow `/images/<name>-<w>.webp` (or `/images/box/<name>-<w>.webp`)
 * with 480/960/1600 variants. Remote images (e.g. pasted in admin) are used as-is.
 */
export function srcSetFor(src: string | null | undefined): string | undefined {
  const m = src?.match(LOCAL);
  if (!m) return undefined;
  return [480, 960, 1600].map((w) => `${m[1]}-${w}.webp ${w}w`).join(', ');
}

/** The same local image at another width ("/images/box/x-480.webp", 1600 → "…-1600.webp"). */
export function imageAt(src: string, width: 480 | 960 | 1600): string {
  const m = src.match(LOCAL);
  return m ? `${m[1]}-${width}.webp` : src;
}
