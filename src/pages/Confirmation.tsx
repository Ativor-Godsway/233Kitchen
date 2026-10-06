import { useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarPlus, Check, Clock, Mail, MapPin, Phone, Wallet } from 'lucide-react';
import { api } from '../lib/api';
import { describeSelections, formatMoney } from '../../shared/pricing';
import { FULFILMENT_LABELS } from '../../shared/constants';
import type { PublicOrderDTO } from '../../shared/types';
import { KenteBand } from '../components/KenteBand';
import { Skeleton } from '../components/ui/Skeleton';

export default function Confirmation() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const location = useLocation();
  const initial = (location.state as { order?: PublicOrderDTO } | null)?.order;
  const reduce = useReducedMotion();

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['public-order', number, token],
    queryFn: () =>
      api<{ order: PublicOrderDTO }>(
        `/orders/${encodeURIComponent(number)}?t=${encodeURIComponent(token)}`,
      ).then((r) => r.order),
    initialData: initial?.number === number ? initial : undefined,
    enabled: !!token,
  });

  useEffect(() => {
    document.title = `Order ${number} · +233 Kitchen`;
  }, [number]);

  if (!token || isError) {
    return (
      <section className="grid min-h-[70vh] place-items-center px-4 pt-16 text-center">
        <div>
          <h1 className="font-display text-3xl font-semibold">We couldn’t find that order</h1>
          <p className="mt-2 text-cream/60">
            Please use the link in your confirmation email, or call us.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-full bg-cream px-6 py-3 font-semibold text-ink"
          >
            Home
          </Link>
        </div>
      </section>
    );
  }

  if (isLoading || !order) {
    return (
      <section className="mx-auto max-w-2xl space-y-4 px-4 pt-28">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </section>
    );
  }

  const icsHref = `/api/orders/${encodeURIComponent(order.number)}/ics?t=${encodeURIComponent(token)}`;
  const tel = order.businessPhone.replace(/\D/g, '');

  return (
    <section className="mx-auto max-w-2xl px-4 pb-24 pt-28 sm:px-6">
      <motion.div
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 200 }}
        className="grid h-16 w-16 place-items-center rounded-full bg-ghana-green-400 text-white shadow-lg shadow-ghana-green/40"
      >
        <Check size={32} strokeWidth={3} aria-hidden />
      </motion.div>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-ghana-gold">
        Order {order.number}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
        Thank you, {order.customerName.split(' ')[0]}!
      </h1>
      <p className="mt-3 text-cream/70">
        We’ve received your pre-order and will confirm it shortly.
      </p>
      <p className="mt-2 inline-flex items-center gap-2 text-sm text-cream/60">
        <Mail size={16} aria-hidden />
        <span>
          We’ve emailed a copy to <span className="font-medium text-cream">{order.email}</span>.
        </span>
      </p>

      <KenteBand height={6} className="my-8 rounded-full" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cream/50">
            <Clock size={14} aria-hidden /> Pickup
          </p>
          <p className="mt-2 font-display text-xl font-semibold">{order.pickupDateLabel}</p>
          <p className="text-cream/70">{order.pickupWindowLabel}</p>
          <p className="mt-1 text-sm text-cream/50">{FULFILMENT_LABELS[order.fulfilment]}</p>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cream/50">
            <MapPin size={14} aria-hidden /> Where
          </p>
          <p className="mt-2 font-semibold">{order.pickupAddressPublic}</p>
          <p className="text-sm text-cream/60">The exact address is in your confirmation email.</p>
        </div>
      </div>

      <div className="mt-3 flex gap-3 rounded-2xl bg-ghana-green/20 p-5 ring-1 ring-ghana-green-400/40">
        <Wallet size={20} className="mt-0.5 shrink-0 text-ghana-green-300" aria-hidden />
        <p className="text-sm">{order.paymentInstructions}</p>
      </div>

      <div className="mt-6 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
        <p className="font-display text-lg font-semibold">Your order</p>
        <ul className="mt-3 space-y-3">
          {order.items.map((l, i) => (
            <li key={i} className="flex justify-between gap-4 text-sm">
              <div>
                <p className="font-medium">
                  {l.quantity}× {l.name}
                </p>
                {l.selections.length > 0 && (
                  <p className="text-xs text-cream/55">{describeSelections(l.selections)}</p>
                )}
                {l.notes && <p className="text-xs italic text-cream/60">“{l.notes}”</p>}
              </div>
              <p className="tabular-nums">{formatMoney(l.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-white/10 pt-4">
          <p className="text-cream/70">Total (pay later)</p>
          <p className="font-display text-2xl font-semibold tabular-nums">
            {formatMoney(order.total)}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={icsHref}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cream px-6 py-3.5 font-semibold text-ink hover:bg-white"
        >
          <CalendarPlus size={18} aria-hidden /> Add to calendar
        </a>
        <a
          href={`tel:+1${tel}`}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold ring-1 ring-white/25 hover:bg-white/10"
        >
          <Phone size={18} aria-hidden /> {order.businessPhone}
        </a>
      </div>
      <Link to="/" className="mt-6 block text-center text-sm text-cream/50 hover:text-cream">
        Back to home
      </Link>
    </section>
  );
}
