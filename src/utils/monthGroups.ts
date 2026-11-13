import { MONTH_NAMES } from './format';

/** Aylara bölünmüş listede bir satır: ay başlığı veya öğe. */
export type MonthRow<T> =
  | { kind: 'month'; key: string; /** "2026-11" (tarihsizse boş). */ month: string; label: string; items: T[] }
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
    rows.push({ kind: 'month', key: `month-${k}`, month: k, label: k ? monthLabel(k) : 'Tarihsiz', items: list });
    list.forEach((item, i) => rows.push({ kind: 'item', key: key(item), item, first: i === 0, last: i === list.length - 1 }));
  }
  return rows;
}

export const monthRowKey = <T,>(row: MonthRow<T>) => row.key;

/** "2026-11-13" → o haftanın pazartesisi "2026-11-09" (yerel takvim; saat dilimi kayması olmaz). */
function weekStart(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const offset = (date.getDay() + 6) % 7; // pazartesi 0 … pazar 6
  date.setDate(date.getDate() - offset);
  return date;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Pazartesi–pazar aralığı: "9–15 Kasım 2026", ay/yıl değişiyorsa "27 Ekim – 2 Kasım 2026". */
export function weekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const m1 = MONTH_NAMES[monday.getMonth()];
  const m2 = MONTH_NAMES[sunday.getMonth()];
  if (monday.getFullYear() !== sunday.getFullYear()) {
    return `${monday.getDate()} ${m1} ${monday.getFullYear()} – ${sunday.getDate()} ${m2} ${sunday.getFullYear()}`;
  }
  if (m1 !== m2) return `${monday.getDate()} ${m1} – ${sunday.getDate()} ${m2} ${sunday.getFullYear()}`;
  return `${monday.getDate()}–${sunday.getDate()} ${m1} ${sunday.getFullYear()}`;
}

/**
 * Listeyi haftalara (pazartesi–pazar) böler; her haftanın önüne başlık satırı ekler. Bu hafta ve geçen hafta
 * başlıkta belirtilir. `month` alanı haftanın pazartesisidir ("2026-11-09").
 */
export function groupByWeek<T>(items: readonly T[], date: (item: T) => string | undefined | null, key: (item: T) => string, today = new Date()): MonthRow<T>[] {
  const groups = new Map<string, { monday: Date | null; items: T[] }>();
  for (const item of items) {
    const value = date(item);
    const monday = value ? weekStart(value) : null;
    const k = monday ? isoDay(monday) : '';
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { monday, items: [] }));
    g.items.push(item);
  }
  const thisWeek = isoDay(weekStart(isoDay(today)));
  const lastWeekDate = weekStart(isoDay(today));
  lastWeekDate.setDate(lastWeekDate.getDate() - 7);
  const lastWeek = isoDay(lastWeekDate);

  const rows: MonthRow<T>[] = [];
  for (const [k, g] of groups) {
    const range = g.monday ? weekLabel(g.monday) : 'Tarihsiz';
    const label = k === thisWeek ? `Bu hafta · ${range}` : k === lastWeek ? `Geçen hafta · ${range}` : range;
    rows.push({ kind: 'month', key: `week-${k}`, month: k, label, items: g.items });
    g.items.forEach((item, i) => rows.push({ kind: 'item', key: key(item), item, first: i === 0, last: i === g.items.length - 1 }));
  }
  return rows;
}
