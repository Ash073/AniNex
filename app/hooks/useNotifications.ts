import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/components/NotificationProvider';
import {
    registerForPushNotificationsAsync,
    addNotificationReceivedListener,
    addNotificationResponseReceivedListener,
    wasRecentlyShown,
} from '@/utils/pushNotifications';
import api from '@/services/api';

/**
 * Centralized hook for push notification management:
 *
 *   1. Token registration  — registers Expo push token with backend on login
 *   2. Foreground listener  — shows in-app toast for push notifications
 *                              (skips if socket toast already showed it — dedup)
 *   3. Tap / response listener — navigates when user taps a notification
 */
export const useNotifications = () => {
    const { user } = useAuthStore();
    const { showNotification } = useNotification();
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    useEffect(() => {
        if (!user?.id) return;

        // ─── 1. REGISTER PUSH TOKEN ───
        const setup = async () => {
            try {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    await api.post('/users/push-token', { token });
                    console.log('[Notifications] Token registered with backend');
                }
            } catch (err) {
                console.error('[Notifications] Registration failed', err);
            }
        };
        setup();

        // ─── 2. FOREGROUND PUSH LISTENER ───
        // Fires when a push notification arrives while the app is OPEN.
        // The socket-based toast in useSocket.ts marks notifications via
        // markNotificationShown(). If that already fired, we skip the toast
        // here to avoid duplicates. If socket was slow or disconnected,
        // this acts as the fallback and shows the toast.
        notificationListener.current = addNotificationReceivedListener((notification) => {
            const { title, body, data } = notification.request.content;
            const dedupKey = (data as any)?.notificationId || (data as any)?.type || '';

            // If socket already showed a toast for this, skip
            if (dedupKey && wasRecentlyShown(dedupKey)) {
                console.log('[Notifications] Skipping duplicate foreground toast:', dedupKey);
                return;
            }

            // Show in-app toast
            showNotification({
                title: title || 'New Notification',
                body: body || '',
                avatar: (data as any)?.senderAvatar as string,
                onPress: () => handleNotificationRouting(data, body),
            });
        });

        // ─── 3. TAP / RESPONSE LISTENER ───
        // Fires when user TAPS a notification (foreground, background, or killed)
        responseListener.current = addNotificationResponseReceivedListener((response) => {
            const { data, body } = response.notification.request.content;
            console.log('[Notifications] User tapped notification:', data);
            handleNotificationRouting(data, body);
        });

        return () => {
            if (notificationListener.current) notificationListener.current.remove();
            if (responseListener.current) responseListener.current.remove();
        };
    }, [user?.id]);

    /**
     * Route user to the correct screen based on notification type
     */
    const handleNotificationRouting = (data: any, body?: string | null) => {
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
                        }
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
                            serverName: data.serverName || 'Server'
                        }
                    } as any);
                }
                break;

            case 'friend_request':
                router.push('/(modals)/notifications' as any);
                break;

            case 'anime_fact':
                router.push({
                    pathname: '/(modals)/anime-fact',
                    params: { fact: data.fact || body || '' }
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

            default:
                console.warn('[Notifications] Unhandled type:', type);
                break;
        }
    };

    return null;
};
