import { create } from 'zustand';

interface NetworkState {
  isOffline: boolean;
  setOffline: (status: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isOffline: false, // Default to online
  setOffline: (status: boolean) => set({ isOffline: status }),
}));
