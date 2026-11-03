import { http } from './http';

/** Sunucudaki bildirim türleri (AKNA API NotificationType). */
export type NotificationKind =
  | 'JobAssigned'
  | 'JobUnassigned'
  | 'JobUpdated'
  | 'JobCancelled'
  | 'JobAccepted'
  | 'JobStarted'
  | 'JobLoading'
  | 'JobDelivering'
  | 'JobCompleted';

export interface AppNotification {
  id: string;
  type: NotificationKind;
  title: string;
  body: string;
  jobId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Paged<T> {
  items: T[];
  totalCount: number;
}

/** Giriş yapmış kullanıcının bildirimleri ve telefon (push) kaydı. */
export const notificationService = {
  async list(pageSize = 50): Promise<AppNotification[]> {
    const page = await http<Paged<AppNotification>>('/api/notifications', { query: { pageSize } });
    return page.items;
  },
  async unreadCount(): Promise<number> {
    return (await http<{ count: number }>('/api/notifications/unread-count')).count;
  },
  markRead: (id: string) => http<void>(`/api/notifications/${id}/read`, { method: 'POST', json: {} }),
  markAllRead: () => http<void>('/api/notifications/read-all', { method: 'POST', json: {} }),
  registerDevice: (token: string, platform: string) => http<void>('/api/notifications/devices', { method: 'POST', json: { token, platform } }),
  unregisterDevice: (token: string) => http<void>('/api/notifications/devices/remove', { method: 'POST', json: { token } }),
};

/** Müşteriye gönderilecek canlı konum takip bağlantısı. */
export interface TrackingLink {
  token: string;
  url: string | null;
  expiresAt: string;
}

export const trackingLinkService = {
  create: (jobId: string) => http<TrackingLink>(`/api/jobs/${jobId}/tracking-links`, { method: 'POST', json: {} }),
};
