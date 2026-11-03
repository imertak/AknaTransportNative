import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { MAP_UNAVAILABLE_REASON, mapNativeAvailable } from '@/components/map/nativeMap';
import type { GeoPoint } from '@/types';
import { ServiceError } from './errors';

/**
 * Harita kullanılabilirliği. Harita MapLibre Native + OpenStreetMap ile çizilir; API anahtarı gerekmez.
 * Web önizlemede yerel harita bileşeni yoktur. Adres arama cihazın kendi geocoder'ını kullanır
 * (iOS: Apple, Android: Google Play hizmetleri).
 */
export function mapAvailability(): { available: true } | { available: false; reason: string } {
  if (Platform.OS === 'web') {
    return { available: false, reason: 'Harita ve adres doğrulama web önizlemede kullanılamaz. Konumu mobil uygulamadan kontrol edin.' };
  }
  if (!mapNativeAvailable) return { available: false, reason: MAP_UNAVAILABLE_REASON };
  return { available: true };
}

/**
 * Adresi koordinata çevirir. Bulunamazsa null döner.
 * Android cihaz geocoder'ı konum izni ister; izin verilmezse açık bir hata fırlatılır.
 */
export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const q = address.trim();
  if (!q) return null;
  if (Platform.OS === 'web') throw new ServiceError('not_implemented', 'Adres doğrulama web önizlemede kullanılamaz.');
  if (Platform.OS === 'android') {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      throw new ServiceError('forbidden', 'Adresi haritada bulmak için Android konum izni gerekir. İzin vermeden de pini haritaya dokunarak yerleştirebilirsiniz.');
    }
  }
  try {
    const results = await Location.geocodeAsync(q);
    const first = results[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch (e) {
    // Sonuç bulunamaması bazı platformlarda hata olarak döner.
    if (e instanceof Error && /not found|no results|kCLErrorDomain error 8/i.test(e.message)) return null;
    throw new ServiceError('unavailable', 'Adres arama servisine ulaşılamadı. İnternet bağlantınızı kontrol edin.');
  }
}
