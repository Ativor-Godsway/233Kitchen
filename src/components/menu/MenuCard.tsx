import { motion, useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { formatMoney } from '../../../shared/pricing';
import type { MenuItem } from '../../../shared/types';
import { useUi } from '../../store/ui';
import { useCart } from '../../store/cart';
import { MenuImage } from './MenuImage';
import { cn } from '../../lib/cn';
import { toast } from 'sonner';
import { canQuickAdd } from '../../lib/menu';

export function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const reduce = useReducedMotion();
  const openItem = useUi((s) => s.openItem);
  const add = useCart((s) => s.add);
  const soldOut = !item.isAvailable;

  const quickAdd = () => {
    add({ slug: item.slug, quantity: 1, selections: [], notes: '' });
    toast.success(`${item.name} added to your bag`);
  };

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay: (index % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group flex flex-col overflow-hidden rounded-3xl bg-white text-ink shadow-[0_1px_0_rgba(0,0,0,.04),0_20px_40px_-24px_rgba(0,0,0,.35)] ring-1 ring-ink/5',
        soldOut && 'opacity-80',
      )}
    >
      <button
        type="button"
        onClick={() => !soldOut && openItem(item.slug)}
        className="relative block aspect-[4/3] overflow-hidden text-left"
        aria-label={`Customise ${item.name}`}
        disabled={soldOut}
        tabIndex={-1}
      >
        <MenuImage
          item={item}
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 45vw, 92vw"
          className={cn(
            'h-full w-full transition duration-700 group-hover:scale-[1.04]',
            soldOut && 'grayscale',
          )}
        />
        {soldOut && (
          <span className="absolute left-4 top-4 rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cream">
            Sold out
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl font-semibold leading-tight">{item.name}</h3>
          <p className="shrink-0 font-display text-xl font-semibold text-ghana-red">
            {formatMoney(item.basePrice)}
          </p>
        </div>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink/65">{item.description}</p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => openItem(item.slug)}
            disabled={soldOut}
            className="flex-1 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-cream transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink/30"
          >
            {soldOut ? 'Sold out this week' : 'Customise'}
          </button>
          {!soldOut && canQuickAdd(item) && (
            <button
              type="button"
              onClick={quickAdd}
              className="grid h-12 w-12 place-items-center rounded-full bg-ghana-red text-white transition hover:bg-ghana-red-400"
              aria-label={`Add ${item.name} to bag`}
            >
              <Plus size={20} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export function MenuCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink/5" aria-hidden>
      <div className="aspect-[4/3] animate-pulse bg-ink/10" />
      <div className="space-y-3 p-6">
        <div className="h-5 w-2/3 animate-pulse rounded bg-ink/10" />
        <div className="h-4 w-full animate-pulse rounded bg-ink/10" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-ink/10" />
        <div className="h-11 w-full animate-pulse rounded-full bg-ink/10" />
      </div>
    </div>
  );
}
