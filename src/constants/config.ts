/**
 * Uygulama yapılandırması. API aşamasında `dataSource` 'api' yapılarak
 * servis katmanı gerçek .NET Web API'ye yönlendirilecek.
 */
export const APP_CONFIG = {
  appName: 'AKNA Transport',
  dataSource: 'mock' as 'mock' | 'api',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  /** Mock servislerde ağ gecikmesini taklit eder (ms). */
  mockLatency: 220,
  defaultVatRate: 20,
  vatRates: [0, 1, 10, 20],
  jobNoPrefix: 'AKN',
  demoInvoicePrefix: 'DEMO',
} as const;

/** Konum takibi parametreleri: batarya ve ağ tüketimini sınırlamak için. */
export const LOCATION_CONFIG = {
  /** Cihazdan konum alınmadan önce gereken minimum hareket (metre). */
  distanceInterval: 40,
  /** Android'de iki konum arasındaki minimum süre (ms). */
  timeInterval: 15_000,
  /** Bu mesafenin altındaki değişimler yayınlanmaz (metre). */
  minPublishDistance: 30,
  /** Araç dursa bile bu sürede bir "canlılık" güncellemesi yayınlanır (ms). */
  heartbeatInterval: 120_000,
  /** İki yayın arasındaki minimum süre (ms). API aşamasında toplu gönderim aralığı. */
  minPublishInterval: 20_000,
} as const;
