import React, { useEffect, useRef } from 'react';
import { useNotification } from './NotificationProvider';
import { addNotificationListener } from '@/utils/pushNotifications';
import { router } from 'expo-router';

/**
 * Listen for background/foreground notifications and show in-app toasts 🎌
 */
export const NotificationHandler = () => {
    const { showNotification } = useNotification();
    const listener = useRef<{ remove: () => void } | null>(null);

    useEffect(() => {
        // Foreground listener — show a custom toast instead of system tray notification
        listener.current = addNotificationListener((notification) => {
            const { title, body, data } = notification.request.content;

            showNotification({
                title: title || 'New Notification',
                body: body || 'You have a new update',
                avatar: data?.senderAvatar as string,
                onPress: () => {
                    // Navigate when toast is tapped
                    if (data?.type === 'dm' && data?.conversationId) {
                        router.push({
                            pathname: '/(modals)/dm/[conversationId]',
                            params: {
                                conversationId: data.conversationId as string,
                                name: (data.senderName as string) || 'User'
                            }
                        } as any);
                    } else if (data?.type === 'server_message' && data?.channelId) {
                        router.push({
                            pathname: '/(modals)/chat/[channelId]',
                            params: { channelId: data.channelId as string }
                        } as any);
                    } else if (data?.type === 'friend_request') {
                        router.push('/(modals)/notifications' as any);
                    } else if (data?.type === 'anime_fact') {
                        router.push({
                            pathname: '/(modals)/anime-fact',
                            params: { fact: (data.fact as string) || body || '' }
                        } as any);
                    } else if (data?.type === 'mention' && data?.channelId) {
                        router.push({
                            pathname: '/(modals)/chat/[channelId]',
                            params: { channelId: data.channelId as string }
                        } as any);
                    }
                }
            });
        });

        return () => {
            if (listener.current) listener.current.remove();
        };
    }, [showNotification]);

    return null;
};
