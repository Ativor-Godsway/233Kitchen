import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Pencil, ShoppingBag, Trash2, X } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Stepper } from '../ui/Stepper';
import { MenuImage } from '../menu/MenuImage';
import { useUi } from '../../store/ui';
import { useCart } from '../../store/cart';
import { useBag } from '../../lib/useBag';
import { describeSelections, formatMoney, MAX_LINE_QUANTITY } from '../../../shared/pricing';

export function CartDrawer() {
  const open = useUi((s) => s.bagOpen);
  const close = useUi((s) => s.closeBag);
  const openItem = useUi((s) => s.openItem);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const { items, subtotal, count, hasProblems } = useBag();
  const navigate = useNavigate();

  return (
    <Dialog open={open} onClose={close} title="Your bag" hideTitle variant="drawer-right" tone="dark">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <p className="font-display text-xl font-semibold" aria-hidden>
          Your bag {count > 0 && <span className="text-cream/50">({count})</span>}
        </p>
        <button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close bag">
          <X size={20} aria-hidden />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
            <ShoppingBag size={32} className="text-ghana-gold" aria-hidden />
          </div>
          <p className="mt-5 font-display text-2xl font-semibold">Your bag is empty</p>
          <p className="mt-2 text-sm text-cream/60">Add something delicious from this week’s menu.</p>
          <a href="/#menu" onClick={close} className="mt-6 rounded-full bg-cream px-6 py-3 text-sm font-semibold text-ink hover:bg-white">
            Browse the menu
          </a>
        </div>
      ) : (
        <>
          <ul className="flex-1 divide-y divide-white/10 overflow-y-auto overscroll-contain px-5">
            {items.map(({ line, item, priced, problem }) => (
              <li key={line.key} className="flex gap-4 py-5">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-ink-700">
                  {item && <MenuImage item={item} sizes="80px" className="h-full w-full" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug">{item?.name ?? line.slug}</p>
                    <p className="shrink-0 font-semibold tabular-nums">{priced ? formatMoney(priced.lineTotal) : '–'}</p>
                  </div>
                  {priced && priced.selections.length > 0 && <p className="mt-1 text-xs text-cream/60">{describeSelections(priced.selections)}</p>}
                  {line.notes && <p className="mt-1 text-xs italic text-cream/50">“{line.notes}”</p>}
                  {problem && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ghana-gold" role="alert">
                      <AlertTriangle size={14} aria-hidden /> {problem}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <Stepper
                      size="sm"
                      label={`${item?.name ?? 'item'} quantity`}
                      value={line.quantity}
                      min={1}
                      max={MAX_LINE_QUANTITY}
                      onChange={(n) => setQuantity(line.key, n)}
                    />
                    <div className="flex gap-1">
                      {item && item.isAvailable && (
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            openItem(line.slug, line);
                          }}
                          className="grid h-8 w-8 place-items-center rounded-full text-cream/70 hover:bg-white/10 hover:text-cream"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Pencil size={15} aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(line.key)}
                        className="grid h-8 w-8 place-items-center rounded-full text-cream/70 hover:bg-white/10 hover:text-ghana-red-300"
                        aria-label={`Remove ${item?.name ?? 'item'}`}
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/10 px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-baseline justify-between">
              <p className="text-cream/70">Subtotal</p>
              <p className="font-display text-2xl font-semibold tabular-nums">{formatMoney(subtotal)}</p>
            </div>
            <p className="mt-1 text-xs text-cream/50">No payment now. Pickup day and time are chosen at checkout.</p>
            {hasProblems && <p className="mt-3 text-sm text-ghana-gold">Remove or edit the highlighted items to continue.</p>}
            <button
              type="button"
              disabled={hasProblems}
              onClick={() => {
                close();
                navigate('/checkout');
              }}
              className="mt-4 w-full rounded-full bg-ghana-red py-4 font-semibold text-white shadow-lg shadow-ghana-red/25 transition hover:bg-ghana-red-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Checkout
            </button>
            <Link to="/#menu" onClick={close} className="mt-3 block text-center text-sm font-medium text-cream/60 hover:text-cream">
              Keep browsing
            </Link>
          </div>
        </>
      )}
    </Dialog>
  );
}
