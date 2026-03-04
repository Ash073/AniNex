import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ═════════════════════════════════════════════════════════════
//  NOTIFICATION DEDUP
//
//  Prevents duplicate in-app toasts when both socket and push
//  fire for the same event. Uses the unique notificationId from
//  the backend (set in data.notificationId).
// ═════════════════════════════════════════════════════════════
const handledNotificationIds = new Set<string>();
const DEDUP_WINDOW_MS = 15_000; // 15-second dedup window

/**
 * Mark a notification as already displayed.
 * Automatically expires after DEDUP_WINDOW_MS.
 */
export function markNotificationHandled(id: string): void {
  if (!id) return;
  handledNotificationIds.add(id);
  setTimeout(() => handledNotificationIds.delete(id), DEDUP_WINDOW_MS);
}

/**
 * Check if notification was already handled in this window.
 */
export function wasAlreadyHandled(id: string): boolean {
  if (!id) return false;
  return handledNotificationIds.has(id);
}

// ═════════════════════════════════════════════════════════════
//  FOREGROUND HANDLER
//
//  Controls how the OS presents notifications while the app
//  is in the foreground. We show both the system banner AND
//  our custom in-app toast (via the listener in useNotifications).
// ═════════════════════════════════════════════════════════════
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ═════════════════════════════════════════════════════════════
//  ANDROID NOTIFICATION CHANNEL
//
//  Must be created before any notification is sent on Android.
//  Channel ID must match the channelId in the push payload.
// ═════════════════════════════════════════════════════════════
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    description: 'General notifications from AniNeX',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366f1',
    showBadge: true,
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ═════════════════════════════════════════════════════════════
//  TOKEN REGISTRATION
//
//  Caches the token in memory so we only fetch once per app
//  lifecycle. The caller (useNotifications hook) decides when
//  to POST it to the backend.
// ═════════════════════════════════════════════════════════════
let cachedToken: string | null = null;

/**
 * Register for push notifications and return the Expo push token.
 * Returns null if permissions are denied or device is a simulator.
 *
 * Idempotent — returns the cached token on subsequent calls.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Return cached token if already acquired this session
  if (cachedToken) {
    console.log('[Push] Returning cached token');
    return cachedToken;
  }

  // Must be a physical device
  if (!Device.isDevice) {
    console.warn('[Push] Push notifications require a physical device');
    return null;
  }

  // Check / request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('[Push] Requesting notification permissions...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted:', finalStatus);
    return null;
  }

  // Resolve project ID
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    'fbb8db22-e484-4526-add1-fe80a4fbcdb5';

  if (!projectId) {
    console.error('[Push] No project ID found — cannot get push token');
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    cachedToken = tokenData.data;
    console.log('[Push] Token acquired:', cachedToken);
    return cachedToken;
  } catch (error: any) {
    console.error('[Push] Token acquisition error:', error?.message || error);
    return null;
  }
}

/**
 * Clear the cached token (e.g., on logout).
 */
export function clearCachedToken(): void {
  cachedToken = null;
}

// ═════════════════════════════════════════════════════════════
//  LISTENER WRAPPERS (clean single-import interface)
// ═════════════════════════════════════════════════════════════

export function addNotificationReceivedListener(
  listener: (notification: Notifications.Notification) => void,
) {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(
  listener: (response: Notifications.NotificationResponse) => void,
) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}
