import type { Customer, Invoice, TransportJob, User, Vehicle, VehicleLocation } from '@/types';
import { createStore, useStore } from './createStore';

export interface DataState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  users: User[];
  vehicles: Vehicle[];
  customers: Customer[];
  jobs: TransportJob[];
  invoices: Invoice[];
  locations: Record<string, VehicleLocation>;
}

const initialState: DataState = {
  status: 'idle',
  users: [],
  vehicles: [],
  customers: [],
  jobs: [],
  invoices: [],
  locations: {},
};

/**
 * İstemci tarafı önbellek. Servislerden gelen veriler burada tutulur,
 * ekranlar seçicilerle okur; tekrar eden servis çağrıları engellenir.
 */
export const dataStore = createStore<DataState>(initialState);

export const resetDataStore = () => dataStore.setState(initialState);

export const useData = <T,>(selector: (s: DataState) => T) => useStore(dataStore, selector);

export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}
