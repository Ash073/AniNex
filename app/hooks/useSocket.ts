import { useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { socketService } from '@/services/socketService';
import { useChatStore } from '@/store/chatStore';
import { Message, DirectMessage } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { useNotification } from '@/components/NotificationProvider';
import api from '@/services/api';

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

  // Notification toast (safe default if invoked outside provider)
  let notify: ReturnType<typeof useNotification>['showNotification'] = () => { };
  try {
    const n = useNotification();
    notify = n.showNotification;
  } catch { }

  // Set online status via REST as backup
  const setOnlineStatus = useCallback(async (isOnline: boolean) => {
    try {
      await api.put('/users/status', { isOnline });
    } catch (e) {
      // Silently fail – socket will handle it
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    socketService.connect();
    setOnlineStatus(true);
    // Mark local user online in store
    updateUser({ isOnline: true });

    // ── Channel messages ──
    const handleNewMessage = (message: Message) => {
      addMessage(message.channel, message);
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

    // ── Reactions handles ──
    const handleMessageReaction = (data: { messageId: string, reactions: string[] }) => {
      // We need to find which channel this message belongs to. 
      // For simplicity, we can iterate over store, or just rely on the fact that reactions 
      // are mostly relevant for the current channel.
      const state = useChatStore.getState();
      Object.keys(state.messages).forEach(channelId => {
        updateMessage(channelId, data.messageId, { reactions: data.reactions });
      });
    };

    const handleDMReaction = (data: { messageId: string, reactions: string[] }) => {
      // DM screens typically handle their own state, but we can update store if needed
      // Currently DMs are in [conversationId].tsx using local state.
    };

    // ── DM notifications (when user is NOT on the DM screen) ──
    const handleDMNotification = (payload: any) => {
      // Refresh conversations list so badge counts update
      queryClient?.invalidateQueries({ queryKey: ['dm-conversations'] });
      queryClient?.invalidateQueries({ queryKey: ['dm-unread-count'] });

      // Show toast notification
      const msg = payload?.message || payload;
      if (msg && msg.sender_id !== userId) {
        incrementUnread();
        const senderName = msg.sender?.username || msg.sender?.display_name || 'Someone';
        const senderAvatar = msg.sender?.avatar;
        const body = msg.image_url ? '📷 Sent an image' : (msg.content || 'New message');
        notify({
          title: senderName,
          body,
          avatar: senderAvatar,
        });
      }
    };

    // ── Channel message notification ──
    const handleMessageNotification = (message: Message) => {
      const authorId = message.author?.id || (message as any).author_id;
      if (authorId !== userId) {
        incrementUnread();
        const authorName = message.author?.username || 'Someone';
        const authorAvatar = message.author?.avatar;
        const hasImage = (message.attachments || []).some((a: any) => a.type === 'image');
        const body = hasImage ? '📷 Sent an image' : (message.content || 'New message');
        notify({
          title: authorName,
          body,
          avatar: authorAvatar,
        });
      }
    };

    // ── Server addition notifications ──
    const handleServerAdded = (payload: any) => {
      // Refresh servers list so the new server shows up
      queryClient?.invalidateQueries({ queryKey: ['servers'] });
      queryClient?.invalidateQueries({ queryKey: ['notifications'] });
      queryClient?.invalidateQueries({ queryKey: ['notification-count'] });

      const serverName = payload?.serverName || 'a server';
      const addedBy = payload?.addedBy || 'Someone';
      notify({
        title: 'Added to Server',
        body: `${addedBy} added you to "${serverName}"`,
      });
    };

    socketService.on('message:new', handleNewMessage);
    socketService.on('message:new', handleMessageNotification);
    socketService.on('message:deleted', handleMessageDeleted);
    socketService.on('message:reaction', handleMessageReaction);
    socketService.on('typing:start', handleTypingStart);
    socketService.on('typing:stop', handleTypingStop);
    socketService.on('dm:notification', handleDMNotification);
    socketService.on('user:status', handleUserStatus);
    socketService.on('server:added', handleServerAdded);

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
      socketService.off('message:new', handleNewMessage);
      socketService.off('message:new', handleMessageNotification);
      socketService.off('message:deleted', handleMessageDeleted);
      socketService.off('message:reaction', handleMessageReaction);
      socketService.off('typing:start', handleTypingStart);
      socketService.off('typing:stop', handleTypingStop);
      socketService.off('dm:notification', handleDMNotification);
      socketService.off('user:status', handleUserStatus);
      socketService.off('server:added', handleServerAdded);
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
