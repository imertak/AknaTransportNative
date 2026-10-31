export type Errors<T> = Partial<Record<keyof T, string>>;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Türkiye telefon numarası: 10 haneli (başında 0 olabilir) veya +90 ile. */
export const isPhone = (v: string) => {
  const d = v.replace(/\D/g, '');
  return /^(90)?0?\d{10}$/.test(d) && d.length >= 10 && d.length <= 12;
};

/** Vergi no 10 hane, TC kimlik no 11 hane. */
export const isTaxNumber = (v: string) => /^\d{10,11}$/.test(v.trim());

export const required = (v: string | undefined | null) => !!v && v.trim().length > 0;

export const hasErrors = <T,>(errors: Errors<T>) => Object.values(errors).some(Boolean);

/** API'nin şifre kuralı: en az 8 karakter, en az bir harf ve bir rakam. Uygunsa null döner. */
export function passwordProblem(v: string): string | null {
  if (v.length < 8) return 'Şifre en az 8 karakter olmalıdır.';
  if (v.length > 128) return 'Şifre en fazla 128 karakter olabilir.';
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v)) return 'Şifre en az bir harf içermelidir.';
  if (!/[0-9]/.test(v)) return 'Şifre en az bir rakam içermelidir.';
  return null;
}
