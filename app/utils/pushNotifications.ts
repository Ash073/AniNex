import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
//  NOTIFICATION DEDUP — prevents the same notification showing
//  twice when both socket toast AND push banner arrive together.
// ─────────────────────────────────────────────────────────────
const recentlyShownIds = new Set<string>();
const DEDUP_WINDOW_MS = 3000;

/**
 * Mark a notification key as "already shown" so the push handler
 * can suppress the duplicate OS banner.
 * Call this from useSocket whenever a socket-based toast is displayed.
 */
export function markNotificationShown(key: string) {
  recentlyShownIds.add(key);
  setTimeout(() => recentlyShownIds.delete(key), DEDUP_WINDOW_MS);
}

/** Check whether this notification was already shown via socket toast. */
export function wasRecentlyShown(key: string): boolean {
  return recentlyShownIds.has(key);
}

// ─────────────────────────────────────────────────────────────
//  FOREGROUND HANDLER
//  Decides how the OS treats a push that arrives while app is open.
//
//  Strategy: ALWAYS show the OS banner UNLESS the same notification
//  was already displayed as an in-app socket toast (dedup).
//  This guarantees notifications show even if socket is down.
// ─────────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data || {}) as Record<string, any>;
    const dedupKey = String(data?.notificationId || data?.type || '');
    const alreadyShown = dedupKey ? wasRecentlyShown(dedupKey) : false;

    return {
      shouldShowAlert: !alreadyShown,
      shouldPlaySound: !alreadyShown,
      shouldSetBadge: true,
      shouldShowBanner: !alreadyShown,
      shouldShowList: true,
    };
  },
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
// ─────────────────────────────────────────────────────────────
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

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
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('[Push] Token acquired:', token);
  } catch (error) {
    console.error('[Push] Token error:', error);
  }

  return token;
}

// ─────────────────────────────────────────────────────────────
//  LISTENERS
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

// ─────────────────────────────────────────────────────────────
//  LOCAL NOTIFICATION (fallback / testing)
// ─────────────────────────────────────────────────────────────
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data: any = {},
) {
  return await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: 'default' },
    trigger: null as any,
  });
}
