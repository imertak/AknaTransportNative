import { APP_CONFIG } from '@/constants/config';
import { DRIVER_FLOW, isClosed } from '@/constants/jobStatus';
import type { MockDatabase } from '@/data/seed';
import type { JobFilter, JobInput, JobStatus, TransportJob } from '@/types';
import { searchKey } from '@/utils/format';
import { createId, sequenceNo } from '@/utils/id';
import type { JobService } from './contracts';
import { ServiceError } from './errors';
import { mockDb } from './mockDb';

export function matchesJobFilter(job: TransportJob, filter: JobFilter, driverName?: string): boolean {
  if (filter.statuses?.length && !filter.statuses.includes(job.status)) return false;
  if (filter.customerId && job.customerId !== filter.customerId) return false;
  if (filter.driverId && job.driverId !== filter.driverId) return false;
  if (filter.dateFrom && job.date < filter.dateFrom) return false;
  if (filter.dateTo && job.date > filter.dateTo) return false;
  if (filter.query) {
    const q = searchKey(filter.query.trim());
    const hay = searchKey(
      [job.jobNo, job.customerName, job.storeName, job.pickupAddress, job.deliveryAddress, job.description, driverName ?? ''].join(' '),
    );
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const sortJobs = (a: TransportJob, b: TransportJob) =>
  b.date.localeCompare(a.date) || b.jobNo.localeCompare(a.jobNo);

function find(db: MockDatabase, id: string): TransportJob {
  const job = db.jobs.find((j) => j.id === id);
  if (!job) throw new ServiceError('not_found', 'İş kaydı bulunamadı.');
  return job;
}

function setStatus(job: TransportJob, status: JobStatus, actorId: string, note?: string) {
  const now = new Date().toISOString();
  job.status = status;
  job.statusHistory.push({ status, at: now, byUserId: actorId, note });
  job.updatedAt = now;
}

function validate(db: MockDatabase, input: JobInput) {
  if (!db.customers.some((c) => c.id === input.customerId)) throw new ServiceError('validation', 'Müşteri bulunamadı.');
  if (!(input.price > 0)) throw new ServiceError('validation', 'Fiyat sıfırdan büyük olmalı.');
  if (input.driverId && !db.users.some((u) => u.id === input.driverId && u.isActive)) {
    throw new ServiceError('validation', 'Seçilen şoför bulunamadı.');
  }
}

export const mockJobService: JobService = {
  list: (filter = {}) =>
    mockDb.read((db) => {
      const names = new Map(db.users.map((u) => [u.id, u.fullName]));
      return db.jobs.filter((j) => matchesJobFilter(j, filter, j.driverId ? names.get(j.driverId) : undefined)).sort(sortJobs);
    }),

  get: (id) => mockDb.read((db) => find(db, id)),

  create: (input, actorId) =>
    mockDb.write((db) => {
      validate(db, input);
      const customer = db.customers.find((c) => c.id === input.customerId)!;
      const now = new Date().toISOString();
      db.counters.job += 1;
      const job: TransportJob = {
        ...input,
        id: createId('j'),
        jobNo: sequenceNo(APP_CONFIG.jobNoPrefix, Number(input.date.slice(0, 4)), db.counters.job),
        customerName: customer.companyName,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: now, byUserId: actorId }],
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
      };
      if (input.driverId) setStatus(job, 'assigned', actorId);
      db.jobs.push(job);
      return job;
    }),

  update: (id, input, actorId) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (job.status === 'cancelled') throw new ServiceError('conflict', 'İptal edilmiş iş düzenlenemez.');
      validate(db, input);
      const customer = db.customers.find((c) => c.id === input.customerId)!;
      const driverChanged = (input.driverId ?? undefined) !== job.driverId;
      Object.assign(job, input, { customerName: customer.companyName, updatedAt: new Date().toISOString() });
      if (driverChanged && !isClosed(job.status)) {
        setStatus(job, input.driverId ? 'assigned' : 'pending', actorId, 'Şoför değiştirildi');
      }
      return job;
    }),

  assign: (id, driverId, actorId) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (isClosed(job.status)) throw new ServiceError('conflict', 'Kapanmış bir işin ataması değiştirilemez.');
      if (driverId && !db.users.some((u) => u.id === driverId && u.isActive)) {
        throw new ServiceError('validation', 'Seçilen şoför bulunamadı.');
      }
      job.driverId = driverId ?? undefined;
      setStatus(job, driverId ? 'assigned' : 'pending', actorId);
      delete db.locations[job.id];
      return job;
    }),

  takeOver: (id, actorId) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (isClosed(job.status)) throw new ServiceError('conflict', 'Kapanmış bir iş üstlenilemez.');
      job.driverId = actorId;
      setStatus(job, 'accepted', actorId, 'İş yönetici tarafından üstlenildi');
      return job;
    }),

  advance: (id, next, actorId) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (job.driverId !== actorId) throw new ServiceError('forbidden', 'Bu iş size atanmamış.');
      const action = DRIVER_FLOW[job.status];
      if (!action || action.next !== next) {
        throw new ServiceError('conflict', 'İşin durumu değişmiş. Lütfen sayfayı yenileyin.');
      }
      setStatus(job, next, actorId);
      if (next === 'completed') delete db.locations[job.id];
      return job;
    }),

  cancel: (id, actorId, reason) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (isClosed(job.status)) throw new ServiceError('conflict', 'Bu iş zaten kapanmış.');
      setStatus(job, 'cancelled', actorId, reason);
      delete db.locations[job.id];
      return job;
    }),
};
