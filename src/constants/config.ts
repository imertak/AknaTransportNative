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

/** Zorunlu iş takibi parametreleri: batarya ve ağ tüketimini sınırlamak için. */
export const LOCATION_CONFIG = {
  /** Cihazdan konum alınmadan önce gereken minimum hareket (metre). */
  distanceInterval: 30,
  /** Android'de iki konum arasındaki minimum süre (ms). */
  timeInterval: 15_000,
  /** Arka planda noktalar en fazla bu aralıkla toplu teslim edilir ve gönderilir (ms). */
  minPublishInterval: 30_000,
} as const;
