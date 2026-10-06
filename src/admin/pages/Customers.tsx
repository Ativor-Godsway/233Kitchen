import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, Mail, MessageSquare, Phone, Search, Send, Users, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { formatMoney } from '../../../shared/pricing';
import type { CustomerDTO, OrderDTO, Paginated } from '../../../shared/types';
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Select, SkeletonRows, Spinner, StatusPill, Textarea, Toggle } from '../ui';
import { downloadUrl, fmtDate, smsHref, telHref } from '../api';
import { Dialog } from '../../components/ui/Dialog';

function ConsentBadge({ c }: { c: CustomerDTO }) {
  if (c.unsubscribedAt) return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">Unsubscribed</span>;
  return c.marketingConsent ? (
    <span className="rounded-full bg-ghana-green-50 px-2 py-0.5 text-xs font-medium text-ghana-green-700">Opted in</span>
  ) : (
    <span className="rounded-full bg-neutral-50 px-2 py-0.5 text-xs text-neutral-500 ring-1 ring-inset ring-neutral-200">No marketing</span>
  );
}

function Profile({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'customers', 'detail', id],
    queryFn: () => api<{ customer: CustomerDTO; orders: OrderDTO[] }>(`/admin/customers/${id}`),
  });
  const [notes, setNotes] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ customer: CustomerDTO }>(`/admin/customers/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
      toast.success('Customer updated');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save'),
  });

  if (isLoading) return <div className="grid flex-1 place-items-center"><Spinner /></div>;
  if (isError || !data) return <div className="p-6"><ErrorState message="Could not load customer." onRetry={refetch} /></div>;
  const { customer: c, orders } = data;

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || c.tags.includes(t)) return setTagInput('');
    save.mutate({ tags: [...c.tags, t] });
    setTagInput('');
  };

  return (
    <>
      <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4">
        <div>
          <p className="text-lg font-semibold">{c.name}</p>
          <p className="text-xs text-neutral-500">Customer since {fmtDate(c.createdAt)}</p>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100" aria-label="Close">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Orders</p>
            <p className="text-xl font-semibold">{c.orderCount}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Spent</p>
            <p className="text-xl font-semibold">{formatMoney(c.totalSpent)}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-3">
            <p className="text-xs text-neutral-500">Last order</p>
            <p className="text-sm font-semibold">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : '–'}</p>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 p-4 text-sm">
          <p>{c.email}</p>
          <p className="text-neutral-600">{c.phone}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <a href={telHref(c.phone)} className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 font-medium hover:bg-neutral-50"><Phone size={15} aria-hidden /> Call</a>
            <a href={smsHref(c.phone)} className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 font-medium hover:bg-neutral-50"><MessageSquare size={15} aria-hidden /> Text</a>
            <Link to={`/admin/marketing?customer=${c.id}`} className="flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 py-2 font-medium hover:bg-neutral-50"><Mail size={15} aria-hidden /> Email</Link>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
          <div>
            <p className="text-sm font-medium">Marketing emails</p>
            <p className="text-xs text-neutral-500">
              {c.unsubscribedAt ? `Unsubscribed ${fmtDate(c.unsubscribedAt)}` : c.marketingConsent ? 'Opted in at checkout' : 'Has not opted in'}
            </p>
          </div>
          <Toggle
            label="Marketing consent"
            checked={c.marketingConsent}
            disabled={save.isPending}
            onChange={(v) => {
              if (v && !window.confirm('Only turn this on if the customer has asked to receive marketing emails. Continue?')) return;
              save.mutate({ marketingConsent: v });
            }}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {c.tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-0.5 pl-2.5 pr-1 text-xs font-medium">
                {t}
                <button type="button" className="grid h-4 w-4 place-items-center rounded-full hover:bg-neutral-300" aria-label={`Remove tag ${t}`} onClick={() => save.mutate({ tags: c.tags.filter((x) => x !== t) })}>
                  <X size={10} aria-hidden />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addTag();
            }}
          >
            <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Add a tag (e.g. vip, church)" maxLength={30} aria-label="New tag" />
            <Button type="submit" disabled={!tagInput.trim()}>Add</Button>
          </form>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Notes</p>
          <Textarea rows={3} value={notes ?? c.notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferences, allergies, anything useful…" aria-label="Customer notes" />
          {notes !== null && notes !== c.notes && (
            <Button size="sm" variant="primary" className="mt-2" loading={save.isPending} onClick={() => save.mutate({ notes }, { onSuccess: () => setNotes(null) })}>
              Save notes
            </Button>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Order history</p>
          {orders.length === 0 ? (
            <p className="text-sm text-neutral-500">No orders.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link to={`/admin/orders?order=${o.id}&status=all`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-neutral-50">
                    <div>
                      <p className="font-medium">{o.number} · {o.pickupDateLabel}</p>
                      <p className="text-xs text-neutral-500">{o.items.map((l) => `${l.quantity}× ${l.name}`).join(', ')}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-medium tabular-nums">{formatMoney(o.total)}</span>
                      <StatusPill status={o.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const consent = params.get('consent') ?? 'all';
  const tag = params.get('tag') ?? '';
  const sort = params.get('sort') ?? 'lastOrder';
  const page = Number(params.get('page') ?? 1);
  const openId = params.get('customer');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in patch) && !('customer' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const t = setTimeout(() => (params.get('q') ?? '') !== search && update({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  useEffect(() => {
    document.title = 'Customers · +233 Kitchen Admin';
  }, []);

  const qs = new URLSearchParams({ consent, sort, page: String(page), pageSize: '25' });
  if (tag) qs.set('tag', tag);
  if (params.get('q')) qs.set('q', params.get('q')!);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'customers', 'list', qs.toString()],
    queryFn: () => api<Paginated<CustomerDTO>>(`/admin/customers?${qs}`),
    placeholderData: keepPreviousData,
  });
  const tags = useQuery({ queryKey: ['admin', 'customers', 'tags'], queryFn: () => api<{ tags: string[] }>('/admin/customers/tags') });
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allOnPage = !!data?.items.length && data.items.every((c) => selected.has(c.id));

  const exportQs = new URLSearchParams(qs);
  exportQs.delete('page');
  exportQs.delete('pageSize');

  return (
    <>
      <PageHeader
        title="Customers"
        sub="Created automatically from orders."
        actions={
          <>
            {selected.size > 0 && (
              <Button variant="brand" onClick={() => navigate('/admin/marketing', { state: { customerIds: [...selected] } })}>
                <Send size={16} aria-hidden /> Email {selected.size} selected
              </Button>
            )}
            <Button onClick={() => downloadUrl(`/admin/customers/export.csv?${exportQs}`)}>
              <Download size={16} aria-hidden /> Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_170px_150px_170px]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className="pl-9" aria-label="Search customers" />
        </div>
        <Select value={consent} onChange={(e) => update({ consent: e.target.value })} aria-label="Marketing consent">
          <option value="all">All customers</option>
          <option value="opted_in">Opted in</option>
          <option value="not_opted_in">Not opted in</option>
        </Select>
        <Select value={tag} onChange={(e) => update({ tag: e.target.value })} aria-label="Tag">
          <option value="">Any tag</option>
          {tags.data?.tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
          <option value="lastOrder">Last order</option>
          <option value="totalSpent">Total spent</option>
          <option value="orderCount">Most orders</option>
          <option value="newest">Newest</option>
          <option value="name">Name A–Z</option>
        </Select>
      </div>

      {isError && <ErrorState message="Could not load customers." onRetry={refetch} />}
      <Card className="overflow-hidden">
        {isLoading ? (
          <SkeletonRows />
        ) : !data?.items.length ? (
          <EmptyState icon={<Users size={20} />} title="No customers found" body="Customers appear here after their first order." />
        ) : (
          <>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ghana-green"
                      checked={allOnPage}
                      onChange={() => setSelected((s) => { const n = new Set(s); data.items.forEach((c) => (allOnPage ? n.delete(c.id) : n.add(c.id))); return n; })}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3">Last order</th>
                  <th className="px-4 py-3">Marketing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="h-4 w-4 accent-ghana-green" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
                    </td>
                    <td className="cursor-pointer px-4 py-3" onClick={() => update({ customer: c.id })}>
                      <button type="button" className="text-left font-medium hover:underline">{c.name}</button>
                      <p className="text-xs text-neutral-500">{c.email}</p>
                      {c.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.tags.map((t) => <span key={t} className="rounded bg-neutral-100 px-1.5 text-[11px] text-neutral-600">{t}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{c.phone}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-neutral-600">{c.lastOrderAt ? fmtDate(c.lastOrderAt) : '–'}</td>
                    <td className="px-4 py-3"><ConsentBadge c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {data.items.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-ghana-green" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => update({ customer: c.id })}>
                    <div className="flex justify-between gap-2">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="font-medium tabular-nums">{formatMoney(c.totalSpent)}</p>
                    </div>
                    <p className="truncate text-xs text-neutral-500">{c.email}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-neutral-500">
                      <span>{c.orderCount} order{c.orderCount === 1 ? '' : 's'}</span>
                      <ConsentBadge c={c} />
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
          <p>{(page - 1) * data.pageSize + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total}</p>
          <div className="flex gap-1">
            <button type="button" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} aria-hidden /></button>
            <button type="button" disabled={page >= pages} onClick={() => update({ page: String(page + 1) })} className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 bg-white disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} aria-hidden /></button>
          </div>
        </div>
      )}

      <Dialog open={!!openId} onClose={() => update({ customer: null })} title="Customer profile" hideTitle variant="drawer-right" className="sm:!max-w-lg">
        {openId && <Profile key={openId} id={openId} onClose={() => update({ customer: null })} />}
      </Dialog>
    </>
  );
}
