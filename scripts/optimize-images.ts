/**
 * npm run images            → builds any missing image outputs (never overwrites existing files)
 * npm run images -- --force → rebuilds everything
 *
 * - reference/*.jpeg (the owner's real box photos)   → public/images/box/<dish>-{480,960,1600}.webp
 * - reference/ai/dishes/*.jpg (plated photos)        → public/images/<dish>-{480,720,960,1600}.webp
 * - reference/ai/icons-cutout/icon-*.png (cutouts)   → public/icons/<name>-{128,256}.webp + -256.png
 * - reference/logo.*                                  → logo badge + favicons
 * - plated fried-rice-chicken + logo                  → public/images/og-image.jpg
 *
 * Real photos only ever go to box/, so they can never replace the plated photos.
 * Photos are checked per size, so adding a new width only writes that width.
 * Finally rewrites shared/asset-manifest.json (content hashes of every file, built or skipped),
 * which assetUrl() uses for ?v= cache busting.
 */
import sharp, { type OverlayOptions } from 'sharp';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { MANIFEST_PATH, writeManifest } from './asset-manifest.js';

const SRC = 'reference';
const DISHES = 'reference/ai/dishes';
const ICONS = 'reference/ai/icons-cutout';
const OUT = 'public/images';
const OUT_BOX = 'public/images/box';
const OUT_ICONS = 'public/icons';
/** Keep in sync with src/lib/images.ts. */
const BOX_WIDTHS = [480, 960, 1600];
const PLATED_WIDTHS = [480, 720, 960, 1600];
const FORCE = process.argv.includes('--force');

for (const d of [OUT, OUT_BOX, OUT_ICONS]) mkdirSync(d, { recursive: true });

let built = 0;
let skipped = 0;
/** Runs `make` only when an output is missing (or with --force). */
async function build(outputs: string[], make: () => Promise<unknown>) {
  if (!FORCE && outputs.every((o) => existsSync(o))) {
    skipped += outputs.length;
    return false;
  }
  await make();
  built += outputs.length;
  return true;
}

/** Writes `<base>-<w>.webp` for each width that's missing (all of them with --force). */
async function buildWidths(
  base: string,
  widths: number[],
  make: (width: number, out: string) => Promise<unknown>,
) {
  const made: number[] = [];
  for (const w of widths) {
    const out = `${base}-${w}.webp`;
    if (await build([out], () => make(w, out))) made.push(w);
  }
  if (made.length) console.log(`✓ ${base.replace(`${OUT}/`, '')} (${made.join(', ')})`);
}

/** Finds a file in `dir` by any of the given base names, regardless of extension. */
function find(dir: string, ...names: string[]): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir);
  for (const n of names) {
    const hit = files.find((f) => path.parse(f).name.toLowerCase() === n.toLowerCase());
    if (hit) return path.join(dir, hit);
  }
  return null;
}

/** Real box photos ("What you'll receive"). out → reference base names. */
const BOX_PHOTOS: Array<{ out: string; names: string[] }> = [
  { out: 'fried-rice-chicken', names: ['fried-rice-chicken', 'fried-rice-chiken'] },
  { out: 'banku-tilapia', names: ['banku-tilapia'] },
  { out: 'waakye-meat', names: ['waakye-meat'] },
  { out: 'waakye-fish', names: ['waakye-fish', 'waakye'] },
  { out: 'braised-rice', names: ['braised-rice', 'rice'] },
];

async function boxPhotos() {
  for (const p of BOX_PHOTOS) {
    const src = find(SRC, ...p.names);
    if (!src) {
      console.warn(`⚠️  missing box photo for ${p.out}`);
      continue;
    }
    await buildWidths(`${OUT_BOX}/${p.out}`, BOX_WIDTHS, (w, out) =>
      sharp(src)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 74 })
        .toFile(out),
    );
  }
}

/** Plated photos. Sources are 1024px; the 1600 variant is a Lanczos upscale for retina screens. */
async function platedPhotos() {
  if (!existsSync(DISHES)) return console.warn(`⚠️  ${DISHES} not found`);
  for (const file of readdirSync(DISHES).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))) {
    const name = path.parse(file).name;
    const src = path.join(DISHES, file);
    await buildWidths(`${OUT}/${name}`, PLATED_WIDTHS, (w, out) =>
      sharp(src)
        .rotate()
        .resize({ width: w, kernel: 'lanczos3' })
        .webp({ quality: 78 })
        .toFile(out),
    );
  }
}

/** Transparent icons: trimmed to the subject, centred on a square with ~5% padding. */
async function icons() {
  if (!existsSync(ICONS)) return console.warn(`⚠️  ${ICONS} not found`);
  for (const file of readdirSync(ICONS).filter((f) => /^icon-.+\.png$/i.test(f))) {
    const name = path.parse(file).name.replace(/^icon-/, '');
    const outs = [
      `${OUT_ICONS}/${name}-128.webp`,
      `${OUT_ICONS}/${name}-256.webp`,
      `${OUT_ICONS}/${name}-256.png`,
    ];
    const did = await build(outs, async () => {
      const trimmed = await sharp(path.join(ICONS, file))
        .ensureAlpha()
        .trim({ threshold: 1 })
        .toBuffer({ resolveWithObject: true });
      const side = Math.max(trimmed.info.width, trimmed.info.height);
      const canvas = Math.round(side / 0.9); // ~5% padding on each side
      const square = await sharp({
        create: {
          width: canvas,
          height: canvas,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      })
        .composite([{ input: trimmed.data, gravity: 'centre' }])
        .png()
        .toBuffer();
      await sharp(square).resize(128).webp({ quality: 88, alphaQuality: 100 }).toFile(outs[0]);
      await sharp(square).resize(256).webp({ quality: 88, alphaQuality: 100 }).toFile(outs[1]);
      await sharp(square).resize(256).png({ compressionLevel: 9 }).toFile(outs[2]);
    });
    if (did) console.log(`✓ icon ${name}`);
  }
}

async function logo() {
  const src = find(SRC, 'logo');
  if (!src) throw new Error('reference/logo.* is missing');
  const outs = [
    `${OUT}/logo-512.webp`,
    `${OUT}/logo-256.png`,
    `${OUT}/logo-email.png`,
    'public/apple-touch-icon.png',
    'public/favicon-32.png',
    'public/icon-192.png',
    'public/icon-512.png',
  ];
  const badge = await logoBadge(src);
  const did = await build(outs, async () => {
    await sharp(badge).resize(512).webp({ quality: 90 }).toFile(outs[0]);
    await sharp(badge).resize(256).png({ compressionLevel: 9 }).toFile(outs[1]);
    await sharp(badge).resize(240).png({ compressionLevel: 9 }).toFile(outs[2]);
    await sharp(badge).resize(180).png().toFile(outs[3]);
    await sharp(badge).resize(32).png().toFile(outs[4]);
    await sharp(badge).resize(192).png().toFile(outs[5]);
    await sharp(badge).resize(512).png().toFile(outs[6]);
  });
  if (did) console.log('✓ logo + favicons');
  return badge;
}

async function logoBadge(src: string) {
  const meta = await sharp(src).metadata();
  const size = Math.round((meta.width ?? 2048) * 0.66);
  const left = Math.round(((meta.width ?? 2048) - size) / 2) - 10;
  const top = Math.round(((meta.height ?? 2048) - size) / 2) - 20;
  const square = await sharp(src)
    .extract({ left, top, width: size, height: size })
    .png()
    .toBuffer();
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  return sharp(square)
    .composite([{ input: circle, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/** Open Graph 1200×630: logo on the left, the plated fried rice on the right. */
async function ogImage(badge: Buffer) {
  const out = `${OUT}/og-image.jpg`;
  const food = find(DISHES, 'fried-rice-chicken');
  if (!food) return console.warn('⚠️  plated fried-rice-chicken missing; og-image not built');
  const did = await build([out], async () => {
    const foodBuf = await sharp(food)
      .rotate()
      .resize(600, 630, { fit: 'cover', position: 'centre' })
      .toBuffer();
    const kente = Buffer.from(
      `<svg width="1200" height="14"><defs><pattern id="k" width="96" height="14" patternUnits="userSpaceOnUse">
       <rect width="24" height="14" fill="#C81010"/><rect x="24" width="24" height="14" fill="#E1A10C"/>
       <rect x="48" width="24" height="14" fill="#1E6131"/><rect x="72" width="24" height="14" fill="#0B0B0B"/></pattern></defs>
       <rect width="1200" height="14" fill="url(#k)"/></svg>`,
    );
    const composites: OverlayOptions[] = [
      { input: await sharp(badge).resize(460).toBuffer(), left: 70, top: 85 },
      { input: foodBuf, left: 600, top: 0 },
      { input: kente, left: 0, top: 616 },
    ];
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0B0B0B' } })
      .composite(composites)
      .jpeg({ quality: 82 })
      .toFile(out);
  });
  if (did) console.log('✓ og-image');
}

if (!existsSync(SRC)) throw new Error('reference/ folder not found');
await boxPhotos();
await platedPhotos();
await icons();
await ogImage(await logo());
console.log(
  `Done: ${built} file(s) built, ${skipped} already present${FORCE ? '' : ' (use --force to rebuild)'}.`,
);
const manifest = writeManifest();
console.log(`✓ ${MANIFEST_PATH}: ${Object.keys(manifest).length} files hashed`);
