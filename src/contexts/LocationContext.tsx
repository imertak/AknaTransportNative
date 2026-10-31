import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isTrackable } from '@/constants/jobStatus';
import { useDriverJobs } from '@/hooks/useData';
import { locationService, shouldPublish, type LocationPermission } from '@/services';
import { errorMessage } from '@/services/errors';
import { locationActions } from '@/store';
import type { LocationFix, TransportJob } from '@/types';
import { useAuth } from './AuthContext';

export type TrackingStatus =
  | 'off' // kullanıcı paylaşımı kapattı
  | 'no_job' // takip edilecek aktif iş yok
  | 'starting'
  | 'active'
  | 'paused' // uygulama arka planda
  | 'denied'
  | 'error';

interface LocationContextValue {
  status: TrackingStatus;
  sharing: boolean;
  permission: LocationPermission | null;
  trackingJob: TransportJob | undefined;
  lastFix: LocationFix | null;
  lastPublishedAt: number | null;
  error: string | null;
  startSharing(): Promise<boolean>;
  stopSharing(): void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Şoför konum paylaşımını yönetir.
 * - Yalnızca kullanıcının yolda/yükleme/teslimat aşamasındaki bir işi varken çalışır.
 * - İşletim sistemi seviyesinde mesafe/süre eşikleri ile GPS uyanmaları azaltılır.
 * - Yayın öncesi `shouldPublish` ile anlamsız güncellemeler elenir.
 * - İlk aşamada uygulama arka plana geçince izleme duraklatılır (batarya ve
 *   izin yükü olmadan). Arka plan takibi için expo-task-manager ile
 *   `startLocationUpdatesAsync` API aşamasında eklenecek.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus } = useAuth();
  const { open } = useDriverJobs(user?.id);
  const trackingJob = useMemo(() => open.find((j) => isTrackable(j.status)), [open]);

  const [sharing, setSharing] = useState(false);
  const [permission, setPermission] = useState<LocationPermission | null>(null);
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState as AppStateStatus | null) ?? 'active');
  const [runState, setRunState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [lastFix, setLastFix] = useState<LocationFix | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastPublished = useRef<LocationFix | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);

  // Oturum kapanınca veya iş bitince paylaşımı sıfırla
  useEffect(() => {
    if (authStatus !== 'signedIn' || !trackingJob) {
      setSharing(false);
      lastPublished.current = null;
    }
  }, [authStatus, trackingJob]);

  const jobId = trackingJob?.id;
  const driverId = user?.id;
  const shouldRun = sharing && !!jobId && !!driverId && appState === 'active' && permission === 'granted';

  useEffect(() => {
    if (!shouldRun || !jobId || !driverId) {
      setRunState('idle');
      return;
    }
    let stop: (() => void) | null = null;
    let cancelled = false;
    setRunState('starting');
    setError(null);

    const handleFix = (fix: LocationFix) => {
      if (!shouldPublish(lastPublished.current, fix)) return;
      lastPublished.current = fix;
      setLastFix(fix);
      setLastPublishedAt(Date.now());
      locationActions.publish({ jobId, driverId, fix }).catch(() => {});
    };

    (async () => {
      try {
        if (!(await locationService.servicesEnabled())) {
          throw new Error('Cihazın konum servisleri kapalı. Ayarlardan açın.');
        }
        const first = await locationService.getCurrent();
        if (cancelled) return;
        lastPublished.current = null; // yeni oturumda ilk konum her zaman yayınlanır
        handleFix(first);
        stop = await locationService.watch(handleFix, (reason) => {
          setError(reason);
          setRunState('error');
        });
        if (cancelled) stop();
        else setRunState('running');
      } catch (e) {
        if (!cancelled) {
          setError(errorMessage(e, 'Konum alınamadı.'));
          setRunState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [shouldRun, jobId, driverId]);

  // Kullanıcı ayarlardan izin verip geri dönebilir: ön plana gelince izni tazele
  useEffect(() => {
    if (authStatus === 'signedIn' && appState === 'active') locationService.getPermission().then(setPermission).catch(() => setPermission('undetermined'));
  }, [authStatus, appState]);

  const startSharing = useCallback(async () => {
    try {
      let p = await locationService.getPermission();
      if (p !== 'granted') p = await locationService.requestPermission();
      setPermission(p);
      if (p !== 'granted') {
        setError('Konum izni verilmedi. Ayarlardan izin vererek paylaşımı başlatabilirsiniz.');
        return false;
      }
      setError(null);
      setSharing(true);
      return true;
    } catch (e) {
      setError(errorMessage(e, 'Konum izni alınamadı.'));
      return false;
    }
  }, []);

  const stopSharing = useCallback(() => {
    setSharing(false);
    lastPublished.current = null;
  }, []);

  const status: TrackingStatus = !trackingJob
    ? 'no_job'
    : permission === 'denied'
      ? 'denied'
      : !sharing
        ? 'off'
        : runState === 'error'
          ? 'error'
          : appState !== 'active'
            ? 'paused'
            : runState === 'running'
              ? 'active'
              : 'starting';

  const value = useMemo(
    () => ({ status, sharing, permission, trackingJob, lastFix, lastPublishedAt, error, startSharing, stopSharing }),
    [status, sharing, permission, trackingJob, lastFix, lastPublishedAt, error, startSharing, stopSharing],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationTracking(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationTracking must be used within LocationProvider');
  return ctx;
}
