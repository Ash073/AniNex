import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '@/constants/api';
import { useAuthStore } from '@/store/authStore';

// Mock mode - set to true to use mock data instead of real API calls
const MOCK_MODE = false;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Helper to get token from storage (web vs native)
const getToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('token');
    } else {
      return await SecureStore.getItemAsync('token');
    }
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

// Helper to get refresh token from storage (web vs native)
const getRefreshToken = async () => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('refreshToken');
    } else {
      return await SecureStore.getItemAsync('refreshToken');
    }
  } catch (error) {
    console.error('Error getting refresh token:', error);
    return null;
  }
};

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token refresh and mock mode fallback
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If network error and mock mode is enabled, return mock data
    if (MOCK_MODE && error.message === 'Network Error') {
      console.log('📱 MOCK MODE: Returning mock data instead of real API');

      const url = originalRequest.url;
      const data = originalRequest.data ? JSON.parse(originalRequest.data) : {};

      // Mock login
      if (url.includes('/auth/login')) {
        return {
          data: {
            success: true,
            data: {
              user: {
                _id: 'mock-1',
                email: data.email,
                username: (data.email || 'user').split('@')[0],
                avatar: 'https://i.pravatar.cc/150?u=' + data.email,
                onboardingCompleted: false,
              },
              token: 'mock-token-' + Date.now(),
              refreshToken: 'mock-refresh-' + Date.now(),
            }
          }
        } as any;
      }

      // Mock register
      if (url.includes('/auth/register')) {
        return {
          data: {
            success: true,
            data: {
              user: {
                _id: 'mock-' + Math.random(),
                email: data.email,
                username: data.username || 'user' + Math.floor(Math.random() * 1000),
                avatar: 'https://i.pravatar.cc/150?u=' + data.email,
                onboardingCompleted: false,
              },
              token: 'mock-token-' + Date.now(),
              refreshToken: 'mock-refresh-' + Date.now(),
            }
          }
        } as any;
      }

      // Mock other requests
      return {
        data: {
          success: true,
          message: 'Mock response',
          data: {}
        }
      };
    }

    // Original token refresh logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { setLoading } = useAuthStore.getState();
      setLoading(true);

      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });

        const { token: newToken, refreshToken: newRefreshToken } = data.data;

        await useAuthStore.getState().setTokens(newToken, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        await useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        setLoading(false);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
