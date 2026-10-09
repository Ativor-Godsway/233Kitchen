import type { MenuItem, OptionGroup } from './types.js';

export type MenuSeedItem = Omit<MenuItem, 'id'>;

/** Builds a 0–5 stepper group for paid extras. */
function extras(options: Array<[key: string, name: string, priceCents: number]>): OptionGroup {
  return {
    key: 'extras',
    name: 'Extras',
    type: 'quantity',
    required: false,
    min: 0,
    max: 5,
    options: options.map(([key, name, price]) => ({ key, name, price, isAvailable: true })),
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
    isAvailable: true,
    sortOrder: 1,
    optionGroups: [
      extras([
        ['extra-sauce', 'Extra sauce (shito)', 200],
        ['extra-coleslaw', 'Extra coleslaw', 200],
        ['extra-chicken', 'Extra chicken', 1000],
        ['extra-plantain', 'Extra plantain', 300],
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
    isAvailable: true,
    sortOrder: 2,
    optionGroups: [
      extras([
        ['extra-banku', 'Extra banku', 500],
        ['extra-tilapia', 'Extra tilapia', 1500],
        ['extra-red-sauce', 'Extra red sauce', 200],
        ['extra-shito', 'Extra sauce (shito)', 200],
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
    image: '/images/waakye-meat-960.webp',
    isAvailable: true,
    sortOrder: 3,
    optionGroups: [
      extras([
        ['extra-eggs', 'Extra eggs', 200],
        ['extra-sauce', 'Extra sauce (shito)', 200],
        ['extra-fish', 'Extra fish', 800],
        ['extra-plantain', 'Extra plantain', 300],
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
    image: null,
    isAvailable: true,
    sortOrder: 4,
    optionGroups: [
      {
        key: 'flavour',
        name: 'Flavour',
        type: 'single',
        required: true,
        min: 1,
        max: 1,
        options: [
          { key: 'oreo', name: 'Oreo Delight', price: 0, isAvailable: true },
          { key: 'caramel', name: 'Caramel', price: 0, isAvailable: true },
          { key: 'strawberry', name: 'Strawberry', price: 0, isAvailable: true },
          { key: 'vanilla', name: 'Vanilla / Regular', price: 0, isAvailable: true },
        ],
      },
      {
        key: 'nuts',
        name: 'Toppings',
        type: 'multi',
        required: false,
        min: 0,
        max: 1,
        options: [{ key: 'with-nuts', name: 'With nuts', price: 0, isAvailable: true }],
      },
    ],
  },
];

export const CATEGORY_LABELS: Record<MenuItem['category'], string> = {
  mains: 'Mains',
  'desserts-drinks': 'Desserts & Drinks',
};

/** Offline/mock menu for the client when the API is unreachable. */
export const MENU_FALLBACK: MenuItem[] = MENU_SEED.map((m) => ({ ...m, id: m.slug }));
