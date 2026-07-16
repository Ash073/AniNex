import api from './api';
import { User, Server } from '@/types';

export const recommendationService = {
  getRecommendedUsers: async (limit = 10) => {
    const { data } = await api.get<{ success: boolean; data: { users: User[] } }>(
      `/recommendations/users?limit=${limit}`
    );
    return data.data.users;
  },

  getRecommendedServers: async (limit = 10) => {
    const { data } = await api.get<{ success: boolean; data: { servers: Server[] } }>(
      `/recommendations/servers?limit=${limit}`
    );
    return data.data.servers;
  }
};
