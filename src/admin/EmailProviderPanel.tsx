import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Send, XCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { cn } from '../lib/cn';
import { Button } from './ui';
import { useAdminSettings, useMe, type EmailStatus } from './api';

interface TestResult {
  to: string;
  ok: boolean;
  status: 'sent' | 'sent_dev' | 'failed';
  error: string | null;
}

/**
 * Shows which email provider is really active (and any misconfiguration), with "Send test email"
 * buttons that go through the real provider: to the logged-in admin, or to every new-order inbox.
 */
export function EmailProviderPanel({ compact }: { compact?: boolean }) {
  const qc = useQueryClient();
  const { data } = useAdminSettings();
  const { data: me } = useMe();
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [requestError, setRequestError] = useState('');

  const test = useMutation({
    mutationFn: (target: 'me' | 'notifications') =>
      api<{ emailStatus: EmailStatus; results: TestResult[] }>('/admin/settings/test-email', {
        method: 'POST',
        json: { target },
      }),
    onMutate: () => {
      setResults(null);
      setRequestError('');
    },
    onSuccess: (r) => {
      setResults(r.results);
      qc.setQueryData(['admin', 'settings'], (old: object | undefined) =>
        old ? { ...old, emailStatus: r.emailStatus, emailProvider: r.emailStatus.provider } : old,
      );
      qc.invalidateQueries({ queryKey: ['admin', 'emails'] });
    },
    onError: (e) =>
      setRequestError(e instanceof ApiError ? e.message : 'Could not send the test email'),
  });

  const s = data?.emailStatus;
  if (!s) return null;
  const bad = !!s.misconfigured || s.provider === 'none';
  const devOnly = !bad && s.provider === 'dev';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-sm',
        bad
          ? 'border-red-200 bg-red-50'
          : devOnly
            ? 'border-ghana-gold-200 bg-ghana-gold-50'
            : 'border-ghana-green-200 bg-ghana-green-50',
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p
            className={cn(
              'flex items-center gap-1.5 font-semibold',
              bad ? 'text-red-800' : devOnly ? 'text-ghana-gold-900' : 'text-ghana-green-800',
            )}
          >
            {bad ? (
              <AlertTriangle size={16} aria-hidden />
            ) : devOnly ? (
              <AlertTriangle size={16} aria-hidden />
            ) : (
              <CheckCircle2 size={16} aria-hidden />
            )}
            Email provider: {s.label}
          </p>
          {s.misconfigured && (
            <p className="mt-1 text-red-800" role="alert">
              {s.misconfigured}. New-order and customer emails are being logged as{' '}
              <strong>failed</strong>. Fix the environment variables, restart the server, then
              resend them from the Email log.
            </p>
          )}
          {devOnly && (
            <p className="mt-1 text-ghana-gold-900">
              Development mode: emails are saved as previews in ./.email-previews and are not
              delivered.
            </p>
          )}
          {!compact && (
            <p className="mt-1 break-all text-neutral-600">
              From {s.from} · OWNER_EMAIL {s.ownerEmail || 'not set'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button
            onClick={() => test.mutate('me')}
            loading={test.isPending && test.variables === 'me'}
            disabled={test.isPending}
            title={me ? `Sends a test email to ${me.email}` : undefined}
          >
            <Send size={15} aria-hidden /> Send test email to me
          </Button>
          {!compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => test.mutate('notifications')}
              loading={test.isPending && test.variables === 'notifications'}
              disabled={test.isPending}
            >
              Test the new-order inboxes
            </Button>
          )}
        </div>
      </div>

      {requestError && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-red-800" role="alert">
          {requestError}
        </p>
      )}
      {results && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {results.map((r) => (
            <li key={r.to} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2">
              {r.ok && r.status === 'sent' ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ghana-green" aria-hidden />
              ) : r.ok ? (
                <AlertTriangle
                  size={16}
                  className="mt-0.5 shrink-0 text-ghana-gold-700"
                  aria-hidden
                />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0 text-ghana-red" aria-hidden />
              )}
              <span className="min-w-0 break-words">
                <strong>{r.to}</strong>:{' '}
                {r.status === 'sent' ? (
                  'sent. Check the inbox (and spam).'
                ) : r.status === 'sent_dev' ? (
                  'dev preview only (not delivered).'
                ) : (
                  <span className="text-red-800">{r.error ?? 'failed'}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
