import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Mail, RefreshCw } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import type { EmailLogDTO, Paginated } from '../../../shared/types';
import { Button, Card, EmptyState, ErrorState, PageHeader, SkeletonRows, Spinner } from '../ui';
import { fmtDateTime } from '../api';
import { Dialog } from '../../components/ui/Dialog';
import { cn } from '../../lib/cn';

const TYPE_LABELS: Record<EmailLogDTO['type'], string> = {
  owner_new_order: 'New order (owner)',
  customer_order_received: 'Order received',
  customer_status_update: 'Status update',
  marketing: 'Marketing',
  direct: 'Direct message',
  test: 'Test',
};

function PreviewBody({ id }: { id: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'emails', 'preview', id], queryFn: () => api<{ html: string; subject: string; to: string }>(`/admin/emails/${id}/preview`) });
  if (isLoading || !data) return <div className="grid h-64 place-items-center"><Spinner /></div>;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-6 pb-3 text-sm text-neutral-500">To {data.to}</p>
      <iframe title="Email preview" srcDoc={data.html} sandbox="" className="h-[70vh] w-full bg-[#F4EFE8]" />
    </div>
  );
}

export default function EmailLog() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'all' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Email log · +233 Kitchen Admin';
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'emails', status, page],
    queryFn: () => api<Paginated<EmailLogDTO> & { failedCount: number }>(`/admin/emails?status=${status}&page=${page}`),
    placeholderData: keepPreviousData,
  });
  const resend = useMutation({
    mutationFn: (id: string) => api<{ ok: boolean; error?: string }>(`/admin/emails/${id}/resend`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Email sent');
      qc.invalidateQueries({ queryKey: ['admin', 'emails'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? (((e.data as { error?: string })?.error) ?? e.message) : 'Resend failed'),
  });

  return (
    <>
      <PageHeader title="Email log" sub="Every email the site sends. Failed emails never block an order, so resend them here." />
      <div className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white p-1">
        {(['all', 'failed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatus(s); setPage(1); }}
            aria-pressed={status === s}
            className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', status === s ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100')}
          >
            {s === 'all' ? 'All' : 'Failed'}
            {s === 'failed' && !!data?.failedCount && <span className="rounded bg-ghana-red px-1 text-xs text-white">{data.failedCount}</span>}
          </button>
        ))}
      </div>
      {isError && <ErrorState message="Could not load emails." onRetry={refetch} />}
      <Card className="overflow-hidden">
        {isLoading ? (
          <SkeletonRows />
        ) : !data?.items.length ? (
          <EmptyState icon={<Mail size={20} />} title={status === 'failed' ? 'No failed emails 🎉' : 'No emails yet'} />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {data.items.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.subject}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {TYPE_LABELS[e.type]} · to {e.to} · {fmtDateTime(e.createdAt)}
                    {e.orderNumber && e.orderId && (
                      <> · <Link className="underline" to={`/admin/orders?order=${e.orderId}&status=all`}>{e.orderNumber}</Link></>
                    )}
                  </p>
                  {e.error && <p className="text-xs text-ghana-red">{e.error}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', e.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-ghana-green-50 text-ghana-green-700')}>
                    {e.status === 'failed' ? 'Failed' : e.status === 'sent_dev' ? 'Sent (dev)' : 'Sent'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setPreviewId(e.id)} aria-label={`Preview ${e.subject}`}>
                    <Eye size={14} aria-hidden />
                  </Button>
                  {e.status === 'failed' && (
                    <Button size="sm" variant="danger" onClick={() => resend.mutate(e.id)} loading={resend.isPending && resend.variables === e.id}>
                      <RefreshCw size={13} aria-hidden /> Resend
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {data && data.total > data.pageSize && (
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <Button size="sm" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
      <Dialog open={!!previewId} onClose={() => setPreviewId(null)} title="Email preview" variant="center" className="!w-[min(720px,100%)]">
        {previewId && <PreviewBody id={previewId} />}
      </Dialog>
    </>
  );
}
