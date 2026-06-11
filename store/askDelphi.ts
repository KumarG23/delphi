import { create } from 'zustand';

interface AskDelphiState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export const useAskDelphiStore = create<AskDelphiState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
