import type { User, ViewMode } from '@/types';

/** Merkezi yetki tanımları. Ekranlar rol yerine yetki sorgular. */
export type Permission =
  | 'jobs.create'
  | 'jobs.edit'
  | 'jobs.assign'
  | 'jobs.cancel'
  | 'jobs.viewAll'
  | 'jobs.viewPrice'
  | 'jobs.takeOver'
  | 'jobs.driverActions'
  | 'customers.manage'
  | 'invoices.manage'
  | 'reports.export'
  | 'map.fleet'
  | 'viewMode.switch';

const ADMIN_PERMISSIONS: Permission[] = [
  'jobs.create',
  'jobs.edit',
  'jobs.assign',
  'jobs.cancel',
  'jobs.viewAll',
  'jobs.viewPrice',
  'jobs.takeOver',
  'jobs.driverActions',
  'customers.manage',
  'invoices.manage',
  'reports.export',
  'map.fleet',
  'viewMode.switch',
];

const DRIVER_PERMISSIONS: Permission[] = ['jobs.driverActions'];

export function can(user: User | null | undefined, permission: Permission): boolean {
  if (!user || !user.isActive) return false;
  return (user.role === 'admin' ? ADMIN_PERMISSIONS : DRIVER_PERMISSIONS).includes(permission);
}

/** Kullanıcının açılışta göreceği varsayılan görünüm. */
export function defaultViewMode(user: User): ViewMode {
  return user.role === 'admin' ? 'admin' : 'driver';
}

export function canUseViewMode(user: User, mode: ViewMode): boolean {
  return mode === 'driver' || user.role === 'admin';
}
