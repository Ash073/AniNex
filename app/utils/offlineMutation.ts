import { Platform } from 'react-native';
import { writeToStore, STORES } from '@/web/offline/db';
import { useNetworkStore } from '@/store/networkStore';

/**
 * Wraps a mutation function.
 * If online, executes normally.
 * If offline, pushes the action to IndexedDB `mutationQueue` and returns a mock success.
 */
export async function withOfflineMutation<T>(
  actionName: string,
  payload: any,
  mutationFn: () => Promise<T>,
  mockResponse?: T
): Promise<T> {
  const isOffline = useNetworkStore.getState().isOffline;

  if (Platform.OS !== 'web' || typeof window === 'undefined' || !isOffline) {
    try {
      return await mutationFn();
    } catch (error: any) {
      if (error.message === 'Network Error' || !navigator.onLine) {
        // Fallback if it failed due to sudden disconnect
        await writeToStore(STORES.MUTATION_QUEUE, {
          action: actionName,
          payload,
          timestamp: Date.now(),
        });
        return mockResponse as T;
      }
      throw error;
    }
  }

  // Offline: Queue mutation and return mock response for optimistic UI
  await writeToStore(STORES.MUTATION_QUEUE, {
    action: actionName,
    payload,
    timestamp: Date.now(),
  });
  
  // Try to register background sync if available
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready as any;
      if (reg.sync) {
        await reg.sync.register('sync-mutations');
      }
    }
  } catch (e) {
    console.log('Background Sync not supported/failed', e);
  }

  return mockResponse as T;
}
