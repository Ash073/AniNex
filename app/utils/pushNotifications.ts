import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Configure how notifications should be handled when the app is in the foreground.
 * IMPORTANT: By returning shouldShowAlert: true, we tell the OS to show a system notification
 * even when the app is open.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,   // In-app toasts (via socket) handle foreground UX; prevent duplicate OS banner
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: false,  // Same reason as shouldShowAlert
    shouldShowList: true,     // Keep in notification center for later reference
  }),
});

/**
 * Initialize Android Channels immediately on module load.
 * This ensures the channels exist even before registration.
 */
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

/**
 * Main function to register for push notifications.
 * It handles permissions, Android channel setup, and retrieves the Expo Push Token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // 1. Physical device check
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // 2. Permission handling
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get notification permissions!');
    return null;
  }

  // 3. Project ID retrieval (required for Expo Push Token)
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    'fbb8db22-e484-4526-add1-fe80a4fbcdb5';

  if (!projectId) {
    console.error('Project ID not found in Expo configuration');
    return null;
  }

  // 4. Get the token
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Push notification mapping successful:', token);
  } catch (error) {
    console.error('Error fetching Expo Push Token:', error);
  }

  return token;
}

/**
 * Notification Listeners
 */
export function addNotificationReceivedListener(listener: (notification: Notifications.Notification) => void) {
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(listener: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(listener);
}

/**
 * Manually trigger a local notification (Tray Test)
 */
export async function scheduleLocalNotification(title: string, body: string, data: any = {}) {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null as any,  // Immediate delivery; typed as any for SDK 54 compat
  });
}
