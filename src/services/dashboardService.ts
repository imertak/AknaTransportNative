import type { DashboardService } from './contracts';
import { ServiceError } from './errors';
import { mockDb } from './mockDb';

/** API ile aynı kural: seçilen ayın tamamlanmış (iptal edilmemiş) işleri. */
export const mockDashboardService: DashboardService = {
  revenue: (year, month) =>
    mockDb.read((db) => {
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
        throw new ServiceError('validation', 'Geçersiz ay veya yıl.');
      }
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const jobs = db.jobs.filter((j) => j.status === 'completed' && j.date.startsWith(prefix));
      return { year, month, revenue: jobs.reduce((s, j) => s + j.price, 0), completedJobs: jobs.length, currency: 'TRY' };
    }),
};
