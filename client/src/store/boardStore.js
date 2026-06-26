import { create } from 'zustand';

const useBoardStore = create((set) => ({
  snapshot: null,
  version: 0,
  isSyncing: false,
  lastSavedAt: null,

  setSnapshot: (snapshot, version) => set({ snapshot, version }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
}));

export default useBoardStore;
