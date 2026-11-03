import { jobService, locationRepository } from '@/services';
import { ServiceError } from '@/services/errors';
import { sortJobs } from '@/services/jobUtils';
import type { JobChangedMessage, LiveLocationMessage } from '@/services/realtime/trackingHub';
import type { VehicleLocation } from '@/types';
import { dataStore, upsert } from './dataStore';

const set = dataStore.setState;

/**
 * Canlı konumu depoya işler. Yalnızca ilgili işin kaydı değişir (diğer araçların işaretçileri yeniden
 * çizilmez). Daha eski veya aynı zaman damgalı konum yenisini ezmez (çevrimdışı kuyruktan geç gelenler).
 */
export function applyLiveLocation(m: LiveLocationMessage) {
  const timestamp = Date.parse(m.recordedAt);
  if (!Number.isFinite(timestamp)) return;
  const current = dataStore.getState().locations[m.jobId];
  if (current && current.fix.timestamp >= timestamp) return;
  const next: VehicleLocation = {
    jobId: m.jobId,
    driverId: m.driverId,
    fix: { latitude: m.latitude, longitude: m.longitude, accuracy: m.accuracy, speed: m.speed, heading: m.heading, timestamp },
  };
  set((s) => ({ locations: { ...s.locations, [m.jobId]: next } }));
  // Depoda olmayan iş (ör. yeni atanmış): iş bilgisi de çekilir.
  if (!dataStore.getState().jobs.some((j) => j.id === m.jobId)) scheduleJobRefresh(m.jobId, false);
}

function forget(jobId: string) {
  set((s) => {
    const locations = { ...s.locations };
    delete locations[jobId];
    return { jobs: s.jobs.filter((j) => j.id !== jobId), locations };
  });
}

const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; removed: boolean }>();

/**
 * İş değişikliği ipucu: aynı iş için art arda gelen ipuçları birleştirilir ve iş sunucudan yeniden okunur.
 * Kısa gecikme, ipucunun veritabanı işlemi tamamlanmadan gelmesi ihtimaline karşıdır.
 */
function scheduleJobRefresh(jobId: string, removed: boolean) {
  const prev = pending.get(jobId);
  if (prev) clearTimeout(prev.timer);
  const timer = setTimeout(() => {
    const entry = pending.get(jobId);
    pending.delete(jobId);
    if (entry?.removed) {
      forget(jobId);
      return;
    }
    jobService.get(jobId).then(
      (job) =>
        set((s) => {
          const locations = { ...s.locations };
          if (job.status === 'completed' || job.status === 'cancelled' || !job.driverId) delete locations[job.id];
          return { jobs: upsert(s.jobs, job).sort(sortJobs), locations };
        }),
      (e) => {
        // Silinmiş veya artık bu kullanıcıya ait olmayan iş listeden kalkar.
        if (e instanceof ServiceError && (e.code === 'not_found' || e.code === 'forbidden')) forget(jobId);
      },
    );
  }, 800);
  pending.set(jobId, { timer, removed: removed || !!prev?.removed });
}

export function applyJobChanged(m: JobChangedMessage) {
  scheduleJobRefresh(m.jobId, m.removed);
}

/** Bağlantı koptuktan sonra kaçan konumlar tek istekle tamamlanır. */
export async function resyncLocations() {
  const list = await locationRepository.listActive();
  set((s) => {
    const locations: Record<string, VehicleLocation> = {};
    for (const l of list) {
      const cur = s.locations[l.jobId];
      locations[l.jobId] = cur && cur.fix.timestamp > l.fix.timestamp ? cur : l;
    }
    return { locations };
  });
}
