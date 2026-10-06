import { useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog } from '../ui/Dialog';
import { Stepper } from '../ui/Stepper';
import { MenuImage } from './MenuImage';
import { useUi } from '../../store/ui';
import { useCart, type CartLine } from '../../store/cart';
import { useMenu } from '../../lib/queries';
import { formatMoney, priceLine, PricingError, MAX_LINE_QUANTITY, MAX_NOTES_LENGTH } from '../../../shared/pricing';
import type { MenuItem, OptionGroup, SelectionInput } from '../../../shared/types';
import { cn } from '../../lib/cn';

/** groupKey → optionKey → qty */
type SelState = Record<string, Record<string, number>>;

function fromLine(line?: CartLine): SelState {
  const s: SelState = {};
  for (const sel of line?.selections ?? []) (s[sel.groupKey] ??= {})[sel.optionKey] = sel.qty;
  return s;
}

function toSelections(s: SelState): SelectionInput[] {
  return Object.entries(s).flatMap(([groupKey, opts]) =>
    Object.entries(opts)
      .filter(([, qty]) => qty > 0)
      .map(([optionKey, qty]) => ({ groupKey, optionKey, qty })),
  );
}

const priceTag = (cents: number) => (cents > 0 ? `+${formatMoney(cents)}` : 'Free');

function GroupHeader({ group, error }: { group: OptionGroup; error?: string }) {
  const hint =
    group.type === 'single'
      ? 'Choose 1'
      : group.type === 'quantity'
        ? `Up to ${group.max} each`
        : group.max > 1
          ? `Choose up to ${group.max}`
          : 'Optional';
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h3 className="font-display text-lg font-semibold">{group.name}</h3>
      <span
        className={cn(
          'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
          error ? 'bg-ghana-red text-white' : group.required ? 'bg-ghana-gold/20 text-ghana-gold' : 'bg-white/10 text-cream/60',
        )}
      >
        {group.required ? `Required · ${hint}` : hint}
      </span>
    </div>
  );
}

function SheetBody({ item, editing, onDone }: { item: MenuItem; editing?: CartLine; onDone: () => void }) {
  const add = useCart((s) => s.add);
  const replace = useCart((s) => s.replace);
  const [sel, setSel] = useState<SelState>(() => fromLine(editing));
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [errorGroup, setErrorGroup] = useState<{ key: string; message: string } | null>(null);
  const groupRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});

  const setQty = (g: string, o: string, qty: number) => {
    setSel((s) => ({ ...s, [g]: { ...(s[g] ?? {}), [o]: qty } }));
    if (errorGroup?.key === g) setErrorGroup(null);
  };
  const pickSingle = (g: string, o: string) => {
    setSel((s) => ({ ...s, [g]: { [o]: 1 } }));
    if (errorGroup?.key === g) setErrorGroup(null);
  };
  const toggleMulti = (group: OptionGroup, o: string) => {
    setSel((s) => {
      const cur = { ...(s[group.key] ?? {}) };
      if (cur[o]) delete cur[o];
      else {
        if (Object.keys(cur).length >= group.max && group.max === 1) for (const k of Object.keys(cur)) delete cur[k];
        if (Object.keys(cur).length < group.max) cur[o] = 1;
      }
      return { ...s, [group.key]: cur };
    });
  };

  // Live running total (independent of validation, so it updates while choosing).
  const unitTotal = useMemo(() => {
    let t = item.basePrice;
    for (const g of item.optionGroups)
      for (const o of g.options) t += (sel[g.key]?.[o.key] ?? 0) * o.price;
    return t;
  }, [item, sel]);

  const submit = () => {
    const line = { slug: item.slug, quantity, selections: toSelections(sel), notes };
    try {
      priceLine(item, line);
    } catch (e) {
      if (e instanceof PricingError) {
        const group = item.optionGroups.find((g) => e.message.includes(g.name) && g.required) ?? item.optionGroups.find((g) => g.required);
        if (group) {
          setErrorGroup({ key: group.key, message: group.type === 'single' ? `Please choose a ${group.name.toLowerCase()}` : e.message });
          groupRefs.current[group.key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          groupRefs.current[group.key]?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
        } else {
          toast.error(e.message);
        }
        return;
      }
      throw e;
    }
    if (editing) {
      replace(editing.key, line);
      toast.success('Bag updated');
    } else {
      add(line);
      toast.success(`${item.name} added to your bag`);
    }
    onDone();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative h-52 shrink-0 sm:h-64 md:h-auto">
        <MenuImage item={item} sizes="(min-width: 768px) 460px, 100vw" className="h-full w-full" eager />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-800 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-ink-800/30" />
        <button
          type="button"
          onClick={onDone}
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-ink/70 text-cream backdrop-blur transition hover:bg-ink"
          aria-label="Close"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-2 sm:px-7 md:pt-7">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 md:hidden" />
          <p className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{item.name}</p>
          <p className="mt-1 font-display text-lg text-ghana-gold">{formatMoney(item.basePrice)}</p>
          <p className="mt-3 text-sm text-cream/70">{item.description}</p>

          {item.optionGroups.map((group) => {
            const err = errorGroup?.key === group.key ? errorGroup.message : undefined;
            return (
              <fieldset
                key={group.key}
                ref={(el) => {
                  groupRefs.current[group.key] = el;
                }}
                className={cn('mt-7 rounded-2xl', err && 'ring-2 ring-ghana-red ring-offset-8 ring-offset-ink-800')}
                aria-describedby={err ? `${group.key}-err` : undefined}
              >
                <legend className="sr-only">{group.name}</legend>
                <GroupHeader group={group} error={err} />
                {err && (
                  <p id={`${group.key}-err`} role="alert" className="mb-3 text-sm font-semibold text-ghana-red-300">
                    {err}
                  </p>
                )}

                {group.type === 'quantity' && (
                  <ul className="divide-y divide-white/10 rounded-2xl bg-white/[0.04] ring-1 ring-white/10">
                    {group.options.map((o) => (
                      <li key={o.key} className={cn('flex items-center justify-between gap-3 px-4 py-3', !o.isAvailable && 'opacity-40')}>
                        <div>
                          <p className="text-sm font-medium">{o.name}</p>
                          <p className="text-xs text-cream/60">{o.isAvailable ? priceTag(o.price) : 'Sold out'}</p>
                        </div>
                        <Stepper
                          size="sm"
                          label={o.name}
                          value={sel[group.key]?.[o.key] ?? 0}
                          max={group.max}
                          disabled={!o.isAvailable}
                          onChange={(n) => setQty(group.key, o.key, n)}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {group.type === 'single' && (
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={group.name}>
                    {group.options.map((o) => {
                      const checked = !!sel[group.key]?.[o.key];
                      return (
                        <label
                          key={o.key}
                          className={cn(
                            'relative flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ghana-gold',
                            checked ? 'bg-ghana-gold/15 ring-ghana-gold' : 'bg-white/[0.04] ring-white/10 hover:ring-white/30',
                            !o.isAvailable && 'cursor-not-allowed opacity-40',
                          )}
                        >
                          <input
                            type="radio"
                            name={`${item.slug}-${group.key}`}
                            className="sr-only"
                            checked={checked}
                            disabled={!o.isAvailable}
                            onChange={() => pickSingle(group.key, o.key)}
                          />
                          <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full ring-2', checked ? 'bg-ghana-gold ring-ghana-gold' : 'ring-white/30')}>
                            {checked && <Check size={12} strokeWidth={3} className="text-ink" aria-hidden />}
                          </span>
                          <span className="flex-1">
                            {o.name}
                            {(o.price > 0 || !o.isAvailable) && (
                              <span className="block text-xs text-cream/60">{o.isAvailable ? priceTag(o.price) : 'Sold out'}</span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {group.type === 'multi' && (
                  <ul className="space-y-2">
                    {group.options.map((o) => {
                      const on = !!sel[group.key]?.[o.key];
                      return (
                        <li key={o.key}>
                          <label className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10', !o.isAvailable && 'cursor-not-allowed opacity-40')}>
                            <span>
                              <span className="block text-sm font-medium">{o.name}</span>
                              <span className="block text-xs text-cream/60">{o.isAvailable ? priceTag(o.price) : 'Sold out'}</span>
                            </span>
                            <input
                              type="checkbox"
                              role="switch"
                              aria-checked={on}
                              className="peer sr-only"
                              checked={on}
                              disabled={!o.isAvailable}
                              onChange={() => toggleMulti(group, o.key)}
                            />
                            <span
                              aria-hidden
                              className={cn(
                                'relative h-7 w-12 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-ghana-gold',
                                on ? 'bg-ghana-green-400' : 'bg-white/20',
                              )}
                            >
                              <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
            );
          })}

          <div className="mt-7">
            <label htmlFor="item-notes" className="font-display text-lg font-semibold">
              Special instructions <span className="text-sm font-normal text-cream/50">(optional)</span>
            </label>
            <textarea
              id="item-notes"
              value={notes}
              maxLength={MAX_NOTES_LENGTH}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. no onions, sauce on the side"
              className="mt-2 w-full resize-none rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-cream ring-1 ring-white/10 placeholder:text-cream/30 focus:outline-none focus:ring-2 focus:ring-ghana-gold"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-white/10 bg-ink-800 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          <Stepper label="Quantity" value={quantity} min={1} max={MAX_LINE_QUANTITY} onChange={setQuantity} />
          <button
            type="button"
            onClick={submit}
            className="flex flex-1 items-center justify-between gap-3 rounded-full bg-ghana-red px-6 py-3.5 font-semibold text-white shadow-lg shadow-ghana-red/25 transition hover:bg-ghana-red-400"
          >
            <span>{editing ? 'Update bag' : 'Add to bag'}</span>
            <span className="tabular-nums" aria-live="polite">
              {formatMoney(unitTotal * quantity)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Customisation sheet: bottom sheet on mobile, modal on desktop. */
export function ItemSheet() {
  const sheet = useUi((s) => s.sheet);
  const closeItem = useUi((s) => s.closeItem);
  const { data: menu } = useMenu();
  const item = sheet ? menu?.find((m) => m.slug === sheet.slug) : undefined;

  return (
    <Dialog open={!!sheet && !!item} onClose={closeItem} title={item ? `Customise ${item.name}` : 'Customise'} hideTitle variant="sheet" tone="dark">
      {item && <SheetBody key={`${item.slug}-${sheet?.editing?.key ?? 'new'}`} item={item} editing={sheet?.editing} onDone={closeItem} />}
    </Dialog>
  );
}
