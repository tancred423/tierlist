import { create } from 'zustand';
import { api } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: () => Promise<void>;
  logout: () => void;
  setToken: (token: string) => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  login: async () => {
    try {
      const { url } = await api.getDiscordAuthUrl();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to get auth URL:', error);
    }
  },

  logout: () => {
    api.setToken(null);
    set({ user: null });
  },

  setToken: (token: string) => {
    api.setToken(token);
  },

  initialize: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isInitialized: true, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const { user } = await api.getCurrentUser();
      set({ user, isInitialized: true, isLoading: false });
    } catch {
      api.setToken(null);
      set({ user: null, isInitialized: true, isLoading: false });
    }
  },
}));
