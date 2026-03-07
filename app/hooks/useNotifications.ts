import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/components/NotificationProvider';
import {
  registerForPushNotificationsAsync,
  onForegroundMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  onTokenRefresh,
  markNotificationHandled,
  wasAlreadyHandled,
} from '@/utils/pushNotifications';
import api from '@/services/api';

// ═════════════════════════════════════════════════════════════
//  MODULE-LEVEL GUARDS
//
//  Prevent duplicate token registration and duplicate listeners
//  even if React re-mounts the hook multiple times.
// ═════════════════════════════════════════════════════════════
let tokenRegistered = false;
let listenersAttached = false;

// ═════════════════════════════════════════════════════════════
//  NAVIGATION HELPER
//
//  Routes the user to the correct screen based on push data.
//  Used for both foreground tap and background/killed tap.
// ═════════════════════════════════════════════════════════════
function navigateToNotification(data: any, body?: string | null): void {
  if (!data) return;

  const type = data.type;

  switch (type) {
    case 'dm':
      if (data.conversationId) {
        router.push({
          pathname: '/(modals)/dm/[conversationId]',
          params: {
            conversationId: data.conversationId,
            name: data.senderName || 'User',
            avatar: data.senderAvatar || '',
          },
        } as any);
      }
      break;

    case 'server_message':
    case 'mention':
      if (data.channelId) {
        router.push({
          pathname: '/(modals)/chat/[channelId]',
          params: {
            channelId: data.channelId,
            channelName: data.channelName || 'general',
            serverName: data.serverName || 'Server',
          },
        } as any);
      }
      break;

    case 'friend_request':
      router.push('/(modals)/notifications' as any);
      break;

    case 'anime_fact':
      router.push({
        pathname: '/(modals)/anime-fact',
        params: { fact: data.fact || body || '' },
      } as any);
      break;

    case 'friend_online':
      if (data.friend_id) {
        router.push(`/(modals)/user-profile?userId=${data.friend_id}` as any);
      }
      break;

    case 'post_like':
    case 'post_comment':
      if (data.post_id) {
        router.push(`/(modals)/post/${data.post_id}` as any);
      }
      break;

    case 'server_invite':
    case 'server_added':
      if (data.server_id) {
        router.push(`/(modals)/server/${data.server_id}` as any);
      }
      break;

    default:
      console.log('[Notifications] Unhandled notification type:', type);
      break;
  }
}

// ═════════════════════════════════════════════════════════════
//  HELPER: send FCM token to backend
// ═════════════════════════════════════════════════════════════
async function sendTokenToBackend(token: string): Promise<void> {
  await api.post('/users/push-token', {
    token,
    platform: Platform.OS,
  });
  console.log('[FCM] Token registered with backend');
}

// ═════════════════════════════════════════════════════════════
//  useNotifications HOOK
//
//  Responsibilities:
//    1. Register FCM token with backend (once per app lifecycle)
//    2. Listen for foreground push → show in-app toast (deduped)
//    3. Listen for notification tap → navigate to target screen
//    4. Handle app opened from killed state via notification tap
//    5. Listen for token refresh → re-register with backend
// ═════════════════════════════════════════════════════════════
export const useNotifications = () => {
  const { user } = useAuthStore();
  const { showNotification } = useNotification();
  const initialChecked = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribers: (() => void)[] = [];

    // ─── 1. REGISTER FCM TOKEN (once per app lifecycle) ──────
    if (!tokenRegistered) {
      const registerToken = async () => {
        try {
          console.log('[FCM] Registering push token...');
          const token = await registerForPushNotificationsAsync();

          if (!token) {
            console.warn('[FCM] No token received — push disabled');
            return;
          }

          await sendTokenToBackend(token);
          tokenRegistered = true;
        } catch (err: any) {
          console.error('[FCM] Token registration failed:', err?.message || err);
        }
      };
      registerToken();
    }

    // ─── 2. FOREGROUND MESSAGE LISTENER (with dedup) ─────────
    if (!listenersAttached) {
      // FCM foreground: data-only messages and notification+data messages
      const unsubForeground = onForegroundMessage((remoteMessage) => {
        const { notification, data } = remoteMessage;
        const title = notification?.title || (data?.title as string) || 'New Notification';
        const body = notification?.body || (data?.body as string) || '';
        const notifId = (data?.notificationId as string) || '';

        console.log('[FCM] Foreground message:', { title, type: data?.type, notifId });

        if (notifId && wasAlreadyHandled(notifId)) {
          console.log('[FCM] Skipping duplicate:', notifId);
          return;
        }
        if (notifId) markNotificationHandled(notifId);

        showNotification({
          title,
          body,
          avatar: data?.senderAvatar as string,
          onPress: () => navigateToNotification(data, body),
        });
      });
      unsubscribers.push(unsubForeground);

      // ─── 3. BACKGROUND TAP LISTENER ──────────────────────────
      const unsubOpened = onNotificationOpenedApp((remoteMessage) => {
        const { data, notification } = remoteMessage;
        console.log('[FCM] Notification opened app:', { type: data?.type });
        navigateToNotification(data, notification?.body || null);
      });
      unsubscribers.push(unsubOpened);

      // ─── 4. KILLED-STATE TAP (check once) ────────────────────
      if (!initialChecked.current) {
        initialChecked.current = true;
        getInitialNotification().then((remoteMessage) => {
          if (remoteMessage) {
            console.log('[FCM] App opened from killed state via notification');
            navigateToNotification(remoteMessage.data, remoteMessage.notification?.body || null);
          }
        });
      }

      // ─── 5. TOKEN REFRESH LISTENER ───────────────────────────
      const unsubTokenRefresh = onTokenRefresh(async (newToken) => {
        console.log('[FCM] Token refreshed, re-registering...');
        try {
          await sendTokenToBackend(newToken);
        } catch (err: any) {
          console.error('[FCM] Token refresh registration failed:', err?.message);
        }
      });
      unsubscribers.push(unsubTokenRefresh);

      listenersAttached = true;
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      listenersAttached = false;
    };
  }, [user?.id]);

  return null;
};
