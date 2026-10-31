import { useCallback, useEffect, useMemo, useState } from 'react';

import { IN_PROGRESS_STATUSES, isInProgress } from '@/constants/jobStatus';
import { customerService, dashboardService, invoiceService } from '@/services';
import { errorMessage } from '@/services/errors';
import { matchesJobFilter } from '@/services/jobService';
import { useData } from '@/store';
import type { CustomerAddress, JobFilter, MonthRevenue, StopType, TransportJob, User, Vehicle, WithholdingType } from '@/types';
import { todayISO } from '@/utils/format';

export const useJobs = () => useData((s) => s.jobs);
export const useCustomers = () => useData((s) => s.customers);
export const useInvoices = () => useData((s) => s.invoices);
export const useUsers = () => useData((s) => s.users);
export const useVehicles = () => useData((s) => s.vehicles);
export const useVehicle = (id: string | undefined) => useData((s) => s.vehicles.find((v) => v.id === id));
export const useLocations = () => useData((s) => s.locations);
export const useDataStatus = () => useData((s) => s.status);

export const useJob = (id: string | undefined) => useData((s) => s.jobs.find((j) => j.id === id));
export const useCustomer = (id: string | undefined) => useData((s) => s.customers.find((c) => c.id === id));
export const useInvoice = (id: string | undefined) => useData((s) => s.invoices.find((i) => i.id === id));
export const useUser = (id: string | undefined) => useData((s) => s.users.find((u) => u.id === id));

export function useUserMap(): Map<string, User> {
  const users = useUsers();
  return useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
}

/** İş atanabilecek kullanıcılar: aktif şoförler ve yöneticiler. */
export function useAssignableUsers(): User[] {
  const users = useUsers();
  return useMemo(() => users.filter((u) => u.isActive).sort((a, b) => (a.role === b.role ? a.fullName.localeCompare(b.fullName, 'tr') : a.role === 'driver' ? -1 : 1)), [users]);
}

export function useFilteredJobs(filter: JobFilter): TransportJob[] {
  const jobs = useJobs();
  const userMap = useUserMap();
  return useMemo(
    () => jobs.filter((j) => matchesJobFilter(j, filter, j.driverId ? userMap.get(j.driverId)?.fullName : undefined)),
    [jobs, userMap, filter],
  );
}

/** Şoföre aktif olarak atanmış ve aktif durumdaki araçlar (iş atamasında seçilebilecekler). */
export function useDriverVehicles(driverId: string | undefined): Vehicle[] {
  const vehicles = useVehicles();
  return useMemo(() => (driverId ? vehicles.filter((v) => v.isActive && v.driverId === driverId) : []), [vehicles, driverId]);
}

interface RemoteState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload(): void;
}

/** Sunucudan veri çeken basit hook; anahtar değişince yeniden yükler. */
function useRemote<T>(key: string | null, load: () => Promise<T>): RemoteState<T> {
  const [nonce, setNonce] = useState(0);
  const requestKey = key ? `${key}#${nonce}` : null;
  const [result, setResult] = useState<{ key: string; data?: T; error: string | null } | null>(null);
  useEffect(() => {
    if (!requestKey) return;
    let alive = true;
    load()
      .then((data) => alive && setResult({ key: requestKey, data, error: null }))
      .catch((e) => alive && setResult({ key: requestKey, error: errorMessage(e, 'Veri alınamadı.') }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const fresh = result?.key === requestKey;
  return {
    data: fresh ? result?.data : undefined,
    loading: !!requestKey && !fresh,
    error: fresh ? (result?.error ?? null) : null,
    reload,
  };
}

/** Seçilen ayın geliri; hesap sunucuda (API modunda) yapılır. İş listesi değişince tazelenir. */
export function useMonthRevenue(year: number, month: number): RemoteState<MonthRevenue> {
  const jobs = useJobs();
  const completedKey = useMemo(() => jobs.filter((j) => j.status === 'completed').length, [jobs]);
  return useRemote(`${year}-${month}-${completedKey}`, () => dashboardService.revenue(year, month));
}

/** Müşterinin önceki işlerinde kullanılan adresler (koordinatlarıyla). */
export function useCustomerAddresses(customerId: string | undefined, type?: StopType): RemoteState<CustomerAddress[]> {
  return useRemote(customerId ? `${customerId}-${type ?? 'all'}` : null, () => customerService.addresses(customerId!, type));
}

/** KDV tevkifat kodları (API modunda sunucudan). */
export function useWithholdingTypes(): RemoteState<WithholdingType[]> {
  return useRemote('withholding-types', () => invoiceService.withholdingTypes());
}

export interface DashboardStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  /** Tamamlanmamış ve iptal edilmemiş işlerin toplam tutarı. Gelir sunucuda hesaplanır (useMonthRevenue). */
  openValue: number;
}

export function useDashboardStats(): DashboardStats {
  const jobs = useJobs();
  return useMemo(() => {
    const s: DashboardStats = { total: jobs.length, pending: 0, assigned: 0, inProgress: 0, completed: 0, cancelled: 0, openValue: 0 };
    for (const j of jobs) {
      if (j.status === 'pending') s.pending++;
      else if (j.status === 'assigned') s.assigned++;
      else if (IN_PROGRESS_STATUSES.includes(j.status)) s.inProgress++;
      else if (j.status === 'completed') s.completed++;
      else if (j.status === 'cancelled') s.cancelled++;
      if (j.status !== 'completed' && j.status !== 'cancelled') s.openValue += j.price;
    }
    return s;
  }, [jobs]);
}

export interface DriverJobs {
  active: TransportJob | undefined;
  today: TransportJob[];
  waiting: TransportJob[];
  open: TransportJob[];
  completed: TransportJob[];
}

/** Belirli bir kullanıcıya atanmış işleri şoför ekranları için gruplar. */
export function useDriverJobs(userId: string | undefined): DriverJobs {
  const jobs = useJobs();
  return useMemo(() => {
    const today = todayISO();
    const mine = jobs.filter((j) => j.driverId && j.driverId === userId);
    const open = mine.filter((j) => j.status !== 'completed' && j.status !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date));
    // En ileri aşamadaki iş aktif iş kabul edilir
    const active = open
      .filter((j) => isInProgress(j.status))
      .sort((a, b) => IN_PROGRESS_STATUSES.indexOf(b.status) - IN_PROGRESS_STATUSES.indexOf(a.status))[0];
    return {
      active,
      open,
      today: open.filter((j) => j.date === today),
      waiting: open.filter((j) => j.status === 'assigned'),
      completed: mine.filter((j) => j.status === 'completed'),
    };
  }, [jobs, userId]);
}

/** Müşteri bazında son işten iş formu için önerilen değerler. */
export function useCustomerLastJob(customerId: string | undefined): TransportJob | undefined {
  const jobs = useJobs();
  return useMemo(() => {
    if (!customerId) return undefined;
    return jobs.filter((j) => j.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  }, [jobs, customerId]);
}
