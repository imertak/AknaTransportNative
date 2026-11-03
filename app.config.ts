import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json üzerine ortam değişkenine bağlı ayarları ekler. API anahtarları koda yazılmaz.
 *
 * - Harita: MapLibre Native + OpenStreetMap (anahtar gerekmez). Karo/rota adresleri EXPO_PUBLIC_MAP_TILES_URL,
 *   EXPO_PUBLIC_MAP_GLYPHS_URL ve EXPO_PUBLIC_ROUTING_URL ile değiştirilebilir (src/constants/config.ts).
 *   MapLibre yerel modül içerir: Expo Go'da çalışmaz, development build veya EAS Build gerekir.
 * - EAS_PROJECT_ID: Expo push token'ı almak için gerekir (expo.dev'deki proje kimliği). `eas init`
 *   app.json'a extra.eas.projectId yazdıysa o kullanılır.
 * - GOOGLE_SERVICES_JSON: Android'de push bildirimi (FCM) için google-services.json dosyasının yolu.
 *   EAS'te "file" tipinde ortam değişkeni olarak verilebilir.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const easProjectId = process.env.EAS_PROJECT_ID?.trim() || (config.extra?.eas as { projectId?: string } | undefined)?.projectId;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || config.android?.googleServicesFile;
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : null) },
    plugins: [
      ...(config.plugins ?? []),
      '@maplibre/maplibre-react-native',
      // Release derlemede R8 WorkManager/Room sınıflarını silmesin (açılışta çökme).
      './plugins/withRoomProguardRules',
    ],
    extra: {
      ...config.extra,
      ...(easProjectId ? { eas: { ...(config.extra?.eas as object | undefined), projectId: easProjectId } } : null),
    },
  };
};
