import {
  customerService,
  invoiceService,
  jobService,
  locationRepository,
  mockDb,
  userService,
} from '@/services';
import { errorMessage } from '@/services/errors';
import { sortJobs } from '@/services/jobService';
import type { CustomerInput, InvoiceInput, JobInput, JobStatus, VehicleLocation } from '@/types';
import { dataStore, resetDataStore, upsert } from './dataStore';

const set = dataStore.setState;

let inflight: Promise<void> | null = null;

/** Tüm temel verileri tek seferde yükler. Eşzamanlı çağrılar birleştirilir. */
export function loadAll(force = false): Promise<void> {
  const { status } = dataStore.getState();
  if (!force && status === 'ready') return Promise.resolve();
  if (inflight) return inflight;
  if (status !== 'ready') set({ status: 'loading', error: undefined });
  inflight = (async () => {
    try {
      const [users, vehicles, customers, jobs, invoices, locations] = await Promise.all([
        userService.list(),
        userService.listVehicles(),
        customerService.list(),
        jobService.list(),
        invoiceService.list(),
        locationRepository.listActive(),
      ]);
      set({
        status: 'ready',
        users,
        vehicles,
        customers,
        jobs,
        invoices,
        locations: Object.fromEntries(locations.map((l) => [l.jobId, l])),
      });
    } catch (e) {
      set({ status: 'error', error: errorMessage(e, 'Veriler yüklenemedi.') });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export const refreshAll = () => loadAll(true);

function patchJob(job: Awaited<ReturnType<typeof jobService.get>>) {
  set((s) => {
    const locations = { ...s.locations };
    if (job.status === 'completed' || job.status === 'cancelled' || !job.driverId) delete locations[job.id];
    return { jobs: upsert(s.jobs, job).sort(sortJobs), locations };
  });
  return job;
}

export const jobActions = {
  create: async (input: JobInput, actorId: string) => patchJob(await jobService.create(input, actorId)),
  update: async (id: string, input: JobInput, actorId: string) => patchJob(await jobService.update(id, input, actorId)),
  assign: async (id: string, driverId: string | null, actorId: string) => patchJob(await jobService.assign(id, driverId, actorId)),
  takeOver: async (id: string, actorId: string) => patchJob(await jobService.takeOver(id, actorId)),
  advance: async (id: string, next: JobStatus, actorId: string) => patchJob(await jobService.advance(id, next, actorId)),
  cancel: async (id: string, actorId: string, reason?: string) => patchJob(await jobService.cancel(id, actorId, reason)),
};

export const customerActions = {
  async create(input: CustomerInput) {
    const c = await customerService.create(input);
    set((s) => ({ customers: upsert(s.customers, c).sort((a, b) => a.companyName.localeCompare(b.companyName, 'tr')) }));
    return c;
  },
  async update(id: string, input: CustomerInput) {
    const c = await customerService.update(id, input);
    set((s) => ({
      customers: upsert(s.customers, c),
      jobs: s.jobs.map((j) => (j.customerId === id && j.customerName !== c.companyName ? { ...j, customerName: c.companyName } : j)),
      invoices: s.invoices.map((i) => (i.customerId === id && i.mode === 'demo' && i.customerName !== c.companyName ? { ...i, customerName: c.companyName } : i)),
    }));
    return c;
  },
  async remove(id: string) {
    await customerService.remove(id);
    set((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
  },
};

export const invoiceActions = {
  async createDemo(input: InvoiceInput, actorId: string) {
    const inv = await invoiceService.createDemo(input, actorId);
    set((s) => ({
      invoices: [inv, ...s.invoices.filter((i) => i.id !== inv.id)],
      jobs: s.jobs.map((j) => (j.id === inv.jobId ? { ...j, invoiceId: inv.id } : j)),
    }));
    return inv;
  },
  async cancel(id: string) {
    const inv = await invoiceService.cancel(id);
    set((s) => ({
      invoices: upsert(s.invoices, inv),
      jobs: s.jobs.map((j) => (j.invoiceId === id ? { ...j, invoiceId: undefined } : j)),
    }));
    return inv;
  },
};

export const locationActions = {
  async publish(location: VehicleLocation) {
    set((s) => ({ locations: { ...s.locations, [location.jobId]: location } }));
    await locationRepository.publish(location);
  },
  async refresh() {
    const list = await locationRepository.listActive();
    set({ locations: Object.fromEntries(list.map((l) => [l.jobId, l])) });
  },
};

/** Demo verilerini başlangıç durumuna döndürür. */
export async function resetDemoData() {
  await mockDb.reset();
  resetDataStore();
  await loadAll(true);
}
