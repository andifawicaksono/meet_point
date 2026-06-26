import { create } from 'zustand';

const useChatStore = create((set) => ({
  messages: [],
  unreadCount: 0,
  isPanelOpen: false,

  setMessages: (messages) => set({ messages }),

  // Prepend older messages (pagination load-more)
  prependMessages: (older) =>
    set((state) => ({ messages: [...older, ...state.messages] })),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
      unreadCount: state.isPanelOpen ? 0 : state.unreadCount + 1,
    })),

  openPanel: () => set({ isPanelOpen: true, unreadCount: 0 }),
  closePanel: () => set({ isPanelOpen: false }),
  clearUnread: () => set({ unreadCount: 0 }),
}));

export default useChatStore;
