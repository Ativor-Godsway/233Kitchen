import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Car, Mail, MessageSquare, Phone, RefreshCw, Send, Store, X } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { api, ApiError } from '../../lib/api';
import { describeSelections, formatMoney } from '../../../shared/pricing';
import {
  FULFILMENT_LABELS,
  PAYMENT_LABELS,
  PAYMENT_STATUSES,
  STATUS_FLOW,
  STATUS_LABELS,
} from '../../../shared/constants';
import type { EmailLogDTO, OrderDTO, OrderStatus, PaymentStatus } from '../../../shared/types';
import { Button, PaymentPill, Select, Spinner, StatusPill, Textarea, ErrorState } from '../ui';
import { fmtDateTime, smsHref, telHref, useAdminSettings } from '../api';
import { cn } from '../../lib/cn';

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: 'Confirm order',
  confirmed: 'Start preparing',
  preparing: 'Mark ready for pickup',
  ready: 'Mark completed',
};

function nextStatus(s: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(s);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

type Detail = { order: OrderDTO; emails: EmailLogDTO[] };

function StatusConfirm({
  order,
  target,
  onDone,
}: {
  order: OrderDTO;
  target: OrderStatus;
  onDone: () => void;
}) {
  const { data } = useAdminSettings();
  const qc = useQueryClient();
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (data) setNotify(data.settings.notifyOnStatus.includes(target));
  }, [data, target]);

  const m = useMutation({
    mutationFn: () =>
      api<{ order: OrderDTO; email: { ok: boolean; error?: string } | null }>(
        `/admin/orders/${order.id}`,
        {
          method: 'PATCH',
          json: { status: target, notifyCustomer: notify, statusNote: note || undefined },
        },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      if (res.email && !res.email.ok)
        toast.error(`Status saved, but the email failed: ${res.email.error ?? 'unknown error'}`);
      else
        toast.success(
          `${order.number} → ${STATUS_LABELS[target]}${res.email?.ok ? ' · customer emailed' : ''}`,
        );
      onDone();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not update'),
  });

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-sm font-medium">
        Change status to <StatusPill status={target} />?
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={notify}
          onChange={(e) => setNotify(e.target.checked)}
          className="h-4 w-4 accent-ghana-green"
        />
        Email {order.customer.name.split(' ')[0]} about this change
      </label>
      {notify && (
        <Textarea
          className="mt-2"
          rows={2}
          placeholder="Optional message to include (e.g. “Running 10 min late”)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
      )}
      <div className="mt-3 flex gap-2">
        <Button
          variant={target === 'cancelled' ? 'danger' : 'primary'}
          size="sm"
          onClick={() => m.mutate()}
          loading={m.isPending}
        >
          {target === 'cancelled' ? 'Cancel order' : 'Confirm'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Back
        </Button>
      </div>
    </div>
  );
}

function DrawerBody({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'orders', 'detail', id],
    queryFn: () => api<Detail>(`/admin/orders/${id}`),
  });
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<{ order: OrderDTO }>(`/admin/orders/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save'),
  });
  const resend = useMutation({
    mutationFn: (logId: string) =>
      api<{ ok: boolean; error?: string }>(`/admin/emails/${logId}/resend`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Email re-sent');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Resend failed'),
  });

  if (isLoading)
    return (
      <div className="grid flex-1 place-items-center">
        <Spinner />
      </div>
    );
  if (isError || !data)
    return (
      <div className="p-6">
        <ErrorState message="Could not load this order." onRetry={refetch} />
      </div>
    );

  const { order, emails } = data;
  const next = nextStatus(order.status);
  const canCancel = order.status !== 'cancelled' && order.status !== 'completed';
  const notesValue = notes ?? order.internalNotes;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{order.number}</p>
            <StatusPill status={order.status} />
            <PaymentPill status={order.paymentStatus} />
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">Placed {fmtDateTime(order.createdAt)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
          aria-label="Close"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* Pickup */}
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Pickup</p>
            <p className="font-semibold">{order.pickupDateLabel}</p>
            <p className="text-sm text-neutral-700">{order.pickupWindowLabel}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Fulfilment</p>
            <p className="flex items-center gap-1.5 font-semibold">
              {order.fulfilment === 'uber' ? (
                <Car size={16} aria-hidden />
              ) : (
                <Store size={16} aria-hidden />
              )}
              {order.fulfilment === 'uber' ? 'Uber courier' : 'Pickup'}
            </p>
            <p className="text-sm text-neutral-500">{FULFILMENT_LABELS[order.fulfilment]}</p>
          </div>
        </section>

        {/* Status actions */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Status
          </h3>
          {target ? (
            <StatusConfirm order={order} target={target} onDone={() => setTarget(null)} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {next && (
                <Button variant="brand" onClick={() => setTarget(next)}>
                  {NEXT_LABEL[order.status]}
                </Button>
              )}
              {order.status === 'cancelled' && (
                <Button variant="secondary" onClick={() => setTarget('new')}>
                  Restore order
                </Button>
              )}
              <Select
                aria-label="Set status"
                className="w-auto"
                value=""
                onChange={(e) => e.target.value && setTarget(e.target.value as OrderStatus)}
              >
                <option value="">Set status…</option>
                {(Object.keys(STATUS_LABELS) as OrderStatus[])
                  .filter((s) => s !== order.status)
                  .map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
              </Select>
              {canCancel && (
                <Button variant="danger" onClick={() => setTarget('cancelled')}>
                  Cancel
                </Button>
              )}
            </div>
          )}
        </section>

        {/* Payment */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Payment
          </h3>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment status">
            {PAYMENT_STATUSES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={order.paymentStatus === p}
                disabled={patch.isPending}
                onClick={() =>
                  patch.mutate(
                    { paymentStatus: p },
                    {
                      onSuccess: () =>
                        toast.success(`${order.number}: ${PAYMENT_LABELS[p as PaymentStatus]}`),
                    },
                  )
                }
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                  order.paymentStatus === p
                    ? 'border-ghana-green bg-ghana-green-50 text-ghana-green-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                )}
              >
                {PAYMENT_LABELS[p]}
              </button>
            ))}
          </div>
        </section>

        {/* Customer */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Customer
          </h3>
          <div className="rounded-xl border border-neutral-200 p-4">
            <p className="font-semibold">{order.customer.name}</p>
            <p className="text-sm text-neutral-600">{order.customer.phone}</p>
            <p className="text-sm text-neutral-600">{order.customer.email}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <a
                href={telHref(order.customer.phone)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <Phone size={15} aria-hidden /> Call
              </a>
              <a
                href={smsHref(order.customer.phone)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <MessageSquare size={15} aria-hidden /> Text
              </a>
              <a
                href={`mailto:${order.customer.email}?subject=${encodeURIComponent(`Your +233 Kitchen order ${order.number}`)}`}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 text-sm font-medium hover:bg-neutral-50"
              >
                <Mail size={15} aria-hidden /> Email
              </a>
            </div>
            {order.customerId && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link
                  to={`/admin/marketing?customer=${order.customerId}`}
                  className="inline-flex items-center gap-1 font-medium text-ghana-green hover:underline"
                >
                  <Send size={14} aria-hidden /> Email customer from the site
                </Link>
                <Link
                  to={`/admin/customers?customer=${order.customerId}`}
                  className="font-medium text-neutral-600 hover:underline"
                >
                  View profile
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Items */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Items
          </h3>
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {order.items.map((l, i) => (
              <li key={i} className="flex justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {l.quantity}× {l.name}
                  </p>
                  {l.selections.length > 0 && (
                    <p className="text-neutral-600">{describeSelections(l.selections)}</p>
                  )}
                  {l.notes && (
                    <p className="mt-0.5 rounded bg-ghana-gold-50 px-1.5 py-0.5 text-xs text-ghana-gold-800">
                      Note: {l.notes}
                    </p>
                  )}
                </div>
                <p className="tabular-nums">{formatMoney(l.lineTotal)}</p>
              </li>
            ))}
            <li className="flex justify-between p-3 text-sm font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(order.total)}</span>
            </li>
          </ul>
          {order.notes && (
            <p className="mt-3 rounded-lg bg-ghana-gold-50 p-3 text-sm text-ghana-gold-900">
              <span className="font-semibold">Customer notes:</span> {order.notes}
            </p>
          )}
        </section>

        {/* Internal notes */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Internal notes
          </h3>
          <Textarea
            rows={3}
            value={notesValue}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Only visible to you"
            aria-label="Internal notes"
          />
          {notes !== null && notes !== order.internalNotes && (
            <Button
              size="sm"
              variant="primary"
              className="mt-2"
              loading={patch.isPending}
              onClick={() =>
                patch.mutate(
                  { internalNotes: notes },
                  {
                    onSuccess: () => {
                      toast.success('Notes saved');
                      setNotes(null);
                    },
                  },
                )
              }
            >
              Save notes
            </Button>
          )}
        </section>

        {/* History */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            History
          </h3>
          <ol className="relative space-y-4 border-l border-neutral-200 pl-5">
            {[...order.statusHistory].reverse().map((h, i) => (
              <li key={i} className="relative">
                <span
                  className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-neutral-400 ring-1 ring-neutral-300"
                  aria-hidden
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <StatusPill status={h.status} />
                  <span className="text-neutral-500">{fmtDateTime(h.at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  by {h.by}
                  {h.notified && ' · customer emailed'}
                </p>
                {h.note && <p className="mt-1 text-xs italic text-neutral-600">“{h.note}”</p>}
              </li>
            ))}
          </ol>
        </section>

        {/* Emails */}
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Emails
          </h3>
          {emails.length === 0 ? (
            <p className="text-sm text-neutral-500">No emails yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {emails.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.subject}</p>
                    <p className="truncate text-xs text-neutral-500">
                      to {e.to} · {fmtDateTime(e.createdAt)}
                    </p>
                    {e.error && <p className="text-xs text-ghana-red">{e.error}</p>}
                  </div>
                  {e.status === 'failed' ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => resend.mutate(e.id)}
                      loading={resend.isPending && resend.variables === e.id}
                    >
                      <RefreshCw size={13} aria-hidden /> Resend
                    </Button>
                  ) : (
                    <span className="shrink-0 rounded-full bg-ghana-green-50 px-2 py-0.5 text-xs font-medium text-ghana-green-700">
                      {e.status === 'sent_dev' ? 'Sent (dev)' : 'Sent'}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export function OrderDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!id}
      onClose={onClose}
      title="Order details"
      hideTitle
      variant="drawer-right"
      className="sm:!max-w-xl"
    >
      {id && <DrawerBody key={id} id={id} onClose={onClose} />}
    </Dialog>
  );
}
