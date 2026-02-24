import api from './api';
import { Message } from '@/types';

export const chatService = {
  getMessages: async (channelId: string, limit = 50, before?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (before) params.append('before', before);

    const { data } = await api.get<{ success: boolean; data: { messages: Message[] } }>(
      `/messages/channel/${channelId}?${params}`
    );
    return data.data.messages;
  },

  sendMessage: async (channelId: string, content: string, repliedToId?: string) => {
    const { data } = await api.post<{ success: boolean; data: { message: Message } }>('/messages', {
      channelId,
      content,
      repliedToId
    });
    return data.data.message;
  },

  editMessage: async (messageId: string, content: string) => {
    const { data } = await api.put<{ success: boolean; data: { message: Message } }>(`/messages/${messageId}`, {
      content
    });
    return data.data.message;
  },

  deleteMessage: async (messageId: string) => {
    await api.delete(`/messages/${messageId}`);
  },

  addReaction: async (messageId: string, emoji: string) => {
    await api.post(`/messages/${messageId}/reactions`, { emoji });
  }
};
