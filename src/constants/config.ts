/** Örn. http://192.168.1.34:5080 — uygulamanın bağlandığı AKNA .NET API adresi (zorunlu). */
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Uygulama yapılandırması. Tüm veriler `EXPO_PUBLIC_API_BASE_URL` ile verilen .NET Web API'den gelir;
 * tanımlı değilse giriş ekranı yapılandırma hatası gösterir. Cihazda demo veri yoktur.
 */
export const APP_CONFIG = {
  appName: 'AKNA Transport',
  apiBaseUrl: API_BASE_URL,
  defaultVatRate: 20,
  vatRates: [0, 1, 10, 20],
} as const;

const env = (v: string | undefined) => (v ?? '').trim();
/** EXPO_PUBLIC_* sayısal ayarı; geçersizse varsayılan kullanılır. */
const num = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(env(v));
  return Number.isFinite(n) && n >= min && n <= max && env(v) !== '' ? n : fallback;
};

/**
 * Zorunlu iş takibi parametreleri: batarya ve ağ tüketimini sınırlamak için. Değerler EAS ortam
 * değişkenleriyle derleme sırasında değiştirilebilir. Sunucu da ayrıca filtreler (30 m / 15 sn, 120 sn nabız).
 */
export const LOCATION_CONFIG = {
  /** Cihazdan konum alınmadan önce gereken minimum hareket (metre). EXPO_PUBLIC_TRACKING_DISTANCE_M */
  distanceInterval: num(process.env.EXPO_PUBLIC_TRACKING_DISTANCE_M, 30, 5, 500),
  /** Android'de iki konum arasındaki minimum süre (ms). EXPO_PUBLIC_TRACKING_INTERVAL_MS */
  timeInterval: num(process.env.EXPO_PUBLIC_TRACKING_INTERVAL_MS, 15_000, 3_000, 300_000),
  /** Arka planda noktalar en fazla bu aralıkla toplu teslim edilir ve gönderilir (ms). EXPO_PUBLIC_TRACKING_PUBLISH_MS */
  minPublishInterval: num(process.env.EXPO_PUBLIC_TRACKING_PUBLISH_MS, 30_000, 5_000, 600_000),
} as const;

/**
 * Harita altyapısı: MapLibre Native + OpenStreetMap verisi. Varsayılan karo sağlayıcısı OpenFreeMap'tir
 * (anahtar ve ücret yok, OpenMapTiles şeması). Kendi karo sunucunuz veya MapTiler gibi bir sağlayıcı
 * kullanılacaksa yalnızca ortam değişkenleri değişir; harita teması (src/theme/map) aynı kalır.
 */
export const MAP_CONFIG = {
  /** OpenMapTiles şemasında TileJSON adresi. EXPO_PUBLIC_MAP_TILES_URL */
  tilesUrl: env(process.env.EXPO_PUBLIC_MAP_TILES_URL) || 'https://tiles.openfreemap.org/planet',
  /** Yazı glifleri ({fontstack}/{range}). EXPO_PUBLIC_MAP_GLYPHS_URL */
  glyphsUrl: env(process.env.EXPO_PUBLIC_MAP_GLYPHS_URL) || 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  attribution: '© OpenStreetMap katkıcıları · OpenFreeMap',
  /**
   * OSRM uyumlu rota servisi (…/route/v1/driving/…). Boş bırakılırsa ("off") duraklar düz çizgiyle
   * birleştirilir. Varsayılan genel OSRM demo sunucusu düşük hacim içindir; üretimde kendi OSRM
   * sunucunuzu veya Geoapify gibi bir servisi verin. EXPO_PUBLIC_ROUTING_URL
   */
  routingUrl: env(process.env.EXPO_PUBLIC_ROUTING_URL) === 'off' ? '' : env(process.env.EXPO_PUBLIC_ROUTING_URL) || 'https://router.project-osrm.org',
  /** Bu süreden eski son konum "eski" olarak işaretlenir (ms). EXPO_PUBLIC_MAP_STALE_AFTER_MS */
  staleAfterMs: num(process.env.EXPO_PUBLIC_MAP_STALE_AFTER_MS, 5 * 60_000, 60_000, 3_600_000),
  /** Araç işaretçisinin yeni konuma kayma süresi (ms). */
  markerAnimationMs: 1200,
} as const;
