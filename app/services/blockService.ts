import api from './api';

export interface Block {
  id: string;
  created_at: string;
  blocked_user: {
    id: string;
    username: string;
    display_name: string;
    avatar: string;
  };
}

export interface BlockCheckResponse {
  isBlocked: boolean;
  blockId: string | null;
}

export const blockService = {
  // Block a user
  blockUser: async (userId: string) => {
    const { data } = await api.post<{ success: boolean; message: string; data: { block: Block } }>('/blocks', { userId });
    return data;
  },

  // Unblock a user
  unblockUser: async (userId: string) => {
    const { data } = await api.delete<{ success: boolean; message: string }>(`/blocks/${userId}`);
    return data;
  },

  // Get blocked users
  getBlockedUsers: async () => {
    const { data } = await api.get<{ success: boolean; data: { blocks: Block[] } }>('/blocks');
    return data.data.blocks;
  },

  // Check if a user is blocked
  checkIfBlocked: async (userId: string) => {
    const { data } = await api.get<{ success: boolean; data: BlockCheckResponse }>(`/blocks/check/${userId}`);
    return data.data;
  }
};