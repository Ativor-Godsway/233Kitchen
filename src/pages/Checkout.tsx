import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Car, Info, Loader2, ShoppingBag, Store } from 'lucide-react';
import { toast } from 'sonner';
import { checkoutSchema, type CheckoutForm } from '../../shared/schemas';
import { formatMoney } from '../../shared/pricing';
import { SelectionList } from '../components/menu/SelectionList';
import type { PublicOrderDTO } from '../../shared/types';
import { useBag } from '../lib/useBag';
import { usePublicConfig } from '../lib/queries';
import { api, ApiError } from '../lib/api';
import { useCart } from '../store/cart';
import { cn } from '../lib/cn';
import { Skeleton } from '../components/ui/Skeleton';

function Summary({ compact }: { compact?: boolean }) {
  const { items, subtotal } = useBag();
  return (
    <div className="rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10 sm:p-6">
      <p className="font-display text-lg font-semibold">Order summary</p>
      <ul className={cn('mt-4 space-y-3', compact && 'max-h-60 overflow-y-auto')}>
        {items.map(({ line, item, priced }) => (
          <li key={line.key} className="flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {line.quantity}× {item?.name ?? line.slug}
              </p>
              {priced && (
                <SelectionList
                  selections={priced.selections}
                  className="mt-1 text-xs text-cream/55"
                />
              )}
              {line.notes && <p className="text-xs italic text-cream/60">“{line.notes}”</p>}
            </div>
            <p className="shrink-0 tabular-nums">{priced ? formatMoney(priced.lineTotal) : '–'}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between border-t border-white/10 pt-4">
        <p className="text-cream/70">Total</p>
        <p className="font-display text-2xl font-semibold tabular-nums">{formatMoney(subtotal)}</p>
      </div>
      <p className="mt-1 text-xs text-cream/60">
        Final prices are confirmed by our kitchen when you place the order.
      </p>
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { items, hasProblems, count, menuUnavailable } = useBag();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const {
    data: config,
    isLoading: configLoading,
    isError: configError,
    refetch,
  } = usePublicConfig();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = 'Checkout · +233 Kitchen';
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      pickupDate: '',
      pickupWindowId: '',
      fulfilment: 'pickup',
      notes: '',
      marketingConsent: false,
      website: '',
    },
  });

  const pickupDate = watch('pickupDate');
  const dateOption = useMemo(
    () => config?.pickupDates.find((d) => d.date === pickupDate),
    [config, pickupDate],
  );

  // Default to the soonest open date.
  useEffect(() => {
    if (config && !pickupDate && config.pickupDates[0])
      setValue('pickupDate', config.pickupDates[0].date);
  }, [config, pickupDate, setValue]);

  // Clear a window choice that is no longer valid for the chosen date.
  const windowId = watch('pickupWindowId');
  useEffect(() => {
    if (windowId && dateOption && dateOption.windows.find((w) => w.id === windowId)?.isFull)
      setValue('pickupWindowId', '');
  }, [dateOption, windowId, setValue]);

  const onSubmit = async (form: CheckoutForm) => {
    setSubmitting(true);
    try {
      const res = await api<{ order: PublicOrderDTO; token: string }>('/orders', {
        method: 'POST',
        json: {
          ...form,
          items: lines.map(({ slug, quantity, selections, notes }) => ({
            slug,
            quantity,
            selections,
            notes,
          })),
        },
      });
      clear();
      qc.invalidateQueries({ queryKey: ['config'] });
      navigate(`/order/${res.order.number}?t=${encodeURIComponent(res.token)}`, {
        replace: true,
        state: { order: res.order },
      });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.fieldErrors) {
          for (const [field, msgs] of Object.entries(e.fieldErrors)) {
            if (msgs?.[0]) setError(field as keyof CheckoutForm, { message: msgs[0] });
          }
        }
        if (['CUTOFF_PASSED', 'SLOT_FULL', 'ORDERING_PAUSED'].includes(e.code ?? '')) refetch();
        toast.error(e.message);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (count === 0) {
    return (
      <section className="grid min-h-[75vh] place-items-center px-4 pt-16 text-center">
        <div>
          <ShoppingBag size={40} className="mx-auto text-ghana-gold" aria-hidden />
          <h1 className="mt-4 font-display text-3xl font-semibold">Your bag is empty</h1>
          <p className="mt-2 text-cream/60">Add a dish or two, then come back to check out.</p>
          <Link
            to="/#menu"
            className="mt-6 inline-block rounded-full bg-cream px-6 py-3 font-semibold text-ink"
          >
            See the menu
          </Link>
        </div>
      </section>
    );
  }

  const settings = config?.settings;
  const paused = settings?.orderingPaused;
  const noDates = config && config.pickupDates.length === 0;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28">
      <Link
        to="/#menu"
        className="inline-flex items-center gap-2 text-sm text-cream/60 hover:text-cream"
      >
        <ArrowLeft size={16} aria-hidden /> Back to menu
      </Link>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Checkout
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="lg:hidden">
          <Summary compact />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
          {/* Honeypot: hidden from people, tempting to bots. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
            </label>
          </div>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-display text-xl font-semibold">Your details</legend>
            <div>
              <label htmlFor="name" className="field-label">
                Full name
              </label>
              <input
                id="name"
                autoComplete="name"
                className="field"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-err' : undefined}
                {...register('name')}
              />
              {errors.name && (
                <p id="name-err" className="field-error">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="phone" className="field-label">
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="field"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? 'phone-err' : undefined}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p id="phone-err" className="field-error">
                    {errors.phone.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="field-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="field"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-err' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p id="email-err" className="field-error">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-2 font-display text-xl font-semibold">Pickup</legend>
            {configLoading && <Skeleton className="h-28 w-full" />}
            {configError && (
              <p className="text-sm text-ghana-gold">
                Couldn’t load pickup times.{' '}
                <button type="button" className="underline" onClick={() => refetch()}>
                  Retry
                </button>
              </p>
            )}
            {(paused || noDates) && (
              <div
                className="rounded-2xl bg-ghana-gold/10 p-4 text-sm text-ghana-gold ring-1 ring-ghana-gold/30"
                role="status"
              >
                {paused
                  ? settings?.pausedMessage
                  : 'No pickup dates are open right now. Please check back soon.'}
              </div>
            )}
            {config && !paused && !noDates && (
              <>
                <div>
                  <label htmlFor="pickupDate" className="field-label">
                    Pickup date
                  </label>
                  <select
                    id="pickupDate"
                    className="field appearance-none bg-[length:16px] pr-10"
                    {...register('pickupDate')}
                  >
                    {config.pickupDates.map((d) => (
                      <option key={d.date} value={d.date} className="bg-ink text-cream">
                        {d.label}
                      </option>
                    ))}
                  </select>
                  {dateOption && (
                    <p className="mt-1.5 text-xs text-cream/50">
                      Orders for {dateOption.label} close {dateOption.cutoffLabel}.
                    </p>
                  )}
                  {errors.pickupDate && <p className="field-error">{errors.pickupDate.message}</p>}
                </div>
                <div>
                  <p className="field-label" id="window-label">
                    Pickup time
                  </p>
                  <Controller
                    control={control}
                    name="pickupWindowId"
                    render={({ field }) => (
                      <div
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        role="radiogroup"
                        aria-labelledby="window-label"
                      >
                        {(dateOption?.windows ?? []).map((w) => (
                          <label
                            key={w.id}
                            className={cn(
                              'cursor-pointer rounded-xl px-3 py-3 text-center text-sm font-semibold ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ghana-gold',
                              field.value === w.id
                                ? 'bg-ghana-gold text-ink ring-ghana-gold'
                                : 'bg-white/[0.04] ring-white/15 hover:ring-white/40',
                              w.isFull && 'cursor-not-allowed opacity-40 line-through',
                            )}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              value={w.id}
                              checked={field.value === w.id}
                              disabled={w.isFull}
                              onChange={() => field.onChange(w.id)}
                            />
                            {w.label}
                            {w.remaining !== null && !w.isFull && w.remaining <= 5 && (
                              <span className="block text-[11px] font-medium opacity-70">
                                {w.remaining} left
                              </span>
                            )}
                            {w.isFull && (
                              <span className="block text-[11px] font-medium no-underline">
                                Full
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  />
                  {errors.pickupWindowId && (
                    <p className="field-error">{errors.pickupWindowId.message}</p>
                  )}
                </div>
              </>
            )}
            <Controller
              control={control}
              name="fulfilment"
              render={({ field }) => (
                <div
                  className="grid gap-2 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="How you’ll collect"
                >
                  {(
                    [
                      {
                        id: 'pickup',
                        label: 'I’ll pick up',
                        sub: 'Collect in person',
                        Icon: Store,
                      },
                      {
                        id: 'uber',
                        label: 'I’ll send an Uber courier',
                        sub: 'You book & pay the courier',
                        Icon: Car,
                      },
                    ] as const
                  ).map(({ id, label, sub, Icon }) => (
                    <label
                      key={id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 ring-1 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ghana-gold',
                        field.value === id
                          ? 'bg-white/10 ring-cream'
                          : 'bg-white/[0.04] ring-white/15 hover:ring-white/40',
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        value={id}
                        checked={field.value === id}
                        onChange={() => field.onChange(id)}
                      />
                      <Icon size={20} className="text-ghana-gold" aria-hidden />
                      <span>
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs text-cream/55">{sub}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            />
          </fieldset>

          <div>
            <label htmlFor="notes" className="field-label">
              Order notes <span className="text-cream/60">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              className="field resize-none"
              placeholder="Anything we should know? Allergies, courier name, etc."
              {...register('notes')}
            />
            {errors.notes && <p className="field-error">{errors.notes.message}</p>}
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-ghana-gold"
              {...register('marketingConsent')}
            />
            <span className="text-cream/80">
              Email me about new menu items and offers. You can unsubscribe at any time.
            </span>
          </label>

          <div
            className="flex gap-3 rounded-2xl bg-ghana-green/20 p-4 text-sm ring-1 ring-ghana-green-400/40"
            role="note"
          >
            <Info size={18} className="mt-0.5 shrink-0 text-ghana-green-300" aria-hidden />
            <p>
              {settings?.paymentInstructions ??
                'No payment now. We’ll confirm your order and share payment options.'}
            </p>
          </div>

          <button
            type="submit"
            disabled={
              submitting ||
              hasProblems ||
              menuUnavailable ||
              !!paused ||
              !!noDates ||
              configLoading ||
              configError
            }
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ghana-red py-4 text-lg font-semibold text-white shadow-lg shadow-ghana-red/25 transition hover:bg-ghana-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 size={20} className="animate-spin" aria-hidden />}
            {submitting ? 'Placing order…' : 'Place pre-order'}
          </button>
          {menuUnavailable ? (
            <p className="text-center text-sm text-ghana-gold" role="status">
              Our menu is temporarily unavailable, so ordering is paused. Please try again in a few
              minutes.
            </p>
          ) : (
            hasProblems && (
              <p className="text-center text-sm text-ghana-gold">
                Some items in your bag are unavailable. Please update your bag.
              </p>
            )
          )}
        </form>

        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <Summary />
          {items.length > 0 && (
            <p className="mt-3 px-2 text-xs text-cream/60">
              We’ll email your confirmation right away.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
