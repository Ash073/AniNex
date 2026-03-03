import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
//  NOTIFICATION DEDUP — prevents duplicate toast when both
//  socket and push fire for the same notification.
//  Uses the unique notificationId from backend (not type!).
// ─────────────────────────────────────────────────────────────
const shownNotificationIds = new Set<string>();
const DEDUP_WINDOW_MS = 10_000; // 10 seconds

/**
 * Mark a notification as already displayed.
 * @param id - The unique notification ID from backend
 */
export function markNotificationHandled(id: string): void {
  if (!id) return;
  shownNotificationIds.add(id);
  setTimeout(() => shownNotificationIds.delete(id), DEDUP_WINDOW_MS);
}

/**
 * Check if notification was already handled.
 */
export function wasAlreadyHandled(id: string): boolean {
  if (!id) return false;
  return shownNotificationIds.has(id);
}

// ─────────────────────────────────────────────────────────────
//  FOREGROUND HANDLER
//  Controls how the OS presents a notification while app is open.
//  We SHOW the system banner (for tray) AND show our
//  custom in-app toast via the listener in useNotifications.
// ─────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─────────────────────────────────────────────────────────────
//  ANDROID NOTIFICATION CHANNEL
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
//  TOKEN REGISTRATION
//  Caches token in memory so we only fetch once per app lifecycle.
// ─────────────────────────────────────────────────────────────
let cachedToken: string | null = null;

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Return cached token if already registered this session
  if (cachedToken) return cachedToken;

  if (!Device.isDevice) {
    console.warn('[Push] Notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Permission not granted');
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    'fbb8db22-e484-4526-add1-fe80a4fbcdb5';

  if (!projectId) {
    console.error('[Push] Project ID not found');
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    cachedToken = token;
    console.log('[Push] Token acquired:', token);
    return token;
  } catch (error) {
    console.error('[Push] Token error:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  LISTENERS (thin wrappers for clean imports)
// ─────────────────────────────────────────────────────────────
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
