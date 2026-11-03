import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationService } from './notifications';

/** Sunucunun gönderdiği Android kanal adı (Push:AndroidChannelId) ile aynı olmalıdır. */
export const JOB_CHANNEL_ID = 'jobs';

/** Bildirime dokunulduğunda veya uygulama açıkken gelen bildirimdeki veri. */
export interface PushData {
  notificationId?: string;
  jobId?: string;
  type?: string;
}

let registeredToken: string | null = null;

// Uygulama açıkken gelen bildirim de üstte gösterilir.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

function projectId(): string | undefined {
  return Constants.easConfig?.projectId ?? (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
}

/**
 * Bildirim izni ister, Expo push token'ını alır ve sunucuya kaydeder. İzin verilmezse, emülatörde,
 * web'de veya EAS proje kimliği yoksa sessizce vazgeçer; uygulama içi bildirim listesi yine çalışır.
 */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(JOB_CHANNEL_ID, {
        name: 'İş bildirimleri',
        description: 'İş atama, iptal ve durum değişiklikleri',
        // eslint-disable-next-line import/namespace -- enum, tip dosyasından yeniden dışa aktarılıyor
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFFFFF',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const id = projectId();
    if (!id) {
      console.warn('[push] EAS proje kimliği yok (EAS_PROJECT_ID). Telefon bildirimleri kapalı.');
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    await notificationService.registerDevice(token, Platform.OS);
    registeredToken = token;
    return token;
  } catch (e) {
    console.warn('[push] Bildirim kaydı yapılamadı', e);
    return null;
  }
}

/** Çıkışta bu telefonun kaydını siler; böylece sonraki kullanıcıya eski hesabın bildirimleri gelmez. */
export async function unregisterFromPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  await Promise.race([notificationService.unregisterDevice(token).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

export async function setAppBadge(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setBadgeCountAsync(count).catch(() => false);
}
