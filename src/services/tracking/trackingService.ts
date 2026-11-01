import { LOCATION_CONFIG } from '@/constants/config';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { colors } from '@/theme';
import type { LocationFix, Session } from '@/types';
import { ServiceError } from '../errors';
import { hasToken, setTokenProvider } from '../http';
import { locationRepository } from '../registry';
import { STORAGE_KEYS, secureStorage } from '../storage';
import { trackingEvents } from './events';
import { locationQueue } from './queue';

/**
 * Zorunlu iş takibi. İş kabul edildiğinde başlar, iş tamamlanınca/iptal edilince veya sunucu
 * aktif iş olmadığını bildirince durur. Native'de expo-task-manager ile gerçek arka plan
 * konumu kullanılır (Android'de kalıcı bildirimli ön plan servisi, iOS'ta "Her zaman" izni).
 * Web önizlemede yalnızca sayfa açıkken çalışır.
 */
export const LOCATION_TASK = 'akna-job-location';
const isWeb = Platform.OS === 'web';
/** API tek istekte en fazla 200 nokta kabul eder. */
const BATCH = 100;

export type PrepareResult =
  | { ok: true }
  | { ok: false; code: 'services_off' | 'foreground_denied' | 'background_denied' | 'unsupported_build' | 'error'; message: string; canAskAgain: boolean };

const toFix = (l: Location.LocationObject): LocationFix => ({
  latitude: l.coords.latitude,
  longitude: l.coords.longitude,
  accuracy: l.coords.accuracy,
  speed: l.coords.speed,
  heading: l.coords.heading,
  timestamp: l.timestamp,
});

/** Uygulama kapalıyken başlayan arka plan görevinde oturum belleği boştur; kayıtlı oturumdan alınır. */
async function ensureAuth() {
  if (hasToken()) return;
  const raw = await secureStorage.get(STORAGE_KEYS.session).catch(() => null);
  const saved = raw ? (JSON.parse(raw) as Session) : null;
  if (saved?.token) setTokenProvider(() => saved.token);
}

let flushing: Promise<void> | null = null;

/** Kuyruktaki noktaları sırayla gönderir. Ağ hatasında noktalar kuyrukta kalır. */
export function flushQueue(): Promise<void> {
  if (!flushing) {
    flushing = (async () => {
      const state = await locationQueue.getState();
      if (!state) {
        await locationQueue.clear();
        return;
      }
      await ensureAuth();
      for (let guard = 0; guard < 50; guard++) {
        const batch = await locationQueue.peek(BATCH);
        if (!batch.length) return;
        try {
          const jobIds = await locationRepository.publishMine(state.driverId, batch);
          const pending = await locationQueue.drop(batch.length);
          trackingEvents.emit({ type: 'published', at: Date.now(), jobIds, pending });
        } catch (e) {
          const code = e instanceof ServiceError ? e.code : 'unknown';
          if (code === 'conflict' || code === 'forbidden') {
            // Sunucuda kabul edilmiş/devam eden iş yok (tamamlandı, iptal edildi veya başkasına atandı).
            await stopTracking();
            trackingEvents.emit({ type: 'no_active_job' });
            return;
          }
          if (code === 'validation') {
            // Bozuk nokta kuyruğu kilitlemesin.
            await locationQueue.drop(batch.length);
            continue;
          }
          trackingEvents.emit({ type: 'queued', pending: await locationQueue.size(), reason: e instanceof Error ? e.message : 'Gönderilemedi' });
          return;
        }
      }
    })().finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function handleFixes(fixes: LocationFix[]) {
  if (!fixes.length) return;
  if (!(await locationQueue.getState())) return; // takip durdurulmuş, geç gelen teslimat
  await locationQueue.enqueue(fixes);
  trackingEvents.emit({ type: 'fix', fix: fixes[fixes.length - 1]! });
  await flushQueue();
}

// Görev modül yüklenirken tanımlanmalıdır (uygulama arka planda başlatıldığında da).
if (!isWeb && !TaskManager.isTaskDefined(LOCATION_TASK)) {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      trackingEvents.emit({ type: 'error', message: error.message });
      return;
    }
    await handleFixes((data?.locations ?? []).map(toFix));
  });
}

let webWatch: Location.LocationSubscription | null = null;

/**
 * Kabul öncesi kontrol: konum servisleri açık mı, ön plan ve arka plan izinleri verildi mi.
 * İzin pencereleri yalnızca işletim sisteminin kendi pencereleridir; ek bir uygulama onayı sorulmaz.
 */
export async function prepareTracking(interactive = true): Promise<PrepareResult> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return { ok: false, code: 'services_off', message: 'Cihazın konum servisleri kapalı. İşi kabul etmek için konumu açın.', canAskAgain: true };
    }
    let fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted && interactive && fg.canAskAgain) fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      return {
        ok: false,
        code: 'foreground_denied',
        message: 'İşi kabul etmek için konum izni gerekir. İş süresince konumunuz yalnızca yöneticinizle paylaşılır.',
        canAskAgain: fg.canAskAgain,
      };
    }
    if (isWeb) return { ok: true };
    let bg = await Location.getBackgroundPermissionsAsync();
    if (!bg.granted && interactive && bg.canAskAgain) bg = await Location.requestBackgroundPermissionsAsync();
    if (!bg.granted) {
      return {
        ok: false,
        code: 'background_denied',
        message:
          Platform.OS === 'ios'
            ? 'Uygulama arka plandayken de takip için konum iznini "Her Zaman" olarak ayarlayın (Ayarlar › AKNA Transport › Konum).'
            : 'Uygulama arka plandayken de takip için konum iznini "Her zaman izin ver" olarak ayarlayın (Ayarlar › Uygulamalar › AKNA Transport › İzinler › Konum).',
        canAskAgain: bg.canAskAgain,
      };
    }
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : '';
    // İzin metinleri (Info.plist) veya arka plan modu derlemede yoksa iOS izin penceresi hiç açılamaz.
    if (/UsageDescription|Info\.plist|UIBackgroundModes|Background location/i.test(raw)) {
      return { ok: false, code: 'unsupported_build', message: unsupportedBuildMessage(), canAskAgain: false };
    }
    return { ok: false, code: 'error', message: raw || 'Konum izni kontrol edilemedi.', canAskAgain: true };
  }
}

/** Expo Go arka plan konumunu desteklemez; eski bir development build'de ise izin ayarları eksik kalmış olabilir. */
function unsupportedBuildMessage(): string {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'Expo Go arka planda konum takibini desteklemiyor, bu yüzden iş kabul edilemiyor. Uygulamanın kendi derlemesini kullanın: npx expo run:ios (veya run:android) ya da EAS Build.';
  }
  return 'Bu uygulama derlemesinde konum izin ayarları eksik. Uygulamayı yeniden derleyin: npx expo prebuild --clean ve ardından npx expo run:ios (veya EAS Build).';
}

export async function isTrackingRunning(): Promise<boolean> {
  if (isWeb) return webWatch !== null;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

/** Takibi başlatır (zaten çalışıyorsa yalnızca durumu günceller). İzinler önceden verilmiş olmalıdır. */
export async function startTracking(driverId: string): Promise<void> {
  await locationQueue.setState({ driverId, startedAt: Date.now() });
  if (isWeb) {
    if (!webWatch) {
      webWatch = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: LOCATION_CONFIG.distanceInterval, timeInterval: LOCATION_CONFIG.timeInterval },
        (l) => void handleFixes([toFix(l)]),
      );
    }
  } else if (!(await isTrackingRunning())) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      distanceInterval: LOCATION_CONFIG.distanceInterval,
      timeInterval: LOCATION_CONFIG.timeInterval,
      // Noktalar toplu teslim edilerek ağ ve pil kullanımı azaltılır.
      deferredUpdatesInterval: LOCATION_CONFIG.minPublishInterval,
      deferredUpdatesDistance: LOCATION_CONFIG.distanceInterval,
      activityType: Location.ActivityType.AutomotiveNavigation,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'AKNA Transport · iş takibi açık',
        notificationBody: 'Aktif nakliye işiniz sürerken konumunuz yöneticinizle paylaşılıyor.',
        notificationColor: colors.ink,
        killServiceOnDestroy: false,
      },
    });
  }
  // İlk konum beklenmeden hemen gönderilir.
  try {
    const now = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await handleFixes([toFix(now)]);
  } catch {
    // GPS sinyali gelince görev konumları gönderir.
  }
}

/** Takibi durdurur ve kuyruğu temizler. Kapanmış işlere sunucu zaten konum kabul etmez. */
export async function stopTracking(): Promise<void> {
  if (isWeb) {
    webWatch?.remove();
    webWatch = null;
  } else if (await isTrackingRunning()) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
  }
  await locationQueue.clearState();
  await locationQueue.clear();
}

export const pendingLocationCount = () => locationQueue.size();
