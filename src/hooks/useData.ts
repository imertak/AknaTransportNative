import { useMemo } from 'react';

import { IN_PROGRESS_STATUSES, isInProgress } from '@/constants/jobStatus';
import { matchesJobFilter } from '@/services/jobService';
import { useData } from '@/store';
import type { JobFilter, TransportJob, User } from '@/types';
import { todayISO } from '@/utils/format';

export const useJobs = () => useData((s) => s.jobs);
export const useCustomers = () => useData((s) => s.customers);
export const useInvoices = () => useData((s) => s.invoices);
export const useUsers = () => useData((s) => s.users);
export const useVehicles = () => useData((s) => s.vehicles);
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

export interface DashboardStats {
  total: number;
  pending: number;
  assigned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  revenue: number;
  openValue: number;
}

export function useDashboardStats(): DashboardStats {
  const jobs = useJobs();
  return useMemo(() => {
    const s: DashboardStats = { total: jobs.length, pending: 0, assigned: 0, inProgress: 0, completed: 0, cancelled: 0, revenue: 0, openValue: 0 };
    for (const j of jobs) {
      if (j.status === 'pending') s.pending++;
      else if (j.status === 'assigned') s.assigned++;
      else if (IN_PROGRESS_STATUSES.includes(j.status)) s.inProgress++;
      else if (j.status === 'completed') s.completed++;
      else if (j.status === 'cancelled') s.cancelled++;
      if (j.status === 'completed') s.revenue += j.price;
      else if (j.status !== 'cancelled') s.openValue += j.price;
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
