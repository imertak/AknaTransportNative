import type { JobStop, JobStopInput, StopType } from '@/types';

/** API ile aynı kural: güzergah açıklaması en fazla 2000 karakter, noktalar " - " ile ayrılır. */
export const ROUTE_SEPARATOR = ' - ';
const ROUTE_MAX_LENGTH = 2000;

const typeOrder = (t: StopType) => (t === 'pickup' ? 0 : 1);

/** Önce tüm yükleme, sonra tüm teslimat noktaları; tür içinde sıra numarasına göre. */
export function orderStops<T extends Pick<JobStop, 'type' | 'sequence'>>(stops: T[]): T[] {
  return [...stops].sort((a, b) => typeOrder(a.type) - typeOrder(b.type) || a.sequence - b.sequence);
}

/** Form girdisini sıra numaralı duraklara çevirir. Boş adresler atlanır. */
export function toStops(input: JobStopInput[]): JobStop[] {
  const counters: Record<StopType, number> = { pickup: 0, delivery: 0 };
  const cleaned = input
    .map((s) => ({ ...s, address: s.address.trim(), description: s.description?.trim() || undefined }))
    .filter((s) => s.address);
  // Kullanıcının girdiği sıra korunur; türler kendi içinde numaralanır.
  return orderStops(cleaned.map((s) => ({ ...s, sequence: ++counters[s.type] })));
}

export function buildRouteDescription(stops: Pick<JobStop, 'type' | 'sequence' | 'address'>[]): string {
  const text = orderStops(stops)
    .map((s) => s.address.trim())
    .filter(Boolean)
    .join(ROUTE_SEPARATOR);
  return text.length > ROUTE_MAX_LENGTH ? `${text.slice(0, ROUTE_MAX_LENGTH - 1)}…` : text;
}

export const stopsOfType = <T extends Pick<JobStop, 'type' | 'sequence'>>(stops: T[], type: StopType) =>
  orderStops(stops.filter((s) => s.type === type));

/** PDF ve listeler için güzergah + elle yazılan açıklama. */
export function composeJobText(route: string, description: string): string {
  const r = route.trim();
  const d = description.trim();
  if (r && d) return `${r} (${d})`;
  return r || d;
}

export const STOP_TYPE_LABEL: Record<StopType, string> = { pickup: 'Yükleme', delivery: 'Teslimat' };
