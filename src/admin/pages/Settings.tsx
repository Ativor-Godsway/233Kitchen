import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { ORDER_STATUSES, STATUS_LABELS } from '../../../shared/constants';
import type { OrderStatus, Settings as S } from '../../../shared/types';
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  Toggle,
} from '../ui';
import { useAdminSettings } from '../api';
import { EmailProviderPanel } from '../EmailProviderPanel';
import { mapLinks } from '../../../shared/maps';
import { cn } from '../../lib/cn';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} sub={sub} />
      <div className="space-y-4 p-5">{children}</div>
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const m = useMutation({
    mutationFn: () =>
      api('/admin/password', {
        method: 'POST',
        json: { currentPassword: current, newPassword: next },
      }),
    onSuccess: () => {
      toast.success('Password changed. Other devices have been signed out.');
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (e) =>
      toast.error(
        e instanceof ApiError
          ? (e.fieldErrors?.newPassword?.[0] ?? e.message)
          : 'Could not change password',
      ),
  });
  const mismatch = confirm.length > 0 && confirm !== next;
  return (
    <Section
      title="Change password"
      sub="At least 10 characters. Changing it signs out other devices."
    >
      <form
        className="grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mismatch) m.mutate();
        }}
      >
        <Field label="Current password" htmlFor="pw-cur">
          <Input
            id="pw-cur"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </Field>
        <Field label="New password" htmlFor="pw-new">
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />
        </Field>
        <Field
          label="Confirm new password"
          htmlFor="pw-conf"
          error={mismatch ? 'Passwords don’t match' : undefined}
        >
          <Input
            id="pw-conf"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <div className="sm:col-span-3">
          <Button
            type="submit"
            variant="primary"
            loading={m.isPending}
            disabled={!current || next.length < 10 || mismatch}
          >
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useAdminSettings();
  const [s, setS] = useState<S | null>(null);
  const [emailsText, setEmailsText] = useState('');
  const [newClosed, setNewClosed] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = 'Settings · +233 Kitchen Admin';
  }, []);
  useEffect(() => {
    if (data && !s) {
      setS(data.settings);
      setEmailsText(data.settings.notificationEmails.join('\n'));
    }
  }, [data, s]);

  const save = useMutation({
    mutationFn: (next: S) => api<{ settings: S }>('/admin/settings', { method: 'PUT', json: next }),
    onSuccess: (r) => {
      setS(r.settings);
      setEmailsText(r.settings.notificationEmails.join('\n'));
      setErrors({});
      qc.setQueryData(['admin', 'settings'], (old: object | undefined) => ({
        ...(old ?? {}),
        settings: r.settings,
      }));
      qc.invalidateQueries({ queryKey: ['config'] });
      toast.success('Settings saved');
    },
    onError: (e) => {
      if (e instanceof ApiError && e.fieldErrors)
        setErrors(
          Object.fromEntries(
            Object.entries(e.fieldErrors).map(([k, v]) => [k, v?.[0] ?? 'Invalid']),
          ),
        );
      toast.error(e instanceof ApiError ? e.message : 'Could not save settings');
    },
  });

  if (isLoading || (!s && !isError))
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  if (isError || !s) return <ErrorState message="Could not load settings." onRetry={refetch} />;

  const up = <K extends keyof S>(k: K, v: S[K]) => setS({ ...s, [k]: v });
  const dirty =
    JSON.stringify(s) !== JSON.stringify(data?.settings) ||
    emailsText !== data?.settings.notificationEmails.join('\n');
  const submit = () =>
    save.mutate({
      ...s,
      notificationEmails: emailsText
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    });

  return (
    <>
      <PageHeader title="Settings" sub="Pickup schedule, notifications and business details." />
      <form
        className="space-y-6 pb-24"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Section title="Ordering" sub="Pause ordering when you need a week off.">
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 p-4">
            <div>
              <p className="text-sm font-medium">Pause ordering</p>
              <p className="text-xs text-neutral-500">
                Customers can browse but can’t place orders.
              </p>
            </div>
            <Toggle
              label="Pause ordering"
              checked={s.orderingPaused}
              onChange={(v) => up('orderingPaused', v)}
            />
          </div>
          <Field
            label="Message shown while paused"
            htmlFor="paused-msg"
            error={errors.pausedMessage}
          >
            <Textarea
              id="paused-msg"
              rows={2}
              value={s.pausedMessage}
              onChange={(e) => up('pausedMessage', e.target.value)}
              maxLength={300}
            />
          </Field>
          <Field label="Pickup days" error={errors.pickupDays}>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pickup days">
              {DAYS.map((d, i) => {
                const day = i + 1;
                const on = s.pickupDays.includes(day);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      up(
                        'pickupDays',
                        on ? s.pickupDays.filter((x) => x !== day) : [...s.pickupDays, day].sort(),
                      )
                    }
                    className={cn(
                      'h-9 w-12 rounded-lg border text-sm font-medium',
                      on
                        ? 'border-ghana-green bg-ghana-green text-white'
                        : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50',
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Cutoff: days before pickup"
              htmlFor="cut-days"
              hint="2 = Monday for a Wednesday pickup"
              error={errors.cutoffDaysBefore}
            >
              <Input
                id="cut-days"
                type="number"
                min={0}
                max={14}
                value={s.cutoffDaysBefore}
                onChange={(e) => up('cutoffDaysBefore', Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Cutoff time (Eastern)" htmlFor="cut-time" error={errors.cutoffTime}>
              <Input
                id="cut-time"
                type="time"
                value={s.cutoffTime}
                onChange={(e) => up('cutoffTime', e.target.value)}
              />
            </Field>
            <Field label="Weeks bookable ahead" htmlFor="weeks" error={errors.bookingWeeksAhead}>
              <Input
                id="weeks"
                type="number"
                min={1}
                max={8}
                value={s.bookingWeeksAhead}
                onChange={(e) => up('bookingWeeksAhead', Number(e.target.value) || 1)}
              />
            </Field>
          </div>
          <Field label="Closed dates (no pickup)" hint="Holidays or weeks off.">
            <div className="flex flex-wrap items-center gap-2">
              {s.closedDates.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 rounded-full bg-neutral-100 py-1 pl-3 pr-1 text-sm"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() =>
                      up(
                        'closedDates',
                        s.closedDates.filter((x) => x !== d),
                      )
                    }
                    className="grid h-5 w-5 place-items-center rounded-full hover:bg-neutral-300"
                    aria-label={`Remove ${d}`}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </span>
              ))}
              <Input
                type="date"
                className="w-44"
                value={newClosed}
                onChange={(e) => setNewClosed(e.target.value)}
                aria-label="Add closed date"
              />
              <Button
                size="sm"
                disabled={!newClosed}
                onClick={() => {
                  if (!s.closedDates.includes(newClosed))
                    up('closedDates', [...s.closedDates, newClosed].sort());
                  setNewClosed('');
                }}
              >
                Add
              </Button>
            </div>
          </Field>
        </Section>

        <Section
          title="Pickup time windows"
          sub="Capacity limits how many orders each window accepts per day (leave empty for unlimited)."
        >
          {errors.windows && <p className="text-sm text-ghana-red">{errors.windows}</p>}
          <ul className="space-y-2">
            {s.windows.map((w, i) => (
              <li
                key={i}
                className="grid grid-cols-2 items-end gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[1fr_140px_140px_100px_auto]"
              >
                <Field label="Label">
                  <Input
                    aria-label={`Window ${i + 1} label`}
                    value={w.label}
                    onChange={(e) =>
                      up(
                        'windows',
                        s.windows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
                <Field label="Start">
                  <Input
                    aria-label={`Window ${i + 1} start`}
                    type="time"
                    value={w.start}
                    onChange={(e) =>
                      up(
                        'windows',
                        s.windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
                <Field label="End">
                  <Input
                    aria-label={`Window ${i + 1} end`}
                    type="time"
                    value={w.end}
                    onChange={(e) =>
                      up(
                        'windows',
                        s.windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                      )
                    }
                  />
                </Field>
                <Field label="Capacity">
                  <Input
                    aria-label={`Window ${i + 1} capacity`}
                    type="number"
                    min={1}
                    placeholder="∞"
                    value={w.capacity ?? ''}
                    onChange={(e) =>
                      up(
                        'windows',
                        s.windows.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                capacity: e.target.value
                                  ? Math.max(1, Number(e.target.value))
                                  : null,
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Button
                  variant="ghost"
                  aria-label={`Remove ${w.label}`}
                  disabled={s.windows.length <= 1}
                  onClick={() =>
                    up(
                      'windows',
                      s.windows.filter((_, j) => j !== i),
                    )
                  }
                >
                  <X size={16} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            onClick={() =>
              up('windows', [
                ...s.windows,
                {
                  id: `w${Date.now().toString(36)}`,
                  label: 'New window',
                  start: '12:00',
                  end: '13:00',
                  capacity: null,
                },
              ])
            }
          >
            <Plus size={14} aria-hidden /> Add window
          </Button>
        </Section>

        <Section
          title="Notifications"
          sub="Who gets the instant “new order” email, and when customers are emailed."
        >
          <EmailProviderPanel />
          <Field
            label="New-order emails go to"
            htmlFor="notif"
            hint="One address per line."
            error={errors.notificationEmails}
          >
            <Textarea
              id="notif"
              rows={3}
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
            />
          </Field>
          <Field
            label="Email the customer automatically when an order becomes…"
            hint="You can still choose per change in the order drawer."
          >
            <div className="flex flex-wrap gap-3">
              {ORDER_STATUSES.filter((x) => x !== 'new').map((st) => (
                <label key={st} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-ghana-green"
                    checked={s.notifyOnStatus.includes(st)}
                    onChange={(e) =>
                      up(
                        'notifyOnStatus',
                        e.target.checked
                          ? [...s.notifyOnStatus, st]
                          : s.notifyOnStatus.filter((x: OrderStatus) => x !== st),
                      )
                    }
                  />
                  {STATUS_LABELS[st]}
                </label>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Business details" sub="Shown on the site, in emails and at checkout.">
          <Field
            label="Payment instructions"
            htmlFor="pay"
            hint="Shown at checkout, on the confirmation page and in emails."
            error={errors.paymentInstructions}
          >
            <Textarea
              id="pay"
              rows={3}
              value={s.paymentInstructions}
              onChange={(e) => up('paymentInstructions', e.target.value)}
            />
          </Field>
          <Field
            label="Map location (public)"
            htmlFor="map-query"
            hint={
              <>
                Shown on the website map and used for “Get directions”. Keep it to the street to
                keep the house number private; it stays in confirmation emails only.{' '}
                <a
                  href={mapLinks(s.mapQuery).directions}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-ghana-green underline"
                >
                  Preview in Google Maps
                </a>
              </>
            }
            error={errors.mapQuery}
          >
            <Input
              id="map-query"
              value={s.mapQuery}
              placeholder="Hollywood Street, Worcester, MA"
              onChange={(e) => up('mapQuery', e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Pickup address on the website"
              htmlFor="addr-pub"
              hint="Street only."
              error={errors.pickupAddressPublic}
            >
              <Input
                id="addr-pub"
                value={s.pickupAddressPublic}
                onChange={(e) => up('pickupAddressPublic', e.target.value)}
              />
            </Field>
            <Field
              label="Full pickup address (emails only)"
              htmlFor="addr-full"
              error={errors.pickupAddressFull}
            >
              <Input
                id="addr-full"
                value={s.pickupAddressFull}
                onChange={(e) => up('pickupAddressFull', e.target.value)}
              />
            </Field>
            <Field label="Business phone" htmlFor="phone" error={errors.businessPhone}>
              <Input
                id="phone"
                value={s.businessPhone}
                onChange={(e) => up('businessPhone', e.target.value)}
              />
            </Field>
            <Field
              label="Postal address line (marketing email footer)"
              htmlFor="addr-line"
              hint="Required by law (CAN-SPAM)."
              error={errors.businessAddressLine}
            >
              <Input
                id="addr-line"
                value={s.businessAddressLine}
                onChange={(e) => up('businessAddressLine', e.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['instagram', 'whatsapp', 'tiktok', 'facebook'] as const).map((k) => (
              <Field
                key={k}
                label={
                  k === 'whatsapp'
                    ? 'WhatsApp link (https://wa.me/…)'
                    : `${k[0].toUpperCase()}${k.slice(1)} link`
                }
                htmlFor={`soc-${k}`}
                error={errors.social}
              >
                <Input
                  id={`soc-${k}`}
                  value={s.social[k]}
                  placeholder="https://…"
                  onChange={(e) => up('social', { ...s.social, [k]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        </Section>

        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-20 border-t border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-3">
            {dirty && <span className="text-sm text-neutral-500">Unsaved changes</span>}
            <Button
              variant="ghost"
              disabled={!dirty}
              onClick={() => {
                setS(data!.settings);
                setEmailsText(data!.settings.notificationEmails.join('\n'));
                setErrors({});
              }}
            >
              Discard
            </Button>
            <Button type="submit" variant="primary" loading={save.isPending} disabled={!dirty}>
              Save settings
            </Button>
          </div>
        </div>
      </form>
      <PasswordCard />
    </>
  );
}
