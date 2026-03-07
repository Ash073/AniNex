import messaging from '@react-native-firebase/messaging';
import api from './api';
import { Platform } from 'react-native';

/**
 * Get the current FCM device token.
 */
export async function getFCMToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    console.log('[FCM Service] Token:', token);
    return token;
  } catch (error: any) {
    console.error('[FCM Service] Failed to get token:', error?.message);
    return null;
  }
}

/**
 * Register (or re-register) the FCM token with the backend.
 */
export async function registerTokenWithBackend(): Promise<void> {
  const token = await getFCMToken();
  if (!token) return;

  await api.post('/users/push-token', {
    token,
    platform: Platform.OS,
  });
  console.log('[FCM Service] Token sent to backend');
}

/**
 * Delete the FCM token (e.g. on logout) so the device stops receiving pushes.
 */
export async function deleteFCMToken(): Promise<void> {
  try {
    await messaging().deleteToken();
    console.log('[FCM Service] Token deleted');
  } catch (error: any) {
    console.error('[FCM Service] Failed to delete token:', error?.message);
  }
}
