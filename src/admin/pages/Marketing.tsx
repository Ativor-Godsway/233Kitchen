import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, FlaskConical, Megaphone, Send } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { CampaignInput } from '../../../shared/schemas';
import type { CampaignDTO, CustomerDTO, SegmentType } from '../../../shared/types';
import { Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, Select, Spinner, Textarea } from '../ui';
import { fmtDateTime } from '../api';
import { Dialog } from '../../components/ui/Dialog';

const SEGMENTS: Array<{ id: SegmentType; label: string; hint: string }> = [
  { id: 'all_opted_in', label: 'Everyone opted in', hint: 'All customers who ticked “email me about new menu items”.' },
  { id: 'ordered_last_30', label: 'Ordered in the last 30 days', hint: 'Opted-in customers with a recent order.' },
  { id: 'lapsed_60', label: 'Haven’t ordered in 60+ days', hint: 'Win-back: opted-in customers who haven’t ordered lately.' },
  { id: 'tag', label: 'By tag', hint: 'Opted-in customers with a specific tag.' },
  { id: 'selected', label: 'Selected customers', hint: 'Chosen on the Customers page (only opted-in ones receive it).' },
  { id: 'single', label: 'One customer (direct message)', hint: 'A one-to-one message, e.g. about their order. Sent regardless of marketing consent.' },
];

type Preview = { recipientCount: number; transactional: boolean; sample: Array<{ name: string; email: string }>; html: string; subject: string };

const EMPTY = { subject: '', heading: '', body: '', imageUrl: '', ctaLabel: '', ctaUrl: '' };

export default function Marketing() {
  const qc = useQueryClient();
  const location = useLocation();
  const [params] = useSearchParams();
  const singleId = params.get('customer');
  const stateIds = (location.state as { customerIds?: string[] } | null)?.customerIds;

  const [segment, setSegment] = useState<SegmentType>(singleId ? 'single' : stateIds?.length ? 'selected' : 'all_opted_in');
  const [customerIds, setCustomerIds] = useState<string[]>(singleId ? [singleId] : (stateIds ?? []));
  const [tag, setTag] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = 'Marketing · +233 Kitchen Admin';
  }, []);

  const single = useQuery({
    queryKey: ['admin', 'customers', 'detail', singleId],
    queryFn: () => api<{ customer: CustomerDTO }>(`/admin/customers/${singleId}`),
    enabled: !!singleId,
  });
  useEffect(() => {
    if (single.data && !form.subject) setForm((f) => ({ ...f, subject: 'A note from +233 Kitchen' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single.data]);

  const tags = useQuery({ queryKey: ['admin', 'customers', 'tags'], queryFn: () => api<{ tags: string[] }>('/admin/customers/tags') });
  const history = useQuery({ queryKey: ['admin', 'campaigns'], queryFn: () => api<{ items: CampaignDTO[] }>('/admin/campaigns') });

  const payload: CampaignInput = useMemo(
    () => ({ ...form, segment, tag, customerIds: segment === 'single' || segment === 'selected' ? customerIds : [] }),
    [form, segment, tag, customerIds],
  );

  const onError = (e: unknown) => {
    if (e instanceof ApiError && e.fieldErrors) {
      setErrors(Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v?.[0] ?? 'Invalid'])));
    }
    toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
  };

  const previewM = useMutation({
    mutationFn: () => api<Preview>('/admin/campaigns/preview', { method: 'POST', json: payload }),
    onSuccess: (p) => {
      setErrors({});
      setPreview(p);
    },
    onError,
  });
  const testM = useMutation({
    mutationFn: () => api<{ to: string; status: string }>('/admin/campaigns/test', { method: 'POST', json: payload }),
    onSuccess: (r) => toast.success(`Test sent to ${r.to}${r.status === 'sent_dev' ? ' (dev: see console / .email-previews)' : ''}`),
    onError,
  });
  const sendM = useMutation({
    mutationFn: () => api<{ campaign: CampaignDTO }>('/admin/campaigns/send', { method: 'POST', json: payload }),
    onSuccess: ({ campaign }) => {
      setConfirmOpen(false);
      setPreview(null);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      if (campaign.failedCount) toast.warning(`Sent ${campaign.sentCount} of ${campaign.recipientCount}. ${campaign.failedCount} failed. See the Email log.`);
      else toast.success(`Sent to ${campaign.sentCount} customer${campaign.sentCount === 1 ? '' : 's'}`);
    },
    onError: (e) => {
      setConfirmOpen(false);
      onError(e);
    },
  });

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setPreview(null);
  };
  const seg = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <>
      <PageHeader title="Marketing" sub="Email opted-in customers about new dishes and offers, or message one customer directly." />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Compose" />
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              previewM.mutate();
            }}
          >
            <Field label="Audience" htmlFor="segment" hint={seg.hint}>
              <Select
                id="segment"
                value={segment}
                onChange={(e) => {
                  setSegment(e.target.value as SegmentType);
                  setPreview(null);
                }}
              >
                {SEGMENTS.filter((s) => (s.id === 'single' ? !!singleId : s.id === 'selected' ? customerIds.length > 0 && !singleId : true)).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.id === 'selected' ? ` (${customerIds.length})` : ''}
                    {s.id === 'single' && single.data ? `: ${single.data.customer.name}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            {segment === 'tag' && (
              <Field label="Tag" htmlFor="tag" error={errors.tag}>
                <Select id="tag" value={tag} onChange={(e) => { setTag(e.target.value); setPreview(null); }}>
                  <option value="">Choose a tag…</option>
                  {tags.data?.tags.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
            )}
            {segment === 'selected' && (
              <p className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                {customerIds.length} customer{customerIds.length === 1 ? '' : 's'} selected
                <button type="button" className="text-xs font-medium text-neutral-500 underline" onClick={() => { setCustomerIds([]); setSegment('all_opted_in'); }}>
                  Clear
                </button>
              </p>
            )}
            <Field label="Subject" htmlFor="subject" error={errors.subject}>
              <Input id="subject" value={form.subject} onChange={set('subject')} maxLength={150} placeholder="New this week: Jollof Fridays 🍛" />
            </Field>
            <Field label="Heading (optional)" htmlFor="heading" error={errors.heading}>
              <Input id="heading" value={form.heading} onChange={set('heading')} maxLength={150} />
            </Field>
            <Field label="Message" htmlFor="body" error={errors.body} hint="Blank line = new paragraph. **bold** and links work.">
              <Textarea id="body" rows={8} value={form.body} onChange={set('body')} maxLength={10000} />
            </Field>
            <Field label="Image URL (optional)" htmlFor="imageUrl" error={errors.imageUrl} hint="An https:// link to a photo.">
              <Input id="imageUrl" value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://…" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Button label (optional)" htmlFor="ctaLabel" error={errors.ctaLabel}>
                <Input id="ctaLabel" value={form.ctaLabel} onChange={set('ctaLabel')} maxLength={40} placeholder="Order now" />
              </Field>
              <Field label="Button link" htmlFor="ctaUrl" error={errors.ctaUrl}>
                <Input id="ctaUrl" value={form.ctaUrl} onChange={set('ctaUrl')} placeholder={`${window.location.origin}/#menu`} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" loading={previewM.isPending}>
                <Eye size={16} aria-hidden /> Preview
              </Button>
              <Button type="button" onClick={() => testM.mutate()} loading={testM.isPending}>
                <FlaskConical size={16} aria-hidden /> Send test to me
              </Button>
              <Button type="button" variant="brand" disabled={!preview || preview.recipientCount === 0} onClick={() => setConfirmOpen(true)} title={!preview ? 'Preview first' : undefined}>
                <Send size={16} aria-hidden /> Send{preview ? ` to ${preview.recipientCount}` : ''}
              </Button>
            </div>
            {!preview && <p className="text-xs text-neutral-500">Preview first to see who will receive it.</p>}
          </form>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title="Preview"
            sub={preview ? `${preview.recipientCount} recipient${preview.recipientCount === 1 ? '' : 's'}${preview.transactional ? ' · direct message' : ' · marketing (unsubscribe link included)'}` : undefined}
          />
          {previewM.isPending ? (
            <div className="grid flex-1 place-items-center py-20"><Spinner /></div>
          ) : preview ? (
            <>
              {preview.recipientCount === 0 && (
                <p className="m-4 rounded-lg bg-ghana-gold-50 p-3 text-sm text-ghana-gold-900">No eligible recipients. Only customers who opted in can receive marketing emails.</p>
              )}
              {preview.sample.length > 0 && (
                <p className="border-b border-neutral-100 px-5 py-2 text-xs text-neutral-500">
                  To: {preview.sample.map((s) => s.name).join(', ')}{preview.recipientCount > preview.sample.length ? ` and ${preview.recipientCount - preview.sample.length} more` : ''}
                </p>
              )}
              <iframe title="Email preview" srcDoc={preview.html} sandbox="" className="h-[640px] w-full flex-1 bg-[#F4EFE8]" />
            </>
          ) : (
            <EmptyState icon={<Eye size={20} />} title="No preview yet" body="Write your message and press Preview." />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Campaign history" />
        {history.isLoading ? (
          <div className="grid place-items-center py-10"><Spinner /></div>
        ) : !history.data?.items.length ? (
          <EmptyState icon={<Megaphone size={20} />} title="No emails sent yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3 text-right">Recipients</th>
                  <th className="px-4 py-3">Delivery</th>
                  <th className="px-4 py-3">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {history.data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.subject}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{SEGMENTS.find((s) => s.id === c.segment)?.label ?? c.segment}{c.tag ? `: ${c.tag}` : ''}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.recipientCount}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={c.failedCount ? 'text-ghana-red' : 'text-ghana-green-700'}>
                        {c.sentCount} sent{c.failedCount ? ` · ${c.failedCount} failed` : ''}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{c.sentAt ? fmtDateTime(c.sentAt) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Send email?" variant="center">
        <div className="space-y-4 p-6 pt-0">
          <p className="text-sm text-neutral-600">
            “{form.subject}” will be sent to <strong>{preview?.recipientCount}</strong> customer{preview?.recipientCount === 1 ? '' : 's'}. This can’t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="brand" loading={sendM.isPending} onClick={() => sendM.mutate()}>
              <Send size={16} aria-hidden /> Send now
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
