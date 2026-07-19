import api from './api';
import { Post, Comment } from '@/types';
import { withOfflineCache } from '@/utils/withOfflineCache';
import { withOfflineMutation } from '@/utils/offlineMutation';
import { STORES } from '@/web/offline/db';

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

    return withOfflineCache(
      STORES.ANIME_LIST, // Mapping generic feed to ANIME_LIST for offline requirements
      `posts_${queryParams.toString()}`,
      async () => {
        const { data } = await api.get<{ success: boolean; data: { posts: Post[] } }>(
          `/posts?${queryParams}`
        );
        return data.data.posts;
      },
      true
    );
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
    return withOfflineMutation(
      'createPost',
      postData,
      async () => {
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
      { ...postData, _id: Date.now().toString(), author: {}, createdAt: new Date().toISOString() } as any
    );
  },

  likePost: async (postId: string) => {
    return withOfflineMutation(
      'likePost',
      { postId },
      async () => {
        const { data } = await api.post(`/posts/${postId}/like`);
        return data;
      },
      { success: true }
    );
  },

  getComments: async (postId: string) => {
    return withOfflineCache(
      STORES.ANIME_LIST,
      `comments_${postId}`,
      async () => {
        const { data } = await api.get<{ success: boolean; data: { comments: Comment[] } }>(
          `/posts/${postId}/comments`
        );
        return data.data.comments;
      },
      true
    );
  },

  addComment: async (postId: string, content: string, parentCommentId?: string) => {
    return withOfflineMutation(
      'addComment',
      { postId, content, parentCommentId },
      async () => {
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
      { _id: Date.now().toString(), content, postId, createdAt: new Date().toISOString() } as any
    );
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
