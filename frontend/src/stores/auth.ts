import { create } from 'zustand';
import { api } from '../api/client';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  initialize: () => Promise<User | null>;
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

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    localStorage.removeItem('auth_redirect');
    set({ user: null });
  },

  setUser: (user: User) => {
    set({ user });
  },

  initialize: async () => {
    set({ isLoading: true });
    try {
      const { user } = await api.getCurrentUser();
      set({ user, isInitialized: true, isLoading: false });
      return user;
    } catch {
      set({ user: null, isInitialized: true, isLoading: false });
      return null;
    }
  },
}));
