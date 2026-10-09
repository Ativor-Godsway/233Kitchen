import manifest from './asset-manifest.json' with { type: 'json' };

/**
 * Content hashes of public/images and public/icons, written by `npm run images`
 * (scripts/asset-manifest.ts) and verified before every build.
 */
const HASHES: Readonly<Record<string, string>> = manifest;

/**
 * Cache-busted URL for a local static asset: "/images/x-960.webp" → "/images/x-960.webp?v=1a2b3c4d".
 * Those folders are cached for a year (immutable), so the URL must change when the file does.
 * Database values stay unversioned; call this at render time. Anything not in the manifest
 * (https:// URLs, unknown paths, null) is returned unchanged.
 */
export function assetUrl(path: string): string;
export function assetUrl(path: string | null | undefined): string | null | undefined;
export function assetUrl(path: string | null | undefined) {
  if (!path) return path;
  const hash = HASHES[path];
  return hash ? `${path}?v=${hash}` : path;
}
