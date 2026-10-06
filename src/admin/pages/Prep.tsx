import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Car, ClipboardList, Download, Printer, Store } from 'lucide-react';
import { api } from '../../lib/api';
import { describeSelections, formatMoney } from '../../../shared/pricing';
import { PAYMENT_LABELS } from '../../../shared/constants';
import type { PrepSheet, PublicConfig } from '../../../shared/types';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  Spinner,
} from '../ui';
import { downloadUrl, usePickupDates } from '../api';

/** Date options: upcoming open dates + any date that has orders. */
function useDateOptions() {
  const withOrders = usePickupDates();
  const config = useQuery({ queryKey: ['config'], queryFn: () => api<PublicConfig>('/config') });
  return useMemo(() => {
    const map = new Map<string, { date: string; label: string; orders: number; isPast: boolean }>();
    for (const d of config.data?.pickupDates ?? [])
      map.set(d.date, { date: d.date, label: d.label, orders: 0, isPast: false });
    for (const d of withOrders.data?.dates ?? []) map.set(d.date, d);
    const today = withOrders.data?.today ?? '';
    const all = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    const upcoming = all.filter((d) => d.date >= today);
    const past = all.filter((d) => d.date < today).reverse();
    return {
      upcoming,
      past,
      loading: withOrders.isLoading || config.isLoading,
      defaultDate: upcoming[0]?.date ?? past[0]?.date ?? '',
    };
  }, [withOrders.data, withOrders.isLoading, config.data, config.isLoading]);
}

export default function Prep() {
  const [params, setParams] = useSearchParams();
  const opts = useDateOptions();
  const date = params.get('date') || opts.defaultDate;

  useEffect(() => {
    document.title = 'Prep sheet · +233 Kitchen Admin';
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'prep', date],
    queryFn: () => api<PrepSheet>(`/admin/orders/prep-sheet?date=${date}`),
    enabled: !!date,
  });

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Prep sheet"
          sub="Everything to cook for a pickup day. Cancelled orders are excluded."
          actions={
            <>
              <Button onClick={() => window.print()} disabled={!data?.orderCount}>
                <Printer size={16} aria-hidden /> Print slips
              </Button>
              <Button
                onClick={() => downloadUrl(`/admin/orders/prep-sheet.csv?date=${date}`)}
                disabled={!data?.orderCount}
              >
                <Download size={16} aria-hidden /> Export CSV
              </Button>
            </>
          }
        />
        <div className="mb-6 max-w-xs">
          <Select
            aria-label="Pickup date"
            value={date}
            onChange={(e) => setParams({ date: e.target.value }, { replace: true })}
            disabled={opts.loading}
          >
            {opts.upcoming.length > 0 && (
              <optgroup label="Upcoming">
                {opts.upcoming.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.label} · {d.orders} order{d.orders === 1 ? '' : 's'}
                  </option>
                ))}
              </optgroup>
            )}
            {opts.past.length > 0 && (
              <optgroup label="Past">
                {opts.past.map((d) => (
                  <option key={d.date} value={d.date}>
                    {d.label} · {d.orders} order{d.orders === 1 ? '' : 's'}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </div>
      </div>

      {(isLoading || opts.loading) && (
        <div className="grid place-items-center py-20">
          <Spinner />
        </div>
      )}
      {isError && <ErrorState message="Could not load the prep sheet." onRetry={refetch} />}

      {data && data.orderCount === 0 && (
        <Card>
          <EmptyState
            icon={<ClipboardList size={20} />}
            title={`No orders for ${data.label} yet`}
            body="When orders come in, totals and slips appear here."
          />
        </Card>
      )}

      {data && data.orderCount > 0 && (
        <>
          <div className="no-print">
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: 'Orders', value: data.orderCount },
                { label: 'Est. revenue', value: formatMoney(data.revenue) },
                { label: 'Pickup', value: data.fulfilment.pickup, icon: Store },
                { label: 'Uber courier', value: data.fulfilment.uber, icon: Car },
              ].map((k) => (
                <Card key={k.label} className="p-4">
                  <p className="text-xs font-medium text-neutral-500">{k.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
                </Card>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <Card>
                <CardHeader title={`To cook · ${data.label}`} />
                <ul className="divide-y divide-neutral-100">
                  {data.items.map((i) => (
                    <li key={i.slug} className="flex gap-4 px-5 py-4">
                      <p className="w-14 shrink-0 text-3xl font-semibold tabular-nums text-ghana-green">
                        {i.quantity}×
                      </p>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{i.name}</p>
                        {i.options.length > 0 ? (
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {i.options.map((o) => (
                              <li
                                key={`${o.group}-${o.name}`}
                                className="rounded-md bg-neutral-100 px-2 py-0.5 text-sm"
                              >
                                <span className="font-semibold tabular-nums">{o.count}</span>{' '}
                                {o.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-neutral-500">No extras</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="By pickup window" />
                <ul className="divide-y divide-neutral-100">
                  {data.windows.map((w) => (
                    <li key={w.id} className="flex justify-between px-5 py-3 text-sm">
                      <span>{w.label}</span>
                      <span className="font-semibold tabular-nums">{w.count}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <h2 className="mb-3 mt-8 text-sm font-semibold text-neutral-900">Order slips</h2>
          </div>

          {/* Slips: shown on screen and printed (2 per row, never split across pages). */}
          <div className="print-area">
            <h1 className="mb-4 hidden text-xl font-bold print:block">
              +233 Kitchen · {data.label} · {data.orderCount} orders
            </h1>
            <div className="hidden print:mb-6 print:block">
              <p className="mb-2 font-bold">Totals</p>
              <ul className="text-sm">
                {data.items.map((i) => (
                  <li key={i.slug}>
                    <strong>
                      {i.quantity}× {i.name}
                    </strong>
                    {i.options.length > 0 && (
                      <> — {i.options.map((o) => `${o.count} ${o.name}`).join(', ')}</>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
              {data.orders.map((o) => (
                <article
                  key={o.id}
                  className="break-inside-avoid rounded-xl border-2 border-dashed border-neutral-300 bg-white p-4 print:rounded-none print:border print:border-black"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-2xl font-bold tracking-tight">{o.number}</p>
                      <p className="text-lg font-semibold">{o.customer.name}</p>
                      <p className="text-sm text-neutral-600">{o.customer.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="rounded bg-neutral-900 px-2 py-1 text-sm font-bold text-white print:border print:border-black print:bg-white print:text-black">
                        {o.pickupWindowLabel}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase">
                        {o.fulfilment === 'uber' ? 'Uber courier' : 'Pickup'}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1 border-t border-neutral-200 pt-3 text-sm">
                    {o.items.map((l, i) => (
                      <li key={i}>
                        <span className="font-semibold">
                          {l.quantity}× {l.name}
                        </span>
                        {l.selections.length > 0 && (
                          <span className="text-neutral-700">
                            {' '}
                            — {describeSelections(l.selections)}
                          </span>
                        )}
                        {l.notes && <span className="block text-xs italic">Note: {l.notes}</span>}
                      </li>
                    ))}
                  </ul>
                  {o.notes && (
                    <p className="mt-2 rounded bg-ghana-gold-50 p-2 text-xs print:border print:border-black print:bg-white">
                      Order note: {o.notes}
                    </p>
                  )}
                  <div className="mt-3 flex justify-between border-t border-neutral-200 pt-2 text-sm">
                    <span>{PAYMENT_LABELS[o.paymentStatus]}</span>
                    <span className="font-semibold">{formatMoney(o.total)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
