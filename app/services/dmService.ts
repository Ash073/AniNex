import api from './api';
import { Conversation, DirectMessage } from '@/types';

export const dmService = {
  /** Get all conversations for the logged-in user */
  getConversations: async (): Promise<Conversation[]> => {
    const { data } = await api.get<{ success: boolean; data: Conversation[] }>(
      '/dm/conversations'
    );
    return data.data;
  },

  /** Start or retrieve a conversation with a specific user */
  startConversation: async (userId: string): Promise<Conversation> => {
    const { data } = await api.post<{ success: boolean; data: Conversation }>(
      '/dm/conversations',
      { userId }
    );
    return data.data;
  },

  /** Get messages for a conversation */
  getMessages: async (
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<DirectMessage[]> => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (before) params.append('before', before);

    const { data } = await api.get<{
      success: boolean;
      data: { messages: DirectMessage[] };
    }>(`/dm/messages/${conversationId}?${params}`);
    return data.data.messages;
  },

  /** Send a direct message (text and/or image) */
  sendMessage: async (
    conversationId: string,
    content: string,
    image_url?: string,
    repliedToId?: string,
  ): Promise<DirectMessage> => {
    const { data } = await api.post<{
      success: boolean;
      data: { message: DirectMessage };
    }>('/dm/messages', { conversationId, content, image_url, repliedToId });
    return data.data.message;
  },

  /** Edit a direct message */
  editMessage: async (
    messageId: string,
    content: string,
  ): Promise<DirectMessage> => {
    const { data } = await api.put<{
      success: boolean;
      data: { message: DirectMessage };
    }>(`/dm/messages/${messageId}`, { content });
    return data.data.message;
  },

  /** Delete a direct message */
  deleteMessage: async (
    messageId: string,
  ): Promise<void> => {
    await api.delete(`/dm/messages/${messageId}`);
  },

  /** Mark all messages in a conversation as read */
  markRead: async (conversationId: string): Promise<void> => {
    await api.put(`/dm/messages/${conversationId}/read`);
  },

  /** Get total unread DM count across all conversations */
  getTotalUnread: async (): Promise<number> => {
    const { data } = await api.get('/dm/total-unread');
    return data?.data?.count || 0;
  },

  /** Add or update a reaction to a direct message */
  addReaction: async (messageId: string, emoji: string): Promise<void> => {
    await api.post(`/dm/messages/${messageId}/reactions`, { emoji });
  },
};
