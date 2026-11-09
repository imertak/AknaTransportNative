import { MONTH_NAMES } from './format';

/** Aylara bölünmüş listede bir satır: ay başlığı veya öğe. */
export type MonthRow<T> =
  | { kind: 'month'; key: string; label: string; items: T[] }
  | { kind: 'item'; key: string; item: T; /** Ayın ilk/son öğesi (gruplu kart köşeleri için). */ first: boolean; last: boolean };

/** "2026-11-09" veya ISO tarih-saat → "2026-11" (tarih-saat yerel saate göre). */
function monthKey(value: string): string {
  if (value.length <= 10) return value.slice(0, 7);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "2026-11" → "Kasım 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[Number(m) - 1] ?? ''} ${y}`.trim();
}

/**
 * Listeyi aylara böler; her ayın önüne başlık satırı ekler. Ayların sırası listenin kendi sırasıdır
 * (yeniden eskiye sıralı liste yeni aydan başlar), ay içindeki öğelerin sırası korunur.
 */
export function groupByMonth<T>(items: readonly T[], date: (item: T) => string | undefined | null, key: (item: T) => string): MonthRow<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = date(item);
    const k = value ? monthKey(value) : '';
    let list = groups.get(k);
    if (!list) groups.set(k, (list = []));
    list.push(item);
  }
  const rows: MonthRow<T>[] = [];
  for (const [k, list] of groups) {
    rows.push({ kind: 'month', key: `month-${k}`, label: k ? monthLabel(k) : 'Tarihsiz', items: list });
    list.forEach((item, i) => rows.push({ kind: 'item', key: key(item), item, first: i === 0, last: i === list.length - 1 }));
  }
  return rows;
}

export const monthRowKey = <T,>(row: MonthRow<T>) => row.key;
