import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  updateUser: (partial: Partial<User>) => void;
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  hasCheckedUpdateNotes: boolean;
  setHasCheckedUpdateNotes: (checked: boolean) => void;
}

// Platform-agnostic storage helpers
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  hasCheckedUpdateNotes: false,

  setHasCheckedUpdateNotes: (checked: boolean) => set({ hasCheckedUpdateNotes: checked }),
  setLoading: (loading) => set({ isLoading: loading }),

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  updateUser: (partial) => set((state) => ({
    user: state.user ? { ...state.user, ...partial } : null,
  })),

  setTokens: async (token, refreshToken) => {
    try {
      await storage.setItem('token', token);
      await storage.setItem('refreshToken', refreshToken);
      set({ token, refreshToken, isAuthenticated: true });
    } catch (error) {
      console.error('Error storing tokens:', error);
    }
  },

  clearAuth: async () => {
    try {
      await storage.removeItem('token');
      await storage.removeItem('refreshToken');
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        hasCheckedUpdateNotes: false,
      });
    } catch (error) {
      console.error('Error clearing auth:', error);
    }
  },

  loadAuth: async () => {
    // Minimum display time (ms) — reduced for faster loading
    const MIN_DISPLAY_MS = 1200;
    const minTimer = new Promise<void>((resolve) =>
      setTimeout(resolve, MIN_DISPLAY_MS)
    );

    const authWork = async () => {
      try {
        const token = await storage.getItem('token');
        const refreshToken = await storage.getItem('refreshToken');

        if (token && refreshToken) {
          set({ token, refreshToken, isAuthenticated: true });

          // Fetch current user profile so we have user data after reload
          try {
            const { default: api } = await import('@/services/api');
            const { data } = await api.get('/auth/me');
            const raw = data?.data?.user;
            if (raw) {
              // Normalize snake_case → camelCase (same as authService)
              const user: User = {
                ...raw,
                id: raw.id || raw._id,
                _id: raw.id || raw._id,
                displayName: raw.display_name || raw.displayName || '',
                favoriteAnime: raw.favorite_anime || raw.favoriteAnime || [],
                experienceLevel: raw.experience_level || raw.experienceLevel || 'casual',
                onboardingCompleted: raw.onboarding_completed ?? raw.onboardingCompleted ?? false,
                profileCompleted: raw.profile_completed ?? raw.profileCompleted ?? false,
                isOnline: true,
                lastSeen: raw.last_seen || raw.lastSeen,
                dateOfBirth: raw.date_of_birth || raw.dateOfBirth,
                createdAt: raw.created_at || raw.createdAt,
                updatedAt: raw.updated_at || raw.updatedAt,
                genres: raw.genres || [],
                interests: raw.interests || [],
                servers: raw.servers || [],
                friends: raw.friends || [],
              };
              set({ user, isAuthenticated: true });
            }
          } catch (fetchErr) {
            console.warn('Could not fetch user profile – token may be expired');
            await storage.removeItem('token');
            await storage.removeItem('refreshToken');
            set({ token: null, refreshToken: null, isAuthenticated: false, user: null });
          }
        }
      } catch (error) {
        console.error('Error loading auth:', error);
      }
    };

    // Wait for BOTH the auth work AND the minimum display time to finish
    // before hiding the loader — whichever takes longer wins.
    await Promise.all([authWork(), minTimer]);
    set({ isLoading: false });
  }
}));
