import type { JobStatus } from '@/types';

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'Bekliyor',
  assigned: 'Atandı',
  accepted: 'Kabul Edildi',
  on_the_way: 'Yolda',
  loading: 'Yükleme Yapılıyor',
  delivering: 'Teslimat Yapılıyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const JOB_STATUS_ORDER: JobStatus[] = [
  'pending',
  'assigned',
  'accepted',
  'on_the_way',
  'loading',
  'delivering',
  'completed',
  'cancelled',
];

/** Şoförün sahada yürüttüğü durumlar. */
export const IN_PROGRESS_STATUSES: JobStatus[] = ['accepted', 'on_the_way', 'loading', 'delivering'];

/** Aracın hareket halinde olduğu, konum paylaşımının anlamlı olduğu durumlar. */
export const TRACKABLE_STATUSES: JobStatus[] = ['on_the_way', 'loading', 'delivering'];

export const CLOSED_STATUSES: JobStatus[] = ['completed', 'cancelled'];

export interface DriverAction {
  label: string;
  next: JobStatus;
  description: string;
}

/** Şoför iş akışı: her aksiyon işi bir sonraki duruma taşır. */
export const DRIVER_FLOW: Partial<Record<JobStatus, DriverAction>> = {
  assigned: { label: 'İşi kabul et', next: 'accepted', description: 'İşi üstlendiğinizi yöneticiye bildirir.' },
  accepted: { label: 'Yola çık', next: 'on_the_way', description: 'Yükleme adresine doğru yola çıktığınızı bildirir.' },
  on_the_way: { label: 'Yüklemeyi başlat', next: 'loading', description: 'Yükleme adresine vardığınızı ve yüklemeye başladığınızı bildirir.' },
  loading: { label: 'Teslimata geç', next: 'delivering', description: 'Yüklemenin bittiğini ve teslimata çıktığınızı bildirir.' },
  delivering: { label: 'İşi tamamla', next: 'completed', description: 'Teslimatın tamamlandığını bildirir.' },
};

export const isInProgress = (s: JobStatus) => IN_PROGRESS_STATUSES.includes(s);
export const isTrackable = (s: JobStatus) => TRACKABLE_STATUSES.includes(s);
export const isClosed = (s: JobStatus) => CLOSED_STATUSES.includes(s);
