import type { MenuItem, OptionGroup } from './types.js';
import type { ExtraIcon } from './icons.js';

export type MenuSeedItem = Omit<MenuItem, 'id'>;

/** Builds a 0–5 stepper group for paid extras. */
function extras(
  options: Array<[key: string, name: string, priceCents: number, icon: ExtraIcon]>,
): OptionGroup {
  return {
    key: 'extras',
    name: 'Extras',
    type: 'quantity',
    required: false,
    min: 0,
    max: 5,
    options: options.map(([key, name, price, icon]) => ({
      key,
      name,
      price,
      isAvailable: true,
      icon,
    })),
  };
}

/**
 * The launch menu. Prices are in cents and come from the owner's spec
 * (they differ from the older flyer — see OPEN_QUESTIONS.md).
 * Descriptions are drafts awaiting owner approval.
 */
export const MENU_SEED: MenuSeedItem[] = [
  {
    name: 'Loaded Fried Rice with Chicken',
    slug: 'loaded-fried-rice-chicken',
    description:
      'Wok-tossed Ghanaian fried rice packed with veg and spring onion, with a juicy grilled chicken quarter, caramelised fried plantain, creamy coleslaw and our house shito.',
    category: 'mains',
    basePrice: 2000,
    image: '/images/fried-rice-chicken-960.webp',
    boxImages: ['/images/box/fried-rice-chicken-480.webp'],
    isAvailable: true,
    sortOrder: 1,
    optionGroups: [
      extras([
        ['extra-sauce', 'Extra sauce (shito)', 200, 'shito'],
        ['extra-coleslaw', 'Extra coleslaw', 200, 'coleslaw'],
        ['extra-chicken', 'Extra chicken', 1000, 'chicken'],
        ['extra-plantain', 'Extra plantain', 300, 'plantain'],
      ]),
    ],
  },
  {
    name: 'Banku with Grilled Tilapia',
    slug: 'banku-grilled-tilapia',
    description:
      'A whole tilapia grilled until smoky and crisp-edged, piled with sautéed peppers, onion and red cabbage. Served with soft, tangy banku, fresh red pepper sauce and shito.',
    category: 'mains',
    basePrice: 2500,
    image: '/images/banku-tilapia-960.webp',
    boxImages: ['/images/box/banku-tilapia-480.webp'],
    isAvailable: true,
    sortOrder: 2,
    optionGroups: [
      extras([
        ['extra-banku', 'Extra banku', 500, 'banku'],
        ['extra-tilapia', 'Extra tilapia', 1500, 'tilapia'],
        ['extra-red-sauce', 'Extra red sauce', 200, 'red-sauce'],
        ['extra-shito', 'Extra sauce (shito)', 200, 'shito'],
      ]),
    ],
  },
  {
    name: 'Loaded Hajia Waakye',
    slug: 'loaded-hajia-waakye',
    description:
      'Hajia-style waakye (rice and beans slow-cooked the proper way) with rich red stew, gari, boiled eggs, spaghetti, sweet fried plantain, coleslaw and a hit of shito.',
    category: 'mains',
    basePrice: 2000,
    image: '/images/waakye-fish-960.webp',
    boxImages: ['/images/box/waakye-fish-480.webp', '/images/box/waakye-meat-480.webp'],
    isAvailable: true,
    sortOrder: 3,
    optionGroups: [
      extras([
        ['extra-eggs', 'Extra eggs', 200, 'eggs'],
        ['extra-sauce', 'Extra sauce (shito)', 200, 'shito'],
        ['extra-fish', 'Extra fish', 800, 'fish'],
        ['extra-plantain', 'Extra plantain', 300, 'plantain'],
      ]),
    ],
  },
  {
    name: 'Braised Rice Plate',
    slug: 'braised-rice-plate',
    description:
      'A hearty favourite featuring fragrant braised rice, golden fried plantain, omelette, sausage, tender gizzards, corned beef and sardines, finished with sliced onions and spring onions, with pepper sauce on the side for an extra kick.',
    category: 'mains',
    basePrice: 2000,
    image: '/images/braised-rice-960.webp',
    boxImages: ['/images/box/braised-rice-480.webp'],
    isAvailable: true,
    sortOrder: 4,
    optionGroups: [
      extras([
        ['extra-sauce', 'Extra sauce', 200, 'red-sauce'],
        ['extra-plantain', 'Extra plantain', 300, 'plantain'],
        ['extra-fried-eggs', 'Extra fried eggs', 300, 'omelette'],
      ]),
    ],
  },
  {
    name: 'Ice Kenkey',
    slug: 'ice-kenkey',
    description:
      'Ghana’s favourite cool-down: fermented corn kenkey blended with chilled milk and a touch of sweetness. Pick your flavour and add nuts for crunch.',
    category: 'desserts-drinks',
    basePrice: 500,
    image: '/images/ice-kenkey-960.webp',
    boxImages: [],
    isAvailable: true,
    sortOrder: 5,
    optionGroups: [
      {
        key: 'flavour',
        name: 'Flavour',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        options: [
          { key: 'oreo', name: 'Oreo Delight', price: 0, isAvailable: true, icon: 'kenkey-oreo' },
          { key: 'caramel', name: 'Caramel', price: 0, isAvailable: true, icon: 'kenkey-caramel' },
          {
            key: 'strawberry',
            name: 'Strawberry',
            price: 0,
            isAvailable: true,
            icon: 'kenkey-strawberry',
          },
          {
            key: 'vanilla',
            name: 'Vanilla / Regular',
            price: 0,
            isAvailable: true,
            icon: 'kenkey-vanilla',
          },
        ],
      },
      {
        key: 'nuts',
        name: 'Toppings',
        type: 'multi',
        required: false,
        min: 0,
        max: 1,
        options: [
          { key: 'with-nuts', name: 'With nuts', price: 0, isAvailable: true, icon: 'nuts' },
        ],
      },
    ],
  },
];

export const CATEGORY_LABELS: Record<MenuItem['category'], string> = {
  mains: 'Mains',
  'desserts-drinks': 'Desserts & Drinks',
};
