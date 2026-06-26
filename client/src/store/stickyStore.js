import { create } from 'zustand';

const useStickyStore = create((set) => ({
  notes: [],

  setNotes: (notes) => set({ notes }),

  addNote: (note) =>
    set((state) => ({
      notes: state.notes.some((n) => n.id === note.id)
        ? state.notes.map((n) => (n.id === note.id ? note : n))
        : [...state.notes, note],
    })),

  updateNote: (note) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? note : n)),
    })),

  moveNote: (id, position_x, position_y) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, position_x, position_y } : n)),
    })),

  removeNote: (id) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),

  updateVoteStats: (noteId, averageStars, totalVotes) =>
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === noteId
          ? { ...n, averageStars, totalVotes, vote_count: totalVotes }
          : n
      ),
    })),
}));

export default useStickyStore;
