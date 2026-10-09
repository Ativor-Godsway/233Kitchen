import { useMemo } from 'react';
import { priceLine, PricingError } from '../../shared/pricing';
import type { MenuItem, PricedLine } from '../../shared/types';
import { useCart, type CartLine } from '../store/cart';
import { useMenu } from './queries';

export interface BagLine {
  line: CartLine;
  item: MenuItem | undefined;
  priced: PricedLine | null;
  problem: string | null;
}

/** Bag lines priced against the current menu (an estimate; the server re-prices on submit). */
export function useBag() {
  const lines = useCart((s) => s.lines);
  const { data: menu, isLoading, isError } = useMenu();
  return useMemo(() => {
    const items: BagLine[] = lines.map((line) => {
      const item = menu?.find((m) => m.slug === line.slug);
      if (!menu) return { line, item, priced: null, problem: null };
      if (!item) return { line, item, priced: null, problem: 'No longer on the menu' };
      try {
        return { line, item, priced: priceLine(item, line), problem: null };
      } catch (e) {
        return {
          line,
          item,
          priced: null,
          problem: e instanceof PricingError ? e.message : 'Unavailable',
        };
      }
    });
    const subtotal = items.reduce((n, b) => n + (b.priced?.lineTotal ?? 0), 0);
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const hasProblems = items.some((b) => b.problem);
    /** The live menu couldn't be loaded, so nothing can be priced or ordered. */
    const menuUnavailable = !menu && isError;
    return { items, subtotal, count, hasProblems, isLoading, menuUnavailable };
  }, [lines, menu, isLoading, isError]);
}
