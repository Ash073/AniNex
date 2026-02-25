import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { SOCKET_URL } from '@/constants/api';
import { Message } from '@/types';

// Platform-agnostic token retrieval (matches authStore storage)
const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('token');
    }
    return await SecureStore.getItemAsync('token');
  } catch {
    return null;
  }
};

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private messageQueue: Array<{ channelId: string; content: string; image_url?: string; repliedToId?: string }> = [];

  async connect() {
    if (this.isConnected && this.socket?.connected) return;

    try {
      const token = await getToken();
      if (!token) {
        console.error('No token found for socket connection');
        return;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });

      this.setupEventListeners();

      this.socket.on('connect', () => {
        console.log('Socket connected');
        this.isConnected = true;
        // Flush queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          this.socket.emit('message:send', msg);
        }
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
    } catch (error) {
      console.error('Socket connection failed:', error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Message events are handled by individual components
    // via the on() method exposed below
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Channel operations
  joinChannel(channelId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('channel:join', channelId);
    }
  }

  leaveChannel(channelId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('channel:leave', channelId);
    }
  }

  // Message operations
  sendMessage(channelId: string, content: string, image_url?: string, repliedToId?: string) {
    const msg = { channelId, content, image_url, repliedToId };
    if (this.socket && this.isConnected) {
      this.socket.emit('message:send', msg);
    } else {
      // Queue the message for retry
      this.messageQueue.push(msg);
    }
  }

  markMessageAsRead(messageId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message:read', { messageId });
    }
  }

  // Typing indicators
  startTyping(channelId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:start', channelId);
    }
  }

  stopTyping(channelId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing:stop', channelId);
    }
  }

  // ── Direct Message operations ──
  joinDM(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('dm:join', conversationId);
    }
  }

  leaveDM(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('dm:leave', conversationId);
    }
  }

  sendDM(conversationId: string, content: string, image_url?: string, repliedToId?: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('dm:send', { conversationId, content, image_url, repliedToId });
    }
  }

  startDMTyping(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('dm:typing:start', conversationId);
    }
  }

  stopDMTyping(conversationId: string) {
    if (this.socket && this.isConnected) {
      this.socket.emit('dm:typing:stop', conversationId);
    }
  }

  // Event listeners
  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

export const socketService = new SocketService();
