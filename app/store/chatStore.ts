import { create } from 'zustand';
import { Message, Channel } from '@/types';

interface TypingUser {
  userId: string;
  username: string;
  channelId: string;
}

interface ChatState {
  messages: Record<string, Message[]>;
  channels: Channel[];
  currentChannelId: string | null;
  typingUsers: TypingUser[];
  unreadCount: number;
  addMessage: (channelId: string, message: Message) => void;
  updateMessage: (channelId: string, messageId: string, updates: Partial<Message>) => void;
  setMessages: (channelId: string, messages: Message[]) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setChannels: (channels: Channel[]) => void;
  setCurrentChannel: (channelId: string | null) => void;
  addTypingUser: (user: TypingUser) => void;
  removeTypingUser: (userId: string, channelId: string) => void;
  clearMessages: () => void;
  incrementUnread: () => void;
  resetUnread: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: {},
  channels: [],
  currentChannelId: null,
  typingUsers: [],
  unreadCount: 0,

  addMessage: (channelId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: [message, ...(state.messages[channelId] || [])]
      }
    })),

  updateMessage: (channelId, messageId, updates) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map(m =>
          m.id === messageId ? { ...m, ...updates } : m
        )
      }
    })),

  setMessages: (channelId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: messages
      }
    })),

  removeMessage: (channelId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).filter((m) => m.id !== messageId),
      },
    })),

  setChannels: (channels) => set({ channels }),

  setCurrentChannel: (channelId) => set({ currentChannelId: channelId }),

  addTypingUser: (user) =>
    set((state) => ({
      typingUsers: [...state.typingUsers.filter(u => u.userId !== user.userId), user]
    })),

  removeTypingUser: (userId, channelId) =>
    set((state) => ({
      typingUsers: state.typingUsers.filter(
        u => !(u.userId === userId && u.channelId === channelId)
      )
    })),

  clearMessages: () => set({ messages: {}, currentChannelId: null }),

  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  resetUnread: () => set({ unreadCount: 0 }),
}));
