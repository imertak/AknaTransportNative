import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * MapLibre yerel modülü bu derlemede var mı? Expo Go'da ve MapLibre eklenmeden önce alınmış
 * derlemelerde yoktur; o durumda kütüphane hiç yüklenmez (yüklenirse uygulama açılışta çöker),
 * harita yerine açıklama gösterilir.
 */
export const mapNativeAvailable = Platform.OS !== 'web' && TurboModuleRegistry?.get?.('MLRNCameraModule') != null;

export const MAP_UNAVAILABLE_REASON =
  "Bu uygulama derlemesinde harita modülü yok (Expo Go veya eski derleme). Haritayı görmek için development build ya da EAS preview build ile yeni bir APK alın.";
