import { APP_CONFIG } from '@/constants/config';
import { DRIVER_FLOW, isClosed } from '@/constants/jobStatus';
import type { MockDatabase } from '@/data/seed';
import type { JobFilter, JobInput, JobStatus, TransportJob } from '@/types';
import { searchKey } from '@/utils/format';
import { buildRouteDescription, stopsOfType, toStops } from '@/utils/stops';
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
  const stops = toStops(input.stops);
  if (!stops.some((s) => s.type === 'pickup')) throw new ServiceError('validation', 'En az bir yükleme noktası girin.');
  if (!stops.some((s) => s.type === 'delivery')) throw new ServiceError('validation', 'En az bir teslimat noktası girin.');
  if (input.driverId && !db.users.some((u) => u.id === input.driverId && u.isActive)) {
    throw new ServiceError('validation', 'Seçilen şoför bulunamadı.');
  }
  ensureVehicle(db, input.driverId ?? null, input.vehicleId ?? null);
}

/** API ile aynı kural: araç seçilen şoföre aktif olarak atanmış ve aktif olmalı. */
function ensureVehicle(db: MockDatabase, driverId: string | null, vehicleId: string | null) {
  if (!vehicleId) return undefined;
  if (!driverId) throw new ServiceError('validation', 'Araç seçmek için önce şoför seçin.');
  const v = db.vehicles.find((x) => x.id === vehicleId);
  if (!v || !v.isActive || v.driverId !== driverId) {
    throw new ServiceError('validation', 'Seçilen araç bu şoföre atanmış aktif bir araç değil.');
  }
  return v;
}

/** Durakları ve onlardan türeyen özet alanları uygular. */
function applyStops(job: TransportJob, input: JobInput) {
  const stops = toStops(input.stops);
  job.stops = stops;
  job.routeDescription = buildRouteDescription(stops);
  const pickups = stopsOfType(stops, 'pickup');
  const deliveries = stopsOfType(stops, 'delivery');
  job.pickupAddress = pickups[0]!.address;
  job.pickupPoint = pickups[0]!.point;
  job.deliveryAddress = deliveries[deliveries.length - 1]!.address;
  job.deliveryPoint = deliveries[deliveries.length - 1]!.point;
}

function applyVehicle(db: MockDatabase, job: TransportJob, vehicleId: string | null | undefined) {
  const v = vehicleId ? db.vehicles.find((x) => x.id === vehicleId) : undefined;
  job.vehicleId = v?.id;
  job.vehiclePlate = v?.plate;
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
      const { stops: _stops, vehicleId, ...rest } = input;
      const job: TransportJob = {
        ...rest,
        id: createId('j'),
        pickupAddress: '',
        deliveryAddress: '',
        stops: [],
        routeDescription: '',
        billingStatus: 'not_invoiced',
        jobNo: sequenceNo(APP_CONFIG.jobNoPrefix, Number(input.date.slice(0, 4)), db.counters.job),
        customerName: customer.companyName,
        status: 'pending',
        statusHistory: [{ status: 'pending', at: now, byUserId: actorId }],
        createdBy: actorId,
        createdAt: now,
        updatedAt: now,
      };
      applyStops(job, input);
      applyVehicle(db, job, input.driverId ? vehicleId : null);
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
      const { stops: _stops, vehicleId, driverId, ...fields } = input;
      Object.assign(job, fields, { customerName: customer.companyName, updatedAt: new Date().toISOString() });
      applyStops(job, input);
      if (!isClosed(job.status)) {
        job.driverId = driverId;
        applyVehicle(db, job, driverId ? vehicleId : null);
        if (driverChanged) setStatus(job, driverId ? 'assigned' : 'pending', actorId, 'Şoför değiştirildi');
      }
      return job;
    }),

  assign: (id, driverId, actorId, vehicleId) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (isClosed(job.status)) throw new ServiceError('conflict', 'Kapanmış bir işin ataması değiştirilemez.');
      if (driverId && !db.users.some((u) => u.id === driverId && u.isActive)) {
        throw new ServiceError('validation', 'Seçilen şoför bulunamadı.');
      }
      ensureVehicle(db, driverId, vehicleId ?? null);
      const sameDriver = (driverId ?? undefined) === job.driverId;
      job.driverId = driverId ?? undefined;
      applyVehicle(db, job, vehicleId);
      // Yalnızca araç değiştiyse durum geçmişine kayıt eklenmez (API ile aynı).
      if (!sameDriver) {
        setStatus(job, driverId ? 'assigned' : 'pending', actorId);
        delete db.locations[job.id];
      } else {
        job.updatedAt = new Date().toISOString();
      }
      return job;
    }),

  takeOver: (id, actorId, vehicleId) =>
    mockDb.write((db) => {
      const job = find(db, id);
      if (isClosed(job.status)) throw new ServiceError('conflict', 'Kapanmış bir iş üstlenilemez.');
      ensureVehicle(db, actorId, vehicleId ?? null);
      job.driverId = actorId;
      applyVehicle(db, job, vehicleId);
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
