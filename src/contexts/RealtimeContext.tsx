import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { TrackingHubClient, type HubStatus } from '@/services/realtime/trackingHub';
import { applyJobChanged, applyLiveLocation, resyncLocations } from '@/store/realtime';
import { useAuth } from './AuthContext';

interface RealtimeValue {
  /** Canlı bağlantı durumu; haritada "canlı" / "yeniden bağlanıyor" göstergesi için. */
  status: HubStatus;
}

const RealtimeContext = createContext<RealtimeValue>({ status: 'disconnected' });

/**
 * Oturum açıkken ve uygulama ön plandayken SignalR canlı takip bağlantısını yönetir. Arka planda
 * bağlantı kapatılır (pil); şoförün konum gönderimi bundan bağımsız olarak arka plan görevinde sürer.
 * Ön plana dönünce yeniden bağlanır ve kaçan konumlar REST ile tamamlanır.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [status, setStatus] = useState<HubStatus>('disconnected');
  const [active, setActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  const enabled = authStatus === 'signedIn' && !!user && active;
  const userId = user?.id;
  useEffect(() => {
    if (!enabled) return;
    const client = new TrackingHubClient({
      onLocation: applyLiveLocation,
      onJobChanged: applyJobChanged,
      // Her (yeniden) bağlanmada kopukluk süresince kaçan konumlar tek istekle tamamlanır.
      onConnected: () => void resyncLocations().catch(() => {}),
      onStatus: setStatus,
    });
    client.start();
    return () => {
      void client.stop();
    };
  }, [enabled, userId]);

  const value = useMemo(() => ({ status }), [status]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);
