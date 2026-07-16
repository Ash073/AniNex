import api from './api';

interface ProfileUpdateData {
  username?: string;
  displayName?: string;
  bio?: string;
  name?: string;
  age?: number;
  dateOfBirth?: string;
  mobile?: string;
  gender?: string;
  avatar?: string;
  favoriteAnime?: string[];
  genres?: string[];
  interests?: string[];
  experienceLevel?: string;
}

interface UserResponse {
  success: boolean;
  data: {
    user: any; // Using any for now since we don't have the exact User type defined
  };
}

export const userService = {
  async updateProfile(data: ProfileUpdateData): Promise<any> {
    try {
      const response = await api.put('/users/profile', data);
      return response.data.data.user;
    } catch (error: any) {
      throw error;
    }
  },

  async getUserById(userId: string): Promise<any> {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async addFriend(userId: string): Promise<any> {
    try {
      const response = await api.post(`/users/friends/${userId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async removeFriend(userId: string): Promise<any> {
    try {
      const response = await api.delete(`/users/friends/${userId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getFriends(): Promise<any[]> {
    try {
      const response = await api.get('/users/friends');
      return response.data.data.friends || [];
    } catch (error: any) {
      throw error;
    }
  },

  async getUserFriends(userId: string): Promise<any[]> {
    try {
      const response = await api.get(`/users/${userId}/friends`);
      return response.data.data.friends || [];
    } catch (error: any) {
      throw error;
    }
  },

  async getUserServers(userId: string): Promise<any[]> {
    try {
      const response = await api.get(`/users/${userId}/servers`);
      return response.data.data.servers || [];
    } catch (error: any) {
      throw error;
    }
  },

  async searchUsers(query: string): Promise<any[]> {
    try {
      const response = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
      return response.data.data.users || [];
    } catch (error: any) {
      throw error;
    }
  }
};