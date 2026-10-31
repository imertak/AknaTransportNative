import type { VehicleType } from '@/types';

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  panelvan: 'Panelvan',
  small_panelvan: 'Küçük Panelvan',
  pickup: 'Kamyonet',
  truck: 'Kamyon',
  other: 'Diğer',
};

export const VEHICLE_TYPES = Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[];
