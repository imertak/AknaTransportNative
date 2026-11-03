import { MAP_CONFIG } from '@/constants/config';
import type { GeoPoint } from '@/types';

/**
 * Yol geometrisi (OSRM uyumlu servis). Sonuçlar bellekte önbelleğe alınır; aynı iş için tekrar istek
 * yapılmaz. Servis kapalıysa, ulaşılamazsa veya rota bulunamazsa null döner ve harita durakları düz
 * (kesikli) çizgiyle birleştirir.
 */
const cache = new Map<string, GeoPoint[] | null>();
const inflight = new Map<string, Promise<GeoPoint[] | null>>();
const MAX_CACHE = 40;
/** OSRM demo sunucusu en fazla birkaç düzine noktayı kabul eder. */
const MAX_POINTS = 25;

const keyOf = (points: GeoPoint[]) => points.map((p) => `${p.longitude.toFixed(5)},${p.latitude.toFixed(5)}`).join(';');

export function cachedRoute(points: GeoPoint[]): GeoPoint[] | null | undefined {
  return cache.get(keyOf(points));
}

export async function fetchRoute(points: GeoPoint[]): Promise<GeoPoint[] | null> {
  if (!MAP_CONFIG.routingUrl || points.length < 2 || points.length > MAX_POINTS) return null;
  const key = keyOf(points);
  if (cache.has(key)) return cache.get(key) ?? null;
  const running = inflight.get(key);
  if (running) return running;

  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const url = `${MAP_CONFIG.routingUrl.replace(/\/+$/, '')}/route/v1/driving/${key}?overview=full&geometries=geojson&steps=false`;
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!res.ok) return null; // geçici hata: önbelleğe alınmaz, sonra tekrar denenir
      const body = (await res.json()) as { code?: string; routes?: { geometry?: { coordinates?: [number, number][] } }[] };
      const coords = body.code === 'Ok' ? body.routes?.[0]?.geometry?.coordinates : undefined;
      const route = coords && coords.length > 1 ? coords.map(([longitude, latitude]) => ({ latitude, longitude })) : null;
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(key, route);
      return route;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
      inflight.delete(key);
    }
  })();
  inflight.set(key, request);
  return request;
}
