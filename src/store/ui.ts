import { create } from 'zustand';
import type { CartLine } from './cart';

interface UiState {
  bagOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  /** Item customisation sheet: a slug to add, optionally an existing line to edit. */
  sheet: { slug: string; editing?: CartLine } | null;
  openItem: (slug: string, editing?: CartLine) => void;
  closeItem: () => void;
}

export const useUi = create<UiState>()((set) => ({
  bagOpen: false,
  openBag: () => set({ bagOpen: true }),
  closeBag: () => set({ bagOpen: false }),
  sheet: null,
  openItem: (slug, editing) => set({ sheet: { slug, editing } }),
  closeItem: () => set({ sheet: null }),
}));
