import Constants from 'expo-constants';

// Use Expo public env vars for production (works on web and native)
const PROD_BASE_URL = Constants.expoConfig?.extra?.expoPublicApiUrl || 'https://aninex-1.onrender.com';

// Fallbacks for dev
const DEV_HOST = typeof window === 'undefined' && typeof navigator !== 'undefined' && navigator.product === 'ReactNative' && Platform.OS === 'android'
  ? '192.168.137.68'
  : 'localhost';
const NGROK_URL = __DEV__ ? Constants.expoConfig?.extra?.expoPublicNgrokUrl || '' : '';
const useNgrok = __DEV__ && !!NGROK_URL;

export const API_URL = useNgrok
  ? `${NGROK_URL}/api`
  : __DEV__
    ? `http://${DEV_HOST}:5000/api`
    : `${PROD_BASE_URL}/api`;

export const OAUTH_BASE_URL = useNgrok
  ? `${NGROK_URL}/api/auth/oauth`
  : __DEV__
    ? `http://${DEV_HOST}:5000/api/auth/oauth`
    : `${PROD_BASE_URL}/api/auth/oauth`;

export const SOCKET_URL = useNgrok
  ? NGROK_URL
  : __DEV__
    ? `http://${DEV_HOST}:5000`
    : PROD_BASE_URL;