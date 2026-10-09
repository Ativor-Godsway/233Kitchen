import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { MenuItem, PublicConfig } from '../../shared/types';

/**
 * The live menu from the API. There is deliberately no bundled fallback: if the API is down the
 * site shows "Menu temporarily unavailable" and ordering is blocked, never a stale menu.
 */
export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: async () => (await api<{ items: MenuItem[] }>('/menu')).items,
    staleTime: 60_000,
    retry: 2,
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
