import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { isTrackable } from '@/constants/jobStatus';
import { useDriverJobs } from '@/hooks/useData';
import { errorMessage } from '@/services/errors';
import {
  flushQueue,
  isTrackingRunning,
  pendingLocationCount,
  prepareTracking,
  startTracking,
  stopTracking,
  trackingEvents,
  watchForegroundPosition,
  type PrepareResult,
} from '@/services/tracking';
import { refreshAll } from '@/store';
import type { LocationFix, TransportJob } from '@/types';
import { useAuth } from './AuthContext';

export type TrackingStatus =
  | 'no_job' // kabul edilmiş/devam eden iş yok
  | 'starting'
  | 'active'
  | 'denied' // izin veya konum servisi eksik
  | 'error';

interface LocationContextValue {
  status: TrackingStatus;
  /** Takip edilen (kabul edilmiş ve devam eden) işler. Birden fazla olabilir. */
  trackingJobs: TransportJob[];
  /** Geriye uyumluluk: ilk takip edilen iş. */
  trackingJob: TransportJob | undefined;
  lastFix: LocationFix | null;
  lastPublishedAt: number | null;
  /** Ağ yokken cihazda bekleyen konum sayısı. */
  pending: number;
  error: string | null;
  /** Cihaz konumu bu uygulama için açık mı (en az ön plan izni). İş olmasa da haritada konum gösterilir. */
  locationOn: boolean;
  /** Konum kapalıysa nedeni (izin reddi, konum servisi kapalı vb.). */
  locationMessage: string | null;
  /** Web önizlemede takip yalnızca sayfa açıkken çalışır. */
  foregroundOnly: boolean;
  /**
   * İş kabulünden önce çağrılır: konum servisi ve (native'de) arka plan izni yoksa işletim
   * sisteminin izin penceresi açılır. ok:false dönerse iş kabul edilmemelidir.
   */
  ensureReady(): Promise<PrepareResult>;
  /** Kabulden hemen sonra takibi başlatır. Başlatılamazsa hata fırlatır. */
  startNow(): Promise<void>;
  /** Oturum kapatılırken takibi durdurur. */
  stopSharing(): Promise<void>;
  /** İzin değiştiyse veya hata sonrası tekrar dener. */
  retry(): Promise<void>;
}

const LocationContext = createContext<LocationContextValue | null>(null);

/**
 * Zorunlu konum takibi: şoförün kabul edilmiş veya devam eden işi olduğu sürece arka planda
 * çalışır, hiçbiri kalmayınca (tamamlandı/iptal) durur. Kullanıcıdan ayrıca "paylaş" onayı
 * istenmez; yalnızca işletim sisteminin izinleri gerekir.
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus, viewMode } = useAuth();
  const { open } = useDriverJobs(user?.id);
  const trackingJobs = useMemo(() => open.filter((j) => isTrackable(j.status)), [open]);
  const driverId = authStatus === 'signedIn' ? user?.id : undefined;
  const shouldTrack = !!driverId && trackingJobs.length > 0;

  const [runState, setRunState] = useState<'idle' | 'starting' | 'running' | 'denied' | 'error'>('idle');
  const [lastFix, setLastFix] = useState<LocationFix | null>(null);
  const [lastPublishedAt, setLastPublishedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const reconciling = useRef<Promise<void> | null>(null);
  const [permissionState, setPermission] = useState<{ userId: string | null; on: boolean; message: string | null }>({ userId: null, on: false, message: null });
  const askedFor = useRef<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const isDriverView = authStatus === 'signedIn' && viewMode === 'driver' && !!user;
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  const applyPermission = useCallback((r: PrepareResult) => {
    // Arka plan izni olmasa da ön plan izni varsa konum gösterilebilir.
    const on = r.ok || r.code === 'background_denied';
    setPermission({ userId: userIdRef.current, on, message: r.ok ? null : r.message });
    return on;
  }, []);
  // İzin bilgisi kullanıcıya bağlıdır; oturum değişince eskisi geçersiz sayılır.
  const permissionValid = permissionState.userId === (user?.id ?? null);
  const permission = { on: permissionValid && permissionState.on, message: permissionValid ? permissionState.message : null };

  // Şoför uygulamaya girer girmez (iş olmasa da) konum izni istenir; her oturumda bir kez.
  useEffect(() => {
    if (!isDriverView || !user) {
      if (authStatus !== 'signedIn') askedFor.current = null;
      return;
    }
    if (askedFor.current === user.id) return;
    askedFor.current = user.id;
    prepareTracking(true).then(applyPermission, () => {});
  }, [isDriverView, user, authStatus, applyPermission]);

  // Aktif iş yokken konum yalnızca cihazda, uygulama açıkken izlenir (sunucuya gönderilmez).
  const watchLocally = isDriverView && permission.on && appActive && runState !== 'running';
  useEffect(() => {
    if (!watchLocally) return;
    let sub: { remove(): void } | null = null;
    let cancelled = false;
    watchForegroundPosition(setLastFix).then((s) => {
      if (cancelled) s?.remove();
      else sub = s;
    });
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [watchLocally]);

  useEffect(
    () =>
      trackingEvents.subscribe((e) => {
        if (e.type === 'fix') setLastFix(e.fix);
        else if (e.type === 'published') {
          setLastPublishedAt(e.at);
          setPending(e.pending);
          setError(null);
        } else if (e.type === 'queued') setPending(e.pending);
        else if (e.type === 'no_active_job') {
          setRunState('idle');
          // Sunucuya göre aktif iş yok: yerel listeyi tazele.
          refreshAll().catch(() => {});
        } else if (e.type === 'error') setError(e.message);
      }),
    [],
  );

  /** İstenen durumla (takip edilecek iş var/yok) gerçek durumu eşitler. İzin penceresi açmaz. */
  const reconcile = useCallback(async () => {
    if (!shouldTrack || !driverId) {
      if (await isTrackingRunning()) await stopTracking();
      setRunState('idle');
      setPending(0);
      return;
    }
    const ready = await prepareTracking(false);
    if (!ready.ok) {
      setRunState('denied');
      setError(ready.message);
      return;
    }
    try {
      if (!(await isTrackingRunning())) setRunState('starting');
      await startTracking(driverId);
      setRunState('running');
      setError(null);
      setPending(await pendingLocationCount());
    } catch (e) {
      setRunState('error');
      setError(errorMessage(e, 'Konum takibi başlatılamadı.'));
    }
  }, [shouldTrack, driverId]);

  const runReconcile = useCallback(() => {
    const p = (reconciling.current ?? Promise.resolve()).then(reconcile, reconcile);
    reconciling.current = p.finally(() => {
      if (reconciling.current === p) reconciling.current = null;
    });
    return p;
  }, [reconcile]);

  useEffect(() => {
    void runReconcile();
  }, [runReconcile, trackingJobs.length]);

  // Ön plana dönünce izinleri yeniden kontrol et ve bekleyen konumları gönder.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      setAppActive(s === 'active');
      if (s !== 'active') return;
      // Kullanıcı ayarlardan izni açıp döndüyse fark edilir (pencere açılmaz).
      if (askedFor.current) prepareTracking(false).then(applyPermission, () => {});
      void runReconcile();
      flushQueue().catch(() => {});
    });
    return () => sub.remove();
  }, [runReconcile, applyPermission]);

  // Ağ yokken biriken konumlar: uygulama açıkken bağlantı gelir gelmez gönderilsin diye düzenli denenir
  // (arka planda her yeni GPS noktası zaten kuyruğu boşaltmayı dener). Sıra korunur; eski nokta yeniyi ezmez.
  useEffect(() => {
    if (!appActive || pending === 0 || runState !== 'running') return;
    const t = setInterval(() => {
      flushQueue().catch(() => {});
    }, 20_000);
    return () => clearInterval(t);
  }, [appActive, pending, runState]);

  const ensureReady = useCallback(async () => {
    const r = await prepareTracking(true);
    if (!r.ok) setError(r.message);
    return r;
  }, []);

  const userId = user?.id;
  const startNow = useCallback(async () => {
    if (!userId) throw new Error('Oturum bulunamadı.');
    setRunState('starting');
    try {
      await startTracking(userId);
      setRunState('running');
      setError(null);
    } catch (e) {
      setRunState('error');
      const message = errorMessage(e, 'Konum takibi başlatılamadı.');
      setError(message);
      throw new Error(message);
    }
  }, [userId]);

  const stopSharing = useCallback(async () => {
    await stopTracking().catch(() => {});
    setRunState('idle');
    setLastFix(null);
    setPending(0);
  }, []);

  const retry = useCallback(async () => {
    const r = await prepareTracking(true);
    applyPermission(r);
    if (!r.ok) {
      setRunState('denied');
      setError(r.message);
      return;
    }
    await runReconcile();
  }, [runReconcile, applyPermission]);

  const status: TrackingStatus = !shouldTrack
    ? 'no_job'
    : runState === 'running'
      ? 'active'
      : runState === 'denied'
        ? 'denied'
        : runState === 'error'
          ? 'error'
          : 'starting';

  const value = useMemo<LocationContextValue>(
    () => ({
      status,
      trackingJobs,
      trackingJob: trackingJobs[0],
      lastFix,
      lastPublishedAt,
      pending,
      error,
      locationOn: permission.on || runState === 'running',
      locationMessage: permission.message,
      foregroundOnly: Platform.OS === 'web',
      ensureReady,
      startNow,
      stopSharing,
      retry,
    }),
    [status, trackingJobs, lastFix, lastPublishedAt, pending, error, permission.on, permission.message, runState, ensureReady, startNow, stopSharing, retry],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocationTracking(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocationTracking must be used within LocationProvider');
  return ctx;
}
