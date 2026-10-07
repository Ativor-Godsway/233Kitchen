import { useMemo, useState } from 'react';
import { CATEGORY_LABELS } from '../../../shared/menu.seed';
import type { MenuItem } from '../../../shared/types';
import { useMenu } from '../../lib/queries';
import { MenuCard, MenuCardSkeleton } from '../menu/MenuCard';
import { SectionHeading } from './SectionHeading';
import { cn } from '../../lib/cn';
import { CutoffNotice } from './CutoffNotice';

type Filter = 'all' | MenuItem['category'];

export function MenuSection() {
  const { data: menu, isLoading, isError, refetch } = useMenu();
  const [filter, setFilter] = useState<Filter>('all');

  const groups = useMemo(() => {
    const items = menu ?? [];
    const cats = (Object.keys(CATEGORY_LABELS) as MenuItem['category'][]).filter(
      (c) => filter === 'all' || c === filter,
    );
    return cats
      .map((c) => ({
        category: c,
        label: CATEGORY_LABELS[c],
        items: items.filter((i) => i.category === c),
      }))
      .filter((g) => g.items.length);
  }, [menu, filter]);

  const chips: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'All' },
    ...(Object.entries(CATEGORY_LABELS) as Array<[MenuItem['category'], string]>).map(
      ([id, label]) => ({ id, label }),
    ),
  ];

  return (
    <section id="menu" className="scroll-mt-16 bg-cream py-24 text-ink sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeading
            tone="light"
            eyebrow="This week’s menu"
            title="Made to order, boxed with care."
          />
          <CutoffNotice tone="light" />
        </div>

        <div
          className="sticky top-16 z-20 -mx-4 mt-10 bg-cream/90 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0"
          role="tablist"
          aria-label="Menu categories"
        >
          <div className="flex gap-2 overflow-x-auto">
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={filter === c.id}
                onClick={() => setFilter(c.id)}
                className={cn(
                  'shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition',
                  filter === c.id
                    ? 'bg-ink text-cream'
                    : 'bg-white text-ink ring-1 ring-ink/10 hover:ring-ink/30',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {isError && (
          <div className="mt-10 rounded-2xl bg-white p-6 text-center ring-1 ring-ink/10">
            <p className="font-semibold">We couldn’t load the menu.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream"
            >
              Try again
            </button>
          </div>
        )}

        {isLoading && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <MenuCardSkeleton key={i} />
            ))}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.category} className="mt-12 first-of-type:mt-10">
            <h3 className="mb-5 font-display text-2xl font-semibold">{g.label}</h3>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((item, i) => (
                <MenuCard key={item.id} item={item} index={i} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
