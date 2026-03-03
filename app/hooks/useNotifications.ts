import { useEffect, useRef } from 'react';
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

// ─────────────────────────────────────────────────────────────
//  Module-level guard — only register push token ONCE per app
//  lifecycle, even if React re-mounts the hook multiple times.
// ─────────────────────────────────────────────────────────────
let tokenRegistered = false;

/**
 * Navigate to the correct screen based on notification data.
 * Extracted as a standalone function so it can be used from
 * both the foreground listener and the tap/response listener.
 */
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
            if (data.serverId) {
                router.push(`/(modals)/server/${data.serverId}` as any);
            }
            break;

        default:
            console.warn('[Notifications] Unhandled type:', type);
            break;
    }
}

/**
 * Centralized hook for push notification management:
 *
 *   1. Token registration  — registers Expo push token with backend (once)
 *   2. Foreground listener  — shows in-app toast for incoming push
 *      notifications (dedup via unique notificationId from backend)
 *   3. Tap / response listener — navigates when user taps a notification
 *
 * IMPORTANT: Expo push is the SINGLE source of truth for all user
 * notifications. Socket events handle data sync only (store/query).
 */
export const useNotifications = () => {
    const { user } = useAuthStore();
    const { showNotification } = useNotification();
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    useEffect(() => {
        if (!user?.id) return;

        // ─── 1. REGISTER PUSH TOKEN (once per app lifecycle) ───
        if (!tokenRegistered) {
            const setup = async () => {
                try {
                    const token = await registerForPushNotificationsAsync();
                    if (token) {
                        await api.post('/users/push-token', { token });
                        tokenRegistered = true;
                        console.log('[Notifications] Token registered with backend');
                    }
                } catch (err) {
                    console.error('[Notifications] Registration failed', err);
                }
            };
            setup();
        }

        // ─── 2. FOREGROUND PUSH LISTENER ───
        // This is now the ONLY place that shows in-app toasts.
        // Socket events no longer display notifications.
        notificationListener.current = addNotificationReceivedListener((notification) => {
            const { title, body, data } = notification.request.content;
            const notifId = (data as any)?.notificationId || '';

            // Dedup: if this exact notification was already handled, skip
            if (notifId && wasAlreadyHandled(notifId)) {
                console.log('[Notifications] Skipping duplicate:', notifId);
                return;
            }

            // Mark as handled
            if (notifId) markNotificationHandled(notifId);

            // Show in-app toast
            showNotification({
                title: title || 'New Notification',
                body: body || '',
                avatar: (data as any)?.senderAvatar as string,
                onPress: () => navigateToNotification(data, body),
            });
        });

        // ─── 3. TAP / RESPONSE LISTENER ───
        // Fires when user TAPS a notification (foreground, background, or killed)
        responseListener.current = addNotificationResponseReceivedListener((response) => {
            const { data, body } = response.notification.request.content;
            console.log('[Notifications] User tapped notification:', data);
            navigateToNotification(data, body);
        });

        return () => {
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
        };
    }, [user?.id]);

    return null;
};
