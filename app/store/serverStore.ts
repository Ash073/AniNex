import { create } from 'zustand';
import { Server } from '@/types';

interface ServerState {
  servers: Server[];
  currentServer: Server | null;
  setServers: (servers: Server[]) => void;
  addServer: (server: Server) => void;
  setCurrentServer: (server: Server | null) => void;
  updateServer: (serverId: string, updates: Partial<Server>) => void;
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  currentServer: null,

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => ({ servers: [...state.servers, server] })),

  setCurrentServer: (server) => set({ currentServer: server }),

  updateServer: (serverId, updates) =>
    set((state) => ({
      servers: state.servers.map(s =>
        s._id === serverId ? { ...s, ...updates } : s
      ),
      currentServer:
        state.currentServer?._id === serverId
          ? { ...state.currentServer, ...updates }
          : state.currentServer
    }))
}));
