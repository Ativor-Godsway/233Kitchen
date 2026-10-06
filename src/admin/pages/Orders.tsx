import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Car, ChevronLeft, ChevronRight, Search, ShoppingBag } from 'lucide-react';
import { api } from '../../lib/api';
import { formatMoney } from '../../../shared/pricing';
import { PAYMENT_LABELS, PAYMENT_STATUSES, STATUS_LABELS } from '../../../shared/constants';
import type { OrderStatus, OrdersListResponse } from '../../../shared/types';
import {
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  PaymentPill,
  Select,
  SkeletonRows,
  StatusPill,
} from '../ui';
import { fmtDateTime, usePickupDates } from '../api';
import { OrderDrawer } from './OrderDrawer';
import { cn } from '../../lib/cn';

const TABS: Array<{ id: string; label: string }> = [
  { id: 'active', label: 'Active' },
  { id: 'new', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? 'active';
  const pickupDate = params.get('date') ?? '';
  const paymentStatus = params.get('payment') ?? 'all';
  const page = Number(params.get('page') ?? 1);
  const openId = params.get('order');
  const [search, setSearch] = useState(params.get('q') ?? '');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  // Debounced search → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get('q') ?? '') !== search) update({ q: search });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    document.title = 'Orders · +233 Kitchen Admin';
  }, []);

  const qs = new URLSearchParams({
    status,
    paymentStatus,
    page: String(page),
    pageSize: '25',
    sort: 'newest',
  });
  if (pickupDate) qs.set('pickupDate', pickupDate);
  if (params.get('q')) qs.set('q', params.get('q')!);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'orders', 'list', qs.toString()],
    queryFn: () => api<OrdersListResponse>(`/admin/orders?${qs}`),
    placeholderData: keepPreviousData,
  });
  const dates = usePickupDates();

  const counts = data?.statusCounts ?? {};
  const countFor = (id: string) =>
    id === 'all'
      ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0)
      : id === 'active'
        ? (['new', 'confirmed', 'preparing', 'ready'] as OrderStatus[]).reduce(
            (a, s) => a + (counts[s] ?? 0),
            0,
          )
        : (counts[id as OrderStatus] ?? 0);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title="Orders"
        sub="Search, filter and update pre-orders. New orders appear automatically."
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          className="inline-flex gap-1 rounded-lg border border-neutral-200 bg-white p-1"
          role="tablist"
          aria-label="Order status"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={status === t.id}
              onClick={() => update({ status: t.id })}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition',
                status === t.id
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded px-1 text-xs tabular-nums',
                  status === t.id
                    ? 'bg-white/20'
                    : t.id === 'new' && countFor('new')
                      ? 'bg-ghana-red text-white'
                      : 'bg-neutral-100 text-neutral-500',
                )}
              >
                {countFor(t.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_200px_180px]">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or order #"
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <Select
          value={pickupDate}
          onChange={(e) => update({ date: e.target.value })}
          aria-label="Pickup date"
        >
          <option value="">All pickup dates</option>
          {dates.data?.dates.map((d) => (
            <option key={d.date} value={d.date}>
              {d.label} ({d.orders}){d.isPast ? '' : ' · upcoming'}
            </option>
          ))}
        </Select>
        <Select
          value={paymentStatus}
          onChange={(e) => update({ payment: e.target.value })}
          aria-label="Payment status"
        >
          <option value="all">Any payment</option>
          {PAYMENT_STATUSES.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>

      {isError && <ErrorState message="Could not load orders." onRetry={refetch} />}

      <Card
        className={cn(
          'overflow-hidden transition-opacity',
          isFetching && !isLoading && 'opacity-70',
        )}
      >
        {isLoading ? (
          <SkeletonRows rows={6} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={20} />}
            title="No orders here"
            body={
              params.get('q')
                ? 'Try a different search.'
                : 'Orders matching these filters will show up here.'
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Pickup</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((o) => (
                  <tr
                    key={o.id}
                    tabIndex={0}
                    onClick={() => update({ order: o.id, page: String(page) })}
                    onKeyDown={(e) =>
                      e.key === 'Enter' && update({ order: o.id, page: String(page) })
                    }
                    className={cn(
                      'cursor-pointer hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none',
                      o.status === 'new' && 'bg-ghana-red-50/40',
                    )}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold">{o.number}</p>
                      <p className="text-xs text-neutral-500">{fmtDateTime(o.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.customer.name}</p>
                      <p className="text-xs text-neutral-500">{o.customer.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{o.pickupDateLabel}</p>
                      <p className="flex items-center gap-1 text-xs text-neutral-500">
                        {o.pickupWindowLabel}
                        {o.fulfilment === 'uber' && <Car size={12} aria-label="Uber courier" />}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PaymentPill status={o.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile cards */}
            <ul className="divide-y divide-neutral-100 md:hidden">
              {data.items.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => update({ order: o.id, page: String(page) })}
                    className={cn(
                      'w-full px-4 py-3.5 text-left',
                      o.status === 'new' && 'bg-ghana-red-50/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold">
                        {o.number}{' '}
                        <span className="font-normal text-neutral-600">· {o.customer.name}</span>
                      </p>
                      <p className="font-semibold tabular-nums">{formatMoney(o.total)}</p>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-neutral-600">
                      {o.pickupDateLabel}, {o.pickupWindowLabel}
                      {o.fulfilment === 'uber' && <Car size={13} aria-label="Uber courier" />}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusPill status={o.status} />
                      <PaymentPill status={o.paymentStatus} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center justify-between text-sm text-neutral-600">
          <p>
            {(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of{' '}
            {data.total}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => update({ page: String(page - 1) })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => update({ page: String(page + 1) })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {data ? `${data.total} orders, ${STATUS_LABELS[status as OrderStatus] ?? status}` : ''}
      </p>

      <OrderDrawer id={openId} onClose={() => update({ order: null, page: String(page) })} />
    </>
  );
}
