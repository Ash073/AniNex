import api from './api';
import { Server, Channel, ServerSettings } from '@/types';

export const serverService = {
  getServers: async () => {
    const { data } = await api.get<{ success: boolean; data: { servers: Server[] } }>('/servers');
    return data.data.servers;
  },

  getServer: async (serverId: string) => {
    const { data } = await api.get<{ success: boolean; data: { server: Server } }>(`/servers/${serverId}`);
    return data.data.server;
  },

  createServer: async (serverData: {
    name: string;
    description?: string;
    animeTheme?: string;
    tags?: string[];
    isPublic?: boolean;
    memberIds?: string[];
    icon?: string;
  }) => {
    const { data } = await api.post<{ success: boolean; data: { server: Server } }>('/servers', serverData);
    return data.data.server;
  },

  joinServer: async (serverId: string) => {
    const { data } = await api.post(`/servers/${serverId}/join`);
    return data;
  },

  // Get the current user's join request status for a server
  getMyJoinStatus: async (serverId: string) => {
    const { data } = await api.get(`/servers/${serverId}/my-join-status`);
    return data.data?.joinRequest || null;
  },

  // Get pending join requests (admin)
  getJoinRequests: async (serverId: string) => {
    const { data } = await api.get(`/servers/${serverId}/join-requests`);
    return data.data?.requests || [];
  },

  // Approve a join request (admin)
  approveJoinRequest: async (serverId: string, requestId: string) => {
    const { data } = await api.post(`/servers/${serverId}/join-requests/${requestId}/approve`);
    return data;
  },

  // Reject a join request (admin)
  rejectJoinRequest: async (serverId: string, requestId: string) => {
    const { data } = await api.post(`/servers/${serverId}/join-requests/${requestId}/reject`);
    return data;
  },

  // Admin manually add a friend as member
  addMember: async (serverId: string, userId: string) => {
    const { data } = await api.post(`/servers/${serverId}/add-member`, { userId });
    return data;
  },

  leaveServer: async (serverId: string) => {
    const { data } = await api.post(`/servers/${serverId}/leave`);
    return data;
  },

  getChannels: async (serverId: string) => {
    const { data } = await api.get<{ success: boolean; data: { channels: Channel[] } }>(`/channels/server/${serverId}`);
    return data.data.channels;
  },

  createChannel: async (channelData: {
    name: string;
    serverId: string;
    description?: string;
    type?: string;
  }) => {
    const { data } = await api.post<{ success: boolean; data: { channel: Channel } }>('/channels', channelData);
    return data.data.channel;
  },

  // ─── Admin: Update server settings / permissions ───
  updateSettings: async (serverId: string, settings: Partial<ServerSettings>) => {
    const { data } = await api.put(`/servers/${serverId}/settings`, settings);
    return data;
  },

  // ─── Admin: Change a member's role ───
  updateMemberRole: async (serverId: string, userId: string, role: string) => {
    const { data } = await api.put(`/servers/${serverId}/members/${userId}/role`, { role });
    return data;
  },

  searchServers: async (query: string) => {
    const { data } = await api.get<{ success: boolean; data: { servers: Server[] } }>(
      `/servers/search?q=${encodeURIComponent(query)}`
    );
    return data.data.servers;
  },

  // ─── Admin: Kick a member ───
  kickMember: async (serverId: string, userId: string) => {
    const { data } = await api.delete(`/servers/${serverId}/members/${userId}`);
    return data;
  },

  // ─── Admin: Delete server ───
  deleteServer: async (serverId: string) => {
    const { data } = await api.delete(`/servers/${serverId}`);
    return data;
  },

  // ─── Admin: Update server info ───
  updateServer: async (serverId: string, updates: { name?: string; description?: string; isPublic?: boolean; tags?: string[]; animeTheme?: string }) => {
    const { data } = await api.put(`/servers/${serverId}`, updates);
    return data;
  },
};
