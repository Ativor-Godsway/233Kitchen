import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import manifest from '../shared/asset-manifest.json' with { type: 'json' };
import { assetUrl } from '../shared/assets.js';
import { iconSrc } from '../shared/icons.js';
import { MENU_SEED } from '../shared/menu.seed.js';
import { srcSetFor } from '../src/lib/images.js';
import { layout } from '../server/emails/layout.js';
import {
  checkManifest,
  computeManifest,
  hashFile,
  writeManifest,
} from '../scripts/asset-manifest.js';

const V = /\?v=[0-9a-f]{8}$/;

describe('assetUrl', () => {
  it('appends the manifest content hash to local images and icons', () => {
    const p = '/images/braised-rice-960.webp';
    expect(assetUrl(p)).toBe(`${p}?v=${hashFile(`public${p}`)}`);
    expect(assetUrl('/images/box/waakye-meat-480.webp')).toMatch(V);
    expect(assetUrl('/icons/plantain-256.png')).toMatch(V);
  });

  it('leaves external URLs, unknown paths and empty values untouched', () => {
    expect(assetUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(assetUrl('/images/not-a-file.webp')).toBe('/images/not-a-file.webp');
    expect(assetUrl('/images/braised-rice-960.webp?v=old')).toBe(
      '/images/braised-rice-960.webp?v=old',
    );
    expect(assetUrl(null)).toBeNull();
    expect(assetUrl(undefined)).toBeUndefined();
    expect(assetUrl('')).toBe('');
  });

  it('versions every srcset entry and every icon URL', () => {
    for (const src of [
      '/images/fried-rice-chicken-960.webp',
      '/images/box/banku-tilapia-480.webp',
    ]) {
      const entries = srcSetFor(src)!.split(', ');
      expect(entries.length).toBeGreaterThanOrEqual(3);
      for (const e of entries) expect(e).toMatch(/\?v=[0-9a-f]{8} \d+w$/);
    }
    expect(iconSrc('shito')).toMatch(/^\/icons\/shito-128\.webp\?v=/);
    expect(iconSrc('shito', 256, 'png')).toMatch(/^\/icons\/shito-256\.png\?v=/);
  });

  it('covers every image the seed menu references', () => {
    for (const item of MENU_SEED)
      for (const img of [item.image!, ...(item.boxImages ?? [])])
        expect(assetUrl(img), img).toMatch(V);
  });

  it('versions the logo in emails', () => {
    expect(layout({ preheader: 'x', body: '' })).toMatch(
      /\/images\/logo-email\.png\?v=[0-9a-f]{8}"/,
    );
  });
});

describe('asset manifest', () => {
  it('matches public/images and public/icons (same check as prebuild)', () => {
    expect(checkManifest()).toEqual([]);
    expect(manifest).toEqual(computeManifest());
    expect(Object.keys(manifest).some((k) => k.startsWith('/images/box/'))).toBe(true);
  });

  let tmp = '';
  afterEach(() => tmp && rmSync(tmp, { recursive: true, force: true }));

  it('reports missing, stale and deleted files', () => {
    tmp = mkdtempSync(path.join(tmpdir(), 'k233-assets-'));
    const pub = path.join(tmp, 'public');
    const out = path.join(tmp, 'manifest.json');
    mkdirSync(path.join(pub, 'images/box'), { recursive: true });
    mkdirSync(path.join(pub, 'icons'), { recursive: true });
    writeFileSync(path.join(pub, 'images/a-960.webp'), 'old photo');
    writeFileSync(path.join(pub, 'images/box/b-480.webp'), 'box');
    writeFileSync(path.join(pub, 'icons/c-128.webp'), 'icon');
    writeFileSync(path.join(pub, 'images/.DS_Store'), 'ignored');

    const m = writeManifest(pub, out);
    expect(Object.keys(m)).toEqual([
      '/icons/c-128.webp',
      '/images/a-960.webp',
      '/images/box/b-480.webp',
    ]);
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(m);
    expect(checkManifest(pub, out)).toEqual([]);

    // Replaced in place (same name, new content) → stale hash, so the build fails.
    writeFileSync(path.join(pub, 'images/a-960.webp'), 'new photo');
    writeFileSync(path.join(pub, 'icons/d-128.webp'), 'new icon');
    unlinkSync(path.join(pub, 'images/box/b-480.webp'));
    const problems = checkManifest(pub, out);
    expect(problems).toHaveLength(3);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^stale hash: \/images\/a-960\.webp/),
        'missing from manifest: /icons/d-128.webp',
        'in manifest but not on disk: /images/box/b-480.webp',
      ]),
    );

    writeManifest(pub, out);
    expect(checkManifest(pub, out)).toEqual([]);
  });
});

describe('vercel.json caching', () => {
  const headers = JSON.parse(readFileSync('vercel.json', 'utf8')).headers as Array<{
    source: string;
    headers: Array<{ key: string; value: string }>;
  }>;
  const cache = (source: string) =>
    headers.find((h) => h.source === source)?.headers.find((x) => x.key === 'Cache-Control')?.value;

  it('caches hashed/versioned folders for a year and revalidates HTML', () => {
    for (const s of ['/assets/(.*)', '/images/(.*)', '/icons/(.*)'])
      expect(cache(s)).toBe('public, max-age=31536000, immutable');
    const html = headers.find((h) => h.source.includes('?!assets/'))!;
    expect(new RegExp(`^${html.source}$`).test('/')).toBe(true);
    expect(new RegExp(`^${html.source}$`).test('/images/x.webp')).toBe(false);
    expect(cache(html.source)).toBe('public, max-age=0, must-revalidate');
  });
});
