/** Örn. http://localhost:5080 — tanımlıysa uygulama .NET API'yi kullanır. */
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

/**
 * Uygulama yapılandırması. `EXPO_PUBLIC_API_BASE_URL` tanımlıysa servis katmanı
 * .NET Web API'ye bağlanır; boşsa cihaz üzerindeki demo verilerle çalışır.
 */
export const APP_CONFIG = {
  appName: 'AKNA Transport',
  dataSource: (API_BASE_URL ? 'api' : 'mock') as 'mock' | 'api',
  apiBaseUrl: API_BASE_URL,
  /** Mock servislerde ağ gecikmesini taklit eder (ms). */
  mockLatency: 220,
  defaultVatRate: 20,
  vatRates: [0, 1, 10, 20],
  jobNoPrefix: 'AKN',
  demoInvoicePrefix: 'DEMO',
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
