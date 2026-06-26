import { create } from 'zustand';
import axios from 'axios';

// ── Axios instance ─────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || 'http://localhost:3001',
  withCredentials: true, // required for HttpOnly refresh-token cookie
});

// ── Store ──────────────────────────────────────────────────────────────────
const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,

  // ── Actions ──────────────────────────────────────────────────────────────

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      set({
        user: data.user,
        accessToken: data.accessToken,
        isAuthenticated: true,
      });
      return data;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password });
      set({
        user: data.user,
        accessToken: data.accessToken,
        isAuthenticated: true,
      });
      return data;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Proceed with local logout even if the server call fails
    } finally {
      set({ user: null, accessToken: null, isAuthenticated: false });
    }
  },

  refreshToken: async () => {
    const { data } = await api.post('/api/auth/refresh');
    set({ accessToken: data.accessToken, isAuthenticated: true });
    return data.accessToken;
  },

  getMe: async () => {
    const { data } = await api.get('/api/auth/me');
    set({ user: data.user, isAuthenticated: true });
    return data.user;
  },
}));

// ── Axios interceptors ─────────────────────────────────────────────────────

// Attach access token to every outgoing request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh-and-retry on 401; logout on second failure
let isRefreshing = false;
let pendingQueue = [];

function drainQueue(error, token) {
  pendingQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token),
  );
  pendingQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Skip retry for the refresh endpoint itself to avoid an infinite loop
    if (original.url?.includes('/api/auth/refresh')) {
      await useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      // Queue this request until the in-flight refresh completes
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const newToken = await useAuthStore.getState().refreshToken();
      drainQueue(null, newToken);
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    } catch (refreshError) {
      drainQueue(refreshError, null);
      await useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default useAuthStore;
