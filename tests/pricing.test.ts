import { describe, expect, it } from 'vitest';
import { MENU_FALLBACK } from '../shared/menu.seed.js';
import { formatMoney, lineKey, priceLine, priceOrder, PricingError } from '../shared/pricing.js';
import type { LineInput, MenuItem } from '../shared/types.js';

const menu: MenuItem[] = structuredClone(MENU_FALLBACK);
const item = (slug: string) => menu.find((m) => m.slug === slug)!;

function expectPricingError(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PricingError);
    expect((e as PricingError).code).toBe(code);
    return;
  }
  throw new Error(`Expected PricingError ${code}`);
}

describe('priceLine', () => {
  it('prices a plain item at its base price', () => {
    const l = priceLine(item('loaded-fried-rice-chicken'), {
      slug: 'loaded-fried-rice-chicken',
      quantity: 1,
      selections: [],
    });
    expect(l.unitTotal).toBe(2000);
    expect(l.lineTotal).toBe(2000);
  });

  it('adds quantity extras and multiplies by line quantity', () => {
    const l = priceLine(item('loaded-fried-rice-chicken'), {
      slug: 'loaded-fried-rice-chicken',
      quantity: 2,
      selections: [
        { groupKey: 'extras', optionKey: 'extra-chicken', qty: 1 }, // $10
        { groupKey: 'extras', optionKey: 'extra-plantain', qty: 2 }, // 2 × $3
        { groupKey: 'extras', optionKey: 'extra-sauce', qty: 0 }, // ignored
      ],
    });
    expect(l.unitTotal).toBe(2000 + 1000 + 600);
    expect(l.lineTotal).toBe(3600 * 2);
    expect(l.selections.map((s) => s.optionKey)).toEqual(['extra-chicken', 'extra-plantain']);
  });

  it('prices banku extras correctly', () => {
    const l = priceLine(item('banku-grilled-tilapia'), {
      slug: 'banku-grilled-tilapia',
      quantity: 1,
      selections: [
        { groupKey: 'extras', optionKey: 'extra-banku', qty: 1 },
        { groupKey: 'extras', optionKey: 'extra-tilapia', qty: 1 },
        { groupKey: 'extras', optionKey: 'extra-red-sauce', qty: 1 },
        { groupKey: 'extras', optionKey: 'extra-shito', qty: 1 },
      ],
    });
    expect(l.unitTotal).toBe(2500 + 500 + 1500 + 200 + 200);
  });

  it('rejects extras above the per-option max of 5', () => {
    expectPricingError(
      () =>
        priceLine(item('loaded-hajia-waakye'), {
          slug: 'loaded-hajia-waakye',
          quantity: 1,
          selections: [{ groupKey: 'extras', optionKey: 'extra-eggs', qty: 6 }],
        }),
      'INVALID_QUANTITY',
    );
  });

  it('requires an Ice Kenkey flavour', () => {
    expectPricingError(
      () => priceLine(item('ice-kenkey'), { slug: 'ice-kenkey', quantity: 1, selections: [] }),
      'REQUIRED_OPTION',
    );
  });

  it('allows only one Ice Kenkey flavour', () => {
    expectPricingError(
      () =>
        priceLine(item('ice-kenkey'), {
          slug: 'ice-kenkey',
          quantity: 1,
          selections: [
            { groupKey: 'flavour', optionKey: 'oreo', qty: 1 },
            { groupKey: 'flavour', optionKey: 'caramel', qty: 1 },
          ],
        }),
      'TOO_MANY_OPTIONS',
    );
  });

  it('adds nuts to Ice Kenkey for free', () => {
    const l = priceLine(item('ice-kenkey'), {
      slug: 'ice-kenkey',
      quantity: 3,
      selections: [
        { groupKey: 'flavour', optionKey: 'caramel', qty: 1 },
        { groupKey: 'nuts', optionKey: 'with-nuts', qty: 1 },
      ],
    });
    expect(l.unitTotal).toBe(500);
    expect(l.lineTotal).toBe(1500);
    expect(l.selections.map((s) => s.name)).toEqual(['Caramel', 'With nuts']);
  });

  it('ignores tampered client prices and uses the menu', () => {
    const tampered = {
      slug: 'banku-grilled-tilapia',
      quantity: 1,
      price: 1,
      unitTotal: 1,
      lineTotal: 1,
      selections: [
        { groupKey: 'extras', optionKey: 'extra-tilapia', qty: 1, unitPrice: 0, price: 0 },
      ],
    } as unknown as LineInput;
    const order = priceOrder(menu, [tampered]);
    expect(order.total).toBe(4000);
  });

  it('rejects unknown options and sold-out items/options', () => {
    expectPricingError(
      () =>
        priceLine(item('ice-kenkey'), {
          slug: 'ice-kenkey',
          quantity: 1,
          selections: [{ groupKey: 'flavour', optionKey: 'chocolate', qty: 1 }],
        }),
      'OPTION_NOT_FOUND',
    );
    const soldOut = { ...item('ice-kenkey'), isAvailable: false };
    expectPricingError(
      () =>
        priceLine(soldOut, {
          slug: 'ice-kenkey',
          quantity: 1,
          selections: [{ groupKey: 'flavour', optionKey: 'oreo', qty: 1 }],
        }),
      'ITEM_UNAVAILABLE',
    );
    const noOreo = structuredClone(item('ice-kenkey'));
    noOreo.optionGroups[0].options[0].isAvailable = false;
    expectPricingError(
      () =>
        priceLine(noOreo, {
          slug: 'ice-kenkey',
          quantity: 1,
          selections: [{ groupKey: 'flavour', optionKey: 'oreo', qty: 1 }],
        }),
      'OPTION_UNAVAILABLE',
    );
  });

  it('rejects invalid line quantities and duplicate options', () => {
    expectPricingError(
      () =>
        priceLine(item('loaded-hajia-waakye'), {
          slug: 'loaded-hajia-waakye',
          quantity: 0,
          selections: [],
        }),
      'INVALID_QUANTITY',
    );
    expectPricingError(
      () =>
        priceLine(item('loaded-hajia-waakye'), {
          slug: 'loaded-hajia-waakye',
          quantity: 1.5,
          selections: [],
        }),
      'INVALID_QUANTITY',
    );
    expectPricingError(
      () =>
        priceLine(item('loaded-hajia-waakye'), {
          slug: 'loaded-hajia-waakye',
          quantity: 1,
          selections: [
            { groupKey: 'extras', optionKey: 'extra-eggs', qty: 1 },
            { groupKey: 'extras', optionKey: 'extra-eggs', qty: 1 },
          ],
        }),
      'DUPLICATE_OPTION',
    );
  });

  it('rejects items that are not on the menu', () => {
    expectPricingError(
      () => priceOrder(menu, [{ slug: 'jollof', quantity: 1, selections: [] }]),
      'ITEM_NOT_FOUND',
    );
  });

  it('sums multiple lines', () => {
    const o = priceOrder(menu, [
      { slug: 'loaded-fried-rice-chicken', quantity: 1, selections: [] },
      {
        slug: 'ice-kenkey',
        quantity: 2,
        selections: [{ groupKey: 'flavour', optionKey: 'oreo', qty: 1 }],
      },
    ]);
    expect(o.subtotal).toBe(3000);
    expect(o.total).toBe(3000);
  });
});

describe('helpers', () => {
  it('lineKey ignores selection order and zero quantities', () => {
    const a = lineKey({
      slug: 'x',
      selections: [
        { groupKey: 'g', optionKey: 'a', qty: 1 },
        { groupKey: 'g', optionKey: 'b', qty: 2 },
        { groupKey: 'g', optionKey: 'c', qty: 0 },
      ],
    });
    const b = lineKey({
      slug: 'x',
      selections: [
        { groupKey: 'g', optionKey: 'b', qty: 2 },
        { groupKey: 'g', optionKey: 'a', qty: 1 },
      ],
    });
    expect(a).toBe(b);
    expect(lineKey({ slug: 'x', selections: [], notes: 'no pepper' })).not.toBe(
      lineKey({ slug: 'x', selections: [] }),
    );
  });

  it('formats money', () => {
    expect(formatMoney(4700)).toBe('$47');
    expect(formatMoney(4750)).toBe('$47.50');
  });
});
