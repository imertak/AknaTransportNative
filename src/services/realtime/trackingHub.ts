import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr';

import { APP_CONFIG } from '@/constants/config';
import type { JobStatus } from '@/types';
import { getAccessToken } from '../http';

/** Sunucunun `locationUpdated` olayı (API LocationDto). */
export interface LiveLocationMessage {
  jobId: string;
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
}

/** Sunucunun `jobChanged` ipucu: iş yeniden okunmalı. */
export interface JobChangedMessage {
  jobId: string;
  /** API durum adı (ör. "OnTheWay"). */
  status: string;
  driverIds: string[];
  removed: boolean;
}

export type HubStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface TrackingHubHandlers {
  onLocation(m: LiveLocationMessage): void;
  onJobChanged(m: JobChangedMessage): void;
  /** Bağlantı (yeniden) kurulduğunda: kopukluk sırasında kaçan güncellemeler REST ile tamamlanır. */
  onConnected(): void;
  onStatus(s: HubStatus): void;
}

export const HUB_PATH = '/hubs/tracking';
/** Otomatik yeniden bağlanma aralıkları; sonrasında her 30 sn'de bir denenir. */
const RETRY_MS = [0, 2_000, 5_000, 10_000, 20_000];

/**
 * Canlı takip hub istemcisi. JWT ile bağlanır (token her bağlanmada yeniden alınır, gerekirse yenilenir),
 * kopunca artan aralıklarla tekrar dener. Sunucu yalnızca yetkili olunan araçların konumunu gönderir.
 */
export class TrackingHubClient {
  private connection: HubConnection | null = null;
  private stopped = true;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watched = new Set<string>();

  constructor(private readonly handlers: TrackingHubHandlers) {}

  start() {
    if (!APP_CONFIG.apiBaseUrl) return;
    this.stopped = false;
    if (!this.connection) this.connection = this.build();
    void this.connect();
  }

  async stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const c = this.connection;
    this.connection = null;
    this.handlers.onStatus('disconnected');
    await c?.stop().catch(() => {});
  }

  /** Tek bir işin konumunu izler (şoför kendi işi için). Yönetici zaten tüm işleri alır. */
  watchJob(jobId: string) {
    this.watched.add(jobId);
    if (this.connection?.state === HubConnectionState.Connected) this.connection.invoke('WatchJob', jobId).catch(() => {});
  }

  unwatchJob(jobId: string) {
    this.watched.delete(jobId);
    if (this.connection?.state === HubConnectionState.Connected) this.connection.invoke('UnwatchJob', jobId).catch(() => {});
  }

  private build(): HubConnection {
    const connection = new HubConnectionBuilder()
      .withUrl(`${APP_CONFIG.apiBaseUrl}${HUB_PATH}`, {
        accessTokenFactory: async () => (await getAccessToken()) ?? '',
        // Çerez kullanılmaz; web önizlemede CORS kimlik bilgisi gerekmez.
        withCredentials: false,
      })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: (ctx) => RETRY_MS[ctx.previousRetryCount] ?? 30_000 })
      .configureLogging(__DEV__ ? LogLevel.Warning : LogLevel.None)
      .build();
    connection.serverTimeoutInMilliseconds = 45_000;
    connection.keepAliveIntervalInMilliseconds = 15_000;

    connection.on('locationUpdated', (m: LiveLocationMessage) => this.handlers.onLocation(m));
    connection.on('jobChanged', (m: JobChangedMessage) => this.handlers.onJobChanged(m));
    connection.onreconnecting(() => this.handlers.onStatus('reconnecting'));
    connection.onreconnected(() => this.afterConnect());
    // Otomatik denemeler tükenince veya sunucu bağlantıyı kapatınca (ör. token süresi doldu) yeniden başlatılır.
    connection.onclose(() => {
      if (this.stopped) return;
      this.handlers.onStatus('disconnected');
      this.scheduleRetry(5_000);
    });
    return connection;
  }

  private async connect() {
    const c = this.connection;
    if (!c || this.stopped || c.state !== HubConnectionState.Disconnected) return;
    this.handlers.onStatus('connecting');
    try {
      await c.start();
      this.afterConnect();
    } catch {
      this.handlers.onStatus('disconnected');
      this.scheduleRetry(10_000);
    }
  }

  private afterConnect() {
    this.handlers.onStatus('connected');
    for (const id of this.watched) this.connection?.invoke('WatchJob', id).catch(() => {});
    this.handlers.onConnected();
  }

  private scheduleRetry(ms: number) {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, ms);
  }
}

export const apiStatusToJobStatus = (s: string): JobStatus | null =>
  (
    ({
      Pending: 'pending',
      Assigned: 'assigned',
      Accepted: 'accepted',
      OnTheWay: 'on_the_way',
      Loading: 'loading',
      Delivering: 'delivering',
      Completed: 'completed',
      Cancelled: 'cancelled',
    }) as Record<string, JobStatus>
  )[s] ?? null;
