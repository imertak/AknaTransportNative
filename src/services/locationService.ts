import * as Location from 'expo-location';

import { LOCATION_CONFIG } from '@/constants/config';
import type { LocationFix, VehicleLocation } from '@/types';
import { distanceMeters } from '@/utils/geo';
import type { LocationRepository } from './contracts';
import { mockDb } from './mockDb';

export type LocationPermission = 'granted' | 'denied' | 'undetermined';

const toFix = (l: Location.LocationObject): LocationFix => ({
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  accuracy: l.coords.accuracy,
  speed: l.coords.speed,
  heading: l.coords.heading,
  timestamp: l.timestamp,
});

const toPermission = (r: Location.LocationPermissionResponse): LocationPermission =>
  r.granted ? 'granted' : r.canAskAgain ? 'undetermined' : 'denied';

/**
 * Cihaz GPS'ine erişen tek nokta. Ekranlar expo-location'ı doğrudan kullanmaz.
 */
export const locationService = {
  async getPermission(): Promise<LocationPermission> {
    return toPermission(await Location.getForegroundPermissionsAsync());
  },

  async requestPermission(): Promise<LocationPermission> {
    return toPermission(await Location.requestForegroundPermissionsAsync());
  },

  servicesEnabled: () => Location.hasServicesEnabledAsync(),

  async getCurrent(): Promise<LocationFix> {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 100 });
    if (last) return toFix(last);
    return toFix(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  },

  /**
   * Konum değişikliklerini dinler. İşletim sistemi tarafında mesafe ve süre
   * eşikleri uygulanarak gereksiz GPS uyanmaları azaltılır.
   */
  async watch(onFix: (fix: LocationFix) => void, onError?: (reason: string) => void): Promise<() => void> {
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: LOCATION_CONFIG.distanceInterval,
        timeInterval: LOCATION_CONFIG.timeInterval,
      },
      (l) => onFix(toFix(l)),
      (reason) => onError?.(reason),
    );
    return () => sub.remove();
  },
};

/**
 * Yeni konumun yayınlanıp yayınlanmayacağına karar verir:
 * anlamlı bir hareket veya uzun süreli sessizlik (heartbeat) yoksa yayınlanmaz.
 */
export function shouldPublish(prev: LocationFix | null, next: LocationFix): boolean {
  if (!prev) return true;
  const elapsed = next.timestamp - prev.timestamp;
  if (elapsed < LOCATION_CONFIG.minPublishInterval) return false;
  if (elapsed >= LOCATION_CONFIG.heartbeatInterval) return true;
  return distanceMeters(prev, next) >= LOCATION_CONFIG.minPublishDistance;
}

/**
 * Mock konum deposu. API aşamasında bu sınıf yerini, konumları toplu olarak
 * (örn. 30-60 sn'de bir) .NET API'ye gönderen ve SignalR ile okuyan bir
 * implementasyona bırakacak.
 */
export const mockLocationRepository: LocationRepository = {
  publish: (location: VehicleLocation) =>
    mockDb.write((db) => {
      db.locations[location.jobId] = location;
    }, 0),
  listActive: () => mockDb.read((db) => Object.values(db.locations), 0),
  clear: (jobId: string) =>
    mockDb.write((db) => {
      delete db.locations[jobId];
    }, 0),
};
