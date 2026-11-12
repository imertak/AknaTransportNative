import {
  customerService,
  eArchiveGateway,
  invoiceMailer,
  invoiceService,
  jobService,
  locationRepository,
  userService,
  vehicleService,
} from '@/services';
import { notifyAccountsChanged } from '@/services/accounts';
import { errorMessage } from '@/services/errors';
import type { PickedFile } from '@/services/files';
import { sortJobs } from '@/services/jobUtils';
import type { UserInput } from '@/services/contracts';
import type { CustomerInput, InvoiceInput, JobInput, JobStatus, User, Vehicle, VehicleInput, VehicleTypeDef } from '@/types';
import { dataStore, upsert } from './dataStore';

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
      const [users, vehicles, vehicleTypes, customers, jobs, invoices, locations] = await Promise.all([
        userService.list(),
        userService.listVehicles(),
        // Araç tipleri eklenmeden önceki sunucularda uç nokta yoktur; o durumda hazır adlar kullanılır.
        vehicleService.listTypes().catch(() => [] as VehicleTypeDef[]),
        customerService.list(),
        jobService.list(),
        invoiceService.list(),
        locationRepository.listActive(),
      ]);
      set({
        status: 'ready',
        users,
        vehicles,
        vehicleTypes: sortTypes(vehicleTypes),
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

function forgetJob(id: string) {
  set((s) => {
    const locations = { ...s.locations };
    delete locations[id];
    return { jobs: s.jobs.filter((j) => j.id !== id), locations };
  });
}

export const jobActions = {
  /** Detay ekranı için işi (durum geçmişiyle) sunucudan tazeler. */
  refresh: async (id: string) => patchJob(await jobService.get(id)),
  /**
   * Bildirim gelince ilgili işi tazeler. İş artık görülemiyorsa (şoförden alındı, silindi) yerel listeden çıkarılır.
   */
  async sync(id: string) {
    try {
      await jobActions.refresh(id);
    } catch {
      forgetJob(id);
    }
  },
  create: async (input: JobInput, actorId: string) => patchJob(await jobService.create(input, actorId)),
  update: async (id: string, input: JobInput, actorId: string) => patchJob(await jobService.update(id, input, actorId)),
  assign: async (id: string, driverId: string | null, actorId: string, vehicleId?: string | null) =>
    patchJob(await jobService.assign(id, driverId, actorId, vehicleId)),
  takeOver: async (id: string, actorId: string, vehicleId?: string | null) => patchJob(await jobService.takeOver(id, actorId, vehicleId)),
  advance: async (id: string, next: JobStatus, actorId: string) => patchJob(await jobService.advance(id, next, actorId)),
  /** İptal: iş listede kalır (İptal durumu), canlı konumu yerel haritadan düşer. */
  cancel: async (id: string, actorId: string, reason: string) => patchJob(await jobService.cancel(id, actorId, reason)),
  /** Mantıksal silme: iş tüm yerel listelerden ve haritadan kaldırılır; sunucuda geçmişiyle saklanır. */
  async remove(id: string, reason?: string) {
    await jobService.remove(id, reason);
    forgetJob(id);
  },
  /** Silinmiş işi geri alır ve yerel listelere ekler. */
  restore: async (id: string) => patchJob(await jobService.restore(id)),
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

const sortTypes = (list: VehicleTypeDef[]) => [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'tr'));

function patchType(t: VehicleTypeDef) {
  set((s) => ({ vehicleTypes: sortTypes(upsert(s.vehicleTypes, t)) }));
  return t;
}

const sortVehicles = (list: Vehicle[]) =>
  list.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.plate.localeCompare(b.plate, 'tr'));

function patchVehicle(v: Vehicle) {
  set((s) => ({ vehicles: sortVehicles(upsert(s.vehicles, v)) }));
  return v;
}

const sortUsers = (list: User[]) =>
  list.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName, 'tr'));

function patchUser(u: User) {
  set((s) => ({ users: sortUsers(upsert(s.users, u)) }));
  return u;
}

/** Şoför (kullanıcı) ekleme, düzenleme ve şifre sıfırlama yalnızca yöneticide. */
export const userActions = {
  refresh: async () => set({ users: sortUsers(await userService.list()) }),
  async create(input: UserInput) {
    const result = await userService.create(input);
    patchUser(result.user);
    return result;
  },
  async update(id: string, input: UserInput & { isActive: boolean }) {
    const user = patchUser(await userService.update(id, input));
    if (!input.isActive) await vehicleActions.refresh().catch(() => {});
    return user;
  },
  async resetPassword(id: string) {
    const result = await userService.resetPassword(id);
    patchUser(result.user);
    return result;
  },
};

/** Araç kaydı ve şoföre atama yalnızca yöneticiye açıktır (API de aynı kuralı uygular). */
export const vehicleActions = {
  refresh: async () => set({ vehicles: sortVehicles(await userService.listVehicles()) }),
  create: async (input: VehicleInput) => patchVehicle(await vehicleService.create(input)),
  update: async (id: string, input: VehicleInput) => patchVehicle(await vehicleService.update(id, input)),
  assign: async (id: string, driverId: string) => patchVehicle(await vehicleService.assign(id, driverId)),
  unassign: async (id: string) => patchVehicle(await vehicleService.unassign(id)),
  refreshTypes: async () => set({ vehicleTypes: sortTypes(await vehicleService.listTypes()) }),
  createType: async (name: string) => patchType(await vehicleService.createType(name)),
  updateType: async (id: string, input: { name: string; isActive: boolean }) => patchType(await vehicleService.updateType(id, input)),
};

async function refreshInvoice(id: string) {
  const inv = await invoiceService.get(id);
  set((s) => ({ invoices: upsert(s.invoices, inv) }));
  return inv;
}

export const invoiceActions = {
  refresh: refreshInvoice,
  /** Faturayı e-Arşiv sağlayıcısına gönderir. Sağlayıcı yoksa hata döner ve fatura taslak kalır. */
  async issue(id: string) {
    await eArchiveGateway.issue(id);
    const inv = await refreshInvoice(id);
    // Yalnızca sağlayıcıdan başarılı sonuç geldiyse işler "Faturalandırıldı" olur.
    if (inv.status === 'earsiv_issued') {
      const ids = new Set(inv.jobIds?.length ? inv.jobIds : [inv.jobId]);
      set((s) => ({ jobs: s.jobs.map((j) => (ids.has(j.id) ? { ...j, billingStatus: 'invoiced' as const } : j)) }));
    }
    return inv;
  },
  sendSignSms: (id: string) => eArchiveGateway.sendSignSms(id),
  /** SMS koduyla imzalar. İşler yalnızca GİB imzayı onaylarsa "Faturalandırıldı" olur. */
  async sign(id: string, operationId: string, code: string) {
    const inv = await eArchiveGateway.sign(id, operationId, code);
    const ids = new Set(inv.jobIds?.length ? inv.jobIds : [inv.jobId]);
    set((s) => ({
      invoices: upsert(s.invoices, inv),
      jobs: inv.status === 'earsiv_issued' ? s.jobs.map((j) => (ids.has(j.id) ? { ...j, billingStatus: 'invoiced' as const } : j)) : s.jobs,
    }));
    return inv;
  },
  /** Faturayı (taslak dahil) iş dökümüyle müşteriye e-postayla gönderir. Fatura durumu değişmez. */
  async sendEmail(id: string) {
    const inv = await invoiceMailer.send(id);
    set((s) => ({ invoices: upsert(s.invoices, inv) }));
    return inv;
  },
  /** Başka yerde kesilen faturanın PDF'ini yükler; işler "Faturalandırıldı" olur ve cari bakiye tazelenir. */
  async uploadManualPdf(id: string, file: PickedFile, invoiceNumber?: string) {
    const inv = await invoiceService.uploadManualPdf(id, file, invoiceNumber);
    const ids = new Set(inv.jobIds?.length ? inv.jobIds : [inv.jobId]);
    set((s) => ({
      invoices: upsert(s.invoices, inv),
      jobs: inv.status === 'earsiv_issued' ? s.jobs.map((j) => (ids.has(j.id) ? { ...j, billingStatus: 'invoiced' as const } : j)) : s.jobs,
    }));
    notifyAccountsChanged();
    return inv;
  },
  async discardDraft(id: string) {
    const inv = await eArchiveGateway.discardDraft(id);
    set((s) => ({ invoices: upsert(s.invoices, inv) }));
    return inv;
  },
  async createDemo(input: InvoiceInput, actorId: string) {
    const inv = await invoiceService.createDemo(input, actorId);
    // Kayıtlı olmayan müşteriye kesilen fatura müşteriyi de kaydeder; listede görünsün.
    if (input.newCustomer) {
      const c = await customerService.get(inv.customerId).catch(() => null);
      if (c) set((s) => ({ customers: upsert(s.customers, c).sort((a, b) => a.companyName.localeCompare(b.companyName, 'tr')) }));
    }
    const jobIdSet = new Set(inv.jobIds?.length ? inv.jobIds : [inv.jobId]);
    set((s) => ({
      invoices: [inv, ...s.invoices.filter((i) => i.id !== inv.id)],
      jobs: s.jobs.map((j) => (jobIdSet.has(j.id) ? { ...j, invoiceId: inv.id, billingStatus: 'in_draft' as const } : j)),
    }));
    return inv;
  },
  async cancel(id: string) {
    const inv = await invoiceService.cancel(id);
    const jobIdSet = new Set(inv.jobIds?.length ? inv.jobIds : [inv.jobId]);
    set((s) => ({
      invoices: upsert(s.invoices, inv),
      jobs: s.jobs.map((j) => (jobIdSet.has(j.id) ? { ...j, invoiceId: undefined, billingStatus: 'not_invoiced' as const } : j)),
    }));
    return inv;
  },
  /** İptal edilmiş faturayı kalıcı olarak siler (işler iptalde zaten faturadan çıkarılmıştır). */
  async remove(id: string) {
    await invoiceService.remove(id);
    set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
    return true;
  },
};

export const locationActions = {
  async refresh() {
    const list = await locationRepository.listActive();
    set({ locations: Object.fromEntries(list.map((l) => [l.jobId, l])) });
  },
};
