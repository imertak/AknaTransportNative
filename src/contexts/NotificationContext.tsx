import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/navigation/routes';
import { notificationService } from '@/services/notifications';
import { registerForPush, setAppBadge, type PushData } from '@/services/push';
import { jobActions } from '@/store';

interface NotificationContextValue {
  unreadCount: number;
  /** Okunmamış sayısını sunucudan tazeler. */
  refreshUnread(): Promise<void>;
  /** Liste ekranı okundu işaretlediğinde sayacı yerelde günceller. */
  setUnreadCount(count: number): void;
}

const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refreshUnread: async () => {},
  setUnreadCount: () => {},
});

/**
 * Oturum açıkken: telefonu push bildirimleri için kaydeder, okunmamış sayısını tutar, gelen bildirimde
 * ilgili işi tazeler ve bildirime dokunulunca işin detayını açar.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const { status, viewMode } = useAuth();
  const signedIn = status === 'signedIn';
  const [unreadCount, setUnread] = useState(0);
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const setUnreadCount = useCallback((count: number) => {
    setUnread(count);
    setAppBadge(count).catch(() => {});
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      setUnreadCount(await notificationService.unreadCount());
    } catch {
      // ağ hatası: sayaç bir sonraki tazelemede düzelir
    }
  }, [setUnreadCount]);

  // Oturum açılınca kayıt + sayaç; uygulama öne gelince sayaç tazelenir.
  useEffect(() => {
    if (!signedIn) return;
    // Sayaç, push kaydı denendikten sonra (izin penceresi kapandığında) tazelenir.
    registerForPush()
      .catch(() => null)
      .then(refreshUnread);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshUnread();
    });
    return () => sub.remove();
  }, [signedIn, refreshUnread]);

  useEffect(() => {
    if (!signedIn || Platform.OS === 'web') return;

    const open = (response: Notifications.NotificationResponse) => {
      const data = (response.notification.request.content.data ?? {}) as PushData;
      if (data.notificationId) notificationService.markRead(data.notificationId).then(refreshUnread, () => {});
      if (data.jobId) {
        jobActions.sync(data.jobId).catch(() => {});
        if (data.type !== 'JobUnassigned') router.push(routes.job(data.jobId, viewModeRef.current));
      } else {
        router.push(routes.notifications(viewModeRef.current));
      }
    };

    const received = Notifications.addNotificationReceivedListener((n) => {
      const data = (n.request.content.data ?? {}) as PushData;
      if (data.jobId) jobActions.sync(data.jobId).catch(() => {});
      refreshUnread();
    });
    const responded = Notifications.addNotificationResponseReceivedListener(open);
    // Uygulama kapalıyken bildirime dokunularak açıldıysa.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      Notifications.clearLastNotificationResponse();
      // Rol ekranları ilk kez çizilirken yönlendirme kaybolmasın.
      setTimeout(() => open(last), 300);
    }
    return () => {
      received.remove();
      responded.remove();
    };
  }, [signedIn, refreshUnread]);

  // Çıkış yapılınca sayaç gösterilmez; yeni oturumda sunucudan tazelenir.
  const visibleUnread = signedIn ? unreadCount : 0;
  const value = useMemo(() => ({ unreadCount: visibleUnread, refreshUnread, setUnreadCount }), [visibleUnread, refreshUnread, setUnreadCount]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);
