import type { GeoPoint } from '@/types';

const R = 6371e3;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** İki nokta arasındaki mesafe (metre), haversine. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`;
}

export const ISTANBUL_CENTER: GeoPoint = { latitude: 41.0369, longitude: 28.985 };

export function regionFor(points: GeoPoint[], padding = 1.4) {
  if (points.length === 0) {
    return { ...ISTANBUL_CENTER, latitudeDelta: 0.35, longitudeDelta: 0.35 };
  }
  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.02, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(0.02, (maxLon - minLon) * padding),
  };
}
