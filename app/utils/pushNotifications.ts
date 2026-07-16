import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

// ═════════════════════════════════════════════════════════════
//  NOTIFICATION DEDUP
//
//  Prevents duplicate in-app toasts when both socket and push
//  fire for the same event. Uses the unique notificationId from
//  the backend (set in data.notificationId).
// ═════════════════════════════════════════════════════════════
const handledNotificationIds = new Set<string>();
const DEDUP_WINDOW_MS = 15_000; // 15-second dedup window

export function markNotificationHandled(id: string): void {
  if (!id) return;
  handledNotificationIds.add(id);
  setTimeout(() => handledNotificationIds.delete(id), DEDUP_WINDOW_MS);
}

export function wasAlreadyHandled(id: string): boolean {
  if (!id) return false;
  return handledNotificationIds.has(id);
}

// ═════════════════════════════════════════════════════════════
//  FCM TOKEN
// ═════════════════════════════════════════════════════════════
let cachedToken: string | null = null;

/**
 * Request notification permission and return the FCM device token.
 * Returns null if permissions are denied.
 * Idempotent — returns the cached token on subsequent calls.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (cachedToken) {
    console.log('[FCM] Returning cached token');
    return cachedToken;
  }

  // Android 13+ (API 33) requires runtime permission
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('[FCM] POST_NOTIFICATIONS permission denied');
      return null;
    }
  }

  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.warn('[FCM] Permission not granted:', authStatus);
    return null;
  }

  try {
    const token = await messaging().getToken();
    cachedToken = token;
    console.log('[FCM] Token acquired:', token);
    return token;
  } catch (error: any) {
    console.error('[FCM] Token error:', error?.message || error);
    return null;
  }
}

export function clearCachedToken(): void {
  cachedToken = null;
}

// ═════════════════════════════════════════════════════════════
//  FCM LISTENER WRAPPERS
// ═════════════════════════════════════════════════════════════

/**
 * Subscribe to foreground messages. Returns unsubscribe function.
 */
export function onForegroundMessage(
  listener: (message: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onMessage(listener);
}

/**
 * Subscribe to notification-open events (user tapped notification
 * while app was in background). Returns unsubscribe function.
 */
export function onNotificationOpenedApp(
  listener: (message: FirebaseMessagingTypes.RemoteMessage) => void,
): () => void {
  return messaging().onNotificationOpenedApp(listener);
}

/**
 * Check if the app was opened from a killed state by tapping a notification.
 * Returns the RemoteMessage or null.
 */
export async function getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  return messaging().getInitialNotification();
}

/**
 * Subscribe to FCM token refresh events. Returns unsubscribe function.
 */
export function onTokenRefresh(listener: (token: string) => void): () => void {
  return messaging().onTokenRefresh(listener);
}
