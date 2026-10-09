import { assetUrl } from './assets.js';

/**
 * Transparent extras icons in public/icons: <name>-128.webp, <name>-256.webp and <name>-256.png.
 * Built by `npm run images` from reference/ai/icons-cutout/icon-<name>.png.
 */
export const EXTRA_ICONS = [
  'banku',
  'chicken',
  'coleslaw',
  'corned-beef',
  'eggs',
  'fish',
  'gizzard',
  'kenkey-caramel',
  'kenkey-oreo',
  'kenkey-strawberry',
  'kenkey-vanilla',
  'nuts',
  'omelette',
  'plantain',
  'red-sauce',
  'sardine',
  'sausage',
  'shito',
  'stew',
  'tilapia',
] as const;

export type ExtraIcon = (typeof EXTRA_ICONS)[number];

export const isExtraIcon = (v: unknown): v is ExtraIcon =>
  typeof v === 'string' && (EXTRA_ICONS as readonly string[]).includes(v);

/** "corned-beef" → "Corned beef" (admin dropdown label). */
export const iconLabel = (name: string) =>
  (name.charAt(0).toUpperCase() + name.slice(1)).replace(/-/g, ' ');

/** Cache-busted icon URL (see shared/assets.ts). */
export const iconSrc = (name: string, size: 128 | 256 = 128, ext: 'webp' | 'png' = 'webp') =>
  assetUrl(`/icons/${name}-${ext === 'png' ? 256 : size}.${ext}`);
