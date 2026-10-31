import type { LocationFix } from '@/types';

/** Arka plan görevinden ön plandaki ekranlara (aynı JS ortamında) bilgi aktarır. */
export type TrackingEvent =
  | { type: 'fix'; fix: LocationFix }
  | { type: 'published'; at: number; jobIds: string[]; pending: number }
  | { type: 'queued'; pending: number; reason: string }
  /** Sunucu aktif iş olmadığını bildirdi; takip durduruldu. */
  | { type: 'no_active_job' }
  | { type: 'error'; message: string };

type Listener = (e: TrackingEvent) => void;
const listeners = new Set<Listener>();

export const trackingEvents = {
  emit(e: TrackingEvent) {
    listeners.forEach((l) => {
      try {
        l(e);
      } catch {
        // dinleyici hatası görevi durdurmamalı
      }
    });
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
