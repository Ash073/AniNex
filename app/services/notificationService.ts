import api from './api';

export interface Notification {
  id: string;
  user_id: string;
  type: 'server_added' | 'server_approved' | 'friend_request' | 'post_like' | 'post_comment' | 'general';
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  /** Fetch notifications for the current user */
  async getNotifications(): Promise<Notification[]> {
    const res = await api.get('/notifications');
    return res.data?.data?.notifications || [];
  },

  /** Get unread notification count */
  async getUnreadCount(): Promise<number> {
    const res = await api.get('/notifications/unread-count');
    return res.data?.data?.count || 0;
  },

  /** Mark a single notification as read */
  async markRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  /** Mark all notifications as read */
  async markAllRead(): Promise<void> {
    await api.put('/notifications/read-all');
  },

  /** Delete a single notification */
  async deleteNotification(id: string): Promise<void> {
    await api.delete(`/notifications/${id}`);
  },

  /** Delete all notifications */
  async deleteAllNotifications(): Promise<void> {
    await api.delete('/notifications');
  },
};