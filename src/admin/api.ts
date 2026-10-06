import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { Settings } from '../../shared/types';

export function useMe() {
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      try {
        return (await api<{ admin: { email: string } | null }>('/admin/me')).admin;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () =>
      api<{ settings: Settings; emailProvider: 'resend' | 'smtp' | 'dev' | 'none' }>(
        '/admin/settings',
      ),
    staleTime: 60_000,
  });
}

/** Triggers a file download from an authenticated GET endpoint. */
export function downloadUrl(path: string) {
  const a = document.createElement('a');
  a.href = `/api${path}`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const telHref = (phone: string) => `tel:+1${phone.replace(/\D/g, '').slice(-10)}`;
export const smsHref = (phone: string) => `sms:+1${phone.replace(/\D/g, '').slice(-10)}`;

export function usePickupDates() {
  return useQuery({
    queryKey: ['admin', 'orders', 'pickup-dates'],
    queryFn: () =>
      api<{
        today: string;
        dates: Array<{ date: string; label: string; orders: number; isPast: boolean }>;
      }>('/admin/orders/pickup-dates'),
  });
}
