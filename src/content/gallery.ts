import { srcSetFor } from '../lib/images';

/**
 * Gallery photos (the plated dish photos in public/images, built by `npm run images` from
 * reference/ai/dishes/). The real box photos are shown per dish under "What you'll receive".
 * To add a photo: put <name>-480/960/1600.webp in public/images and list it here.
 */
export interface GalleryPhoto {
  key: string;
  src: string;
  srcSet: string | undefined;
  caption: string;
  alt: string;
}

const PHOTOS: Array<Omit<GalleryPhoto, 'srcSet'>> = [
  {
    key: 'fried-rice-chicken',
    src: '/images/fried-rice-chicken-960.webp',
    caption: 'Loaded fried rice',
    alt: 'Fried rice with a grilled chicken quarter, fried plantain, coleslaw and shito',
  },
  {
    key: 'banku-tilapia',
    src: '/images/banku-tilapia-960.webp',
    caption: 'Banku & grilled tilapia',
    alt: 'Grilled tilapia topped with peppers and red cabbage, with banku, pepper sauce and shito',
  },
  {
    key: 'waakye-fish',
    src: '/images/waakye-fish-960.webp',
    caption: 'Hajia waakye',
    alt: 'Waakye with spaghetti, gari, boiled egg, fried fish, stew and shito',
  },
  {
    key: 'braised-rice',
    src: '/images/braised-rice-960.webp',
    caption: 'Braised rice plate',
    alt: 'Braised rice with fried plantain, omelette, sausage, gizzards, corned beef and sardines',
  },
  {
    key: 'ice-kenkey',
    src: '/images/ice-kenkey-960.webp',
    caption: 'Ice kenkey',
    alt: 'Bottles of chilled ice kenkey',
  },
];

export const GALLERY: GalleryPhoto[] = PHOTOS.map((p) => ({ ...p, srcSet: srcSetFor(p.src) }));
