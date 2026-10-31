import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { GeoPoint } from '@/types';
import { ServiceError } from './errors';

/**
 * Harita ve adres doğrulama için kullanılabilirlik. Sağlayıcı yapılandırılmamışsa harita
 * gösterilmez ve koordinat üretilmez (sahte harita/koordinat yok).
 * - iOS: Apple Haritalar ve CLGeocoder, anahtar gerekmez.
 * - Android: Google Maps için GOOGLE_MAPS_ANDROID_API_KEY gerekir (app.config.ts).
 * - Web: yerel harita ve geocoder yoktur.
 */
export function mapAvailability(): { available: true } | { available: false; reason: string } {
  if (Platform.OS === 'web') {
    return { available: false, reason: 'Harita ve adres doğrulama web önizlemede kullanılamaz. Konumu mobil uygulamadan kontrol edin.' };
  }
  if (Platform.OS === 'android') {
    const extra = Constants.expoConfig?.extra as { maps?: { androidConfigured?: boolean } } | undefined;
    if (!extra?.maps?.androidConfigured) {
      return {
        available: false,
        reason: 'Android harita sağlayıcısı yapılandırılmamış. Yönetici GOOGLE_MAPS_ANDROID_API_KEY ortam değişkeniyle uygulamayı yeniden derlemeli.',
      };
    }
  }
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
