/**
 * Content-hash manifest for long-cached static assets (public/images, public/icons).
 * Maps "/images/x-960.webp" → first 8 hex chars of its sha256; assetUrl() appends ?v=<hash>.
 *
 *   tsx scripts/asset-manifest.ts           → (re)write shared/asset-manifest.json
 *   tsx scripts/asset-manifest.ts --check   → exit 1 if any file is missing, stale or extra (prebuild)
 *
 * `npm run images` writes it automatically after generating files.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_PATH = 'shared/asset-manifest.json';
/** Public folders whose files are served with an immutable, 1-year Cache-Control. */
export const VERSIONED_DIRS = ['images', 'icons'];

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .flatMap((f) => {
      const full = path.join(dir, f);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

export const hashFile = (file: string) =>
  createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);

/** Hashes every file currently in the versioned public folders. */
export function computeManifest(publicDir = 'public'): Record<string, string> {
  const entries = VERSIONED_DIRS.flatMap((d) => walk(path.join(publicDir, d)))
    .map((file) => ['/' + path.relative(publicDir, file).split(path.sep).join('/'), hashFile(file)])
    .sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
}

export function writeManifest(publicDir = 'public', out = MANIFEST_PATH) {
  const manifest = computeManifest(publicDir);
  writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** Problems with the committed manifest compared to the files on disk (empty = OK). */
export function checkManifest(publicDir = 'public', manifestPath = MANIFEST_PATH): string[] {
  const actual = computeManifest(publicDir);
  const recorded: Record<string, string> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {};
  const problems: string[] = [];
  for (const [file, hash] of Object.entries(actual)) {
    if (!(file in recorded)) problems.push(`missing from manifest: ${file}`);
    else if (recorded[file] !== hash)
      problems.push(`stale hash: ${file} (manifest ${recorded[file]}, file ${hash})`);
  }
  for (const file of Object.keys(recorded))
    if (!(file in actual)) problems.push(`in manifest but not on disk: ${file}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const problems = checkManifest();
    if (problems.length) {
      console.error(`✗ ${MANIFEST_PATH} is out of date (${problems.length} problem(s)):`);
      for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
      console.error('Run `npm run images` (or `npm run assets:manifest`) and commit the result.');
      process.exit(1);
    }
    console.log(`✓ ${MANIFEST_PATH} matches public/${VERSIONED_DIRS.join(', public/')}`);
  } else {
    const m = writeManifest();
    console.log(`✓ wrote ${MANIFEST_PATH} (${Object.keys(m).length} files)`);
  }
}
