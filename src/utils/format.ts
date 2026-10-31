import type { ISODate } from '@/types';

function groupThousands(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 36500 -> "36.500 TL", 1250.5 -> "1.250,50 TL" */
export function formatCurrency(value: number, opts: { decimals?: 'auto' | 0 | 2; suffix?: boolean } = {}): string {
  const { decimals = 'auto', suffix = true } = opts;
  const negative = value < 0;
  const abs = Math.abs(value);
  const useDecimals = decimals === 2 || (decimals === 'auto' && Math.round(abs * 100) % 100 !== 0);
  const fixed = abs.toFixed(useDecimals ? 2 : 0);
  const [int, frac] = fixed.split('.');
  const out = `${negative ? '-' : ''}${groupThousands(int)}${frac ? `,${frac}` : ''}`;
  return suffix ? `${out} TL` : out;
}

/** Kullanıcı girişini sayıya çevirir: "4.000", "4000,50", "4 000" */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/\s|TL/gi, '');
  if (!cleaned) return null;
  let normalized = cleaned;
  if (cleaned.includes(',')) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) normalized = cleaned.replace(/\./g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Fiyat alanı için yazarken biçimlendirme: "4000" -> "4.000" */
export function formatAmountInput(input: string): string {
  const [intRaw, fracRaw] = input.replace(/[^\d,]/g, '').split(',');
  const int = intRaw.replace(/^0+(?=\d)/, '');
  const grouped = groupThousands(int);
  return fracRaw !== undefined ? `${grouped},${fracRaw.slice(0, 2)}` : grouped;
}

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

export const MONTH_NAMES = MONTHS;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-19" -> "19.10.2026" */
export function formatDate(iso: ISODate | string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

/** "2026-10-19" -> "19 Eki" */
export function formatDateShort(iso: ISODate): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]}`;
}

/** "2026-10-19" -> "19 Ekim 2026, Pazartesi" */
export function formatDateLong(iso: ISODate): string {
  const date = fromISODate(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${WEEKDAYS[date.getDay()]}`;
}

/** ISO tarih-saat -> "19.10.2026 14:05" (yerel saat) */
export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(input: string | number): string {
  const d = new Date(input);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatRelative(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, Math.round((now - timestamp) / 1000));
  if (diff < 45) return 'az önce';
  if (diff < 3600) return `${Math.round(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.round(diff / 3600)} sa önce`;
  return formatDateTime(new Date(timestamp).toISOString());
}

/** Yerel saate göre YYYY-MM-DD */
export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromISODate(iso: ISODate): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const m = digits.match(/^0?(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toLocaleUpperCase('tr-TR'))
    .join('');
}

/** Türkçe karakterlere duyarlı, büyük/küçük harf bağımsız arama anahtarı. */
export function searchKey(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
