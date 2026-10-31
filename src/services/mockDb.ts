import { APP_CONFIG } from '@/constants/config';
import { createSeedDatabase, MOCK_DB_VERSION, type MockDatabase } from '@/data/seed';
import { STORAGE_KEYS, storage } from './storage';

/**
 * Cihaz üzerinde kalıcı (AsyncStorage) çalışan sahte veritabanı.
 * Sadece mock servisler tarafından kullanılır; ekranlar buna doğrudan erişmez.
 */
let db: MockDatabase | null = null;
let loading: Promise<MockDatabase> | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

async function load(): Promise<MockDatabase> {
  if (db) return db;
  if (!loading) {
    loading = (async () => {
      const stored = await storage.getJSON<MockDatabase>(STORAGE_KEYS.mockDb);
      db = stored && stored.version === MOCK_DB_VERSION ? stored : createSeedDatabase();
      if (!stored) schedulePersist();
      return db;
    })();
  }
  return loading;
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (db) storage.setJSON(STORAGE_KEYS.mockDb, db).catch(() => {});
  }, 300);
}

const delay = (ms: number = APP_CONFIG.mockLatency) => new Promise((r) => setTimeout(r, ms));

/** Kopya döndürerek servis dışından veritabanının değiştirilmesini engeller. */
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export const mockDb = {
  async read<T>(selector: (db: MockDatabase) => T, latency?: number): Promise<T> {
    const data = await load();
    await delay(latency);
    return clone(selector(data));
  },
  async write<T>(mutator: (db: MockDatabase) => T, latency?: number): Promise<T> {
    const data = await load();
    await delay(latency);
    const result = mutator(data);
    schedulePersist();
    return clone(result);
  },
  async reset(): Promise<void> {
    db = createSeedDatabase();
    loading = Promise.resolve(db);
    await storage.setJSON(STORAGE_KEYS.mockDb, db);
  },
};
