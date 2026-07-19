import { Platform } from 'react-native';
import { readAllFromStore, deleteFromStore, STORES } from '@/web/offline/db';
import api from '@/services/api';
import { socketService } from '@/services/socketService';

export class SyncManager {
  private isSyncing = false;

  async syncMutations() {
    if (Platform.OS !== 'web' || this.isSyncing) return;
    
    this.isSyncing = true;
    try {
      const queue = await readAllFromStore(STORES.MUTATION_QUEUE);
      
      // Sort by timestamp
      queue.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of queue) {
        try {
          if (item.action === 'socket_message') {
            socketService.sendMessage(item.payload.channelId, item.payload.content, item.payload.image_url, item.payload.repliedToId);
          } else {
            // Replay standard HTTP requests using our API instance
            // (Assuming payload contains { method, url, data })
            if (item.payload.method && item.payload.url) {
              await api({
                method: item.payload.method,
                url: item.payload.url,
                data: item.payload.data
              });
            }
          }
          // On success, remove from queue
          await deleteFromStore(STORES.MUTATION_QUEUE, item.id);
        } catch (error: any) {
          console.error('Sync item failed:', item, error);
          // If it's a 4xx error, maybe drop it. For now, leave in queue to retry later unless explicitly handled
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  setupListeners() {
    if (Platform.OS === 'web') {
      window.addEventListener('online', () => {
        this.syncMutations().catch(console.error);
      });
      
      // Also register background sync service worker listener if possible
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SYNC_MUTATIONS') {
            this.syncMutations().catch(console.error);
          }
        });
      }
    }
  }
}

export const syncManager = new SyncManager();
