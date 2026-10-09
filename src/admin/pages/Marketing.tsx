import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Eye, FlaskConical, Megaphone, Play, Send } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { CampaignInput } from '../../../shared/schemas';
import type { CampaignDTO, CustomerDTO, EmailQuota, SegmentType } from '../../../shared/types';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from '../ui';
import { fmtDateTime } from '../api';
import { Dialog } from '../../components/ui/Dialog';

const SEGMENTS: Array<{ id: SegmentType; label: string; hint: string }> = [
  {
    id: 'all_opted_in',
    label: 'Everyone opted in',
    hint: 'All customers who ticked “email me about new menu items”.',
  },
  {
    id: 'ordered_last_30',
    label: 'Ordered in the last 30 days',
    hint: 'Opted-in customers with a recent order.',
  },
  {
    id: 'lapsed_60',
    label: 'Haven’t ordered in 60+ days',
    hint: 'Win-back: opted-in customers who haven’t ordered lately.',
  },
  { id: 'tag', label: 'By tag', hint: 'Opted-in customers with a specific tag.' },
  {
    id: 'selected',
    label: 'Selected customers',
    hint: 'Chosen on the Customers page (only opted-in ones receive it).',
  },
  {
    id: 'single',
    label: 'One customer (direct message)',
    hint: 'A one-to-one message, e.g. about their order. Sent regardless of marketing consent.',
  },
];

type Preview = {
  recipientCount: number;
  quota: EmailQuota;
  transactional: boolean;
  sample: Array<{ name: string; email: string }>;
  html: string;
  subject: string;
};

const EMPTY = { subject: '', heading: '', body: '', imageUrl: '', ctaLabel: '', ctaUrl: '' };

type BatchResult = { campaign: CampaignDTO; quota: EmailQuota };

const STATUS_TEXT: Record<CampaignDTO['status'], string> = {
  sending: 'In progress',
  paused: 'Paused (daily limit)',
  sent: 'Sent',
  partial: 'Partly sent',
  failed: 'Failed',
};

/** Warns before a send that would run into the daily email limit (Gmail: ~500/day). */
function QuotaNote({ quota, recipients }: { quota: EmailQuota; recipients: number }) {
  if (!quota.limit || quota.remaining === null) return null;
  const over = recipients > quota.remaining;
  return (
    <div
      className={
        over
          ? 'mx-4 mt-4 flex gap-2 rounded-lg bg-ghana-gold-50 p-3 text-sm text-ghana-gold-900'
          : 'mx-4 mt-4 flex gap-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600'
      }
      role={over ? 'alert' : 'note'}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <p>
        Your email account can send about {quota.limit} emails a day (Gmail’s limit is ~500).{' '}
        {quota.sentLast24h} sent in the last 24 hours, so up to <strong>{quota.remaining}</strong>{' '}
        more today.
        {over
          ? ` This email goes to ${recipients}: it will pause after ${quota.remaining} and you can resume it tomorrow from Campaign history.`
          : ` Emails go out in batches of ${quota.batchSize}; keep this page open while it sends.`}
      </p>
    </div>
  );
}

export default function Marketing() {
  const qc = useQueryClient();
  const location = useLocation();
  const [params] = useSearchParams();
  const singleId = params.get('customer');
  const stateIds = (location.state as { customerIds?: string[] } | null)?.customerIds;

  const [segment, setSegment] = useState<SegmentType>(
    singleId ? 'single' : stateIds?.length ? 'selected' : 'all_opted_in',
  );
  const [customerIds, setCustomerIds] = useState<string[]>(
    singleId ? [singleId] : (stateIds ?? []),
  );
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
    if (single.data && !form.subject)
      setForm((f) => ({ ...f, subject: 'A note from +233 Kitchen' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single.data]);

  const tags = useQuery({
    queryKey: ['admin', 'customers', 'tags'],
    queryFn: () => api<{ tags: string[] }>('/admin/customers/tags'),
  });
  const history = useQuery({
    queryKey: ['admin', 'campaigns'],
    queryFn: () => api<{ items: CampaignDTO[] }>('/admin/campaigns'),
  });

  const payload: CampaignInput = useMemo(
    () => ({
      ...form,
      segment,
      tag,
      customerIds: segment === 'single' || segment === 'selected' ? customerIds : [],
    }),
    [form, segment, tag, customerIds],
  );

  const onError = (e: unknown) => {
    if (e instanceof ApiError && e.fieldErrors) {
      setErrors(
        Object.fromEntries(Object.entries(e.fieldErrors).map(([k, v]) => [k, v?.[0] ?? 'Invalid'])),
      );
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
    mutationFn: () =>
      api<{ to: string; status: string }>('/admin/campaigns/test', {
        method: 'POST',
        json: payload,
      }),
    onSuccess: (r) =>
      toast.success(
        `Test sent to ${r.to}${r.status === 'sent_dev' ? ' (dev: see console / .email-previews)' : ''}`,
      ),
    onError,
  });
  /** Progress of the campaign being sent from this tab (one request per batch). */
  const [progress, setProgress] = useState<CampaignDTO | null>(null);
  const [sending, setSending] = useState(false);

  const report = ({ campaign: c }: BatchResult) => {
    if (c.status === 'paused')
      toast.warning(
        `Paused at today’s email limit: ${c.sentCount} of ${c.recipientCount} sent. Resume it tomorrow from Campaign history.`,
        { duration: 10_000 },
      );
    else if (c.failedCount)
      toast.warning(
        `Sent ${c.sentCount} of ${c.recipientCount}. ${c.failedCount} failed. See the Email log.`,
      );
    else toast.success(`Sent to ${c.sentCount} customer${c.sentCount === 1 ? '' : 's'}`);
  };

  /** Sends batch after batch until the campaign finishes, pauses or a request fails. */
  const drive = async (first: () => Promise<BatchResult>) => {
    setSending(true);
    try {
      let r = await first();
      setProgress(r.campaign);
      while (r.campaign.status === 'sending') {
        const id = r.campaign.id;
        r = await api<BatchResult>(`/admin/campaigns/${id}/continue`, { method: 'POST' });
        setProgress(r.campaign);
      }
      report(r);
      return r;
    } catch (e) {
      onError(e);
      return null;
    } finally {
      setSending(false);
      setProgress(null);
      qc.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      qc.invalidateQueries({ queryKey: ['admin', 'emails'] });
    }
  };

  const send = async () => {
    const r = await drive(() =>
      api<BatchResult>('/admin/campaigns/send', { method: 'POST', json: payload }),
    );
    setConfirmOpen(false);
    if (r) {
      setPreview(null);
      setForm(EMPTY);
    }
  };

  const resume = (id: string) =>
    drive(() => api<BatchResult>(`/admin/campaigns/${id}/continue`, { method: 'POST' }));

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setPreview(null);
  };
  const seg = SEGMENTS.find((s) => s.id === segment)!;

  return (
    <>
      <PageHeader
        title="Marketing"
        sub="Email opted-in customers about new dishes and offers, or message one customer directly."
      />

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
                {SEGMENTS.filter((s) =>
                  s.id === 'single'
                    ? !!singleId
                    : s.id === 'selected'
                      ? customerIds.length > 0 && !singleId
                      : true,
                ).map((s) => (
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
                <Select
                  id="tag"
                  value={tag}
                  onChange={(e) => {
                    setTag(e.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="">Choose a tag…</option>
                  {tags.data?.tags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {segment === 'selected' && (
              <p className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
                {customerIds.length} customer{customerIds.length === 1 ? '' : 's'} selected
                <button
                  type="button"
                  className="text-xs font-medium text-neutral-500 underline"
                  onClick={() => {
                    setCustomerIds([]);
                    setSegment('all_opted_in');
                  }}
                >
                  Clear
                </button>
              </p>
            )}
            <Field label="Subject" htmlFor="subject" error={errors.subject}>
              <Input
                id="subject"
                value={form.subject}
                onChange={set('subject')}
                maxLength={150}
                placeholder="New this week: Jollof Fridays 🍛"
              />
            </Field>
            <Field label="Heading (optional)" htmlFor="heading" error={errors.heading}>
              <Input id="heading" value={form.heading} onChange={set('heading')} maxLength={150} />
            </Field>
            <Field
              label="Message"
              htmlFor="body"
              error={errors.body}
              hint="Blank line = new paragraph. **bold** and links work."
            >
              <Textarea
                id="body"
                rows={8}
                value={form.body}
                onChange={set('body')}
                maxLength={10000}
              />
            </Field>
            <Field
              label="Image URL (optional)"
              htmlFor="imageUrl"
              error={errors.imageUrl}
              hint="An https:// link to a photo."
            >
              <Input
                id="imageUrl"
                value={form.imageUrl}
                onChange={set('imageUrl')}
                placeholder="https://…"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Button label (optional)" htmlFor="ctaLabel" error={errors.ctaLabel}>
                <Input
                  id="ctaLabel"
                  value={form.ctaLabel}
                  onChange={set('ctaLabel')}
                  maxLength={40}
                  placeholder="Order now"
                />
              </Field>
              <Field label="Button link" htmlFor="ctaUrl" error={errors.ctaUrl}>
                <Input
                  id="ctaUrl"
                  value={form.ctaUrl}
                  onChange={set('ctaUrl')}
                  placeholder={`${window.location.origin}/#menu`}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" loading={previewM.isPending}>
                <Eye size={16} aria-hidden /> Preview
              </Button>
              <Button type="button" onClick={() => testM.mutate()} loading={testM.isPending}>
                <FlaskConical size={16} aria-hidden /> Send test to me
              </Button>
              <Button
                type="button"
                variant="brand"
                disabled={!preview || preview.recipientCount === 0}
                onClick={() => setConfirmOpen(true)}
                title={!preview ? 'Preview first' : undefined}
              >
                <Send size={16} aria-hidden /> Send{preview ? ` to ${preview.recipientCount}` : ''}
              </Button>
            </div>
            {!preview && (
              <p className="text-xs text-neutral-500">Preview first to see who will receive it.</p>
            )}
          </form>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <CardHeader
            title="Preview"
            sub={
              preview
                ? `${preview.recipientCount} recipient${preview.recipientCount === 1 ? '' : 's'}${preview.transactional ? ' · direct message' : ' · marketing (unsubscribe link included)'}`
                : undefined
            }
          />
          {previewM.isPending ? (
            <div className="grid flex-1 place-items-center py-20">
              <Spinner />
            </div>
          ) : preview ? (
            <>
              {preview.recipientCount > 0 && !preview.transactional && (
                <QuotaNote quota={preview.quota} recipients={preview.recipientCount} />
              )}
              {preview.recipientCount === 0 && (
                <p className="m-4 rounded-lg bg-ghana-gold-50 p-3 text-sm text-ghana-gold-900">
                  No eligible recipients. Only customers who opted in can receive marketing emails.
                </p>
              )}
              {preview.sample.length > 0 && (
                <p className="border-b border-neutral-100 px-5 py-2 text-xs text-neutral-500">
                  To: {preview.sample.map((s) => s.name).join(', ')}
                  {preview.recipientCount > preview.sample.length
                    ? ` and ${preview.recipientCount - preview.sample.length} more`
                    : ''}
                </p>
              )}
              <iframe
                title="Email preview"
                srcDoc={preview.html}
                sandbox=""
                className="h-[640px] w-full flex-1 bg-[#F4EFE8]"
              />
            </>
          ) : (
            <EmptyState
              icon={<Eye size={20} />}
              title="No preview yet"
              body="Write your message and press Preview."
            />
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Campaign history" />
        {history.isLoading ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
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
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {history.data.items.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.subject}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                      {SEGMENTS.find((s) => s.id === c.segment)?.label ?? c.segment}
                      {c.tag ? `: ${c.tag}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.recipientCount}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          c.failedCount
                            ? 'text-ghana-red'
                            : c.pendingCount
                              ? 'text-ghana-gold-800'
                              : 'text-ghana-green-700'
                        }
                      >
                        {c.sentCount} sent{c.failedCount ? ` · ${c.failedCount} failed` : ''}
                        {c.pendingCount ? ` · ${c.pendingCount} waiting` : ''}
                      </span>
                      <span className="block text-xs text-neutral-500">
                        {STATUS_TEXT[c.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                      {c.sentAt ? fmtDateTime(c.sentAt) : '–'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {(c.status === 'paused' || c.status === 'sending') && (
                        <Button
                          size="sm"
                          onClick={() => resume(c.id)}
                          disabled={sending}
                          aria-label={`Resume sending “${c.subject}”`}
                        >
                          <Play size={14} aria-hidden /> Resume
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Send email?"
        variant="center"
      >
        <div className="space-y-4 p-6 pt-0">
          <p className="text-sm text-neutral-600">
            “{form.subject}” will be sent to <strong>{preview?.recipientCount}</strong> customer
            {preview?.recipientCount === 1 ? '' : 's'}. This can’t be undone.
          </p>
          {progress && (
            <div aria-live="polite">
              <p className="text-sm font-medium">
                Sending… {progress.sentCount + progress.failedCount + progress.skippedCount} of{' '}
                {progress.recipientCount}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-ghana-green transition-all"
                  style={{
                    width: `${Math.round(((progress.recipientCount - progress.pendingCount) / progress.recipientCount) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                Keep this page open until it finishes.
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={sending} onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" loading={sending} onClick={send}>
              <Send size={16} aria-hidden /> Send now
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
