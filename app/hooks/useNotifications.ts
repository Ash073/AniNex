import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/components/NotificationProvider';
import {
    registerForPushNotificationsAsync,
    addNotificationReceivedListener,
    addNotificationResponseReceivedListener
} from '@/utils/pushNotifications';
import api from '@/services/api';

/**
 * Centralized hook to manage all notification-related logic:
 * 1. Token registration
 * 2. Foreground listening (toasts)
 * 3. Background/Tap listening (navigation)
 */
export const useNotifications = () => {
    const { user } = useAuthStore();
    const { showNotification } = useNotification();
    const notificationListener = useRef<any>(null);
    const responseListener = useRef<any>(null);

    useEffect(() => {
        if (!user?.id) return;

        // ─── 1. REGISTER FOR PUSH ───
        const setup = async () => {
            try {
                const token = await registerForPushNotificationsAsync();
                if (token) {
                    await api.post('/users/push-token', { token });
                    console.log('[Notifications] Registered token with backend');
                }
            } catch (err) {
                console.error('[Notifications] Registration failed', err);
            }
        };
        setup();

        // ─── 2. FOREGROUND LISTENER ───
        // Fired when notification is received while app is OPEN.
        // Socket handlers (useSocket) already show in-app toasts for real-time events,
        // so we only show a toast here for push-only types that have no socket counterpart.
        notificationListener.current = addNotificationReceivedListener((notification) => {
            const { title, body, data } = notification.request.content;
            const type = data?.type as string;

            // Types already handled by socket-based toasts in useSocket — skip to avoid duplicate
            const socketHandledTypes = ['dm', 'server_message', 'friend_request', 'post_like', 'post_comment', 'server_added', 'friend_online'];
            if (type && socketHandledTypes.includes(type)) return;

            // For push-only types (e.g. anime_fact from daily cron), show the toast
            showNotification({
                title: title || 'New Notification',
                body: body || '',
                avatar: data?.senderAvatar as string,
                onPress: () => handleNotificationRouting(data, body),
            });
        });

        // ─── 3. RESPONSE LISTENER ───
        // Fired when user TAPS on a notification (foreground or background)
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
     * Unified routing logic for all notification types
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
                console.warn('[Notifications] Unhandled notification type:', type);
                break;
        }
    };

    return null;
};
