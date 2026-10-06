/**
 * npm run images — converts ./reference photos into optimised WebP (480/960/1600w)
 * in public/images, and builds the logo badge, favicons and Open Graph image.
 */
import sharp, { type OverlayOptions } from 'sharp';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'reference';
const OUT = 'public/images';
mkdirSync(OUT, { recursive: true });

/** Finds a reference file by any of the given base names, regardless of extension. */
function find(...names: string[]): string | null {
  const files = readdirSync(SRC);
  for (const n of names) {
    const hit = files.find((f) => path.parse(f).name.toLowerCase() === n.toLowerCase());
    if (hit) return path.join(SRC, hit);
  }
  return null;
}

const PHOTOS: Array<{ out: string; names: string[] }> = [
  { out: 'fried-rice-chicken', names: ['fried-rice-chicken', 'fried-rice-chiken'] },
  { out: 'banku-tilapia', names: ['banku-tilapia'] },
  { out: 'waakye-meat', names: ['waakye-meat'] },
  { out: 'waakye-fish', names: ['waakye-fish', 'waakye'] },
  { out: 'rice-platter', names: ['rice'] },
];

const WIDTHS = [480, 960, 1600];

async function photos() {
  for (const p of PHOTOS) {
    const src = find(...p.names);
    if (!src) {
      console.warn(`⚠️  missing photo for ${p.out}`);
      continue;
    }
    for (const w of WIDTHS) {
      await sharp(src)
        .rotate()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 74 })
        .toFile(`${OUT}/${p.out}-${w}.webp`);
    }
    console.log(`✓ ${p.out}`);
  }
}

async function logo() {
  const src = find('logo');
  if (!src) throw new Error('reference/logo.* is missing');
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
  const badge = await sharp(square)
    .composite([{ input: circle, blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp(badge).resize(512).webp({ quality: 90 }).toFile(`${OUT}/logo-512.webp`);
  await sharp(badge).resize(256).png({ compressionLevel: 9 }).toFile(`${OUT}/logo-256.png`);
  await sharp(badge).resize(240).png({ compressionLevel: 9 }).toFile(`${OUT}/logo-email.png`);
  await sharp(badge).resize(180).png().toFile('public/apple-touch-icon.png');
  await sharp(badge).resize(32).png().toFile('public/favicon-32.png');
  await sharp(badge).resize(192).png().toFile('public/icon-192.png');
  await sharp(badge).resize(512).png().toFile('public/icon-512.png');
  console.log('✓ logo + favicons');

  // Open Graph 1200×630: logo on the left, food on the right.
  const food = find('fried-rice-chicken', 'fried-rice-chiken');
  const foodBuf = food
    ? await sharp(food).rotate().resize(600, 630, { fit: 'cover', position: 'centre' }).toBuffer()
    : null;
  const kente = Buffer.from(
    `<svg width="1200" height="14"><defs><pattern id="k" width="96" height="14" patternUnits="userSpaceOnUse">
     <rect width="24" height="14" fill="#C81010"/><rect x="24" width="24" height="14" fill="#E1A10C"/>
     <rect x="48" width="24" height="14" fill="#1E6131"/><rect x="72" width="24" height="14" fill="#0B0B0B"/></pattern></defs>
     <rect width="1200" height="14" fill="url(#k)"/></svg>`,
  );
  const composites: OverlayOptions[] = [
    { input: await sharp(badge).resize(460).toBuffer(), left: 70, top: 85 },
  ];
  if (foodBuf) composites.push({ input: foodBuf, left: 600, top: 0 });
  composites.push({ input: kente, left: 0, top: 616 });
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0B0B0B' } })
    .composite(composites)
    .jpeg({ quality: 82 })
    .toFile(`${OUT}/og-image.jpg`);
  console.log('✓ og-image');
}

if (!existsSync(SRC)) throw new Error('reference/ folder not found');
await photos();
await logo();
