import type {
  LineInput,
  MenuItem,
  OptionGroup,
  PricedLine,
  PricedSelection,
  SelectionInput,
} from './types.js';

export const MAX_LINE_QUANTITY = 20;
export const MAX_NOTES_LENGTH = 300;

export class PricingError extends Error {
  constructor(
    public code:
      | 'ITEM_NOT_FOUND'
      | 'ITEM_UNAVAILABLE'
      | 'OPTION_NOT_FOUND'
      | 'OPTION_UNAVAILABLE'
      | 'INVALID_QUANTITY'
      | 'REQUIRED_OPTION'
      | 'TOO_MANY_OPTIONS'
      | 'DUPLICATE_OPTION',
    message: string,
    public slug?: string,
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

function validateGroup(item: MenuItem, group: OptionGroup, chosen: SelectionInput[]): void {
  const where = `${item.name} – ${group.name}`;
  if (group.type === 'quantity') {
    for (const s of chosen) {
      if (!isInt(s.qty) || s.qty < 0 || s.qty > group.max) {
        throw new PricingError(
          'INVALID_QUANTITY',
          `${where}: quantity must be 0–${group.max}`,
          item.slug,
        );
      }
    }
    const total = chosen.reduce((n, s) => n + s.qty, 0);
    if (group.required && total < Math.max(1, group.min)) {
      throw new PricingError(
        'REQUIRED_OPTION',
        `${where}: please choose at least ${Math.max(1, group.min)}`,
        item.slug,
      );
    }
    return;
  }

  // single / multi: each chosen option counts once
  for (const s of chosen) {
    if (s.qty !== 1)
      throw new PricingError('INVALID_QUANTITY', `${where}: invalid selection`, item.slug);
  }
  const max = group.type === 'single' ? 1 : group.max;
  const min = group.required ? Math.max(1, group.min) : group.min;
  if (chosen.length > max) {
    throw new PricingError('TOO_MANY_OPTIONS', `${where}: choose at most ${max}`, item.slug);
  }
  if (chosen.length < min) {
    throw new PricingError(
      'REQUIRED_OPTION',
      group.type === 'single' ? `${where}: please choose one` : `${where}: choose at least ${min}`,
      item.slug,
    );
  }
}

/**
 * Prices one bag line against the authoritative menu item.
 * The client never sends prices; anything extra in the input is ignored.
 * Throws PricingError for anything invalid or unavailable.
 */
export function priceLine(item: MenuItem, input: LineInput): PricedLine {
  if (!item.isAvailable) {
    throw new PricingError('ITEM_UNAVAILABLE', `${item.name} is sold out`, item.slug);
  }
  if (!isInt(input.quantity) || input.quantity < 1 || input.quantity > MAX_LINE_QUANTITY) {
    throw new PricingError(
      'INVALID_QUANTITY',
      `Quantity must be 1–${MAX_LINE_QUANTITY}`,
      item.slug,
    );
  }

  const seen = new Set<string>();
  const byGroup = new Map<string, SelectionInput[]>();
  for (const s of input.selections ?? []) {
    const id = `${s.groupKey}:${s.optionKey}`;
    if (seen.has(id))
      throw new PricingError('DUPLICATE_OPTION', `Duplicate option ${s.optionKey}`, item.slug);
    seen.add(id);
    const group = item.optionGroups.find((g) => g.key === s.groupKey);
    const option = group?.options.find((o) => o.key === s.optionKey);
    if (!group || !option) {
      throw new PricingError('OPTION_NOT_FOUND', `Unknown option for ${item.name}`, item.slug);
    }
    const list = byGroup.get(group.key) ?? [];
    list.push(s);
    byGroup.set(group.key, list);
  }

  const selections: PricedSelection[] = [];
  for (const group of item.optionGroups) {
    const chosen = byGroup.get(group.key) ?? [];
    validateGroup(item, group, chosen);
    for (const s of chosen) {
      if (s.qty === 0) continue;
      const option = group.options.find((o) => o.key === s.optionKey)!;
      if (!option.isAvailable) {
        throw new PricingError('OPTION_UNAVAILABLE', `${option.name} is sold out`, item.slug);
      }
      selections.push({
        groupKey: group.key,
        groupName: group.name,
        optionKey: option.key,
        name: option.name,
        qty: s.qty,
        unitPrice: option.price,
        ...(option.icon ? { icon: option.icon } : {}),
      });
    }
  }

  const unitTotal = item.basePrice + selections.reduce((sum, s) => sum + s.unitPrice * s.qty, 0);
  return {
    menuItemId: item.id,
    slug: item.slug,
    name: item.name,
    unitBase: item.basePrice,
    selections,
    quantity: input.quantity,
    notes: (input.notes ?? '').trim().slice(0, MAX_NOTES_LENGTH),
    unitTotal,
    lineTotal: unitTotal * input.quantity,
  };
}

export interface PricedOrder {
  lines: PricedLine[];
  subtotal: number;
  total: number;
}

/** Prices a whole bag. `menu` must come from the database on the server. */
export function priceOrder(menu: MenuItem[], lines: LineInput[]): PricedOrder {
  const bySlug = new Map(menu.map((m) => [m.slug, m]));
  const priced = lines.map((line) => {
    const item = bySlug.get(line.slug);
    if (!item)
      throw new PricingError(
        'ITEM_NOT_FOUND',
        'An item in your bag is no longer on the menu',
        line.slug,
      );
    return priceLine(item, line);
  });
  const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0);
  return { lines: priced, subtotal, total: subtotal };
}

/**
 * Stable identity for a configured line: identical configurations merge into
 * one bag line. Zero-quantity extras are ignored.
 */
export function lineKey(input: Pick<LineInput, 'slug' | 'selections' | 'notes'>): string {
  const sel = input.selections
    .filter((s) => s.qty > 0)
    .map((s) => `${s.groupKey}.${s.optionKey}x${s.qty}`)
    .sort()
    .join(',');
  return `${input.slug}|${sel}|${(input.notes ?? '').trim().toLowerCase()}`;
}

/** "$47" for whole dollars, "$47.50" otherwise. */
export function formatMoney(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Human summary of a line's selections, e.g. "Caramel · With nuts · 2× Extra plantain". */
export function describeSelections(selections: Pick<PricedSelection, 'name' | 'qty'>[]): string {
  return selections.map((s) => (s.qty > 1 ? `${s.qty}× ${s.name}` : s.name)).join(' · ');
}
