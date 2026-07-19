import { openDB, IDBPDatabase } from 'idb';
import { Platform } from 'react-native';

const DB_NAME = 'aninex-offline-db';
const DB_VERSION = 1;

export const STORES = {
  ANIME_LIST: 'animeList',
  USER_PROFILE: 'userProfile',
  CHAT_HISTORY: 'chatHistory',
  MUTATION_QUEUE: 'mutationQueue',
};

let dbPromise: Promise<IDBPDatabase<any>> | null = null;

export const initDB = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORES.ANIME_LIST)) {
          const store = db.createObjectStore(STORES.ANIME_LIST, { keyPath: 'id' });
          store.createIndex('lastAccessed', 'lastAccessed');
        }
        if (!db.objectStoreNames.contains(STORES.USER_PROFILE)) {
          db.createObjectStore(STORES.USER_PROFILE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.CHAT_HISTORY)) {
          const store = db.createObjectStore(STORES.CHAT_HISTORY, { keyPath: 'id' });
          store.createIndex('conversationId', 'conversationId');
          store.createIndex('lastAccessed', 'lastAccessed');
        }
        if (!db.objectStoreNames.contains(STORES.MUTATION_QUEUE)) {
          db.createObjectStore(STORES.MUTATION_QUEUE, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
};

export const runEviction = async () => {
  if (Platform.OS !== 'web') return;
  const db = await initDB();
  if (!db) return;

  const tx = db.transaction([STORES.ANIME_LIST, STORES.CHAT_HISTORY], 'readwrite');

  // Evict animeList (keep last 100)
  const animeStore = tx.objectStore(STORES.ANIME_LIST);
  const animeCount = await animeStore.count();
  if (animeCount > 100) {
    const index = animeStore.index('lastAccessed');
    let cursor = await index.openCursor();
    let toDelete = animeCount - 100;
    while (cursor && toDelete > 0) {
      await cursor.delete();
      cursor = await cursor.continue();
      toDelete--;
    }
  }

  // Evict chatHistory (keep last 30 days)
  const chatStore = tx.objectStore(STORES.CHAT_HISTORY);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const chatIndex = chatStore.index('lastAccessed');
  let chatCursor = await chatIndex.openCursor(IDBKeyRange.upperBound(thirtyDaysAgo));
  while (chatCursor) {
    await chatCursor.delete();
    chatCursor = await chatCursor.continue();
  }

  await tx.done;
};

export const readFromStore = async (storeName: string, id: string) => {
  if (Platform.OS !== 'web') return null;
  const db = await initDB();
  if (!db) return null;
  return db.get(storeName, id);
};

export const writeToStore = async (storeName: string, item: any) => {
  if (Platform.OS !== 'web') return;
  const db = await initDB();
  if (!db) return;
  const data = { ...item, lastAccessed: Date.now() };
  await db.put(storeName, data);
};

export const readAllFromStore = async (storeName: string) => {
  if (Platform.OS !== 'web') return [];
  const db = await initDB();
  if (!db) return [];
  return db.getAll(storeName);
};

export const deleteFromStore = async (storeName: string, id: string | number) => {
  if (Platform.OS !== 'web') return;
  const db = await initDB();
  if (!db) return;
  await db.delete(storeName, id);
};

// Start eviction logic immediately for web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  runEviction().catch(console.error);
}
