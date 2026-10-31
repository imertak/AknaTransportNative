import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json üzerine ortam değişkenine bağlı ayarları ekler. API anahtarları koda yazılmaz.
 *
 * - GOOGLE_MAPS_ANDROID_API_KEY: Android'de react-native-maps (Google Maps) için zorunludur.
 *   Tanımlı değilse Android'de harita bileşeni gösterilmez, yerine açık bir uyarı çıkar.
 *   iOS varsayılan olarak Apple Haritalar'ı kullanır ve anahtar gerektirmez.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim() || undefined;
  return {
    ...(config as ExpoConfig),
    plugins: [...(config.plugins ?? []), ['react-native-maps', { androidGoogleMapsApiKey: androidMapsKey }]],
    extra: {
      ...config.extra,
      maps: { androidConfigured: !!androidMapsKey },
    },
  };
};
