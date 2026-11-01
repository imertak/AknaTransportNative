import type { JobFilter, TransportJob } from '@/types';
import { searchKey } from '@/utils/format';

export function matchesJobFilter(job: TransportJob, filter: JobFilter, driverName?: string): boolean {
  if (filter.statuses?.length && !filter.statuses.includes(job.status)) return false;
  if (filter.customerId && job.customerId !== filter.customerId) return false;
  if (filter.driverId && job.driverId !== filter.driverId) return false;
  if (filter.dateFrom && job.date < filter.dateFrom) return false;
  if (filter.dateTo && job.date > filter.dateTo) return false;
  if (filter.billingStatus && job.billingStatus !== filter.billingStatus) return false;
  if (filter.query) {
    const q = searchKey(filter.query.trim());
    const hay = searchKey(
      [
        job.jobNo,
        job.customerName,
        job.storeName,
        job.routeDescription,
        ...job.stops.map((s) => s.address),
        job.description,
        job.vehiclePlate ?? '',
        driverName ?? '',
      ].join(' '),
    );
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const sortJobs = (a: TransportJob, b: TransportJob) =>
  b.date.localeCompare(a.date) || b.jobNo.localeCompare(a.jobNo);
