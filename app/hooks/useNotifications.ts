import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/components/NotificationProvider';
import {
  registerForPushNotificationsAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
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
//  useNotifications HOOK
//
//  Responsibilities:
//    1. Register push token with backend (once per app lifecycle)
//    2. Listen for foreground push → show in-app toast (deduped)
//    3. Listen for notification tap → navigate to target screen
//
//  This hook is the ONLY place that sets up push listeners.
//  Socket events handle real-time data sync, NOT display.
// ═════════════════════════════════════════════════════════════
export const useNotifications = () => {
  const { user } = useAuthStore();
  const { showNotification } = useNotification();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (!user?.id) return;

    // ─── 1. REGISTER PUSH TOKEN (once per app lifecycle) ─────
    if (!tokenRegistered) {
      const registerToken = async () => {
        try {
          console.log('[Notifications] Registering push token...');
          const token = await registerForPushNotificationsAsync();

          if (!token) {
            console.warn('[Notifications] No token received — push disabled');
            return;
          }

          // POST to backend — writes to push_tokens table + users.push_token
          await api.post('/users/push-token', {
            token,
            platform: Platform.OS,   // 'ios' | 'android'
          });

          tokenRegistered = true;
          console.log('[Notifications] Token registered with backend successfully');
        } catch (err: any) {
          console.error('[Notifications] Token registration failed:', err?.message || err);
          // Don't set tokenRegistered — will retry on next mount
        }
      };
      registerToken();
    }

    // ─── 2. FOREGROUND PUSH LISTENER (with dedup) ────────────
    // Only attach listeners once even if effect re-runs
    if (!listenersAttached) {
      notificationListener.current = addNotificationReceivedListener((notification) => {
        const { title, body, data } = notification.request.content;
        const notifId = (data as any)?.notificationId || '';

        console.log('[Notifications] Push received in foreground:', {
          title,
          type: (data as any)?.type,
          notifId,
        });

        // Dedup: skip if this exact notification was already handled
        if (notifId && wasAlreadyHandled(notifId)) {
          console.log('[Notifications] Skipping duplicate:', notifId);
          return;
        }

        // Mark as handled to prevent socket-side duplicate
        if (notifId) markNotificationHandled(notifId);

        // Show in-app toast
        showNotification({
          title: title || 'New Notification',
          body: body || '',
          avatar: (data as any)?.senderAvatar as string,
          onPress: () => navigateToNotification(data, body),
        });
      });

      // ─── 3. TAP / RESPONSE LISTENER ─────────────────────────
      // Fires when user taps notification (foreground, background, or killed)
      responseListener.current = addNotificationResponseReceivedListener((response) => {
        const { data, body } = response.notification.request.content;
        console.log('[Notifications] User tapped notification:', {
          type: (data as any)?.type,
          notifId: (data as any)?.notificationId,
        });
        navigateToNotification(data, body);
      });

      listenersAttached = true;
    }

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
        notificationListener.current = null;
      }
      if (responseListener.current) {
        responseListener.current.remove();
        responseListener.current = null;
      }
      listenersAttached = false;
    };
  }, [user?.id]);

  return null;
};
