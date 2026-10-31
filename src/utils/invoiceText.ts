/**
 * Fatura yardımcıları: KDV tevkifatı, yazıyla tutar ve IBAN. API'deki hesaplarla birebir aynıdır
 * (Domain/Common/Withholding.cs, AmountInWords.cs, Iban.cs); demo modunda ve önizlemede kullanılır.
 */

export interface WithholdingType {
  code: string;
  /** KDV'nin alıcı tarafından kesilen yüzdesi (2/10 → 20). */
  rate: number;
  fraction: string;
  name: string;
}

const wt = (code: string, rate: number, name: string): WithholdingType => ({ code, rate, fraction: `${rate / 10}/10`, name });

/** Sık kullanılan KDV kısmi tevkifat kodları. API modunda tam liste sunucudan gelir. */
export const DEFAULT_WITHHOLDING_TYPES: WithholdingType[] = [
  wt('624', 20, 'Yük taşımacılığı hizmeti'),
  wt('614', 50, 'Servis taşımacılığı hizmeti'),
  wt('616', 50, 'Diğer hizmetler'),
  wt('603', 70, 'Makine, teçhizat, demirbaş ve taşıtlara ait tadil, bakım ve onarım hizmetleri'),
  wt('606', 90, 'İşgücü temin hizmetleri'),
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calculateWithholding(vatAmount: number, total: number, type: WithholdingType | null) {
  const withholdingAmount = type ? round2((vatAmount * type.rate) / 100) : 0;
  return { withholdingAmount, payableAmount: round2(total - withholdingAmount) };
}

const ONES = ['', 'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ'];
const TENS = ['', 'ON', 'YİRMİ', 'OTUZ', 'KIRK', 'ELLİ', 'ALTMIŞ', 'YETMİŞ', 'SEKSEN', 'DOKSAN'];
const SCALES = ['', 'BİN', 'MİLYON', 'MİLYAR'];

function hundreds(n: number): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const o = n % 10;
  return [h === 1 ? 'YÜZ' : h > 1 ? `${ONES[h]} YÜZ` : '', TENS[t], ONES[o]].filter(Boolean).join(' ');
}

export function numberInWords(n: number): string {
  if (n === 0) return 'SIFIR';
  const parts: string[] = [];
  for (let scale = SCALES.length - 1; scale >= 0; scale--) {
    const group = Math.floor(n / 1000 ** scale) % 1000;
    if (!group) continue;
    parts.push(scale === 1 && group === 1 ? 'BİN' : `${hundreds(group)} ${SCALES[scale]}`.trim());
  }
  return parts.join(' ');
}

/** 4640 → "YALNIZ: DÖRT BİN ALTI YÜZ KIRK TÜRK LİRASI". */
export function amountInWords(amount: number): string {
  const value = round2(Math.abs(amount));
  const whole = Math.floor(value);
  const cents = Math.round((value - whole) * 100);
  return `YALNIZ: ${numberInWords(whole)} TÜRK LİRASI${cents > 0 ? ` ${numberInWords(cents)} KURUŞ` : ''}`;
}

export const normalizeIban = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) return false;
  if (iban.startsWith('TR') && iban.length !== 26) return false;
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // Büyük sayıyı parça parça mod 97 alarak hesapla.
  let rem = 0;
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}

export const formatIban = (v: string) => normalizeIban(v).replace(/(.{4})/g, '$1 ').trim();
