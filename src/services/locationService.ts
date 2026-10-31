import { isTrackable } from '@/constants/jobStatus';
import type { VehicleLocation } from '@/types';
import type { LocationRepository } from './contracts';
import { ServiceError } from './errors';
import { mockDb } from './mockDb';

/**
 * Demo modu konum deposu (cihazda). API modunda konumlar /api/locations/me ile gönderilir.
 * Cihaz GPS'i ve arka plan görevi services/tracking altındadır.
 */
export const mockLocationRepository: LocationRepository = {
  publish: (location: VehicleLocation) =>
    mockDb.write((db) => {
      db.locations[location.jobId] = location;
    }, 0),
  publishMine: (driverId, fixes) =>
    mockDb.write((db) => {
      const jobs = db.jobs.filter((j) => j.driverId === driverId && isTrackable(j.status));
      if (!jobs.length) throw new ServiceError('conflict', 'Konum gönderilebilecek aktif bir işiniz yok.');
      const latest = fixes.reduce((a, b) => (b.timestamp > a.timestamp ? b : a));
      for (const j of jobs) db.locations[j.id] = { jobId: j.id, driverId, fix: latest };
      return jobs.map((j) => j.id);
    }, 0),
  listActive: () => mockDb.read((db) => Object.values(db.locations), 0),
  clear: (jobId: string) =>
    mockDb.write((db) => {
      delete db.locations[jobId];
    }, 0),
};
