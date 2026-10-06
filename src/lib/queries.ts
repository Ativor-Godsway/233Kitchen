import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { MENU_FALLBACK } from '../../shared/menu.seed';
import type { MenuItem, PublicConfig } from '../../shared/types';

/** Menu from the API, falling back to the bundled seed menu if the API is unreachable. */
export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      try {
        return (await api<{ items: MenuItem[] }>('/menu')).items;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[menu] API unavailable, using bundled menu', e);
          return MENU_FALLBACK;
        }
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function usePublicConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api<PublicConfig>('/config'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
