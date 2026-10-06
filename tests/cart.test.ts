import { beforeEach, describe, expect, it } from 'vitest';

// Minimal localStorage for the persisted Zustand store.
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => void mem.set(k, String(v)),
  removeItem: (k) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};

const { useCart } = await import('../src/store/cart.js');

const kenkey = (flavour: string, nuts = false) => ({
  slug: 'ice-kenkey',
  quantity: 1,
  notes: '',
  selections: [
    { groupKey: 'flavour', optionKey: flavour, qty: 1 },
    ...(nuts ? [{ groupKey: 'nuts', optionKey: 'with-nuts', qty: 1 }] : []),
  ],
});

beforeEach(() => useCart.getState().clear());

describe('bag store', () => {
  it('merges identical configurations into one line', () => {
    useCart.getState().add(kenkey('oreo'));
    useCart.getState().add({ ...kenkey('oreo'), quantity: 2 });
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].quantity).toBe(3);
  });

  it('keeps different configurations and notes separate', () => {
    useCart.getState().add(kenkey('oreo'));
    useCart.getState().add(kenkey('oreo', true));
    useCart.getState().add({ ...kenkey('oreo'), notes: 'extra cold' });
    expect(useCart.getState().lines).toHaveLength(3);
  });

  it('ignores zero-quantity extras when merging', () => {
    const base = { slug: 'loaded-hajia-waakye', quantity: 1, notes: '', selections: [] };
    useCart.getState().add(base);
    useCart
      .getState()
      .add({ ...base, selections: [{ groupKey: 'extras', optionKey: 'extra-eggs', qty: 0 }] });
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].quantity).toBe(2);
  });

  it('editing a line into an existing configuration merges them', () => {
    useCart.getState().add(kenkey('oreo'));
    useCart.getState().add(kenkey('caramel'));
    const caramelKey = useCart.getState().lines[1].key;
    useCart.getState().replace(caramelKey, kenkey('oreo'));
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0].quantity).toBe(2);
  });

  it('clamps quantities and removes lines', () => {
    useCart.getState().add({ ...kenkey('vanilla'), quantity: 50 });
    const key = useCart.getState().lines[0].key;
    expect(useCart.getState().lines[0].quantity).toBe(20);
    useCart.getState().setQuantity(key, 0);
    expect(useCart.getState().lines[0].quantity).toBe(1);
    useCart.getState().remove(key);
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it('persists to localStorage', () => {
    useCart.getState().add(kenkey('strawberry'));
    expect(mem.get('k233-bag')).toContain('strawberry');
  });
});
