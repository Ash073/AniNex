import api from './api';
import { Post, Comment } from '@/types';

export const postService = {
  getPosts: async (params?: {
    serverId?: string;
    category?: string;
    limit?: number;
    skip?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.serverId) queryParams.append('serverId', params.serverId);
    if (params?.category) queryParams.append('category', params.category);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());

    const { data } = await api.get<{ success: boolean; data: { posts: Post[] } }>(
      `/posts?${queryParams}`
    );
    return data.data.posts;
  },

  createPost: async (postData: {
    content: string;
    title?: string;
    category?: string;
    serverId?: string;
    tags?: string[];
    images?: string[];
    visibility?: 'public' | 'followers' | 'selected';
    allowedUsers?: string[];
    commentsEnabled?: boolean;
    mentions?: string[];
  }) => {
    const { data } = await api.post<{ success: boolean; data: { post: Post } }>('/posts', postData);

    // Reward XP for posting (+5 XP)
    try {
      const { useAuthStore } = await import('@/store/authStore');
      const { user, updateUser } = useAuthStore.getState();
      if (user) {
        updateUser({ xp: (user.xp || 0) + 5 });
      }
    } catch (err) {
      console.warn('Failed to update local XP after post:', err);
    }

    return data.data.post;
  },

  likePost: async (postId: string) => {
    const { data } = await api.post(`/posts/${postId}/like`);
    return data;
  },

  getComments: async (postId: string) => {
    const { data } = await api.get<{ success: boolean; data: { comments: Comment[] } }>(
      `/posts/${postId}/comments`
    );
    return data.data.comments;
  },

  addComment: async (postId: string, content: string, parentCommentId?: string) => {
    const { data } = await api.post<{ success: boolean; data: { comment: Comment } }>(
      `/posts/${postId}/comments`,
      { content, parentCommentId }
    );

    // Reward XP for commenting (+3 XP)
    try {
      const { useAuthStore } = await import('@/store/authStore');
      const { user, updateUser } = useAuthStore.getState();
      if (user) {
        updateUser({ xp: (user.xp || 0) + 3 });
      }
    } catch (err) {
      console.warn('Failed to update local XP after comment:', err);
    }

    return data.data.comment;
  },

  getPost: async (postId: string) => {
    const { data } = await api.get<{ success: boolean; data: { post: Post } }>(
      `/posts/${postId}`
    );
    return data.data.post;
  },

  getUserPosts: async (userId: string, params?: { limit?: number; skip?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());

    const { data } = await api.get<{ success: boolean; data: { posts: Post[] } }>(
      `/posts/user/${userId}?${queryParams}`
    );
    return data.data.posts;
  },

  deletePost: async (postId: string) => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/posts/${postId}`);
    return data;
  },

  viewPost: async (postId: string) => {
    const { data } = await api.post(`/posts/${postId}/view`);
    return data;
  },
};
