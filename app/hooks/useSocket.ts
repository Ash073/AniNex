import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { socketService } from '@/services/socketService';
import { useChatStore } from '@/store/chatStore';
import { Message, DirectMessage } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

// ─────────────────────────────────────────────────────────────
//  IMPORTANT ARCHITECTURE NOTE:
//  Socket events are for DATA SYNC ONLY — updating Zustand stores
//  and invalidating React Query caches.
//
//  All user-visible notifications (toasts + OS banners) are
//  delivered exclusively through Expo Push → useNotifications.ts.
//  Do NOT add notify(), scheduleLocalNotification(), or any
//  notification display logic to this file.
// ─────────────────────────────────────────────────────────────

// Module-level flag to prevent duplicate listener registration
// when useSocket() is called from multiple components simultaneously
let listenersRegisteredBy: string | null = null;

export const useSocket = () => {
  const { isAuthenticated, user, updateUser } = useAuthStore();
  const {
    addMessage,
    updateMessage,
    setMessages,
    addTypingUser,
    removeTypingUser,
    incrementUnread,
    removeMessage,
  } = useChatStore() as any;
  const appState = useRef(AppState.currentState);
  const userId = user?.id || user?._id;

  // queryClient is optional – wrapped in try/catch so hook still works outside QueryClientProvider
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch { }

  // Set online status via REST as backup
  const setOnlineStatus = useCallback(async (isOnline: boolean) => {
    try {
      await api.put('/users/status', { isOnline });
    } catch (e) {
      // Silently fail – socket will handle it
    }
  }, []);

  const instanceId = useRef(`socket-${Date.now()}-${Math.random()}`).current;

  useEffect(() => {
    if (!isAuthenticated) return;

    // Only register listeners if no other instance has done so
    const shouldRegisterListeners = !listenersRegisteredBy;
    if (shouldRegisterListeners) {
      listenersRegisteredBy = instanceId;
    }

    socketService.connect();
    setOnlineStatus(true);
    // Mark local user online in store
    updateUser({ isOnline: true });

    // ── Channel messages (DATA SYNC) ──
    const handleNewMessage = (message: Message) => {
      const channelId = message.channel || message.channel_id;
      if (!channelId) return;

      // Deduplicate: remove any optimistic message from the same author
      const state = useChatStore.getState();
      const existing = state.messages[channelId] || [];
      const authorId = message.author?.id || (message as any).author_id;

      // If this is our own message, remove the optimistic placeholder
      if (authorId === userId) {
        const withoutOptimistic = existing.filter(
          (m) => !m.id.startsWith('optimistic-') || (m as any).author_id !== userId
        );
        useChatStore.getState().setMessages(channelId, [message, ...withoutOptimistic]);
      } else {
        addMessage(channelId, message);
        incrementUnread();
      }
    };

    const handleMessageDeleted = (data: { messageId: string; channelId: string }) => {
      if (!data?.messageId || !data?.channelId) return;
      removeMessage(data.channelId, data.messageId);
    };

    const handleTypingStart = (data: { userId: string; username: string; channelId: string }) => {
      addTypingUser(data);
    };

    const handleTypingStop = (data: { userId: string; channelId: string }) => {
      removeTypingUser(data.userId, data.channelId);
    };

    // ── User online/offline status sync ──
    const handleUserStatus = (data: { userId: string; isOnline: boolean }) => {
      if (data.userId === userId) {
        updateUser({ isOnline: data.isOnline });
      }
    };

    // ── Reaction sync ──
    const handleMessageReaction = (data: { messageId: string; reactions: string[] }) => {
      const state = useChatStore.getState();
      Object.keys(state.messages).forEach((channelId) => {
        updateMessage(channelId, data.messageId, { reactions: data.reactions });
      });
    };

    const handleDMReaction = (_data: { messageId: string; reactions: string[] }) => {
      // DM screens handle their own state via local state in [conversationId].tsx
    };

    // ── DM data sync (badge counts, conversation list refresh) ──
    const handleDMNotification = (payload: any) => {
      queryClient?.invalidateQueries({ queryKey: ['dm-conversations'] });
      queryClient?.invalidateQueries({ queryKey: ['dm-unread-count'] });

      const msg = payload?.message || payload;
      if (msg && msg.sender_id !== userId) {
        incrementUnread();
      }
    };

    // ── Server addition (data sync) ──
    const handleServerAdded = (_payload: any) => {
      queryClient?.invalidateQueries({ queryKey: ['servers'] });
      queryClient?.invalidateQueries({ queryKey: ['notifications'] });
      queryClient?.invalidateQueries({ queryKey: ['notification-count'] });
    };

    // ── General notification sync (badge counts) ──
    const handleNotificationNew = (payload: any) => {
      queryClient?.invalidateQueries({ queryKey: ['notifications'] });
      queryClient?.invalidateQueries({ queryKey: ['notification-count'] });
    };

    // Only register event listeners if this instance owns them
    if (shouldRegisterListeners) {
      socketService.on('message:new', handleNewMessage);
      socketService.on('message:deleted', handleMessageDeleted);
      socketService.on('message:reaction', handleMessageReaction);
      socketService.on('typing:start', handleTypingStart);
      socketService.on('typing:stop', handleTypingStop);
      socketService.on('dm:notification', handleDMNotification);
      socketService.on('user:status', handleUserStatus);
      socketService.on('server:added', handleServerAdded);
      socketService.on('notification:new', handleNotificationNew);
      socketService.on('dm:reaction', handleDMReaction);
    }

    // ── AppState tracking for online/offline ──
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        socketService.connect();
        setOnlineStatus(true);
        updateUser({ isOnline: true });
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        setOnlineStatus(false);
        updateUser({ isOnline: false });
        socketService.disconnect();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Only unregister listeners if this instance owns them
      if (listenersRegisteredBy === instanceId) {
        socketService.off('message:new', handleNewMessage);
        socketService.off('message:deleted', handleMessageDeleted);
        socketService.off('message:reaction', handleMessageReaction);
        socketService.off('typing:start', handleTypingStart);
        socketService.off('typing:stop', handleTypingStop);
        socketService.off('dm:notification', handleDMNotification);
        socketService.off('user:status', handleUserStatus);
        socketService.off('server:added', handleServerAdded);
        socketService.off('notification:new', handleNotificationNew);
        socketService.off('dm:reaction', handleDMReaction);
        listenersRegisteredBy = null;
      }
      subscription.remove();
      setOnlineStatus(false);
      updateUser({ isOnline: false });
      socketService.disconnect();
    };
  }, [isAuthenticated, addMessage, addTypingUser, removeTypingUser, removeMessage]);

  const sendMessage = useCallback((channelId: string, content: string, image_url?: string, repliedToId?: string) => {
    socketService.sendMessage(channelId, content, image_url, repliedToId);
  }, []);

  const joinChannel = useCallback((channelId: string) => {
    socketService.joinChannel(channelId);
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketService.leaveChannel(channelId);
  }, []);

  const startTyping = useCallback((channelId: string) => {
    socketService.startTyping(channelId);
  }, []);

  const stopTyping = useCallback((channelId: string) => {
    socketService.stopTyping(channelId);
  }, []);

  return {
    sendMessage,
    joinChannel,
    leaveChannel,
    startTyping,
    stopTyping,
    isConnected: socketService.getConnectionStatus()
  };
};
