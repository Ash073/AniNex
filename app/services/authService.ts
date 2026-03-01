import api from './api';
import { User } from '@/types';

// Normalize snake_case from Supabase into camelCase the frontend expects
const normalizeUser = (raw: any): User => {
  if (!raw) return raw;
  return {
    ...raw,
    id: raw.id || raw._id,
    _id: raw.id || raw._id,
    displayName: raw.display_name || raw.displayName || '',
    favoriteAnime: raw.favorite_anime || raw.favoriteAnime || [],
    experienceLevel: raw.experience_level || raw.experienceLevel || 'casual',
    onboardingCompleted: raw.onboarding_completed ?? raw.onboardingCompleted ?? false,
    profileCompleted: raw.profile_completed ?? raw.profileCompleted ?? false,
    isOnline: raw.is_online ?? raw.isOnline ?? false,
    lastSeen: raw.last_seen || raw.lastSeen,
    dateOfBirth: raw.date_of_birth || raw.dateOfBirth,
    createdAt: raw.created_at || raw.createdAt,
    updatedAt: raw.updated_at || raw.updatedAt,
    // keep arrays as-is
    genres: raw.genres || [],
    interests: raw.interests || [],
    servers: raw.servers || [],
    friends: raw.friends || [],
    xp: raw.xp || 0,
    level: raw.level || 1,
    streak: raw.streak || 0,
    badges: raw.badges || [],
    lastLogin: raw.last_login || raw.lastLogin,
  };
};

export const authService = {
  register: async (username: string, email: string, password: string) => {
    try {
      console.log('🔐 Registering user:', { username, email });
      const response = await api.post<{ success: boolean; data: { user: any; token: string; refreshToken: string } }>('/auth/register', {
        username,
        email,
        password
      });
      console.log('✅ Registration successful');
      const result = response.data.data;
      return { ...result, user: normalizeUser(result.user) };
    } catch (error: any) {
      console.error('❌ Registration failed:', error.message, error.response?.data);
      throw error;
    }
  },

  login: async (email: string, password: string) => {
    try {
      console.log('🔐 Logging in user:', email);
      const response = await api.post<{ success: boolean; data: { user: any; token: string; refreshToken: string } }>('/auth/login', {
        email,
        password
      });
      console.log('✅ Login successful');
      const result = response.data.data;
      return { ...result, user: normalizeUser(result.user) };
    } catch (error: any) {
      console.error('❌ Login failed:', error.message, error.response?.data);
      throw error;
    }
  },

  googleLogin: async (idToken?: string, accessToken?: string) => {
    try {
      console.log('🔐 Google auth...');
      const response = await api.post<{ success: boolean; data: { user: any; token: string; refreshToken: string } }>('/auth/google', {
        idToken,
        accessToken,
      });
      console.log('✅ Google auth successful');
      const result = response.data.data;
      return { ...result, user: normalizeUser(result.user) };
    } catch (error: any) {
      console.error('❌ Google auth failed:', error.message, error.response?.data);
      throw error;
    }
  },

  facebookLogin: async (accessToken: string) => {
    try {
      console.log('🔐 Facebook auth...');
      const response = await api.post<{ success: boolean; data: { user: any; token: string; refreshToken: string } }>('/auth/facebook', {
        accessToken,
      });
      console.log('✅ Facebook auth successful');
      const result = response.data.data;
      return { ...result, user: normalizeUser(result.user) };
    } catch (error: any) {
      console.error('❌ Facebook auth failed:', error.message, error.response?.data);
      throw error;
    }
  },

  completeOnboarding: async (onboardingData: {
    favoriteAnime: string[];
    genres: string[];
    interests: string[];
    experienceLevel: string;
  }) => {
    const { data } = await api.post('/auth/onboarding', onboardingData);
    if (data.data?.user) {
      data.data.user = normalizeUser(data.data.user);
    }
    return data;
  },

  updateProfile: async (profileData: Partial<User>) => {
    const response = await api.put('/auth/profile', profileData);
    const result = response.data.data;
    return { ...result, user: normalizeUser(result.user) };
  },

  getCurrentUser: async () => {
    const { data } = await api.get<{ success: boolean; data: { user: any } }>('/auth/me');
    return normalizeUser(data.data.user);
  },

  logout: async () => {
    const { data } = await api.post('/auth/logout');
    return data;
  },

  deleteAccount: async () => {
    const { data } = await api.delete('/auth/account');
    return data;
  },
};