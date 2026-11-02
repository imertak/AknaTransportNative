import { useMemo } from 'react';

import { dataStore, useData } from '@/store';
import type { VehicleType, VehicleTypeDef } from '@/types';

/**
 * Hazır araç tiplerinin adları. Tipler sunucudan gelir ve yönetici yenilerini ekleyebilir; bu liste
 * yalnızca tipler henüz yüklenmemişken (veya eski sunucuda) ad göstermek için kullanılır.
 */
const DEFAULT_NAMES: Record<string, string> = {
  Panelvan: 'Panelvan',
  SmallPanelvan: 'Küçük Panelvan',
  Pickup: 'Kamyonet',
  Truck: 'Kamyon',
  Other: 'Diğer',
};

const DEFAULT_TYPES: VehicleTypeDef[] = Object.entries(DEFAULT_NAMES).map(([code, name], i) => ({ id: code, code, name, sortOrder: (i + 1) * 10, isActive: true }));

function labelFrom(types: VehicleTypeDef[], code: VehicleType): string {
  return types.find((t) => t.code === code)?.name ?? DEFAULT_NAMES[code] ?? code;
}

/** Araç tipinin adı (React dışı kullanım: PDF/HTML üretimi gibi). */
export function vehicleTypeLabel(code: VehicleType): string {
  return labelFrom(dataStore.getState().vehicleTypes, code);
}

/** Tüm araç tipleri (pasifler dahil); sunucudan gelmediyse hazır tipler. */
export function useAllVehicleTypes(): VehicleTypeDef[] {
  const types = useData((s) => s.vehicleTypes);
  return types.length ? types : DEFAULT_TYPES;
}

/** Ekranda tip adını göstermek için; tipler değişince yeniden çizilir. */
export function useVehicleTypeLabel(): (code: VehicleType) => string {
  const types = useData((s) => s.vehicleTypes);
  return useMemo(() => (code: VehicleType) => labelFrom(types, code), [types]);
}

/**
 * Seçim listesi: aktif tipler. Kaydın mevcut tipi pasife alınmışsa o da listede kalır ki düzenlemede kaybolmasın.
 */
export function useVehicleTypeOptions(current?: VehicleType | ''): { value: VehicleType; label: string }[] {
  const types = useAllVehicleTypes();
  return useMemo(
    () => types.filter((t) => t.isActive || t.code === current).map((t) => ({ value: t.code, label: t.isActive ? t.name : `${t.name} (pasif)` })),
    [types, current],
  );
}
