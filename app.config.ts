import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json üzerine ortam değişkenine bağlı ayarları ekler. API anahtarları koda yazılmaz.
 *
 * - GOOGLE_MAPS_ANDROID_API_KEY: Android'de react-native-maps (Google Maps) için zorunludur.
 *   Tanımlı değilse Android'de harita bileşeni gösterilmez, yerine açık bir uyarı çıkar.
 *   iOS varsayılan olarak Apple Haritalar'ı kullanır ve anahtar gerektirmez.
 * - EAS_PROJECT_ID: Expo push token'ı almak için gerekir (expo.dev'deki proje kimliği). `eas init`
 *   app.json'a extra.eas.projectId yazdıysa o kullanılır.
 * - GOOGLE_SERVICES_JSON: Android'de push bildirimi (FCM) için google-services.json dosyasının yolu.
 *   EAS'te "file" tipinde ortam değişkeni olarak verilebilir.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined;
  const easProjectId = process.env.EAS_PROJECT_ID?.trim() || (config.extra?.eas as { projectId?: string } | undefined)?.projectId;
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim() || config.android?.googleServicesFile;
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : null) },
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: androidMapsKey }]],
    extra: {
      ...config.extra,
      maps: { androidConfigured: !!androidMapsKey },
      ...(easProjectId ? { eas: { ...(config.extra?.eas as object | undefined), projectId: easProjectId } } : null),
    },
  };
};
