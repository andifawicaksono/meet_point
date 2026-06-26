import { create } from 'zustand';
import { api } from './authStore';

const useRoomStore = create((set, get) => ({
  rooms: [],
  currentRoom: null,
  participants: [],
  isLoading: false,
  error: null,

  // ── Actions ─────────────────────────────────────────────────────────────

  fetchMyRooms: async ({ page = 1, limit = 12 } = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/api/rooms', { params: { page, limit } });
      set({ rooms: data.rooms });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load rooms';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRoom: async (roomId) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/api/rooms/${roomId}`);
      set({ currentRoom: data.room, participants: data.participants });
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load room';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  createRoom: async (name, description = '') => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/api/rooms', { name, description });
      set((state) => ({ rooms: [data.room, ...state.rooms] }));
      return data.room;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create room';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  joinByCode: async (inviteCode) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/api/rooms/join/${inviteCode.toUpperCase().trim()}`);
      set({ currentRoom: data.room, participants: data.participants });
      // Add to rooms list if not already present
      set((state) => ({
        rooms: state.rooms.some((r) => r.id === data.room.id)
          ? state.rooms
          : [data.room, ...state.rooms],
      }));
      return data.room;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to join room';
      set({ error: msg });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  leaveRoom: async (roomId) => {
    try {
      await api.post(`/api/rooms/${roomId}/leave`);
    } catch {
      // Even if the REST call fails, clear local state
    } finally {
      set({ currentRoom: null, participants: [] });
    }
  },

  setCurrentRoom: (room) => set({ currentRoom: room }),

  updateParticipants: (participants) => set({ participants }),

  addParticipant: (participant) =>
    set((state) => ({
      participants: state.participants.some((p) => p.id === participant.id)
        ? state.participants.map((p) => (p.id === participant.id ? { ...p, ...participant } : p))
        : [...state.participants, participant],
    })),

  removeParticipantFromState: (userId) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === userId ? { ...p, isOnline: false } : p,
      ),
    })),

  clearError: () => set({ error: null }),
}));

export default useRoomStore;
