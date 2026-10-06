import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { lineKey, MAX_LINE_QUANTITY } from '../../shared/pricing.js';
import type { SelectionInput } from '../../shared/types.js';

export interface CartLine {
  key: string;
  slug: string;
  quantity: number;
  selections: SelectionInput[];
  notes: string;
}

interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'key'>) => void;
  /** Replace an existing line (editing). Merges if the new config matches another line. */
  replace: (oldKey: string, line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const clampQty = (n: number) => Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.round(n)));

function normalize(line: Omit<CartLine, 'key'>): CartLine {
  const selections = line.selections.filter((s) => s.qty > 0);
  const notes = line.notes.trim();
  return {
    ...line,
    selections,
    notes,
    quantity: clampQty(line.quantity),
    key: lineKey({ slug: line.slug, selections, notes }),
  };
}

function merge(lines: CartLine[], next: CartLine): CartLine[] {
  const existing = lines.find((l) => l.key === next.key);
  if (!existing) return [...lines, next];
  return lines.map((l) =>
    l.key === next.key ? { ...l, quantity: clampQty(l.quantity + next.quantity) } : l,
  );
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) => set((s) => ({ lines: merge(s.lines, normalize(line)) })),
      replace: (oldKey, line) =>
        set((s) => {
          const next = normalize(line);
          const idx = s.lines.findIndex((l) => l.key === oldKey);
          const without = s.lines.filter((l) => l.key !== oldKey);
          if (without.some((l) => l.key === next.key) || idx === -1)
            return { lines: merge(without, next) };
          const lines = [...without];
          lines.splice(idx, 0, next);
          return { lines };
        }),
      setQuantity: (key, quantity) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.key === key ? { ...l, quantity: clampQty(quantity) } : l)),
        })),
      remove: (key) => set((s) => ({ lines: s.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'k233-bag', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);

export const selectCount = (s: CartState) => s.lines.reduce((n, l) => n + l.quantity, 0);
