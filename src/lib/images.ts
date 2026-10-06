/**
 * Local images follow `/images/<name>-960.webp` with 480/960/1600 variants.
 * Remote images (e.g. pasted in admin) are used as-is.
 */
export function srcSetFor(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  const m = src.match(/^(\/images\/.+)-(480|960|1600)\.webp$/);
  if (!m) return undefined;
  return [480, 960, 1600].map((w) => `${m[1]}-${w}.webp ${w}w`).join(', ');
}
