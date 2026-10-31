import { storage } from '../storage';
import type { LocationFix } from '@/types';

/**
 * Çevrimdışı konum kuyruğu (AsyncStorage). Arka plan görevi ve ön plan aynı kuyruğu kullanır;
 * ağ yoksa noktalar burada bekler ve bağlantı gelince sırayla gönderilir.
 */
const QUEUE_KEY = 'akna.tracking.queue';
const STATE_KEY = 'akna.tracking.state';
/** Uzun süre çevrimdışı kalınırsa en eski noktalar atılır (≈ 4 saatlik veri). */
export const MAX_QUEUE = 1000;

export interface TrackingState {
  driverId: string;
  startedAt: number;
}

// Aynı JS çalışma ortamındaki eşzamanlı okuma/yazmaları sıraya koyar.
let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

const read = async () => (await storage.getJSON<LocationFix[]>(QUEUE_KEY)) ?? [];

export const locationQueue = {
  enqueue: (fixes: LocationFix[]) =>
    locked(async () => {
      if (!fixes.length) return (await read()).length;
      const merged = [...(await read()), ...fixes]
        // Aynı zaman damgalı tekrarlar (deferred teslimat) elenir.
        .filter((f, i, all) => i === all.findIndex((x) => x.timestamp === f.timestamp))
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-MAX_QUEUE);
      await storage.setJSON(QUEUE_KEY, merged);
      return merged.length;
    }),
  peek: (count: number) => locked(async () => (await read()).slice(0, count)),
  /** Başarıyla gönderilen (veya kalıcı olarak reddedilen) ilk n noktayı siler. */
  drop: (count: number) =>
    locked(async () => {
      const rest = (await read()).slice(count);
      await storage.setJSON(QUEUE_KEY, rest);
      return rest.length;
    }),
  size: () => locked(async () => (await read()).length),
  clear: () => locked(() => storage.remove(QUEUE_KEY)),

  getState: () => storage.getJSON<TrackingState>(STATE_KEY),
  setState: (s: TrackingState) => storage.setJSON(STATE_KEY, s),
  clearState: () => storage.remove(STATE_KEY),
};
