import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MENU_SEED } from '../shared/menu.seed.js';
import { EXTRA_ICONS } from '../shared/icons.js';
import { imageAt, srcSetFor } from '../src/lib/images.js';

const pub = (p: string) => `public${p}`;
const sizes = (src: string, widths: ReadonlyArray<480 | 720 | 960 | 1600> = [480, 960, 1600]) =>
  widths.map((w) => pub(imageAt(src, w)));

describe('menu images and icons', () => {
  it('every seed image and box photo exists in all three sizes', () => {
    for (const item of MENU_SEED) {
      expect(item.image, item.slug).toMatch(/^\/images\/[a-z-]+-960\.webp$/);
      for (const f of sizes(item.image!, [480, 720, 960, 1600]))
        expect(existsSync(f), f).toBe(true);
      for (const box of item.boxImages ?? []) {
        expect(box).toMatch(/^\/images\/box\/[a-z-]+-480\.webp$/);
        for (const f of sizes(box)) expect(existsSync(f), f).toBe(true);
      }
    }
  });

  it('maps dishes to their box photos (Ice Kenkey has none)', () => {
    const box = Object.fromEntries(MENU_SEED.map((i) => [i.slug, i.boxImages]));
    expect(box['loaded-hajia-waakye']).toEqual([
      '/images/box/waakye-fish-480.webp',
      '/images/box/waakye-meat-480.webp',
    ]);
    expect(box['braised-rice-plate']).toEqual(['/images/box/braised-rice-480.webp']);
    expect(box['ice-kenkey']).toEqual([]);
  });

  it('every icon in the catalogue has 128/256 WebP and a 256 PNG', () => {
    for (const n of EXTRA_ICONS)
      for (const f of [`${n}-128.webp`, `${n}-256.webp`, `${n}-256.png`])
        expect(existsSync(`public/icons/${f}`), f).toBe(true);
  });

  it('every seed option has a known icon', () => {
    for (const item of MENU_SEED)
      for (const g of item.optionGroups)
        for (const o of g.options)
          expect(EXTRA_ICONS as readonly string[], `${item.slug}/${o.key}`).toContain(o.icon);
  });

  it('nothing references the removed /images/waakye-meat-* files', () => {
    const files = [
      'shared/menu.seed.ts',
      'src/components/hero/HeroVisual.tsx',
      'src/content/gallery.ts',
      'index.html',
    ];
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\/images\/waakye-meat/);
  });

  it('srcSetFor offers 720 for plated photos (not box photos)', () => {
    expect(srcSetFor('/images/braised-rice-960.webp')).toBe(
      '/images/braised-rice-480.webp 480w, /images/braised-rice-720.webp 720w, /images/braised-rice-960.webp 960w, /images/braised-rice-1600.webp 1600w',
    );
  });

  it('srcSetFor supports the box/ subfolder', () => {
    expect(srcSetFor('/images/box/waakye-meat-480.webp')).toBe(
      '/images/box/waakye-meat-480.webp 480w, /images/box/waakye-meat-960.webp 960w, /images/box/waakye-meat-1600.webp 1600w',
    );
    expect(imageAt('/images/box/waakye-meat-480.webp', 1600)).toBe(
      '/images/box/waakye-meat-1600.webp',
    );
    expect(srcSetFor('https://example.com/a.jpg')).toBeUndefined();
  });
});
