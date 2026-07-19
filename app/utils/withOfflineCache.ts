import { Platform } from 'react-native';
import { readFromStore, writeToStore, readAllFromStore, STORES } from '@/web/offline/db';
import { useNetworkStore } from '@/store/networkStore';

/**
 * Wraps a fetch function with write-through cache for IndexedDB.
 * Works seamlessly across web and native (no-op on native).
 * 
 * @param storeName - The IndexedDB store to use (e.g. STORES.ANIME_LIST)
 * @param key - Unique ID for this item or query
 * @param fetchFn - The original API fetch promise
 * @param isList - If true, treats the data as an array and stores items individually (or together if preferred)
 */
export async function withOfflineCache<T>(
  storeName: string,
  key: string,
  fetchFn: () => Promise<T>,
  isList: boolean = false
): Promise<T> {
  const isOffline = useNetworkStore.getState().isOffline;

  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return fetchFn();
  }

  if (isOffline) {
    try {
      if (isList) {
        // If it's a list fetch, we might just read the whole store or a specific query key
        const cached = await readFromStore(storeName, key);
        return (cached?.data || []) as T;
      } else {
        const cached = await readFromStore(storeName, key);
        if (cached) return cached.data as T;
        throw new Error('No offline data found');
      }
    } catch (e) {
      console.warn('Offline read failed', e);
      throw e;
    }
  }

  // Online: Fetch and cache
  try {
    const data = await fetchFn();
    // Wrap data with ID for the store
    await writeToStore(storeName, { id: key, data });
    return data;
  } catch (error: any) {
    // If network fails unexpectedly (e.g., connection drops mid-flight)
    console.warn('Network fetch failed, falling back to cache', error);
    try {
      const cached = await readFromStore(storeName, key);
      if (cached) return (isList ? cached.data || [] : cached.data) as T;
    } catch (e) {}
    throw error;
  }
}
