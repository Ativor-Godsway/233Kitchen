/**
 * Gallery photos ("Real boxes, real portions."), loaded automatically from
 * src/assets/gallery/. To add a photo, drop a .jpg / .jpeg / .png / .webp file in that
 * folder; nothing else is required. Vite (vite-imagetools) creates the 480/960/1600px WebP
 * versions automatically in dev and at build time.
 *
 * - Order: files are shown in filename order, so prefix them: 06-jollof.jpg, 07-kelewele.jpg…
 * - Caption / alt text: taken from the filename ("06-jollof-rice.jpg" → "Jollof rice"),
 *   or set them explicitly in GALLERY_TEXT below (recommended for good alt text).
 */

/** Optional text per file (key = filename without number prefix and extension). */
const GALLERY_TEXT: Record<string, { caption?: string; alt?: string }> = {
  'loaded-fried-rice': {
    caption: 'Loaded fried rice',
    alt: 'Fried rice with a grilled chicken quarter, fried plantain, coleslaw and shito',
  },
  'banku-grilled-tilapia': {
    caption: 'Banku & grilled tilapia',
    alt: 'Grilled tilapia topped with peppers and red cabbage, with pepper sauce and shito',
  },
  'hajia-waakye': {
    caption: 'Hajia waakye',
    alt: 'Waakye with red stew, gari, boiled eggs, fried plantain, coleslaw and shito',
  },
  'waakye-with-fish': {
    caption: 'Waakye with fish',
    alt: 'Waakye with talia, stew, gari, egg, fried plantain and fried fish',
  },
  'rice-platter': {
    caption: 'From our kitchen',
    alt: 'Rice platter with omelette, sausages, fried plantain and pepper sauce',
  },
};

// Responsive WebP srcset + a 960px WebP fallback for every file in the folder.
const srcSets = import.meta.glob<string>(
  '../assets/gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  {
    eager: true,
    import: 'default',
    query: '?w=480;960;1600&format=webp&quality=74&withoutEnlargement&as=srcset',
  },
);
const fallbacks = import.meta.glob<string>(
  '../assets/gallery/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}',
  {
    eager: true,
    import: 'default',
    query: '?w=960&format=webp&quality=74&withoutEnlargement',
  },
);

export interface GalleryPhoto {
  key: string;
  src: string;
  srcSet: string;
  caption: string;
  alt: string;
}

/** "06-jollof_rice" → key "jollof_rice", label "Jollof rice" */
function fromFilename(path: string) {
  const base = path
    .split('/')
    .pop()!
    .replace(/\.[^.]+$/, '');
  const key = base.replace(/^\d+[-_ ]*/, '');
  const words = key.replace(/[-_]+/g, ' ').trim();
  return { key, label: words.charAt(0).toUpperCase() + words.slice(1) };
}

export const GALLERY: GalleryPhoto[] = Object.keys(fallbacks)
  .sort()
  .map((path) => {
    const { key, label } = fromFilename(path);
    const text = GALLERY_TEXT[key] ?? {};
    return {
      key: path,
      src: fallbacks[path],
      srcSet: srcSets[path],
      caption: text.caption ?? label,
      alt: text.alt ?? text.caption ?? label,
    };
  });
