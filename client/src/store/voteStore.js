import { create } from 'zustand';

const useVoteStore = create((set) => ({
  myVotes: {}, // noteId → stars (session-scoped)
  isOpen: false,

  setMyVote: (noteId, stars) =>
    set((state) => ({ myVotes: { ...state.myVotes, [noteId]: stars } })),

  setOpen: (isOpen) => set({ isOpen }),
}));

export default useVoteStore;
