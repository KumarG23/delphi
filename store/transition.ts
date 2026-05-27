import { create } from 'zustand';

import { pickLoader } from '@/lib/loaders';

interface TransitionState {
  isShowing: boolean;
  source: number | null;
  startedAt: number;
  show: () => void;
  hide: () => void;
}

export const useTransitionStore = create<TransitionState>((set) => ({
  isShowing: false,
  source: null,
  startedAt: 0,
  show: () => {
    const source = pickLoader();
    if (!source) return;
    set({ isShowing: true, source, startedAt: Date.now() });
  },
  hide: () => set({ isShowing: false }),
}));
